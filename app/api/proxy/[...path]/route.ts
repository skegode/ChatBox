import { NextRequest } from 'next/server';

// Generic proxy: forwards same-origin requests under /api/proxy/* to the upstream backend.
// Preserves method, headers (except some hop-by-hop headers), body, and response status/content-type.
const CONFIGURED_BACKEND = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || '';

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

		const shouldLogSendFailure =
			req.method === 'POST' &&
			(/\/api\/Messages\/send$/i.test(relWithApi) || /\/api\/Messages$/i.test(relWithApi));

		if (shouldLogSendFailure) {
			console.log('[proxy] Forwarding send request', {
				upstream,
				method: req.method,
				authHeaderPresent: Boolean(forwardHeaders['authorization']),
				cookieHeaderPresent: Boolean(forwardHeaders['cookie']),
			});
		}

		const res = await fetch(upstream, init);

		// Build response headers to return to client
		const resHeaders: Record<string, string> = {};
		res.headers.forEach((v, k) => {
			// Avoid exposing backend's CORS headers; we control same-origin responses
			if (k.toLowerCase() === 'access-control-allow-origin') return;
			resHeaders[k] = v;
		});

		const body = await res.arrayBuffer();
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
		return new Response(JSON.stringify({ error: 'Proxy failure', details: String(err) }), { status: 502, headers: { 'Content-Type': 'application/json' } });
	}
}

export { proxyHandler as GET, proxyHandler as POST, proxyHandler as PUT, proxyHandler as PATCH, proxyHandler as DELETE, proxyHandler as OPTIONS };
