import { NextRequest } from 'next/server';
import { randomUUID } from 'crypto';

// Generic proxy: forwards same-origin requests under /api/proxy/* to the upstream backend.
// Preserves method, headers (except some hop-by-hop headers), body, and response status/content-type.
const CONFIGURED_BACKEND = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || '';
const DEBUG_PROXY = process.env.DEBUG_PROXY === '1';

function debugLog(...args: unknown[]) {
	if (DEBUG_PROXY) console.log(...args);
}

// Log backend target once at module load so it appears in Vercel/dev server logs.
debugLog('[proxy] CONFIGURED_BACKEND =', CONFIGURED_BACKEND || '(not set)');

function sleep(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientStatus(status: number) {
	return status === 502 || status === 503 || status === 504;
}

// Default timeout for most requests; Messages GET uses a longer timeout because
// backend queries can be slow under load.
const DEFAULT_TIMEOUT_MS = 12000;
const MESSAGES_TIMEOUT_MS = 25000;

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = DEFAULT_TIMEOUT_MS) {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), timeoutMs);
	try {
		return await fetch(url, { ...init, signal: controller.signal });
	} finally {
		clearTimeout(timeout);
	}
}

async function proxyHandler(req: NextRequest) {
	try {
		if (!CONFIGURED_BACKEND) {
			return new Response(
				JSON.stringify({
					error: 'Proxy misconfiguration',
					message: 'BACKEND_URL is not configured for this deployment.',
				}),
				{ status: 500, headers: { 'Content-Type': 'application/json' } }
			);
		}

		// Determine upstream path by removing the /api/proxy prefix
		const url = new URL(req.url);
		const rel = url.pathname.replace(/^\/api\/proxy/, '');
		// If the client requested /api/proxy/Chats (no '/api' after proxy),
		// most backend endpoints live under '/api/*' so ensure we preserve that.
		const relWithApi = rel.startsWith('/api') ? rel : '/api' + rel;
		const upstream = CONFIGURED_BACKEND.replace(/\/+$/, '') + relWithApi + (url.search || '');

		const init: RequestInit = {
			method: req.method,
			// forward body for non-GET/HEAD
			body: undefined,
			redirect: 'follow',
		};

		// Copy headers except host and some hop-by-hop headers
		const skip = new Set(['host', 'connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization', 'te', 'trailer', 'transfer-encoding', 'upgrade']);
		const forwardHeaders: Record<string, string> = {};
		req.headers.forEach((value, key) => {
			if (!skip.has(key.toLowerCase())) forwardHeaders[key] = value;
		});
		init.headers = forwardHeaders;

		if (req.method !== 'GET' && req.method !== 'HEAD') {
			try {
				const buf = await req.arrayBuffer();
				init.body = buf.byteLength ? Buffer.from(buf) : undefined;
			} catch (e) {
				// ignore body read errors
			}
		}

		// Assign a request id for end-to-end tracing.
		const requestId = (req.headers.get('x-request-id') || randomUUID()) as string;

		const isMessagesGet = req.method === 'GET' && /\/api\/Messages/i.test(relWithApi);
		const shouldLogSendFailure =
			req.method === 'POST' &&
			(/\/api\/Messages\/send$/i.test(relWithApi) || /\/api\/Messages$/i.test(relWithApi));

		// Log auth presence for every Messages GET to confirm token forwarding.
		if (isMessagesGet) {
			debugLog('[proxy] Messages GET', {
				requestId,
				upstream,
				authHeaderPresent: Boolean(forwardHeaders['authorization']),
				cookieHeaderPresent: Boolean(forwardHeaders['cookie']),
			});
		}

		if (shouldLogSendFailure) {
			debugLog('[proxy] Forwarding send request', {
				requestId,
				upstream,
				method: req.method,
				authHeaderPresent: Boolean(forwardHeaders['authorization']),
				cookieHeaderPresent: Boolean(forwardHeaders['cookie']),
			});
		}

		// Choose appropriate timeout.
		const timeoutMs = isMessagesGet ? MESSAGES_TIMEOUT_MS : DEFAULT_TIMEOUT_MS;

		const isAuthLogin = req.method === 'POST' && /\/api\/Auth\/login$/i.test(relWithApi);
		let res: Response;
		try {
			res = await fetchWithTimeout(upstream, init, timeoutMs);
		} catch (err) {
			const isAbort = err instanceof Error && (err.name === 'AbortError' || err.message.includes('aborted'));
			// Retry once on abort/timeout for GET (idempotent) and login cold-start.
			if ((isMessagesGet && isAbort) || isAuthLogin) {
				console.warn('[proxy] Retrying after abort/timeout', { requestId, upstream });
				await sleep(350);
				res = await fetchWithTimeout(upstream, init, timeoutMs);
			} else {
				throw err;
			}
		}

		if (isAuthLogin && isTransientStatus(res.status)) {
			await sleep(350);
			res = await fetchWithTimeout(upstream, init, 15000);
		}

		// Build response headers to return to client
		const resHeaders: Record<string, string> = {};
		res.headers.forEach((v, k) => {
			// Avoid exposing backend's CORS headers; we control same-origin responses
			if (k.toLowerCase() === 'access-control-allow-origin') return;
			resHeaders[k] = v;
		});
		// Always echo request id so browser Network tab and backend logs can be correlated.
		resHeaders['x-request-id'] = requestId;

		const body = await res.arrayBuffer();
		if (isMessagesGet && res.status >= 400) {
			const preview = Buffer.from(body).toString('utf8').slice(0, 500);
			console.error('[proxy] Messages GET failed', { requestId, upstream, status: res.status, preview });
		}
		if (shouldLogSendFailure && res.status >= 400) {
			const bodyText = Buffer.from(body).toString('utf8');
			console.error('[proxy] Send request failed', {
				upstream,
				status: res.status,
				contentType: res.headers.get('content-type') || '',
				bodyPreview: bodyText.slice(0, 1000),
			});
		}

		return new Response(body.byteLength ? Buffer.from(body) : null, {
			status: res.status,
			headers: resHeaders,
		});
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		const isTimeout = err instanceof Error && (err.name === 'AbortError' || err.message.includes('aborted') || err.message.includes('timed out'));
		console.error('[proxy] Fatal proxy error', { message, isTimeout });
		return new Response(
			JSON.stringify({ error: isTimeout ? 'Proxy timeout' : 'Proxy failure', details: message }),
			{ status: 502, headers: { 'Content-Type': 'application/json' } }
		);
	}
}

export { proxyHandler as GET, proxyHandler as POST, proxyHandler as PUT, proxyHandler as PATCH, proxyHandler as DELETE, proxyHandler as OPTIONS };
