// Displays a single message in the conversation
import React, { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { Check, CheckCheck, FileText, Download } from "lucide-react";

// Inject chat-image related styles once globally
const CHAT_IMAGE_STYLE_ID = '__chat-image-styles';
if (typeof document !== 'undefined' && !document.getElementById(CHAT_IMAGE_STYLE_ID)) {
  const style = document.createElement('style');
  style.id = CHAT_IMAGE_STYLE_ID;
  style.textContent = [
    '.chat-image{ max-width:260px; border-radius:8px; object-fit:cover; cursor:pointer; display:block }',
    '.chat-image-skeleton{ width:260px; height:160px; background:#f3f4f6; border-radius:8px }',
    '.lightbox-overlay{ position:fixed; inset:0; background:rgba(0,0,0,0.7); display:flex; align-items:center; justify-content:center; z-index:1050 }',
    '.lightbox-content img{ max-width:90%; max-height:90%; border-radius:8px }',
    '.image-actions{ display:flex; gap:8px; align-items:center }',
  ].join('\n');
  document.head.appendChild(style);
}

type Message = {
  id: string;
  messageId?: string | null;
  isOutgoing?: boolean;
  sourcePhoneNumberId?: string | null;
  displayPhoneNumber?: string | null;
  body: string;
  timestamp: Date;
  status: "sent" | "delivered" | "read";
  direction: "incoming" | "outgoing";
  chatId: string;
  mediaPath?: string | null;
  mediaUrl?: string | null;
  mediaId?: string | null;
  mediaFileName?: string | null;
  fileName?: string | null;
  messageType?: 'text' | 'image' | 'video' | 'audio' | 'pdf' | 'document' | null;
  senderName?: string | null;
};

type MessageBubbleProps = {
  message: Message;
  quotedText?: string | null;
  onReply?: () => void;
};

export default function MessageBubble({
  message,
  quotedText,
  onReply,
}: MessageBubbleProps) {
  const isOutgoing = typeof message.isOutgoing === "boolean"
    ? message.isOutgoing
    : message.direction === "outgoing";

  const safeTimestamp =
    message.timestamp instanceof Date && !isNaN(message.timestamp.getTime())
      ? message.timestamp
      : new Date();

  let quote: string | null = null;
  let mainBody = message.body ?? "";

  // Some backends return placeholder text like "media" for attachment-only messages.
  // Hide that placeholder so users only see the attachment card.
  if (message.messageType !== 'text' && (message.mediaPath || message.mediaUrl || message.mediaId) && /^(media|file)$/i.test(mainBody.trim())) {
    mainBody = "";
  }

  if (quotedText && quotedText.length > 0) {
    quote = quotedText;
  } else {
    const parts = message.body ? message.body.split(/\n\s*\n/) : [""];
    if (parts.length >= 2) {
      const maybeQuote = parts[0].trim();
      const rest = parts.slice(1).join("\n\n").trim();
      if (
        maybeQuote.length > 0 &&
        maybeQuote.length <= 500 &&
        maybeQuote.split("\n").length <= 6 &&
        rest.length > 0
      ) {
        quote = maybeQuote;
        mainBody = rest;
      }
    }
  }

  const getFileNameFromUrl = (u?: string | null) => {
    if (!u) return null;
    try {
      const url = new URL(u, window.location.href);
      // If this is our image proxy URL it will include the original value
      // as the `url` query parameter (or sometimes `path`/`file`). Prefer
      // `url`, then `path`, then `file` when extracting the filename.
      const original =
        url.searchParams.get('url') ||
        url.searchParams.get('path') ||
        url.searchParams.get('file') ||
        undefined;
      const source = original || url.pathname;
      // If source is itself a URL, parse it to get its pathname
      try {
        const inner = new URL(source, window.location.href);
        const qp2 = inner.searchParams.get('path') || inner.searchParams.get('file');
        if (qp2) return qp2.split('/').pop() || qp2;
        return inner.pathname.split('/').pop() || null;
      } catch {
        // Not an absolute URL — treat as a path-like string
        const parts = String(source).split('?')[0].split('/');
        return parts.pop() || null;
      }
    } catch {
      const parts = String(u).split("?")[0].split("/");
      return parts.pop() || null;
    }
  };

  const getExt = (fileName?: string | null) => {
    if (!fileName) return "";
    const idx = fileName.lastIndexOf(".");
    return idx >= 0 ? fileName.slice(idx + 1).toLowerCase() : "";
  };

  const sanitizeDisplayFileName = (name?: string | null) => {
    if (!name) return null;
    const v = String(name).trim();
    if (!v) return null;
    if (/^(media|file|download|messages?)$/i.test(v)) return null;
    return v;
  };

  // Resolve a media path or filename to a usable URL for preview/download.
  // Route all media through the Next.js image proxy at `/api/image/proxy?url=...`.
  // This ensures the proxy can try backend candidate locations and forward
  // cookies/authorization when necessary, avoiding direct browser fetches
  // that may 404 for bare filenames or protected upstream URLs.
  const resolveMediaUrl = (raw?: string | null, mediaId?: string | null, messageId?: string | null, contactId?: string | null) => {
    const mid = mediaId ? String(mediaId).trim() : '';
    const msgId = messageId ? String(messageId).trim() : '';
    if (!raw && !mid && !msgId) return '';
    const trimmed = raw ? String(raw).trim() : '';
    // Allow data URIs and already-proxied URLs to pass through unchanged
    if (trimmed.startsWith('data:')) return trimmed;
    if (trimmed.startsWith('/api/image/proxy')) return trimmed;
    // Always route other values through the image proxy which will attempt
    // multiple upstream candidate locations (uploads, media, Messages/media, etc.)
    const params = new URLSearchParams();
    if (trimmed) params.set('url', trimmed);
    if (mid) params.set('mediaId', mid);
    if (msgId) params.set('messageId', msgId);
    if (contactId) params.set('contactId', contactId);
    return `/api/image/proxy?${params.toString()}`;
  };

  const [pdfObjectUrl, setPdfObjectUrl] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [downloadLoading, setDownloadLoading] = useState(false);

  const [menuOpen, setMenuOpen] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [imageErrorReason, setImageErrorReason] = useState<string | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [imageCandidateIndex, setImageCandidateIndex] = useState(0);

  const probeImageError = async (url: string) => {
    try {
      const res = await fetch(url, { credentials: 'include' });
      if (res.ok) return;
      const text = await res.text();
      const lower = text.toLowerCase();

      if (lower.includes('oauth') || lower.includes('code\\":190') || lower.includes('token invalid') || lower.includes('token expired')) {
        setImageErrorReason('Attachment unavailable: backend WhatsApp token is invalid or expired.');
        return;
      }

      if (res.status === 401) {
        setImageErrorReason('Attachment unavailable: unauthorized on upstream media service.');
        return;
      }

      if (res.status === 404) {
        setImageErrorReason('Attachment not found on media server.');
        return;
      }

      setImageErrorReason(`Attachment failed to load (${res.status}).`);
    } catch {
      setImageErrorReason('Attachment failed to load due to a network/proxy error.');
    }
  };

  const buildImageCandidates = (raw?: string | null, mediaId?: string | null, messageId?: string | null) => {
    const candidates: string[] = [];
    const trimmed = raw ? String(raw).trim() : '';
    const mid = mediaId ? String(mediaId).trim() : '';
    const msgId = messageId ? String(messageId).trim() : '';

    const add = (u?: string | null) => {
      if (!u) return;
      const s = String(u).trim();
      if (!s) return;
      if (!candidates.includes(s)) candidates.push(s);
    };

    add(resolveMediaUrl(trimmed, mid, msgId, message.chatId || null));

    if (trimmed) {
      const noLead = trimmed.replace(/^\/+/, '');
      const base = noLead.split('/').filter(Boolean).pop() || noLead;
      add(`/api/proxy/Messages/media?path=${encodeURIComponent(trimmed)}`);
      add(`/api/proxy/Messages/media?path=${encodeURIComponent('/uploads/' + base)}`);
      add(`/api/proxy/Messages/media?path=${encodeURIComponent('/media/' + base)}`);
      add(`/api/proxy/Messages/media/${encodeURIComponent(noLead)}`);
      add(`/api/proxy/Messages/media/${encodeURIComponent(base)}`);
    }

    if (mid) {
      add(`/api/proxy/Messages/media/${encodeURIComponent(mid)}`);
      add(`/api/proxy/Messages/media?mediaId=${encodeURIComponent(mid)}`);
      add(`/api/proxy/Messages/media?id=${encodeURIComponent(mid)}`);
    }

    if (msgId) {
      add(`/api/proxy/Messages/media?messageId=${encodeURIComponent(msgId)}`);
      add(`/api/proxy/Messages/media?wamid=${encodeURIComponent(msgId)}`);
      add(`/api/proxy/Messages/${encodeURIComponent(msgId)}/media`);
    }

    return candidates;
  };

  const imageCandidates = useMemo(
    () => buildImageCandidates(message.mediaUrl || message.mediaPath, message.mediaId, message.messageId),
    [message.mediaUrl, message.mediaPath, message.mediaId, message.messageId]
  );
  const activeImageSrc = imageCandidates[imageCandidateIndex] || '';

  useEffect(() => {
    const mediaUrl = resolveMediaUrl(message.mediaUrl || message.mediaPath, message.mediaId, message.messageId, message.chatId || null);
    const fileName = sanitizeDisplayFileName(message.mediaFileName || message.fileName || getFileNameFromUrl(mediaUrl));
    const ext = getExt(fileName);
    let aborted = false;

    async function fetchPdf() {
      if (!mediaUrl || ext !== "pdf") return;
      setPdfLoading(true);
      setPdfError(null);
      try {
        const res = await fetch(mediaUrl);
        if (!res.ok) throw new Error(`Failed to load document (${res.status})`);
        const blob = await res.blob();
        if (aborted) return;
        const obj = URL.createObjectURL(blob);
        setPdfObjectUrl(obj);
      } catch (err: unknown) {
        console.error("PDF fetch failed", err);
        setPdfError("Unable to preview PDF");
      } finally {
        if (!aborted) setPdfLoading(false);
      }
    }

    fetchPdf();

    return () => {
      aborted = true;
      if (pdfObjectUrl) {
        URL.revokeObjectURL(pdfObjectUrl);
        setPdfObjectUrl(null);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message.mediaPath, message.mediaId, message.messageType]);

  // Reset image state when media source changes.
  // NOTE: we no longer set imageLoading=true here; the <img> is always mounted
  // so onLoad / onError will fire and update state.
  useEffect(() => {
    if (message.messageType !== 'text' && (message.mediaPath || message.mediaUrl || message.mediaId)) {
      setImageError(false);
      setImageLoading(true);
      setImageErrorReason(null);
      setImageCandidateIndex(0);
    } else {
      setImageLoading(false);
      setImageError(false);
      setImageErrorReason(null);
      setImageCandidateIndex(0);
    }
  }, [message.mediaPath, message.mediaUrl, message.mediaId, message.messageType]);

  const handleDownload = async (mediaUrl?: string | null) => {
    if (!mediaUrl) return;
    setDownloadLoading(true);
    const fileName = getFileNameFromUrl(mediaUrl) || "file";
    try {
      const res = await fetch(mediaUrl);
      if (!res.ok) throw new Error(`Download failed (${res.status})`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      console.error("Download failed", err);
    } finally {
      setDownloadLoading(false);
    }
  };

  const renderMedia = () => {
    const declaredType = String(message.messageType || 'text').toLowerCase();
    if (declaredType === 'text') return null;
    if (!message.mediaPath && !message.mediaUrl && !message.mediaId) return null;

    const mediaUrl = resolveMediaUrl(message.mediaUrl || message.mediaPath, message.mediaId, message.messageId, message.chatId || null);
    const fileName = sanitizeDisplayFileName(message.mediaFileName || message.fileName || getFileNameFromUrl(mediaUrl));
    const ext = getExt(fileName);

    // Use resolved media URL so filenames, previews and proxying work for relative paths
    // (resolveMediaUrl will route non-absolute paths through the image proxy).
    // NOTE: `mediaUrl` is used below for <img>, <video>, <audio> sources and downloads.
    // Previously this used `message.mediaPath` directly which could be a bare filename
    // and would fail to load from the browser (404). Using the resolved URL fixes that.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    // (mediaUrl is intentionally shadowed above for type inference)
    // const mediaUrl = resolveMediaUrl(message.mediaPath);

    switch (declaredType) {
      case "image":
        return (
          <div className="card p-2 mb-2" style={{ border: 'none', background: 'transparent' }}>
            <div className="d-flex flex-wrap align-items-start attached-file" style={{ gap: 12 }}>
              <div className="flex-grow-1 overflow-hidden">
                <div className="text-start">
                  {/* Always mount <img> so onLoad / onError fire; hide via CSS while loading */}
                  {!imageError && (
                    <img
                      src={activeImageSrc || mediaUrl}
                      alt={fileName || 'Image'}
                      className="chat-image"
                      style={imageLoading ? { position: 'absolute', width: 0, height: 0, overflow: 'hidden', opacity: 0 } : undefined}
                      onClick={() => setLightboxOpen(true)}
                      onLoad={() => { setImageLoading(false); setImageError(false); setImageErrorReason(null); }}
                      onError={() => {
                        const hasNext = imageCandidateIndex < imageCandidates.length - 1;
                        if (hasNext) {
                          setImageLoading(true);
                          setImageCandidateIndex((prev) => prev + 1);
                          return;
                        }
                        setImageLoading(false);
                        setImageError(true);
                        void probeImageError(activeImageSrc || mediaUrl);
                      }}
                    />
                  )}

                  {imageLoading && !imageError && <div className="chat-image-skeleton" />}

                  {imageError && (
                    <div style={{ width: 260, height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff5f5', borderRadius: 8, color: '#9ca3af' }}>
                      <span style={{ padding: '0 10px', textAlign: 'center', fontSize: 12 }}>
                        {imageErrorReason || 'Image failed to load'}
                      </span>
                    </div>
                  )}

                  {fileName ? (
                    <div style={{ marginTop: 6 }}>
                      <small style={{ fontSize: 11, color: '#9ca3af' }}>{fileName}</small>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="image-actions">
                <button onClick={() => setLightboxOpen(true)} className="btn btn-sm btn-outline-secondary" title="View" style={{ padding: '4px 8px' }}>
                  <i className="ri-eye-line" />
                </button>
                <button onClick={() => handleDownload(mediaUrl)} className="btn btn-sm btn-outline-secondary" title="Download" style={{ padding: '4px 8px' }}>
                  <i className="ri-download-2-line" />
                </button>
              </div>

              {lightboxOpen && (
                <div className="lightbox-overlay" onClick={() => setLightboxOpen(false)}>
                  <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
                    <img src={activeImageSrc || mediaUrl} alt={fileName || 'Image'} />
                    <div style={{ display: 'flex', justifyContent: 'center', marginTop: 10 }}>
                      <button className="btn btn-sm btn-light me-2" onClick={() => handleDownload(activeImageSrc || mediaUrl)}>
                        <i className="ri-download-2-line" /> Download
                      </button>
                      <button className="btn btn-sm btn-secondary" onClick={() => setLightboxOpen(false)}>Close</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      case "video":
        return (
          <div className="card p-2 mb-2">
            <div className="d-flex flex-wrap align-items-center attached-file">
              <div className="avatar-sm me-3 ms-0 attached-file-avatar">
                <div className="avatar-title bg-primary-subtle text-primary rounded font-size-20">
                  <i className="ri-mic-fill" />
                </div>
              </div>
              <div className="flex-grow-1 overflow-hidden">
                <div className="text-start">
                  <video
                    src={mediaUrl}
                    controls
                    className="w-full max-h-80 bg-black"
                  />
                  <p className="text-muted text-truncate font-size-13 mb-0">
                    {fileName || "Audio"}
                  </p>
                </div>
              </div>
              <div className="ms-4 me-0">
                <div className="d-flex gap-2 font-size-20 d-flex align-items-start">
                  <div>
                    <a
                      onClick={() => handleDownload(mediaUrl)}
                      className="fw-medium"
                    >
                      <i className="ri-download-2-line" />
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      case "audio":
        return (
          <div className="card p-2 mb-2">
            <div className="d-flex flex-wrap align-items-center attached-file">
              <div className="avatar-sm me-3 ms-0 attached-file-avatar">
                <div className="avatar-title bg-primary-subtle text-primary rounded font-size-20">
                  <i className="ri-mic-fill" />
                </div>
              </div>
              <div className="flex-grow-1 overflow-hidden">
                <div className="text-start">
                  <audio src={mediaUrl} controls className="w-full" />
                  <p className="text-muted text-truncate font-size-13 mb-0">
                    {fileName || "Audio"}
                  </p>
                </div>
              </div>
              <div className="ms-4 me-0">
                <div className="d-flex gap-2 font-size-20 d-flex align-items-start">
                  <div>
                    <a
                      onClick={() => handleDownload(mediaUrl)}
                      className="fw-medium"
                    >
                      <i className="ri-download-2-line" />
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      case "pdf":
        return (
          <div className="card p-2 mb-2">
            <div className="d-flex flex-wrap align-items-center attached-file">
              <div className="avatar-sm me-3 ms-0 attached-file-avatar">
                <div className="avatar-title bg-primary-subtle text-primary rounded font-size-20">
                  <i className="ri-file-text-fill" />
                </div>
              </div>
              <div className="flex-grow-1 overflow-hidden">
                <div className="text-start">
                  <h5 className="font-size-14 text-truncate mb-1">
                    {fileName || "Document.pdf"}
                  </h5>
                  <p className="text-muted text-truncate font-size-13 mb-0"></p>
                </div>
              </div>
              <div className="ms-4 me-0">
                <div className="d-flex gap-2 font-size-20 d-flex align-items-start">
                  <div>
                    <a
                      onClick={() => handleDownload(mediaUrl)}
                      className="fw-medium"
                    >
                      <i className="ri-download-2-line" />
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      case "document":
      default:
        return (
          <div className="card p-2 mb-2">
            <div className="d-flex flex-wrap align-items-center attached-file">
              <div className="avatar-sm me-3 ms-0 attached-file-avatar">
                <div className="avatar-title bg-primary-subtle text-primary rounded font-size-20">
                  <i className="ri-file-text-fill" />
                </div>
              </div>
              <div className="flex-grow-1 overflow-hidden">
                <div className="text-start">
                  <h5 className="font-size-14 text-truncate mb-1">
                    {fileName || "Document"}
                  </h5>
                  <p className="text-muted text-truncate font-size-13 mb-0">
                    {ext ? ext.toUpperCase() : "File"}
                  </p>
                </div>
              </div>
              <div className="ms-4 me-0">
                <div className="d-flex gap-2 font-size-20 d-flex align-items-start">
                  <div>
                    <a
                      onClick={() => handleDownload(mediaUrl)}
                      className="fw-medium"
                    >
                      <i className="ri-download-2-line" />
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="conversation-list">
      <div className="chat-avatar">
        <img src="/images/default-avatar.png" alt="" />
      </div>

      <div className="user-chat-content">
        <div className="ctext-wrap">
          <div className="ctext-wrap-content">
            {quote && (
              <div className="card p-2 mb-2">
                <span>{quote}</span>
              </div>
            )}

            {mainBody && <p className="mb-0">{mainBody}</p>}

            {renderMedia()}

            <p className="chat-time mb-0">
              <i className="ri-time-line align-middle" />
              <span className="align-middle">
                {format(safeTimestamp, "HH:mm")}
              </span>
              {isOutgoing && (
                <span className="ms-1" aria-hidden>
                  {message.status === "read" ? (
                    <CheckCheck size={14} className="text-primary" style={{ color: '#3b82f6' }} />
                  ) : message.status === "delivered" ? (
                    <CheckCheck size={14} style={{ color: '#9ca3af' }} />
                  ) : (
                    <Check size={14} style={{ color: '#9ca3af' }} />
                  )}
                </span>
              )}
            </p>
            {isOutgoing && message.senderName && (
              <p className="text-xs text-muted mt-1 mb-0">
                Sent by {message.senderName}
              </p>
            )}
            {!isOutgoing && message.displayPhoneNumber && (
              <p className="mt-1 mb-0">
                <span
                  className="badge bg-light text-muted"
                  style={{ fontSize: 11, fontWeight: 500 }}
                >
                  received on {message.displayPhoneNumber}
                </span>
              </p>
            )}
          </div>
          <div
            className="dropdown align-self-start"
            style={{ position: "relative" }}
          >
            <button
              className="btn btn-link p-0 dropdown-toggle"
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-haspopup="true"
              aria-expanded={menuOpen}
            >
              <i className="ri-more-2-fill" />
            </button>
            {menuOpen && (
              <div
                className="dropdown-menu show"
                style={{
                  position: "absolute",
                  top: "-40px",
                  left: 0,
                  zIndex: 100,
                  minWidth: "160px",
                }}
                onMouseLeave={() => setMenuOpen(false)}
              >
                <button
                  className="dropdown-item"
                  type="button"
                  onClick={() => {
                    if (onReply) onReply();
                    setMenuOpen(false);
                  }}
                >
                  Reply <i className="ri-reply-line float-end text-muted" />
                </button>
                <button className="dropdown-item" type="button">
                  Copy <i className="ri-file-copy-line float-end text-muted" />
                </button>
                <button className="dropdown-item" type="button">
                  Forward{" "}
                  <i className="ri-chat-forward-line float-end text-muted" />
                </button>
                <button className="dropdown-item" type="button">
                  Delete{" "}
                  <i className="ri-delete-bin-line float-end text-muted" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
