import { NextResponse } from 'next/server';

const DEFAULT_BACKEND = process.env.NEXT_PUBLIC_LOCAL_API || 'http://localhost:5265';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const raw = searchParams.get('url');
    if (!raw) return NextResponse.json({ error: 'Missing url query parameter' }, { status: 400 });

    // Normalize relative paths / filenames by resolving against known bases
    let remoteUrl = raw;
    // If starts with '/', assume path on backend host
    if (raw.startsWith('/')) {
      remoteUrl = `${DEFAULT_BACKEND}${raw}`;
    } else {
      // If raw looks like a bare filename (e.g. "12345.jpg") or a relative path without protocol,
      // try to resolve it against an explicit media base (env) or common backend locations.
      const hasScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(raw);
      if (!hasScheme) {
        const mediaBase = process.env.NEXT_PUBLIC_MEDIA_BASE || process.env.NEXT_PUBLIC_API_URL || DEFAULT_BACKEND;
        // Prefer a media-specific path if provided; try /images/ then root
        remoteUrl = `${String(mediaBase).replace(/\/+$/,'')}/images/${raw}`;
      }
    }

    // Validate URL
    try {
      // This will throw if remoteUrl is not an absolute URL
      // eslint-disable-next-line no-new
      new URL(remoteUrl);
    } catch (e) {
      console.error('Image proxy invalid url:', raw, 'resolved as', remoteUrl);
      return NextResponse.json({ error: 'Invalid url parameter' }, { status: 400 });
    }

    const headers: Record<string, string> = {};
    // Forward cookies and authorization header if present on the incoming request
    const cookie = req.headers.get('cookie');
    const auth = req.headers.get('authorization');
    if (cookie) headers['cookie'] = cookie;
    if (auth) headers['authorization'] = auth;

    const res = await fetch(remoteUrl, { method: 'GET', headers, cache: 'no-store' } as any);
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return NextResponse.json({ error: 'Upstream error', status: res.status, body: text }, { status: res.status });
    }

    const contentType = res.headers.get('content-type') || 'application/octet-stream';
    const buffer = Buffer.from(await res.arrayBuffer());

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=300',
      },
    });
  } catch (err) {
    console.error('Image proxy error:', err);
    return NextResponse.json({ error: 'Image proxy failed' }, { status: 502 });
  }
}
