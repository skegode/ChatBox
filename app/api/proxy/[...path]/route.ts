import { NextRequest } from 'next/server';

// Generic proxy: forwards same-origin requests under /api/proxy/* to the upstream backend.
// Preserves method, headers (except some hop-by-hop headers), body, and response status/content-type.
const DEFAULT_BACKEND = process.env.NEXT_PUBLIC_API_URL || process.env.BACKEND_URL || 'https://app.servicesuitecloud.com/WhatsappApi';

async function proxyHandler(req: NextRequest) {
	try {
		// Determine upstream path by removing the /api/proxy prefix
		const url = new URL(req.url);
		const rel = url.pathname.replace(/^\/api\/proxy/, '');
		const upstream = DEFAULT_BACKEND.replace(/\/+$/, '') + rel + (url.search || '');

		const init: RequestInit = {
			method: req.method,
			headers: {} as Record<string, string>,
			// forward body for non-GET/HEAD
			body: undefined,
			redirect: 'follow',
		};

		// Copy headers except host and some hop-by-hop headers
		const skip = new Set(['host', 'connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization', 'te', 'trailer', 'transfer-encoding', 'upgrade']);
		req.headers.forEach((value, key) => {
			if (!skip.has(key.toLowerCase())) init.headers![key] = value;
		});

		if (req.method !== 'GET' && req.method !== 'HEAD') {
			try {
				const buf = await req.arrayBuffer();
				init.body = buf.byteLength ? Buffer.from(buf) : undefined;
			} catch (e) {
				// ignore body read errors
			}
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
		return new Response(body.byteLength ? Buffer.from(body) : null, {
			status: res.status,
			headers: resHeaders,
		});
	} catch (err) {
		return new Response(JSON.stringify({ error: 'Proxy failure', details: String(err) }), { status: 502, headers: { 'Content-Type': 'application/json' } });
	}
}

export { proxyHandler as GET, proxyHandler as POST, proxyHandler as PUT, proxyHandler as PATCH, proxyHandler as DELETE, proxyHandler as OPTIONS };
