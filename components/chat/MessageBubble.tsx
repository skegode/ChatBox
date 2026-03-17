// Displays a single message in the conversation
import React, { useEffect, useState } from "react";
import { format } from "date-fns";
import { Check, CheckCheck, FileText, Download } from "lucide-react";

type Message = {
  id: string;
  body: string;
  timestamp: Date;
  status: "sent" | "delivered" | "read";
  direction: "incoming" | "outgoing";
  chatId: string;
  mediaPath?: string | null;
  messageType?: string | null;
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
  const isOutgoing = message.direction === "outgoing";

  const safeTimestamp =
    message.timestamp instanceof Date && !isNaN(message.timestamp.getTime())
      ? message.timestamp
      : new Date();

  let quote: string | null = null;
  let mainBody = message.body ?? "";

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
      const qp =
        url.searchParams.get("path") ||
        url.searchParams.get("file") ||
        undefined;
      if (qp) return qp.split("/").pop() || qp;
      return url.pathname.split("/").pop() || null;
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

  const [pdfObjectUrl, setPdfObjectUrl] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [downloadLoading, setDownloadLoading] = useState(false);

  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const mediaUrl = message.mediaPath;
    const fileName = getFileNameFromUrl(mediaUrl);
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
  }, [message.mediaPath, message.messageType]);

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
    if (!message.mediaPath) return null;

    const declaredType = (message.messageType || "").toLowerCase();
    const fileName = getFileNameFromUrl(message.mediaPath);
    const ext = getExt(fileName);
    let inferredType = declaredType;
    if (!inferredType || inferredType === "media" || inferredType === "file") {
      if (["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg"].includes(ext))
        inferredType = "image";
      else if (["mp4", "webm", "ogg", "mov", "mkv"].includes(ext))
        inferredType = "video";
      else if (["mp3", "wav", "m4a", "aac", "oga"].includes(ext))
        inferredType = "audio";
      else if (ext === "pdf") inferredType = "pdf";
      else inferredType = "document";
    }

    const mediaUrl = message.mediaPath;

    switch (inferredType) {
      case "image":
        return (
          <div className="card p-2 mb-2">
            <div className="d-flex flex-wrap align-items-center attached-file">
              <div className="flex-grow-1 overflow-hidden">
                <div className="text-start">
                  <a
                    className="popup-img d-inline-block m-1"
                    href={mediaUrl}
                    title={fileName || "Image"}
                  >
                    <img
                      src={mediaUrl}
                      alt={fileName || "Image"}
                      style={{
                        width: 180,
                        height: 120,
                        objectFit: "cover",
                        display: "block",
                      }}
                      className="rounded border"
                    />
                  </a>
                  <p className="text-muted text-truncate font-size-13 mb-0">
                    {fileName || "Image"}
                  </p>
                </div>
              </div>
              <div className="ms-4 me-0">
                <div className="d-flex gap-2 font-size-20 d-flex align-items-start">
                  <div>
                    <button
                      onClick={() => handleDownload(mediaUrl)}
                      className="btn btn-sm btn-link fw-medium p-0"
                    >
                      <i className="ri-download-2-line" />
                    </button>
                  </div>
                </div>
              </div>
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
