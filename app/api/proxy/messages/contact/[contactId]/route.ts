import { NextResponse } from 'next/server';

const DEFAULT_BACKEND = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5265';

async function fetchUpstream(url: string, headers: Record<string, string>) {
  try {
    const res = await fetch(url, { headers });
    const body = await res.text();
    return { status: res.status, body, contentType: res.headers.get('content-type') || 'application/json' };
  } catch (err) {
    return { status: 502, body: JSON.stringify({ error: 'Upstream fetch failed' }), contentType: 'application/json' };
  }
}

export async function GET(req: Request, ctx: any) {
  const contactId = ctx?.params?.contactId;
  if (!contactId) {
    return NextResponse.json({ error: 'Missing contactId' }, { status: 400 });
  }

  const headers: Record<string, string> = {};
  const cookie = req.headers.get('cookie');
  const auth = req.headers.get('authorization');
  if (cookie) headers['cookie'] = cookie;
  if (auth) headers['authorization'] = auth;

  const tried: Array<{ url: string; result: any }> = [];

  // Try several variants: exact id, +prefixed, and numeric-only
  const candidates = [contactId];
  if (!contactId.startsWith('+')) candidates.push('+' + contactId);
  const digits = contactId.replace(/\D/g, '');
  if (digits && digits !== contactId) candidates.push(digits);

  for (const c of candidates) {
    const url = `${DEFAULT_BACKEND.replace(/\/$/, '')}/api/Messages/contact/${encodeURIComponent(c)}`;
    const res = await fetchUpstream(url, headers);
    tried.push({ url, result: res });
    if (res.status === 200) {
      return new NextResponse(res.body, { status: 200, headers: { 'Content-Type': res.contentType } });
    }
  }

  // If none returned 200, return the last response
  const last = tried[tried.length - 1];
  try {
    const parsed = JSON.parse(last.result.body);
    return NextResponse.json(parsed, { status: last.result.status });
  } catch (e) {
    return new NextResponse(last.result.body, { status: last.result.status, headers: { 'Content-Type': last.result.contentType } });
  }
}
