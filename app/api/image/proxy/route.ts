import { NextResponse } from 'next/server';

const DEFAULT_BACKEND = process.env.NEXT_PUBLIC_LOCAL_API || 'http://localhost:5265';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const raw = searchParams.get('url');
    if (!raw) return NextResponse.json({ error: 'Missing url query parameter' }, { status: 400 });

    // Build a list of candidate upstream URLs to try for the provided raw value.
    const candidates: string[] = [];
    const trimmed = raw;

    // If starts with '/', assume path on backend host
    if (trimmed.startsWith('/')) {
      candidates.push(`${DEFAULT_BACKEND}${trimmed}`);
    }

    // If looks like an absolute URL, try it directly
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed) || trimmed.startsWith('//')) {
      candidates.push(trimmed);
    }

    const mediaBase = process.env.NEXT_PUBLIC_MEDIA_BASE || process.env.NEXT_PUBLIC_API_URL || DEFAULT_BACKEND;
    // Common backend endpoints and locations — prioritize typical public folders used by backend
    candidates.push(`${String(DEFAULT_BACKEND).replace(/\/+$/,'')}/uploads/${encodeURIComponent(trimmed)}`);
    candidates.push(`${String(DEFAULT_BACKEND).replace(/\/+$/,'')}/media/${encodeURIComponent(trimmed)}`);
    candidates.push(`${String(DEFAULT_BACKEND).replace(/\/+$/,'')}/WhatsAppMedia/${encodeURIComponent(trimmed)}`);
    // backend's Messages media endpoint with query
    candidates.push(`${String(DEFAULT_BACKEND).replace(/\/+$/,'')}/api/Messages/media?path=${encodeURIComponent(trimmed)}`);
    // backend's Messages media endpoint as path segment
    candidates.push(`${String(DEFAULT_BACKEND).replace(/\/+$/,'')}/api/Messages/media/${encodeURIComponent(trimmed)}`);
    // conventional media folders on configured media base
    candidates.push(`${String(mediaBase).replace(/\/+$/,'')}/media/${encodeURIComponent(trimmed)}`);
    candidates.push(`${String(mediaBase).replace(/\/+$/,'')}/files/${encodeURIComponent(trimmed)}`);
    candidates.push(`${String(mediaBase).replace(/\/+$/,'')}/uploads/${encodeURIComponent(trimmed)}`);
    candidates.push(`${String(mediaBase).replace(/\/+$/,'')}/images/${encodeURIComponent(trimmed)}`);
    candidates.push(`${String(DEFAULT_BACKEND).replace(/\/+$/,'')}/${encodeURIComponent(trimmed)}`);

    // Deduplicate while preserving order
    const seen = new Set<string>();
    const uniqCandidates = candidates.filter(c => {
      if (!c) return false;
      if (seen.has(c)) return false;
      seen.add(c);
      return true;
    });

    // Start with the first candidate but we'll iterate through uniqCandidates when fetching
    let remoteUrl = uniqCandidates[0] || raw;

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

    // Try each candidate upstream URL in sequence until one works
    let upstreamRes: Response | null = null;
    let lastStatus = 0;
    let lastBody = '';
    for (const candidate of uniqCandidates) {
      try {
        console.log('Image proxy trying:', candidate);
        const r = await fetch(candidate, { method: 'GET', headers, cache: 'no-store' } as any);
        if (r.ok) {
          upstreamRes = r;
          remoteUrl = candidate;
          break;
        }
        lastStatus = r.status;
        lastBody = await r.text().catch(() => '');
        console.warn(`Image proxy upstream ${candidate} returned ${r.status}`);
      } catch (err) {
        console.error('Image proxy fetch error for', candidate, err);
      }
    }

    if (!upstreamRes) {
      return NextResponse.json({ error: 'Upstream error', status: lastStatus || 404, body: lastBody }, { status: lastStatus || 404 });
    }

    const contentType = upstreamRes.headers.get('content-type') || 'application/octet-stream';
    const buffer = Buffer.from(await upstreamRes.arrayBuffer());

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
