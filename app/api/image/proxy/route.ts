import { NextResponse } from 'next/server';

const DEFAULT_BACKEND = process.env.NEXT_PUBLIC_LOCAL_API || 'http://localhost:5265';

function normalizeMediaVariants(raw: string): string[] {
  const variants = new Set<string>();
  const trimmed = String(raw || '').trim();
  if (!trimmed) return [];

  const add = (v?: string | null) => {
    if (!v) return;
    const s = String(v).trim();
    if (!s) return;
    variants.add(s);
  };

  add(trimmed);

  // Decode once for already-encoded values.
  try {
    add(decodeURIComponent(trimmed));
  } catch {
    // ignore
  }

  for (const v of Array.from(variants)) {
    // Normalize Windows separators.
    const slashed = v.replace(/\\+/g, '/');
    add(slashed);

    // Normalize repeated slashes inside path-like values.
    if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(slashed)) {
      add(slashed.replace(/\/+/g, '/'));
    }

    // If path has known media segment, keep trailing portion from it.
    const idxUploads = slashed.toLowerCase().lastIndexOf('/uploads/');
    if (idxUploads >= 0) add(slashed.slice(idxUploads));
    const idxMedia = slashed.toLowerCase().lastIndexOf('/media/');
    if (idxMedia >= 0) add(slashed.slice(idxMedia));
    const idxWa = slashed.toLowerCase().lastIndexOf('/whatsappmedia/');
    if (idxWa >= 0) add(slashed.slice(idxWa));

    // Basename fallback for full filesystem paths.
    const base = slashed.split('/').filter(Boolean).pop();
    if (base) {
      add(base);
      add(`/uploads/${base}`);
      add(`/media/${base}`);
      add(`/WhatsAppMedia/${base}`);
    }
  }

  return Array.from(variants);
}

