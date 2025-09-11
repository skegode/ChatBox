// Page for specific chat conversation
// app/dashboard/[chatId]/page.tsx

"use client";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import MessageBubble from "../../../components/chat/MessageBubble";
import MessageInput from "../../../components/chat/MessageInput";
import api, { MEDIA_BASE_URL } from "@/lib/api";
import { useAuth } from "@/components/providers/AuthProvider";
import { PERMISSIONS } from "@/lib/permissions";
import axios from "axios";

// Match your backend MessageViewModel
type MessageVm = {
  id: number;
  messageId?: string | null;
  contactName?: string | null;
  contactWaId: string;
  messageText?: string | null;
  messageType?: string | null;
  mediaPath?: string | null;
  messageDateTime: string | Date;
  isIncoming: boolean;
  contextMessageId?: string | null;
};

type MessageStatus = "sent" | "delivered" | "read";

// Selected quote state type
type SelectedQuote = {
  id: string;
  body: string;
  messageId?: string | null;
} | null;

// Context menu state type
type ContextMenu = { x: number; y: number; message: MessageVm } | null;

interface SendMessagePayload {
  ContactId: string;
  MessageText: string;
  ContextMessageId?: string;
  MediaId?: string;
  MediaType?: string;
  MediaLocalPath?: string;
  MediaFileName?: string;
}

interface StatusPayload {
  status?: string;
  delivered?: boolean;
}

// helper to detect phone-like strings so we can decide saved vs phone
function digitsOnly(s?: string) {
  return (s ?? "").replace(/\D/g, "");
}

function contactNameLooksLikePhone(candidate?: string, contactId?: string) {
  if (!candidate) return false;
  const a = digitsOnly(candidate);
  if (!a) return false; // contains letters -> real name
  const b = digitsOnly(contactId ?? "");
  if (!b) return true; // candidate digits but no contactId -> treat as phone
  return a === b || a.endsWith(b) || b.endsWith(a);
}

