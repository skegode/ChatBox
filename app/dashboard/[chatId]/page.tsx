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
  id: number | string;
  messageId?: string | null;
  isOutgoing?: boolean;
  sourcePhoneNumberId?: string | null;
  displayPhoneNumber?: string | null;
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
  contactId: string;
  messageText: string;
  contextMessageId?: string | null;
  ContactId?: string;
  MessageText?: string;
  ContextMessageId?: string;
  mediaId?: string;
  mediaType?: string;
  mediaLocalPath?: string;
  mediaUrl?: string;
  fileName?: string;
  mediaFileName?: string;
  MediaId?: string;
  MediaType?: string;
  MediaLocalPath?: string;
  MediaUrl?: string;
  FileName?: string;
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

function buildContactIdVariants(contactId?: string) {
  const raw = String(contactId ?? "").trim();
  const digits = digitsOnly(raw);
  const plus = digits ? `+${digits}` : "";
  return Array.from(new Set([raw, digits, plus].filter(Boolean)));
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
    if (typeof maybe.errorMessage === "string" && maybe.errorMessage.trim()) return maybe.errorMessage;
    if (typeof maybe.message === "string" && maybe.message.trim()) return maybe.message;
  }
  return "";
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

function getSendFailureReason(payload: unknown): string | null {
  const readString = (obj: unknown, key: string): string => {
    if (!obj || typeof obj !== "object") return "";
    const value = (obj as Record<string, unknown>)[key];
    return typeof value === "string" ? value.trim() : "";
  };

  const parseNestedDetails = (details: string): string => {
    const trimmed = details.trim();
    if (!trimmed) return "";
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      const nestedError = readString(parsed, "error");
      if (nestedError) return nestedError;
      const nestedMessage = readString(parsed, "message");
      if (nestedMessage) return nestedMessage;
      if (parsed && typeof parsed === "object") {
        const errObj = (parsed as Record<string, unknown>)["error"];
        const errMessage = readString(errObj, "message");
        if (errMessage) return errMessage;
      }
    } catch {
      // ignore parse failure and use raw details string
    }
    return trimmed;
  };

  if (typeof payload === "string") {
    const txt = payload.trim();
    if (/whatsapp send failed|oauth|invalid access token|unauthorized|forbidden/i.test(txt)) {
      return txt;
    }
    return null;
  }

  if (!payload || typeof payload !== "object") return null;

  const errorText = readString(payload, "error");
  const messageText = readString(payload, "message");
  const detailsText = readString(payload, "details");
  const errorsValue = (payload as Record<string, unknown>)["errors"];

  if (errorsValue && typeof errorsValue === "object") {
    const flattened = Object.entries(errorsValue as Record<string, unknown>)
      .map(([field, value]) => {
        if (Array.isArray(value)) {
          return `${field}: ${value.map((v) => String(v)).join(", ")}`;
        }
        if (typeof value === "string") {
          return `${field}: ${value}`;
        }
        return "";
      })
      .filter(Boolean)
      .join(" | ");
    if (flattened) return flattened;
  }

  if (errorText) {
    const detailReason = parseNestedDetails(detailsText);
    return detailReason ? `${errorText}: ${detailReason}` : errorText;
  }

  const successValue = (payload as Record<string, unknown>)["success"];
  const okValue = (payload as Record<string, unknown>)["ok"];
  const statusValue = String((payload as Record<string, unknown>)["status"] ?? "").toLowerCase();
  const explicitlyFailed =
    successValue === false ||
    okValue === false ||
    statusValue === "failed" ||
    statusValue === "error";

  if (explicitlyFailed) {
    if (messageText) return messageText;
    if (detailsText) return parseNestedDetails(detailsText) || detailsText;
    return "Message send was rejected by upstream";
  }

  return null;
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
  const statusRetryAtRef = useRef<Record<string, number>>({});
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
    const messageId = String(m.messageId ?? '').trim().toLowerCase();
    if (messageId && !messageId.startsWith('temp-')) return `mid:${messageId}`;

    const numericId = String(m.id ?? '').trim();
    if (numericId && numericId !== '0') return `id:${numericId}`;

    const ts = new Date(m.messageDateTime).getTime();
    const body = String(m.messageText ?? '').trim().toLowerCase();
    const media = String(m.mediaPath ?? '').trim().toLowerCase();
    const direction = m.isIncoming ? 'in' : 'out';
    const contact = String(m.contactWaId ?? '').replace(/\D/g, '');
    // Fallback fingerprint for duplicate webhook payloads with missing IDs.
    return `fp:${contact}:${direction}:${ts}:${m.messageType}:${body}:${media}`;
  };

  const dedupeAndSort = (arr: MessageVm[]) => {
    const byKey = new Map<string, MessageVm>();
    const scoreMessage = (m: MessageVm) =>
      (m.messageId ? 4 : 0) +
      (m.mediaPath ? 2 : 0) +
      (m.messageText ? 1 : 0);

    const signature = (m: MessageVm) => {
      const contact = String(m.contactWaId ?? '').replace(/\D/g, '');
      const type = String(m.messageType ?? '').toLowerCase();
      const body = String(m.messageText ?? '').trim().toLowerCase();
      const media = String(m.mediaPath ?? '').trim().toLowerCase();
      return `${contact}:${type}:${body}:${media}`;
    };

    for (const m of arr) {
      const key = buildMsgKey(m);
      const existing = byKey.get(key);
      if (!existing) {
        byKey.set(key, m);
        continue;
      }

      // Prefer the richer/latest payload when duplicates collide.
      const existingScore = scoreMessage(existing);
      const currentScore = scoreMessage(m);
      if (currentScore >= existingScore) {
        byKey.set(key, m);
      }
    }

    const items = Array.from(byKey.values());

    items.sort(
      (a, b) =>
        new Date(a.messageDateTime).getTime() -
        new Date(b.messageDateTime).getTime()
    );

    // Second-pass compaction for duplicated inbound webhooks that arrive with
    // different IDs but identical content and near-identical timestamps.
    // Looks back through the last 10 messages within the window, not just the
    // immediately preceding one, to catch non-adjacent duplicates.
    const compacted: MessageVm[] = [];
    const DUP_WINDOW_MS = 60_000; // 60 s window
    for (const m of items) {
      if (!m.isIncoming) {
        compacted.push(m);
        continue;
      }

      const currTs = new Date(m.messageDateTime).getTime();
      const sig = signature(m);
      let foundDup = false;

      // Look back up to 10 recent incoming entries within the window.
      for (let i = compacted.length - 1; i >= Math.max(0, compacted.length - 10); i--) {
        const candidate = compacted[i];
        if (!candidate.isIncoming) continue;
        const candTs = new Date(candidate.messageDateTime).getTime();
        if (Number.isFinite(currTs) && Number.isFinite(candTs) && Math.abs(currTs - candTs) > DUP_WINDOW_MS) break;
        if (signature(candidate) === sig) {
          if (scoreMessage(m) >= scoreMessage(candidate)) {
            compacted[i] = m;
          }
          foundDup = true;
          break;
        }
      }

      if (!foundDup) compacted.push(m);
    }

    return compacted;
  };

  const getContextIdFromMessage = (m?: MessageVm | null): string | null => {
    if (!m) return null;
    const explicit = String(m.messageId ?? "").trim();
    if (!explicit || explicit.startsWith("temp-")) return null;
    // WhatsApp context IDs are not numeric DB row IDs; reject numeric-only values.
    if (/^\d+$/.test(explicit)) return null;
    return explicit;
  };

  async function fetchConversationData(targetChatId: string) {
    const contactIdVariants = buildContactIdVariants(targetChatId);
    let lastError: unknown = null;

    const tryEndpoint = async (
      requestFactory: (contactId: string) => Promise<{ data: unknown }>
    ) => {
      for (const contactIdVariant of contactIdVariants) {
        try {
          return await requestFactory(contactIdVariant);
        } catch (err) {
          lastError = err;
          const status = getErrorStatus(err);
          if (status === 404 || status === 502 || status === 503) {
            continue;
          }
          throw err;
        }
      }

      return null;
    };

    const pathResponse = await tryEndpoint((contactIdVariant) =>
      api.get(`/api/Messages/contact/${encodeURIComponent(contactIdVariant)}`)
    );
    if (pathResponse) {
      return pathResponse.data;
    }

    const queryResponse = await tryEndpoint((contactIdVariant) =>
      api.get(`/api/Messages`, { params: { contactId: contactIdVariant } })
    );
    if (queryResponse) {
      return queryResponse.data;
    }

    if (lastError) {
      throw lastError;
    }

    return null;
  }

  async function fetchConversation(showLoading = true) {
    if (!chatId) return;
    if (showLoading) {
      setInitialLoading(true);
    } else {
      setIsRefreshing(true);
    }
    setError(null);

    try {
        const data = await fetchConversationData(chatId);

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

      return true;
    } catch (err: unknown) {
      console.error("Error fetching conversation:", err);

      const status = getErrorStatus(err);
      const message = getErrorMessage(err);

      if (status === 403) {
        setError("You don't have permission to view this conversation");
        setTimeout(() => router.push("/dashboard"), 3000);
      } else {
        setError(message || "Failed to load conversation");
      }

      if (showLoading) setMessages([]);
      return false;
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
              .then((r) => ({ id, data: r.data, retryAfterMs: 0 }))
              .catch((err) => {
                const status = getErrorStatus(err);
                if (status === 404) return { id, data: null, retryAfterMs: 0 };
                if (status === 429 || status === 502 || status === 503) {
                  return { id, data: null, retryAfterMs: 60_000 };
                }
                throw err;
              })
          )
        );

        setStatusMap((prev) => {
          const next = { ...prev };
          for (const res of results) {
            if (res.status === "fulfilled") {
              const id = res.value.id;
              if (res.value.retryAfterMs > 0) {
                statusRetryAtRef.current[id] = Date.now() + res.value.retryAfterMs;
                continue;
              }

              delete statusRetryAtRef.current[id];
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

  // Scroll refs for auto-scrolling to the latest message
  const bottomRef = useRef<HTMLDivElement>(null);
  const conversationRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    bottomRef.current?.scrollIntoView({ behavior, block: 'end' });
  };

  // Scroll to bottom instantly when switching chats or when initial load completes
  useEffect(() => {
    if (!initialLoading && messages && messages.length > 0) {
      scrollToBottom('instant');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId, initialLoading]);

  // Smart-scroll on new messages: only if user is already near the bottom
  const msgCount = messages ? messages.length : 0;
  useEffect(() => {
    if (initialLoading || !messages || messages.length === 0) return;
    const el = conversationRef.current;
    const isNearBottom = el
      ? el.scrollHeight - el.scrollTop - el.clientHeight < 200
      : true;
    if (isNearBottom) scrollToBottom('smooth');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [msgCount]);

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
    // Tell the chat list to clear the unread badge for this contact immediately.
    window.dispatchEvent(new CustomEvent('chatOpened', { detail: { contactId: chatId } }));

    const interval = setInterval(() => fetchConversation(false), 15000);
    return () => clearInterval(interval);
  }, [chatId]);

  useEffect(() => {
    if (!messages || messages.length === 0) return;
    const now = Date.now();
    const toCheck = messages
      .filter(
        (m) =>
          !m.isIncoming &&
          m.messageId &&
          !String(m.messageId).startsWith("temp-") &&
          (statusRetryAtRef.current[String(m.messageId)] ?? 0) <= now
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
      const latestIncomingContextMessageId =
        [...(messages ?? [])]
          .reverse()
          .map((m) => (m.isIncoming ? getContextIdFromMessage(m) : null))
          .find((id): id is string => Boolean(id)) ?? null;
      const resolvedContextMessageId =
        quote?.messageId ?? latestIncomingContextMessageId ?? null;

      let messageText = hasText ? inputText : "";
      const payloadBase: SendMessagePayload = {
        contactId: phoneNumber,
        messageText,
        ...(resolvedContextMessageId ? { contextMessageId: resolvedContextMessageId, ContextMessageId: resolvedContextMessageId } : {}),
        ContactId: phoneNumber,
        MessageText: messageText,
      };

      if (!quote?.messageId && quote?.body) {
        messageText = hasText ? `> ${quote.body}\n\n${inputText}` : "";
        payloadBase.messageText = messageText;
        payloadBase.MessageText = messageText;
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
        payload.mediaId = mediaMeta.mediaId;
        payload.MediaId = mediaMeta.mediaId;
        payload.mediaType = mediaMeta.mediaType;
        payload.MediaType = mediaMeta.mediaType;
        payload.mediaFileName = mediaMeta.mediaFileName;
        payload.MediaFileName = mediaMeta.mediaFileName;
        payload.fileName = mediaMeta.fileName;
        payload.FileName = mediaMeta.fileName;
        payload.mediaLocalPath = mediaMeta.mediaPath;
        payload.MediaLocalPath = mediaMeta.mediaPath;
        if (mediaMeta.mediaUrl) {
          payload.mediaUrl = mediaMeta.mediaUrl;
          payload.MediaUrl = mediaMeta.mediaUrl;
        }

        if (!hasText) {
          payload.messageText = "";
          payload.MessageText = "";
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

      const optimisticMessage: MessageVm = {
        id: 0,
        messageId: tempId,
        isOutgoing: true,
        sourcePhoneNumberId: null,
        displayPhoneNumber: null,
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
        contextMessageId: resolvedContextMessageId,
        sentBy: userId,
        senderName: userName,
      };
      setMessages((prev) =>
        prev ? [...prev, optimisticMessage] : [optimisticMessage]
      );

      const response = await api.post("/api/Messages/send", payload);

      if ((response as { status?: number } | null)?.status !== undefined && (response as { status: number }).status >= 200 && (response as { status: number }).status < 300) {
        setQuote(null);

        const responseData = (response as { data?: unknown } | null)?.data;
        const sendFailureReason = getSendFailureReason(responseData);
        if (sendFailureReason) {
          throw new Error(sendFailureReason);
        }

        const normalizedResponse = responseData
          ? (await import("@/lib/chatAdapter")).default.normalizeMessages(
              Array.isArray(responseData) ? responseData : [responseData],
              chatId
            )
          : [];

        if (normalizedResponse.length > 0) {
          setMessages((prev) => {
            const withoutTemp = prev?.filter((m) => m.messageId !== tempId) || [];
            return dedupeAndSort([
              ...withoutTemp,
              ...(normalizedResponse as MessageVm[]).map((message) => ({
                ...message,
                isIncoming: false,
              })),
            ]);
          });
          void fetchConversation(false);
        } else {
          const refreshed = await fetchConversation(false);
          if (refreshed) {
            setMessages(
              (prev) => prev?.filter((m) => m.messageId !== tempId) || null
            );
          }
        }

        window.dispatchEvent(new CustomEvent('chatMessageSent', { detail: { contactId: chatId } }));
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
        const parsedReason = getSendFailureReason(response?.data);
        if (response?.status === 403) {
          setError("You don't have permission to send message to this contact");
        } else if (parsedReason) {
          setError(parsedReason);
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

  const latestIncomingMessage =
    [...(messages ?? [])]
      .reverse()
      .find(
        (m) =>
          m.isIncoming && Boolean(getContextIdFromMessage(m))
      ) ?? null;

  const resolvedContextMessageId =
    quote?.messageId ?? getContextIdFromMessage(latestIncomingMessage) ?? null;

  const resolvedContextMessage = resolvedContextMessageId
    ? (messages ?? []).find(
        (m) =>
          (m.messageId && m.messageId === resolvedContextMessageId) ||
          String(m.id) === String(resolvedContextMessageId)
      ) ?? null
    : null;

  const replySourceNumber =
    resolvedContextMessage?.displayPhoneNumber ||
    resolvedContextMessage?.sourcePhoneNumberId ||
    null;

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
        <div ref={conversationRef} className="chat-conversation p-3 p-lg-4">
          {initialLoading ? (
            <div className="flex justify-center items-center h-full">
              Loading messages...
            </div>
          ) : error && (!messages || messages.length === 0) ? (
            <div className="flex justify-center items-center h-full text-red-500">
              {error}
            </div>
          ) : messages && messages.length > 0 ? (
            <>
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
                        isOutgoing: m.isOutgoing ?? !m.isIncoming,
                        sourcePhoneNumberId: m.sourcePhoneNumberId ?? null,
                        displayPhoneNumber: m.displayPhoneNumber ?? null,
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
                        const replyContextId = getContextIdFromMessage(m);
                        setQuote({
                          id: buildMsgKey(m),
                          body: m.messageText ?? "",
                          messageId: replyContextId,
                        });
                        setContextMenu(null);
                      }}
                    />
                  </li>
                );
              })}
            </ul>
            <div ref={bottomRef} />
            </>
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

          <div className="mb-2">
            {replySourceNumber ? (
              <span className="badge bg-info-subtle text-info-emphasis" style={{ fontSize: 12, fontWeight: 500 }}>
                Reply will be sent from {replySourceNumber}
              </span>
            ) : (
              <span className="badge bg-secondary-subtle text-secondary-emphasis" style={{ fontSize: 12, fontWeight: 500 }}>
                No reply context selected. Message will be sent using the default sender number.
              </span>
            )}
          </div>

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
              const replyContextId = getContextIdFromMessage(msg);
              setQuote({
                id: buildMsgKey(msg),
                body: msg.messageText ?? "",
                messageId: replyContextId,
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