function looksLikeImagePath(raw: string): boolean {
  const p = String(raw || '').toLowerCase();
  return /\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?|$)/.test(p);
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const raw = searchParams.get('url');
    const mediaId = searchParams.get('mediaId');
    const messageId = searchParams.get('messageId');
    const contactId = searchParams.get('contactId');
    const debug = searchParams.get('debug') === '1';
    if (!raw && !mediaId && !messageId) return NextResponse.json({ error: 'Missing url/mediaId/messageId query parameter' }, { status: 400 });

    // Build a list of candidate upstream URLs to try for the provided raw value.
    const candidates: string[] = [];
    const variants = raw ? normalizeMediaVariants(raw) : [];
    const trimmed = variants[0] || raw || '';

    for (const v of variants) {
      // If starts with '/', assume path on backend host
      if (v.startsWith('/')) {
        candidates.push(`${DEFAULT_BACKEND}${v}`);
      }

      // If looks like an absolute URL, try it directly
      if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(v) || v.startsWith('//')) {
        candidates.push(v);
      }
    }

    const mediaBase = process.env.NEXT_PUBLIC_MEDIA_BASE || process.env.NEXT_PUBLIC_API_URL || DEFAULT_BACKEND;

    if (mediaId) {
      const mid = encodeURIComponent(String(mediaId).trim());
      candidates.push(`${String(DEFAULT_BACKEND).replace(/\/+$/,'')}/api/Messages/media/${mid}`);
      candidates.push(`${String(DEFAULT_BACKEND).replace(/\/+$/,'')}/api/Messages/media?mediaId=${mid}`);
      candidates.push(`${String(DEFAULT_BACKEND).replace(/\/+$/,'')}/api/Messages/media?id=${mid}`);
      candidates.push(`${String(DEFAULT_BACKEND).replace(/\/+$/,'')}/api/Messages/media?messageId=${mid}`);
      candidates.push(`${String(DEFAULT_BACKEND).replace(/\/+$/,'')}/api/messages/media/${mid}`);
      candidates.push(`${String(DEFAULT_BACKEND).replace(/\/+$/,'')}/Messages/media/${mid}`);
    }

    if (messageId) {
      const qid = encodeURIComponent(String(messageId).trim());
      candidates.push(`${String(DEFAULT_BACKEND).replace(/\/+$/,'')}/api/Messages/media?messageId=${qid}`);
      candidates.push(`${String(DEFAULT_BACKEND).replace(/\/+$/,'')}/api/Messages/media?wamid=${qid}`);
      candidates.push(`${String(DEFAULT_BACKEND).replace(/\/+$/,'')}/api/Messages/media?id=${qid}`);
      candidates.push(`${String(DEFAULT_BACKEND).replace(/\/+$/,'')}/api/Messages/${qid}/media`);
      candidates.push(`${String(DEFAULT_BACKEND).replace(/\/+$/,'')}/api/messages/${qid}/media`);
      candidates.push(`${String(DEFAULT_BACKEND).replace(/\/+$/,'')}/api/Messages/${qid}`);
    }
    // Common backend endpoints and locations — prioritize typical public folders used by backend
    for (const v of variants) {
      const encoded = encodeURIComponent(v);
      const baseName = v.split('/').filter(Boolean).pop() || v;
      const encodedBaseName = encodeURIComponent(baseName);
      const rawNoLead = v.replace(/^\/+/, '');
      const baseNoLead = baseName.replace(/^\/+/, '');

      candidates.push(`${String(DEFAULT_BACKEND).replace(/\/+$/,'')}/uploads/${encoded}`);
      candidates.push(`${String(DEFAULT_BACKEND).replace(/\/+$/,'')}/uploads/${encodedBaseName}`);
      candidates.push(`${String(DEFAULT_BACKEND).replace(/\/+$/,'')}/uploads/${rawNoLead}`);
      candidates.push(`${String(DEFAULT_BACKEND).replace(/\/+$/,'')}/uploads/${baseNoLead}`);
      candidates.push(`${String(DEFAULT_BACKEND).replace(/\/+$/,'')}/media/${encoded}`);
      candidates.push(`${String(DEFAULT_BACKEND).replace(/\/+$/,'')}/media/${encodedBaseName}`);
      candidates.push(`${String(DEFAULT_BACKEND).replace(/\/+$/,'')}/media/${rawNoLead}`);
      candidates.push(`${String(DEFAULT_BACKEND).replace(/\/+$/,'')}/media/${baseNoLead}`);
      candidates.push(`${String(DEFAULT_BACKEND).replace(/\/+$/,'')}/WhatsAppMedia/${encoded}`);
      candidates.push(`${String(DEFAULT_BACKEND).replace(/\/+$/,'')}/WhatsAppMedia/${encodedBaseName}`);
      candidates.push(`${String(DEFAULT_BACKEND).replace(/\/+$/,'')}/WhatsAppMedia/${rawNoLead}`);
      candidates.push(`${String(DEFAULT_BACKEND).replace(/\/+$/,'')}/WhatsAppMedia/${baseNoLead}`);
      candidates.push(`${String(DEFAULT_BACKEND).replace(/\/+$/,'')}/whatsappmedia/${rawNoLead}`);
      candidates.push(`${String(DEFAULT_BACKEND).replace(/\/+$/,'')}/whatsappmedia/${baseNoLead}`);

      // backend's Messages media endpoint with alternative query keys
      candidates.push(`${String(DEFAULT_BACKEND).replace(/\/+$/,'')}/api/Messages/media?path=${encoded}`);
      candidates.push(`${String(DEFAULT_BACKEND).replace(/\/+$/,'')}/api/Messages/media?file=${encoded}`);
      candidates.push(`${String(DEFAULT_BACKEND).replace(/\/+$/,'')}/api/Messages/media?filename=${encodedBaseName}`);
      candidates.push(`${String(DEFAULT_BACKEND).replace(/\/+$/,'')}/api/Messages/media?fileName=${encodedBaseName}`);
      candidates.push(`${String(DEFAULT_BACKEND).replace(/\/+$/,'')}/api/Messages/media?mediaPath=${encoded}`);
      candidates.push(`${String(DEFAULT_BACKEND).replace(/\/+$/,'')}/api/Messages/media?mediaLocalPath=${encoded}`);
      // backend's Messages media endpoint as path segment
      candidates.push(`${String(DEFAULT_BACKEND).replace(/\/+$/,'')}/api/Messages/media/${encoded}`);
      candidates.push(`${String(DEFAULT_BACKEND).replace(/\/+$/,'')}/api/Messages/media/${encodedBaseName}`);
      candidates.push(`${String(DEFAULT_BACKEND).replace(/\/+$/,'')}/api/Messages/media/${rawNoLead}`);
      candidates.push(`${String(DEFAULT_BACKEND).replace(/\/+$/,'')}/api/Messages/media/${baseNoLead}`);
      // alternate casing/path used by some backends
      candidates.push(`${String(DEFAULT_BACKEND).replace(/\/+$/,'')}/api/messages/media?path=${encoded}`);
      candidates.push(`${String(DEFAULT_BACKEND).replace(/\/+$/,'')}/Messages/media?path=${encoded}`);

      // conventional media folders on configured media base
      candidates.push(`${String(mediaBase).replace(/\/+$/,'')}/media/${encoded}`);
      candidates.push(`${String(mediaBase).replace(/\/+$/,'')}/files/${encoded}`);
      candidates.push(`${String(mediaBase).replace(/\/+$/,'')}/uploads/${encoded}`);
      candidates.push(`${String(mediaBase).replace(/\/+$/,'')}/images/${encoded}`);
      candidates.push(`${String(mediaBase).replace(/\/+$/,'')}/media/${rawNoLead}`);
      candidates.push(`${String(mediaBase).replace(/\/+$/,'')}/uploads/${rawNoLead}`);
      candidates.push(`${String(mediaBase).replace(/\/+$/,'')}/images/${baseNoLead}`);
      candidates.push(`${String(DEFAULT_BACKEND).replace(/\/+$/,'')}/${encoded}`);
      candidates.push(`${String(DEFAULT_BACKEND).replace(/\/+$/,'')}/${rawNoLead}`);
    }

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
    if (auth) {
      headers['authorization'] = auth;
    } else if (cookie) {
      // For <img> requests from the browser, Authorization header is usually absent.
      // If we have a `token` cookie, promote it to a Bearer token for upstream fetches.
      const tokenMatch = cookie.match(/(?:^|;\s*)token=([^;]+)/i);
      if (tokenMatch?.[1]) {
        try {
          const token = decodeURIComponent(tokenMatch[1]);
          if (token) headers['authorization'] = `Bearer ${token}`;
        } catch {
          // Ignore malformed cookie token and continue without auth header.
        }
      }
    }

    // Try each candidate upstream URL in sequence until one works
    let upstreamRes: Response | null = null;
    let lastStatus = 0;
    let lastBody = '';
    const attempts: Array<{ candidate: string; status?: number; contentType?: string; error?: string }> = [];
    const expectImage = raw ? looksLikeImagePath(raw) : true;
    for (const candidate of uniqCandidates) {
      try {
        console.log('Image proxy trying:', candidate);
        const r = await fetch(candidate, { method: 'GET', headers, cache: 'no-store' } as any);
        attempts.push({ candidate, status: r.status, contentType: r.headers.get('content-type') || '' });
        if (r.ok) {
          const ct = (r.headers.get('content-type') || '').toLowerCase();
          // Some upstream endpoints can return 200 with JSON/HTML error payloads.
          // If we requested an image path, only accept image or binary content types.
          const acceptable = !expectImage || ct.includes('image/') || ct.includes('application/octet-stream');
          if (acceptable) {
            upstreamRes = r;
            remoteUrl = candidate;
            break;
          }

          const bodyPreview = await r.text().catch(() => '');
          lastStatus = r.status;
          lastBody = bodyPreview;
          console.warn(`Image proxy upstream ${candidate} returned non-image content-type: ${ct}`);
          continue;
        }
        lastStatus = r.status;
        lastBody = await r.text().catch(() => '');
        console.warn(`Image proxy upstream ${candidate} returned ${r.status}`);
      } catch (err) {
        attempts.push({ candidate, error: String(err) });
        console.error('Image proxy fetch error for', candidate, err);
      }
    }

    if (!upstreamRes) {
      // Contact-aware fallback: fetch messages for this contact and attempt richer media refs
      // (full URLs/paths) when the incoming `url` is only a bare filename.
      if (contactId && raw) {
        try {
          const contactUrl = `${String(DEFAULT_BACKEND).replace(/\/+$/,'')}/api/Messages/contact/${encodeURIComponent(contactId)}`;
          const contactRes = await fetch(contactUrl, { method: 'GET', headers, cache: 'no-store' } as any);
          attempts.push({ candidate: contactUrl, status: contactRes.status, contentType: contactRes.headers.get('content-type') || '' });

          if (contactRes.ok) {
            const payload = await contactRes.json().catch(() => null);
            const arr: Array<Record<string, unknown>> = Array.isArray(payload)
              ? (payload as Array<Record<string, unknown>>)
              : (payload && typeof payload === 'object' && Array.isArray((payload as any).items)
                ? ((payload as any).items as Array<Record<string, unknown>>)
                : []);

            const targetBase = String(raw).replace(/\\+/g, '/').split('/').filter(Boolean).pop()?.toLowerCase() || '';
            const refs = new Set<string>();
            for (const m of arr) {
              const values = [
                m['mediaPath'], m['MediaPath'], m['mediaUrl'], m['MediaUrl'], m['mediaLocalPath'], m['MediaLocalPath'],
                m['filePath'], m['fileUrl'], m['downloadUrl'], m['media'], m['Media']
              ];
              for (const v of values) {
                if (typeof v !== 'string' || !v.trim()) continue;
                const s = v.trim();
                const base = s.replace(/\\+/g, '/').split('/').filter(Boolean).pop()?.toLowerCase() || '';
                if (targetBase && base === targetBase) refs.add(s);
              }
            }

            const expectImageFallback = looksLikeImagePath(raw);
            for (const ref of refs) {
              const rsl = ref.replace(/\\+/g, '/');
              const base = rsl.split('/').filter(Boolean).pop() || rsl;
              const noLead = rsl.replace(/^\/+/, '');
              const extraCandidates = [
                /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(rsl) ? rsl : `${String(DEFAULT_BACKEND).replace(/\/+$/,'')}/${noLead}`,
                `${String(DEFAULT_BACKEND).replace(/\/+$/,'')}/uploads/${base}`,
                `${String(DEFAULT_BACKEND).replace(/\/+$/,'')}/media/${base}`,
                `${String(DEFAULT_BACKEND).replace(/\/+$/,'')}/api/Messages/media?path=${encodeURIComponent(rsl)}`,
                `${String(DEFAULT_BACKEND).replace(/\/+$/,'')}/api/Messages/media?path=${encodeURIComponent('/uploads/' + base)}`,
                `${String(DEFAULT_BACKEND).replace(/\/+$/,'')}/api/Messages/media?path=${encodeURIComponent('/media/' + base)}`,
              ];

              for (const c of extraCandidates) {
                try {
                  const rr = await fetch(c, { method: 'GET', headers, cache: 'no-store' } as any);
                  attempts.push({ candidate: c, status: rr.status, contentType: rr.headers.get('content-type') || '' });
                  if (!rr.ok) continue;
                  const ct = (rr.headers.get('content-type') || '').toLowerCase();
                  const acceptable = !expectImageFallback || ct.includes('image/') || ct.includes('application/octet-stream');
                  if (!acceptable) continue;
                  upstreamRes = rr;
                  remoteUrl = c;
                  break;
                } catch (e) {
                  attempts.push({ candidate: c, error: String(e) });
                }
              }

              if (upstreamRes) break;
            }
          }
        } catch (e) {
          attempts.push({ candidate: 'contact-media-fallback', error: String(e) });
        }
      }

      if (upstreamRes) {
        const contentType = upstreamRes.headers.get('content-type') || 'application/octet-stream';
        const buffer = Buffer.from(await upstreamRes.arrayBuffer());
        return new NextResponse(buffer, {
          status: 200,
          headers: {
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=300',
          },
        });
      }

      const payload: Record<string, unknown> = { error: 'Upstream error', status: lastStatus || 404, body: lastBody };
      if (debug) payload.attempts = attempts;
      return NextResponse.json(payload, { status: lastStatus || 404 });
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
