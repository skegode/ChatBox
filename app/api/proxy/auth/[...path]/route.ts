import { NextResponse } from 'next/server';

const DEFAULT_BACKEND = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5265';

async function fetchUpstream(url: string, init: RequestInit) {
  try {
    const res = await fetch(url, init);
    const body = await res.text();
    return { status: res.status, body, contentType: res.headers.get('content-type') || 'application/json' };
  } catch (err) {
    return { status: 502, body: JSON.stringify({ error: 'Upstream fetch failed' }), contentType: 'application/json' };
  }
}

function buildUpstreamUrl(pathSegments: string[] | undefined) {
  const joined = (pathSegments || []).join('/');
  // ensure we always hit the backend's /api/Auth/<...> path
  return `${DEFAULT_BACKEND.replace(/\/$/, '')}/api/Auth/${joined}`;
}

async function handle(req: Request, ctx: any) {
  const segments = ctx?.params?.path || [];
  const upstream = buildUpstreamUrl(Array.isArray(segments) ? segments : [segments]);

  // clone headers, preserving auth cookies/authorization if present
  const headers: Record<string, string> = {};
  for (const [k, v] of req.headers.entries()) {
    if (!v) continue;
    // skip host header
    if (k.toLowerCase() === 'host') continue;
    headers[k] = v;
  }

  const method = req.method.toUpperCase();

  // read body if present
  let body: any = undefined;
  try {
    body = await req.text();
  } catch (e) {
    body = undefined;
  }

  const init: RequestInit = {
    method,
    headers,
    body: body && body.length ? body : undefined,
    // forward cookies and other credentials server-side
    credentials: 'include',
  };

  const res = await fetchUpstream(upstream, init);

  try {
    const parsed = JSON.parse(res.body);
    return NextResponse.json(parsed, { status: res.status });
  } catch (e) {
    return new NextResponse(res.body, { status: res.status, headers: { 'Content-Type': res.contentType } });
  }
}

export async function OPTIONS() {
  // Respond OK for preflight if browser were to call this (proxy is same-origin so not required)
  return new NextResponse(null, { status: 204, headers: { Allow: 'GET,POST,PUT,PATCH,DELETE,OPTIONS' } });
}

export async function GET(req: Request, ctx: any) {
  return handle(req, ctx);
}

export async function POST(req: Request, ctx: any) {
  return handle(req, ctx);
}

export async function PUT(req: Request, ctx: any) {
  return handle(req, ctx);
}

export async function PATCH(req: Request, ctx: any) {
  return handle(req, ctx);
}

export async function DELETE(req: Request, ctx: any) {
  return handle(req, ctx);
}