export default function ChatPage() {
  const params = useParams();
  const chatId = params?.chatId as string | undefined;
  const [messages, setMessages] = useState<MessageVm[] | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [contactInfo, setContactInfo] = useState<{ name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusMap, setStatusMap] = useState<Record<string, MessageStatus>>({});
  const [quote, setQuote] = useState<SelectedQuote>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenu>(null);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const router = useRouter();
  const { user, isAuthenticated, checkPolicy } = useAuth();
  const canViewAllChats = checkPolicy(PERMISSIONS.POLICY_VIEW_ALL_CHATS);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/login");
      return;
    }

    if (!chatId) {
      setError("Invalid chat id");
      setInitialLoading(false);
    } else {
      setError(null);
    }
  }, [chatId, isAuthenticated, router]);

  const buildMsgKey = (m: MessageVm) => {
    if (m.messageId) return String(m.messageId);
    const ts = new Date(m.messageDateTime).getTime();
    return `${m.id}-${ts}`;
  };

  const dedupeAndSort = (arr: MessageVm[]) => {
    const seen = new Set<string>();
    const items: MessageVm[] = [];

    for (const m of arr) {
      const key = buildMsgKey(m);
      if (!seen.has(key)) {
        seen.add(key);
        items.push(m);
      }
    }

    items.sort(
      (a, b) =>
        new Date(a.messageDateTime).getTime() -
        new Date(b.messageDateTime).getTime()
    );
    return items;
  };

  async function fetchConversation(showLoading = true) {
    if (!chatId) return;
    if (showLoading) {
      setInitialLoading(true);
    } else {
      setIsRefreshing(true);
    }
    setError(null);

    try {
      const response = await api.get(
        `api/Messages/contact/${encodeURIComponent(chatId)}`
      );
      const data = response.data;

      if (Array.isArray(data)) {
        const cleaned = dedupeAndSort(data);
        setMessages(cleaned);

        // Determine whether the server-provided contactName is an actual saved name
        if (cleaned.length > 0 && cleaned[0].contactName) {
          const candidate = cleaned[0].contactName as string;
          const isPhone = contactNameLooksLikePhone(candidate, chatId);
          if (!isPhone) {
            setContactInfo({ name: candidate });
          } else {
            // backend returned a phone as contactName => treat as unsaved
            setContactInfo(null);
          }
        } else {
          // No saved name — clear contactInfo so header displays phone number
          setContactInfo(null);
        }
      } else {
        if (showLoading) setMessages([]);
      }
    } catch (err: unknown) {
      console.error("Error fetching conversation:", err);

      if (axios.isAxiosError(err) && err.response?.status === 403) {
        setError("You don't have permission to view this conversation");
        setTimeout(() => router.push("/dashboard"), 3000);
      } else if (axios.isAxiosError(err)) {
        setError(
          err.response?.data?.error ||
            err.response?.data?.message ||
            "Failed to load conversation"
        );
      } else {
        setError("Failed to load conversation");
      }

      if (showLoading) setMessages([]);
    } finally {
      if (showLoading) setInitialLoading(false);
      else setIsRefreshing(false);
    }
  }

  const fetchStatuses = async (messageIds: string[]) => {
    if (!messageIds || messageIds.length === 0) return;
    try {
      const results = await Promise.allSettled(
        messageIds.map((id) =>
          api
            .get(`api/Messages/status`, { params: { messageId: id } })
            .then((r) => ({ id, data: r.data }))
        )
      );

      setStatusMap((prev) => {
        const next = { ...prev };
        for (const res of results) {
          if (res.status === "fulfilled") {
            const id = res.value.id;
            const payload: StatusPayload = res.value.data;
            if (payload) {
              if (String(payload.status).toLowerCase() === "read") {
                next[id] = "read";
              } else if (payload.delivered) {
                next[id] = "delivered";
              } else {
                next[id] = "sent";
              }
            }
          } else {
            console.warn("Status check failed", res.reason);
          }
        }
        return next;
      });
    } catch (e) {
      console.error("Error fetching message statuses", e);
    }
  };

  useEffect(() => {
    if (!chatId) return;
    fetchConversation(true);

    const interval = setInterval(() => fetchConversation(false), 5000);
    return () => clearInterval(interval);
  }, [chatId]);

  useEffect(() => {
    if (!messages || messages.length === 0) return;
    const toCheck = messages
      .filter((m) => !m.isIncoming && m.messageId)
      .map((m) => String(m.messageId))
      .filter((id) => !(id in statusMap));

    if (toCheck.length > 0) {
      fetchStatuses(Array.from(new Set(toCheck)));
    }
  }, [messages, statusMap]);

  const handleSendMessage = async (text: string, file?: File | null) => {
    if (!chatId) return false;
    try {
      const phoneNumber = (chatId || "").replace(/^\+/, "");

      let messageText = text;
      const payload: SendMessagePayload = {
        ContactId: phoneNumber,
        MessageText: "",
      };

      if (quote?.messageId) {
        payload.ContextMessageId = quote.messageId;
      } else if (quote?.body) {
        messageText = `> ${quote.body}\n\n${text}`;
      }
      payload.MessageText = messageText;

      let mediaMeta: {
        fileName: string;
        mediaId: string;
        mediaType?: string;
        mediaLocalPath?: string;
      } | null = null;

      if (file) {
        const fd = new FormData();
        fd.append("file", file);
        const mediaResp = await api.post("/api/Messages/media", fd);
        mediaMeta = mediaResp?.data;
        if (!mediaMeta || !mediaMeta.mediaId) {
          throw new Error("Media upload failed");
        }

        payload.MediaId = mediaMeta.mediaId;
        if (mediaMeta.mediaType) payload.MediaType = mediaMeta.mediaType;
        if (mediaMeta.mediaLocalPath)
          payload.MediaLocalPath = mediaMeta.mediaLocalPath;
        if (mediaMeta.fileName) payload.MediaFileName = mediaMeta.fileName;
      }

      const tempId = `temp-${Date.now()}`;
      const optimisticMessage: MessageVm = {
        id: 0,
        messageId: tempId,
        contactName: contactInfo?.name || null,
        contactWaId: phoneNumber,
        messageText: messageText,
        messageType: file ? mediaMeta?.mediaType ?? "media" : "text",
        mediaPath: mediaMeta?.mediaLocalPath ?? null,
        messageDateTime: new Date(),
        isIncoming: false,
        contextMessageId: quote?.messageId || null,
      };
      setMessages((prev) =>
        prev ? [...prev, optimisticMessage] : [optimisticMessage]
      );

      const response = await api.post("/api/Messages/send", payload, {
        headers: { "Content-Type": "application/json" },
      });

      if (response?.status >= 200 && response?.status < 300) {
        setQuote(null);
        await fetchConversation(false);
        setMessages(
          (prev) => prev?.filter((m) => m.messageId !== tempId) || null
        );
        return true;
      } else {
        console.error("Send message returned non-success status", response);
        setMessages(
          (prev) => prev?.filter((m) => m.messageId !== tempId) || null
        );
        return false;
      }
    } catch (error: unknown) {
      console.error("Error sending message:", error);
      setMessages(
        (prev) =>
          prev?.filter((m) => !String(m.messageId).startsWith("temp-")) || null
      );
      if (axios.isAxiosError(error)) {
        const response = error.response;
        if (response?.status === 403) {
          setError("You don't have permission to send message to this contact");
        } else {
          setError(
            response?.data?.error ||
              response?.data?.message ||
              "Failed to send message"
          );
        }
      } else {
        setError((error as Error)?.message || "Failed to send message");
      }
      return false;
    }
  };

  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    if (contextMenu) {
      document.addEventListener("click", handleClick);
      return () => document.removeEventListener("click", handleClick);
    }
  }, [contextMenu]);

  // Save contact modal handlers
  const openSaveModal = () => {
    setSaveError(null);
    // prefill only when we have an actual saved name (not a phone disguised as name)
    setSaveName(contactInfo?.name ?? "");
    setShowSaveModal(true);
  };

  const closeSaveModal = () => {
    setShowSaveModal(false);
    setSaveError(null);
  };

  const handleSaveContact = async () => {
    if (!chatId) return;
    if (!saveName || saveName.trim().length === 0) {
      setSaveError("Name is required");
      return;
    }

    setSaving(true);
    setSaveError(null);
    try {
      const payload = {
        ContactId: chatId.trim(),
        ContactName: saveName.trim(),
      };
      const resp = await api.post("/api/Messages/contacts/save-name", payload);
      const data = resp?.data;
      // Update local display: prefer returned contactName if available
      const newName = data?.contactName ?? saveName.trim();
      setContactInfo({ name: newName });
      // Refresh conversation so server-provided contactName is included in other lists
      await fetchConversation(false);
      setShowSaveModal(false);
    } catch (err: unknown) {
      console.error("Error saving contact name", err);
      if (axios.isAxiosError(err)) {
        setSaveError(
          err.response?.data?.error ||
            err.response?.data?.message ||
            "Failed to save contact"
        );
      } else {
        setSaveError("Failed to save contact");
      }
    } finally {
      setSaving(false);
    }
  };

  // Decide header display and whether a saved name exists (not phone-like)
  const savedNameExists = !!(
    contactInfo?.name && !contactNameLooksLikePhone(contactInfo.name, chatId)
  );

  return (
    <div className="d-lg-flex">
      <div className="w-100 overflow-hidden position-relative">
        <div className="p-3 p-lg-4 border-bottom user-chat-topbar">
          <div className="row align-items-center">
            <div className="col-sm-4 col-8">
              <div className="d-flex align-items-center">
                <div className="d-block d-lg-none me-2 ms-0">
                  <a
                    href="javascript: void(0);"
                    className="user-chat-remove text-muted font-size-16 p-2"
                  >
                    <i className="ri-arrow-left-s-line" />
                  </a>
                </div>
                <div className="me-3 ms-0">
                  <img
                    src="/images/default-avatar.png"
                    className="rounded-circle avatar-xs"
                    alt=""
                  />
                </div>
                <div className="flex-grow-1 overflow-hidden">
                  <h5 className="font-size-16 mb-0 text-truncate">                    
                    {savedNameExists ? contactInfo!.name : chatId || "Unknown"}
                    {isRefreshing && (
                      <span className="w-3 h-3 rounded-full bg-blue-500 animate-pulse inline-block" />
                    )}
                  </h5>
                </div>
              </div>
            </div>
            <div className="col-sm-8 col-4">
              <ul className="list-inline user-chat-nav text-end mb-0">
                {!canViewAllChats && user && (
                  <li className="list-inline-item d-none d-lg-inline-block me-2 ms-0">
                    <button
                      type="button"
                      className="btn nav-btn user-profile-show"
                    >
                      <i className="ri-user-2-line" /> Assigned to you as{" "}
                      {user.role}
                    </button>
                  </li>
                )}
                {chatId && (
                  <li className="list-inline-item d-none d-lg-inline-block me-2 ms-0">
                    <button
                      onClick={openSaveModal}
                      type="button"
                      className="btn nav-btn"
                      data-bs-toggle="modal"
                      data-bs-target="#audiocallModal"
                    >
                      <i className="ri-phone-line" />
                      {savedNameExists ? "Edit" : "Save"}
                    </button>
                  </li>
                )}
              </ul>
            </div>
          </div>
        </div>
        <div className="chat-conversation p-3 p-lg-4">
          {initialLoading ? (
            <div className="flex justify-center items-center h-full">
              Loading messages...
            </div>
          ) : error && (!messages || messages.length === 0) ? (
            <div className="flex justify-center items-center h-full text-red-500">
              {error}
            </div>
          ) : messages && messages.length > 0 ? (
            <ul className="list-unstyled mb-0">
              {messages.map((m) => {
                const uniqueKey = buildMsgKey(m);
                const uiStatus: MessageStatus = m.isIncoming
                  ? "delivered"
                  : m.messageId
                  ? statusMap[String(m.messageId)] ?? "sent"
                  : "sent";

                const rawPath = m.mediaPath ?? "";
                const fileName = rawPath
                  ? rawPath.replace(/\\/g, "/").split("/").pop()
                  : null;

                const mediaUrl = fileName
                  ? `${MEDIA_BASE_URL}api/Messages/media?path=${encodeURIComponent(
                      fileName
                    )}`
                  : undefined;

                const ext = fileName
                  ? fileName.split(".").pop()?.toLowerCase()
                  : undefined;
                let inferredType =
                  (m.messageType || "").toLowerCase() || undefined;
                if (!inferredType || inferredType === "media") {
                  if (
                    ext &&
                    [
                      "jpg",
                      "jpeg",
                      "png",
                      "gif",
                      "webp",
                      "bmp",
                      "svg",
                    ].includes(ext)
                  )
                    inferredType = "image";
                  else if (
                    ext &&
                    ["mp4", "webm", "ogg", "mov", "mkv"].includes(ext)
                  )
                    inferredType = "video";
                  else if (
                    ext &&
                    ["mp3", "wav", "m4a", "aac", "oga"].includes(ext)
                  )
                    inferredType = "audio";
                  else if (ext === "pdf") inferredType = "pdf";
                  else if (
                    ext &&
                    ["doc", "docx", "docm", "dot", "dotx"].includes(ext)
                  )
                    inferredType = "document";
                  else if (ext) inferredType = "document";
                }

                const quotedMessage = m.contextMessageId
                  ? messages.find(
                      (mm) =>
                        (mm.messageId && mm.messageId === m.contextMessageId) ||
                        String(mm.id) === String(m.contextMessageId)
                    )
                  : undefined;

                return (
                  <li
                    key={uniqueKey}
                    className={m.isIncoming ? "" : "right"}
                    // onContextMenu={(e) => {
                    //   e.preventDefault();
                    //   setContextMenu({ x: e.clientX, y: e.clientY, message: m });
                    // }}
                  >
                    <MessageBubble
                      message={{
                        id: uniqueKey,
                        body: m.messageText ?? "",
                        timestamp: new Date(m.messageDateTime),
                        status: uiStatus,
                        direction: m.isIncoming ? "incoming" : "outgoing",
                        chatId: chatId || "",
                        mediaPath: mediaUrl ?? undefined,
                        messageType: inferredType,
                      }}
                      quotedText={quotedMessage?.messageText ?? null}
                      onReply={() => {
                        setQuote({
                          id: buildMsgKey(m),
                          body: m.messageText ?? "",
                          messageId: m.messageId ?? null,
                        });
                        setContextMenu(null);
                      }}
                    />
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="flex justify-center items-center h-full text-gray-500">
              No messages yet. Start a conversation with{" "}
              {savedNameExists ? contactInfo!.name : chatId || "this contact"}.
            </div>
          )}
        </div>
        <div className="chat-input-section p-3 p-lg-4 border-top mb-0">
          {quote && (
            <div className="card quote-card p-2">
              <div className="d-flex align-items-start mb-1">
                <em className="flex-grow-1">Replying to</em>
                <a
                  href="#"
                  onClick={() => setQuote(null)}
                  className="fw-medium"
                >
                  <i className="ri-close-fill"></i>
                </a>
              </div>
              <div className="rounded bg-light p-2">
                <p className="mb-0">{quote.body}</p>
              </div>
            </div>
          )}

          <MessageInput onSend={handleSendMessage} />
        </div>
      </div>

      {contextMenu && (
        <div
          className="fixed z-50 bg-white border rounded shadow-lg p-2"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            onClick={() => {
              const msg = contextMenu.message;
              setQuote({
                id: buildMsgKey(msg),
                body: msg.messageText ?? "",
                messageId: msg.messageId ?? null,
              });
              setContextMenu(null);
            }}
            className="text-sm hover:bg-gray-100 px-2 py-1 rounded"
          >
            Reply
          </button>
        </div>
      )}

      {/* Save Contact Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded shadow-lg w-full max-w-md p-4">
            <h3 className="font-semibold mb-2">
              {savedNameExists ? "Edit contact" : "Save contact"}
            </h3>
            <p className="text-xs text-gray-500 mb-3">Phone: {chatId}</p>
            <label className="block text-sm mb-1">Name</label>
            <input
              className="w-full border rounded px-3 py-2 mb-2"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              placeholder="Full name"
            />
            {saveError && (
              <div className="text-red-500 text-sm mb-2">{saveError}</div>
            )}
            <div className="flex justify-end gap-2">
              <button
                onClick={closeSaveModal}
                className="px-3 py-1 rounded border bg-white hover:bg-gray-50"
                disabled={saving}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveContact}
                className="btn btn-primary"
                disabled={saving}
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
