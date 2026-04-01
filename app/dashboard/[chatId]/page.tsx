// Page for specific chat conversation
// app/dashboard/[chatId]/page.tsx

"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import MessageBubble from "../../../components/chat/MessageBubble";
import MessageInput from "../../../components/chat/MessageInput";
import api, { MEDIA_BASE_URL } from "@/lib/api";
import { useAuth } from "@/components/providers/AuthProvider";
import { PERMISSIONS } from "@/lib/permissions";
import axios from "axios";

// Match your backend MessageViewModel
type ChatMessageType = "text" | "image" | "video" | "audio" | "pdf" | "document";

type MessageVm = {
  id: number;
  messageId?: string | null;
  messageType: ChatMessageType;
  mediaId?: string | null;
  mediaFileName?: string | null;
  fileName?: string | null;
  mediaUrl?: string | null;
  contactName?: string | null;
  contactWaId: string;
  messageText?: string | null;
  mediaPath?: string | null;
  messageDateTime: string | Date;
  isIncoming: boolean;
  contextMessageId?: string | null;
  sentBy?: number | null;
  senderName?: string | null;
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
  MediaUrl?: string;
  FileName?: string;
  MediaFileName?: string;
  contactId?: string;
  text?: string;
  contextMessageId?: string;
  mediaId?: string;
  mediaType?: string;
  mediaLocalPath?: string;
  mediaUrl?: string;
  fileName?: string;
  mediaFileName?: string;
  To?: string;
  to?: string;
  PhoneNumber?: string;
  phoneNumber?: string;
  Body?: string;
  body?: string;
  From?: string;
  from?: string;
  message?: string;
  Recipient?: string;
  recipient?: string;
  ContactWaId?: string;
  contactWaId?: string;
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

function buildContactIdVariants(contactId?: string) {
  const raw = String(contactId ?? "").trim();
  const digits = digitsOnly(raw);
  const plus = digits ? `+${digits}` : "";
  return Array.from(new Set([raw, digits, plus].filter(Boolean)));
}

function inferMediaTypeFromFile(file: File): string {
  const mime = String(file.type || "").toLowerCase();
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  if (mime === "application/pdf") return "pdf";
  return "document";
}

function normalizeOutboundMediaType(v?: string | null, file?: File | null): ChatMessageType {
  const raw = String(v ?? "").toLowerCase().trim();
  if (raw === "image" || raw === "video" || raw === "audio" || raw === "pdf" || raw === "document") {
    return raw;
  }
  if (file) {
    const inferred = inferMediaTypeFromFile(file);
    if (inferred === "image" || inferred === "video" || inferred === "audio" || inferred === "pdf") {
      return inferred;
    }
  }
  return "document";
}

function getErrorStatus(err: unknown): number | undefined {
  if (axios.isAxiosError(err)) return err.response?.status;
  if (err && typeof err === "object" && "statusCode" in err) {
    const statusCode = (err as { statusCode?: unknown }).statusCode;
    if (typeof statusCode === "number") return statusCode;
  }
  return undefined;
}

function getErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    return (
      err.response?.data?.error ||
      err.response?.data?.message ||
      err.message ||
      ""
    );
  }
  if (err && typeof err === "object") {
    const maybe = err as { message?: unknown; errorMessage?: unknown };
    if (typeof maybe.errorMessage === "string" && maybe.errorMessage.trim()) {
      return maybe.errorMessage;
    }
    if (typeof maybe.message === "string" && maybe.message.trim()) {
      return maybe.message;
    }
  }
  return "";
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
  const { user, isAuthenticated, isLoading, checkPolicy } = useAuth();
  const canViewAllChats = checkPolicy(PERMISSIONS.POLICY_VIEW_ALL_CHATS);

  useEffect(() => {
    if (isLoading) {
      return;
    }

    if (!isAuthenticated) {
      router.replace("/login");
      return;
    }

    if (!chatId) {
      setError("Invalid chat id");
      setInitialLoading(false);
    } else {
      setError(null);
    }
  }, [chatId, isAuthenticated, isLoading, router]);

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
        // Use the canonical messages-by-contact endpoint.
        // Try the exact path the frontend expects, with a leading-plus fallback for phone ids.
        const idRaw = String(chatId || "");
        const idWithPlus = idRaw.startsWith("+") ? idRaw : `+${idRaw}`;
        let response = undefined as any;

        try {
          // Primary expected shape
          response = await api.get(`/api/Messages/contact/${encodeURIComponent(idRaw)}`);
        } catch (err: unknown) {
          const status = (err as any)?.statusCode ?? (err as any)?.response?.status;
          if (status === 404) {
            // Try with leading plus if not found
            try {
              response = await api.get(`/api/Messages/contact/${encodeURIComponent(idWithPlus)}`);
            } catch (err2: unknown) {
              const status2 = (err2 as any)?.statusCode ?? (err2 as any)?.response?.status;
              if (status2 === 404) {
                throw new Error("No messages endpoint matched (404)");
              }
              throw err2;
            }
          } else {
            throw err;
          }
        }

        const data = response.data;

      if (Array.isArray(data) || data) {
        // normalize server response to internal MessageVm shape
        const normalized = (await import('@/lib/chatAdapter')).default.normalizeMessages(data, chatId);
        const cleaned = dedupeAndSort(normalized as any);
        setMessages(cleaned as any);

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
      // Batch in groups of 10 to avoid flooding the backend
      const batchSize = 10;
      for (let i = 0; i < messageIds.length; i += batchSize) {
        const batch = messageIds.slice(i, i + batchSize);
        const results = await Promise.allSettled(
          batch.map((id) =>
            api
              .get(`/api/Messages/status`, { params: { messageId: id } })
              .then((r) => ({ id, data: r.data }))
              .catch((err) => {
                if (err?.statusCode === 404 || err?.response?.status === 404) return { id, data: null };
                throw err;
              })
          )
        );

        setStatusMap((prev) => {
          const next = { ...prev };
          for (const res of results) {
            if (res.status === "fulfilled") {
              const id = res.value.id;
              const payload: StatusPayload = res.value.data;
              // Mark IDs even when endpoint returns null/404 so we do not refetch forever.
              if (!payload) {
                next[id] = "sent";
              } else if (String(payload.status).toLowerCase() === "read") {
                next[id] = "read";
              } else if (payload.delivered) {
                next[id] = "delivered";
              } else {
                next[id] = "sent";
              }
            }
          }
          return next;
        });
      }
    } catch (e) {
      console.error("Error fetching message statuses", e);
    }
  };

  // Reset all state immediately when chatId changes so the UI is clean before fetch
  const prevChatIdRef = useRef(chatId);
  useEffect(() => {
    if (chatId !== prevChatIdRef.current) {
      prevChatIdRef.current = chatId;
      setMessages(null);
      setContactInfo(null);
      setStatusMap({});
      setError(null);
      setQuote(null);
      setContextMenu(null);
      setInitialLoading(true);
    }
  }, [chatId]);

  useEffect(() => {
    if (!chatId) return;
    fetchConversation(true);

    const interval = setInterval(() => fetchConversation(false), 15000);
    return () => clearInterval(interval);
  }, [chatId]);

  useEffect(() => {
    if (!messages || messages.length === 0) return;
    const toCheck = messages
      .filter(
        (m) =>
          !m.isIncoming &&
          m.messageId &&
          !String(m.messageId).startsWith("temp-")
      )
      .map((m) => String(m.messageId))
      .filter((id) => !(id in statusMap));

    if (toCheck.length > 0) {
      fetchStatuses(Array.from(new Set(toCheck)));
    }
  }, [messages, statusMap]);

  const handleSendMessage = async (text: string, file?: File | null) => {
    if (!chatId) return false;
    try {
      const hasFile = Boolean(file);
      const inputText = String(text ?? "");
      const hasText = inputText.trim().length > 0;
      if (!hasFile && !hasText) return false;

      const phoneNumber = digitsOnly(chatId || "");
      const contactIdVariants = buildContactIdVariants(chatId);
      const recipientDigits = digitsOnly(chatId || "");
      const recipientPlus = recipientDigits ? `+${recipientDigits}` : "";

      let messageText = hasText ? inputText : "";
      const payloadBase: SendMessagePayload = {
        ContactId: phoneNumber,
        MessageText: messageText,
      };

      if (quote?.messageId) {
        payloadBase.ContextMessageId = quote.messageId;
      } else if (quote?.body) {
        messageText = hasText ? `> ${quote.body}\n\n${inputText}` : "";
      }

      payloadBase.MessageText = messageText;
      payloadBase.contactId = phoneNumber;
      payloadBase.text = messageText;
      payloadBase.Body = messageText;
      payloadBase.body = messageText;
      payloadBase.message = messageText;
      if (payloadBase.ContextMessageId) {
        payloadBase.contextMessageId = payloadBase.ContextMessageId;
      }

      let mediaMeta: {
        mediaId: string;
        mediaType: ChatMessageType;
        mediaFileName: string;
        fileName: string;
        mediaPath: string;
        mediaUrl?: string;
      } | null = null;

      if (hasFile && file) {
        const fd = new FormData();
        fd.append("file", file);

        const mediaResp = await api.post("/api/Messages/media", fd);
        const envelope = mediaResp?.data as Record<string, unknown> | null;
        const rawMeta =
          envelope && typeof envelope.data === "object" && envelope.data !== null
            ? (envelope.data as Record<string, unknown>)
            : envelope;

        const mediaId =
          typeof rawMeta?.mediaId === "string"
            ? rawMeta.mediaId
            : typeof rawMeta?.MediaId === "string"
            ? rawMeta.MediaId
            : typeof rawMeta?.attachmentId === "string"
            ? rawMeta.attachmentId
            : typeof rawMeta?.id === "string"
            ? rawMeta.id
            : "";

        const mediaFileName =
          (typeof rawMeta?.mediaFileName === "string" && rawMeta.mediaFileName) ||
          (typeof rawMeta?.MediaFileName === "string" && rawMeta.MediaFileName) ||
          (typeof rawMeta?.fileName === "string" && rawMeta.fileName) ||
          (typeof rawMeta?.FileName === "string" && rawMeta.FileName) ||
          file.name;

        const mediaPath =
          (typeof rawMeta?.mediaPath === "string" && rawMeta.mediaPath) ||
          (typeof rawMeta?.MediaPath === "string" && rawMeta.MediaPath) ||
          (typeof rawMeta?.mediaLocalPath === "string" && rawMeta.mediaLocalPath) ||
          (typeof rawMeta?.MediaLocalPath === "string" && rawMeta.MediaLocalPath) ||
          (typeof rawMeta?.path === "string" && rawMeta.path) ||
          "";

        const mediaUrl =
          (typeof rawMeta?.mediaUrl === "string" && rawMeta.mediaUrl) ||
          (typeof rawMeta?.MediaUrl === "string" && rawMeta.MediaUrl) ||
          undefined;

        if (!mediaId || !mediaPath || !mediaFileName) {
          throw new Error("Media upload failed");
        }

        mediaMeta = {
          mediaId,
          mediaType: normalizeOutboundMediaType(
            (typeof rawMeta?.mediaType === "string" && rawMeta.mediaType) ||
              (typeof rawMeta?.MediaType === "string" && rawMeta.MediaType) ||
              (typeof rawMeta?.mimeType === "string" && rawMeta.mimeType) ||
              null,
            file
          ),
          mediaFileName,
          fileName: mediaFileName,
          mediaPath,
          mediaUrl,
        };
      }

      const payload: SendMessagePayload = { ...payloadBase };
      if (mediaMeta) {
        payload.MediaId = mediaMeta.mediaId;
        payload.mediaId = mediaMeta.mediaId;
        payload.MediaType = mediaMeta.mediaType;
        payload.mediaType = mediaMeta.mediaType;
        payload.MediaFileName = mediaMeta.mediaFileName;
        payload.mediaFileName = mediaMeta.mediaFileName;
        payload.FileName = mediaMeta.fileName;
        payload.fileName = mediaMeta.fileName;
        payload.MediaLocalPath = mediaMeta.mediaPath;
        payload.mediaLocalPath = mediaMeta.mediaPath;
        if (mediaMeta.mediaUrl) {
          payload.MediaUrl = mediaMeta.mediaUrl;
          payload.mediaUrl = mediaMeta.mediaUrl;
        }

        if (!hasText) {
          payload.MessageText = "";
          payload.text = "";
          payload.Body = "";
          payload.body = "";
          payload.message = "";
        }
      }

      const tempId = `temp-${Date.now()}`;
      
      // Define type guards with proper interfaces
      interface UserWithId { id: number; }
      interface UserWithUserId { userId: number; }
      interface UserWithName { firstName: string; otherName?: string; }
      
      // Type-safe checks
      const hasId = (u: unknown): u is UserWithId => 
        u !== null && typeof u === 'object' && 'id' in u && typeof (u as UserWithId).id === 'number';
        
      const hasUserId = (u: unknown): u is UserWithUserId => 
        u !== null && typeof u === 'object' && 'userId' in u && typeof (u as UserWithUserId).userId === 'number';
        
      const hasName = (u: unknown): u is UserWithName => 
        u !== null && 
        typeof u === 'object' && 
        'firstName' in u && 
        typeof (u as UserWithName).firstName === 'string';
      
      // Extract user ID safely
      let userId: number | null = null;
      if (user) {
        if (hasId(user)) {
          userId = user.id;
        } else if (hasUserId(user)) {
          userId = user.userId;
        }
      }
      
      // Extract user name safely - only use firstName and otherName as requested
      let userName = "You";
      if (user && hasName(user)) {
        if (user.firstName) {
          if ('otherName' in user && typeof user.otherName === 'string') {
            userName = `${user.firstName} ${user.otherName}`;
          } else {
            userName = user.firstName;
          }
        }
      }

      const senderPhone =
        user && "phoneNumber" in user && typeof user.phoneNumber === "string"
          ? user.phoneNumber.trim()
          : "";
      const senderDigits = digitsOnly(senderPhone);
      const senderPlus = senderDigits ? `+${senderDigits}` : senderPhone;
        
      const optimisticMessage: MessageVm = {
        id: 0,
        messageId: tempId,
        messageType: mediaMeta ? mediaMeta.mediaType : "text",
        mediaId: mediaMeta?.mediaId ?? null,
        mediaFileName: mediaMeta?.mediaFileName ?? null,
        fileName: mediaMeta?.fileName ?? null,
        mediaUrl: mediaMeta?.mediaUrl ?? null,
        contactName: contactInfo?.name || null,
        contactWaId: phoneNumber,
        messageText: messageText,
        mediaPath: mediaMeta?.mediaPath ?? null,
        messageDateTime: new Date(),
        isIncoming: false,
        contextMessageId: quote?.messageId || null,
        sentBy: userId,
        senderName: userName,
      };
      setMessages((prev) =>
        prev ? [...prev, optimisticMessage] : [optimisticMessage]
      );

      let response = null as Awaited<ReturnType<typeof api.post>> | null;
      let lastError: unknown = null;
      const endpoints = ["/api/Messages/send", "/api/Messages"];

      for (const endpoint of endpoints) {
        for (const contactIdVariant of contactIdVariants) {
          try {
            const attemptPayload: SendMessagePayload = {
              ...payload,
              ContactId: contactIdVariant,
              contactId: contactIdVariant,
              To: recipientPlus || contactIdVariant,
              to: recipientPlus || contactIdVariant,
              Recipient: recipientPlus || contactIdVariant,
              recipient: recipientPlus || contactIdVariant,
              ContactWaId: recipientPlus || contactIdVariant,
              contactWaId: recipientPlus || contactIdVariant,
              PhoneNumber: recipientDigits || contactIdVariant,
              phoneNumber: recipientDigits || contactIdVariant,
              From: senderPlus,
              from: senderPlus,
            };

            response = await api.post(endpoint, attemptPayload);
            break;
          } catch (err) {
            lastError = err;

            const status = getErrorStatus(err);
            const apiMessage = getErrorMessage(err);

            if (!status) {
              throw err;
            }

            const shouldRetry =
              (status === 400 || status === 401 || status === 404) &&
              /send failed|invalid|not found|unauthorized/i.test(apiMessage);

            if (!shouldRetry) {
              throw err;
            }
          }
        }

        if (response) {
          break;
        }
      }

      if (!response && lastError) {
        throw lastError;
      }

      if (response?.status >= 200 && response?.status < 300) {
        setQuote(null);
        setMessages(
          (prev) => prev?.filter((m) => m.messageId !== tempId) || null
        );
        await fetchConversation(false);
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
                    href="#"
                    onClick={(e) => { e.preventDefault(); router.push('/dashboard'); }}
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
                      {(() => {
                        // Type-safe role check without using 'any'
                        interface UserWithRole { role: string; }
                        
                        const hasRole = (u: unknown): u is UserWithRole => 
                          u !== null && 
                          typeof u === 'object' && 
                          'role' in u && 
                          typeof (u as UserWithRole).role === 'string';
                          
                        return hasRole(user) ? user.role : 'User';
                      })()}
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

                const messageType = m.messageType || "text";

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
                        messageId: m.messageId ?? null,
                        body: m.messageText ?? "",
                        timestamp: new Date(m.messageDateTime),
                        status: uiStatus,
                        direction: m.isIncoming ? "incoming" : "outgoing",
                        chatId: chatId || "",
                        mediaPath: m.mediaPath ?? undefined,
                        mediaUrl: m.mediaUrl ?? undefined,
                        mediaId: m.mediaId ?? undefined,
                        mediaFileName: m.mediaFileName ?? undefined,
                        fileName: m.fileName ?? undefined,
                        messageType,
                        senderName: !m.isIncoming ? m.senderName : null,
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
