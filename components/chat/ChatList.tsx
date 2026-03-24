//components/chat/ChatList.tsx
"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { PlusCircle, RefreshCw } from "lucide-react";
import ChatItem from "./ChatItem";
// import { FixedSizeList as VirtualList } from 'react-window';
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import chatAdapter from '@/lib/chatAdapter';
import { useAuth } from "../providers/AuthProvider";
import { PERMISSIONS } from "@/lib/permissions";

export type Conversation = {
  id?: string;
  contactId: string;
  contactName?: string | null;
  lastMessageText?: string | null;
  lastMessageTime?: string | Date | null;
  unreadCount?: number;
  messageCount?: number;
  lastMessageDirection?: 'incoming' | 'outgoing' | null;
  lastMessageStatus?: 'sent' | 'delivered' | 'read' | null;
  // Alternative field names from backend
  isLastMessageIncoming?: boolean | null;
  lastMessageIsIncoming?: boolean | null;
  // optional media preview helpers
  lastMediaPath?: string | null;
  lastMessageType?: string | null;
};

export default function ChatList() {
  const [chats, setChats] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true); // initial full load
  const [isRefreshing, setIsRefreshing] = useState(false); // background refresh indicator
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState<string>("");
  const router = useRouter();
  const { user, checkPolicy } = useAuth();


  // Check if user has permission to view all chats or just assigned chats
  const canViewAllChats = checkPolicy(PERMISSIONS.POLICY_VIEW_ALL_CHATS);

  // Fetch conversations from the backend
  const fetchConversations = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    else setIsRefreshing(true);
    setError(null);

    try {
      const response = await api.get("/api/Chats");
      // Map backend fields to Conversation type (be permissive with field names)
      const normalized = Array.isArray(response.data) || response.data ? chatAdapter.normalizeConversations(response.data) : [];

      // Merge with previous chats to preserve any last-message previews and media
      setChats((prev) => {
        const prevArr = prev || [];
        return (normalized as Conversation[]).map((n) => {
          const p = prevArr.find((x) => normalizeContactId(x.contactId) === normalizeContactId(n.contactId));
          return {
            ...n,
            lastMessageText: n.lastMessageText ?? p?.lastMessageText ?? undefined,
            lastMessageTime: n.lastMessageTime ?? p?.lastMessageTime ?? undefined,
            lastMediaPath: n.lastMediaPath ?? (p as any)?.lastMediaPath ?? undefined,
            lastMessageType: n.lastMessageType ?? (p as any)?.lastMessageType ?? undefined,
          } as Conversation;
        });
      });

      // For chats that don't include a last message preview, fetch lightweight previews in background
      (async () => {
        try {
          const missingAll = (normalized as Conversation[]).filter(c => !(c.lastMessageText) && c.contactId).map(c => c.contactId);
          const maxFetchPreviews = 200; // hard cap to avoid overloading backend
          const toFetch = missingAll.slice(0, maxFetchPreviews);
          if (toFetch.length === 0) return;

          const batchSize = 10;
          const previewsCache: Record<string, { lastMessageText?: string | null; lastMessageTime?: string | Date | null; lastMediaPath?: string | null; lastMessageType?: string | null }> = {};

          for (let i = 0; i < toFetch.length; i += batchSize) {
            const batchIds = toFetch.slice(i, i + batchSize);
            const results = await Promise.allSettled(batchIds.map(async (contactId) => {
              const tryFetch = async (idToUse: string) => {
                try {
                  const r = await api.get(`/api/Messages/contact/${encodeURIComponent(idToUse)}`);
                  return r.data;
                } catch (_) {
                  return null;
                }
              };

              let data = await tryFetch(contactId);
              if (!data) {
                const withPlus = contactId.startsWith('+') ? contactId : `+${contactId}`;
                data = await tryFetch(withPlus);
              }
              const msgs = chatAdapter.normalizeMessages(data, contactId);
              return { contactId, msgs };
            }));

            for (const res of results) {
              if (res.status === 'fulfilled') {
                const { contactId, msgs } = res.value as { contactId: string; msgs: any[] };
                if (msgs && msgs.length > 0) {
                  msgs.sort((a, b) => new Date((b as any).messageDateTime).getTime() - new Date((a as any).messageDateTime).getTime());
                  const last = msgs[0];
                  let previewText = last.messageText ?? null;
                  if (!previewText && (last.mediaPath || last.messageType)) {
                    const mt = (last.messageType || "").toString().toLowerCase();
                    const isImage = mt.includes("image") || /(\.jpg|\.jpeg|\.png|\.gif|\.webp)$/i.test(String(last.mediaPath || ""));
                    previewText = isImage ? "[Image]" : "[Attachment]";
                  }
                  const entry = {
                    lastMessageText: previewText,
                    lastMessageTime: last.messageDateTime ?? null,
                    lastMediaPath: last.mediaPath ?? null,
                    lastMessageType: last.messageType ?? null,
                  };
                  previewsCache[contactId] = entry;
                  previewsCache[normalizeContactId(contactId)] = entry;
                }
              }
            }

            if (Object.keys(previewsCache).length > 0) {
              setChats(prev => (prev || []).map(ch => {
                const key = normalizeContactId(ch.contactId) || ch.contactId;
                const p = previewsCache[key] || previewsCache[ch.contactId];
                if (!p) return ch;
                return {
                  ...ch,
                  lastMessageText: ch.lastMessageText ?? p.lastMessageText ?? ch.lastMessageText,
                  lastMessageTime: ch.lastMessageTime ?? p.lastMessageTime ?? ch.lastMessageTime,
                  lastMediaPath: ch.lastMediaPath ?? p.lastMediaPath ?? ch.lastMediaPath,
                  lastMessageType: ch.lastMessageType ?? p.lastMessageType ?? ch.lastMessageType,
                };
              }));
            }
          }
        } catch (err) {
          console.error('Background preview fetch failed', err);
        }
      })();
      if (!Array.isArray(response.data) && showLoading) setChats([]);
    } catch (err: unknown) {
      console.error("Error fetching conversations:", err);
      if (showLoading) setChats([]);
      setError("Failed to load chats.");
    } finally {
      if (showLoading) setLoading(false);
      else setIsRefreshing(false);
    }
  }, []);

  // Silent refresh
  const silentRefresh = useCallback(
    () => fetchConversations(false),
    [fetchConversations]
  );

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    let running = true;

    const startPolling = () => {
      if (interval) return;
      interval = setInterval(() => {
        if (document.visibilityState === 'visible') {
          silentRefresh();
        }
      }, 15000);
    };

    const stopPolling = () => {
      if (interval) { clearInterval(interval); interval = null; }
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        stopPolling();
      } else if (document.visibilityState === 'visible' && running) {
        silentRefresh();
        startPolling();
      }
    };

    fetchConversations();
    startPolling();
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      running = false;
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [fetchConversations, silentRefresh]);

  const handleNewChat = () => {
    const contactId = window.prompt("Enter contact phone (e.g. 254XXXXXXXXX):");
    if (!contactId) return;
    router.push(`/dashboard/${encodeURIComponent(contactId)}`);
  };

  const handleManualRefresh = () => {
    fetchConversations(true);
  };

  const filteredChats = useMemo(() => {
    if (!query || query.trim() === "") return chats;
    const q = query.trim().toLowerCase();
    return chats.filter((c) => {
      const name = (c.contactName || "").toLowerCase();
      const id = (c.contactId || "").toLowerCase();
      const last = (c.lastMessageText || "").toLowerCase();
      return name.includes(q) || id.includes(q) || last.includes(q);
    });
  }, [chats, query]);

  // Normalize contact IDs for stable deduping/keys (strip non-digits and leading +)
  const normalizeContactId = (id?: string) => {
    if (!id) return '';
    const s = String(id).trim();
    // remove non-digit characters but keep leading + significance removed for dedupe
    return s.replace(/\D/g, '');
  };

  // Loading state: ensure header remains visible (header is absolute inside the sidebar,
  // messages / list area scrolls with top padding so content passes behind the header)
  if (loading) {
    return (
      <div className="p-4">
        <div className="d-flex mb-4">
          <h4 className="mb-0 flex-grow-1">Chats</h4>
          <Link
            href="/dashboard/broadcast"
            className="btn btn-link text-decoration-none text-muted font-size-18 py-0 me-2"
          >
            <i className="ri-broadcast-line"></i>
          </Link>
          <button
            onClick={handleNewChat}
            type="button"
            className="btn btn-link text-decoration-none text-muted font-size-18 py-0"
          >
            <i className="ri-user-add-line"></i>
          </button>
        </div>
        <div className="search-box chat-search-box">
          <div className="input-group mb-3 rounded-3">
            <span
              className="input-group-text text-muted bg-light pe-1 ps-3"
              id="basic-addon1"
            >
              <i className="ri-search-line search-icon font-size-18" />
            </span>
            <input
              type="text"
              className="form-control bg-light"
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search messages or users"
              aria-label="Search messages or users"
              aria-describedby="basic-addon1"
            />
          </div>
        </div>

        <div className="text-start text-muted">Loading conversations…</div>
      </div>
    );
  }

  if (error && (!chats || chats.length === 0)) {
    return (
      <div className="p-4">
        <div className="d-flex mb-4">
          <h4 className="mb-0 flex-grow-1">Chats</h4>
          <Link
            href="/dashboard/broadcast"
            className="btn btn-link text-decoration-none text-muted font-size-18 py-0 me-2"
          >
            <i className="ri-broadcast-line"></i>
          </Link>
          <button
            onClick={handleNewChat}
            type="button"
            className="btn btn-link text-decoration-none text-muted font-size-18 py-0"
          >
            <i className="ri-user-add-line"></i>
          </button>
        </div>
        <div className="search-box chat-search-box">
          <div className="input-group mb-3 rounded-3">
            <span
              className="input-group-text text-muted bg-light pe-1 ps-3"
              id="basic-addon1"
            >
              <i className="ri-search-line search-icon font-size-18" />
            </span>
            <input
              type="text"
              className="form-control bg-light"
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search messages or users"
              aria-label="Search messages or users"
              aria-describedby="basic-addon1"
            />
          </div>
        </div>
        <div className="text-danger mb-4">{error}</div>
        <button onClick={handleManualRefresh} className="btn btn-primary">
          <i className="ri-reset-right-line me-2"></i>
          Retry
        </button>
      </div>
    );
  }

  if (!chats || chats.length === 0) {
    return (
      <div className="p-4">
        <div className="d-flex mb-4">
          <h4 className="mb-0 flex-grow-1">Chats</h4>
          <Link
            href="/dashboard/broadcast"
            className="btn btn-link text-decoration-none text-muted font-size-18 py-0 me-2"
          >
            <i className="ri-broadcast-line"></i>
          </Link>
          <button
            onClick={handleNewChat}
            type="button"
            className="btn btn-link text-decoration-none text-muted font-size-18 py-0"
          >
            <i className="ri-user-add-line"></i>
          </button>
        </div>
        <div className="search-box chat-search-box">
          <div className="input-group mb-3 rounded-3">
            <span
              className="input-group-text text-muted bg-light pe-1 ps-3"
              id="basic-addon1"
            >
              <i className="ri-search-line search-icon font-size-18" />
            </span>
            <input
              type="text"
              className="form-control bg-light"
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search messages or users"
              aria-label="Search messages or users"
              aria-describedby="basic-addon1"
            />
          </div>
        </div>
        <h3 className="text-muted">
          {canViewAllChats
            ? "No chats available"
            : "No assigned conversations yet"}
        </h3>
        <p className="text-muted">
          {canViewAllChats
            ? "Start a new conversation to begin chatting"
            : "Wait for an admin to assign contacts to you, or start a new conversation"}
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="px-4 pt-4">
        <div className="d-flex mb-4">
          <h4 className="mb-0 flex-grow-1">Chats</h4>
          <Link
            href="/dashboard/broadcast"
            className="btn btn-link text-decoration-none text-muted font-size-18 py-0 me-2"
          >
            <i className="ri-broadcast-line"></i>
          </Link>
          <button
            onClick={handleNewChat}
            type="button"
            className="btn btn-link text-decoration-none text-muted font-size-18 py-0"
          >
            <i className="ri-user-add-line"></i>
          </button>
        </div>
        <div className="search-box chat-search-box">
          <div className="input-group mb-3 rounded-3">
            <span
              className="input-group-text text-muted bg-light pe-1 ps-3"
              id="basic-addon1"
            >
              <i className="ri-search-line search-icon font-size-18" />
            </span>
            <input
              type="text"
              className="form-control bg-light"
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search messages or users"
              aria-label="Search messages or users"
              aria-describedby="basic-addon1"
            />
          </div>
        </div>
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <div className="chat-message-list px-2" style={{ height: '100%', overflow: 'auto' }}>
          <ul className="list-unstyled chat-list chat-user-list w-100">
            {/* Deduplicate by contactId */}
            {filteredChats
                .filter((chat, idx, arr) =>
                  arr.findIndex((c) => normalizeContactId(c.contactId) === normalizeContactId(chat.contactId)) === idx
                )
                .map((chat, idx) => {
                  const keyId = normalizeContactId(chat.contactId) || `${idx}`;
                  return (
                    <li key={keyId + '-' + idx} className="w-100">
                      <Link href={`/dashboard/${encodeURIComponent(chat.contactId)}`}>
                        <div style={{ width: '100%' }}>
                          <ChatItem chat={chat} />
                        </div>
                      </Link>
                    </li>
                  );
                })}
          </ul>
        </div>
      </div>
    </div>
  );
}
