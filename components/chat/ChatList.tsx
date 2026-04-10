//components/chat/ChatList.tsx
"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { PlusCircle, RefreshCw } from "lucide-react";
import ChatItem from "./ChatItem";
// import { FixedSizeList as VirtualList } from 'react-window';
import { useRouter, usePathname } from "next/navigation";
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
  lastDisplayPhoneNumber?: string | null;
  lastSourcePhoneNumberId?: string | null;
};

export default function ChatList() {
  const [chats, setChats] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true); // initial full load
  const [isRefreshing, setIsRefreshing] = useState(false); // background refresh indicator
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState<string>("");
  // Guard background preview calls to avoid request storms that freeze the UI.
  const previewInFlightRef = useRef<Set<string>>(new Set());
  const previewRetryAtRef = useRef<Record<string, number>>({});
  const router = useRouter();
  const pathname = usePathname();
  // Keep a ref so the stale useCallback closure always reads the current pathname.
  const pathnameRef = useRef(pathname);
  useEffect(() => { pathnameRef.current = pathname; }, [pathname]);
  const { user, checkPolicy, isLoading } = useAuth();


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
        // Detect the currently open chat from the URL so we can keep its badge at 0.
        const openDigits = (() => {
          const seg = pathnameRef.current?.split('/dashboard/')?.[1]?.split('/')?.[0];
          return seg ? decodeURIComponent(seg).replace(/\D/g, '') : '';
        })();
        return (normalized as Conversation[]).map((n) => {
          const p = prevArr.find((x) => normalizeContactId(x.contactId) === normalizeContactId(n.contactId));
          const contactDigits = normalizeContactId(n.contactId);
          const isCurrentlyOpen = openDigits !== '' && contactDigits === openDigits;
          return {
            ...n,
            // If this is the chat the agent currently has open, always show 0 unread.
            unreadCount: isCurrentlyOpen ? 0 : n.unreadCount,
            lastMessageText: n.lastMessageText ?? p?.lastMessageText ?? undefined,
            lastMessageTime: n.lastMessageTime ?? p?.lastMessageTime ?? undefined,
            lastMediaPath: n.lastMediaPath ?? (p as any)?.lastMediaPath ?? undefined,
            lastMessageType: n.lastMessageType ?? (p as any)?.lastMessageType ?? undefined,
            lastMessageDirection: n.lastMessageDirection ?? p?.lastMessageDirection ?? undefined,
            lastMessageStatus: n.lastMessageStatus ?? p?.lastMessageStatus ?? undefined,
            lastDisplayPhoneNumber: n.lastDisplayPhoneNumber ?? p?.lastDisplayPhoneNumber ?? undefined,
            lastSourcePhoneNumberId: n.lastSourcePhoneNumberId ?? p?.lastSourcePhoneNumberId ?? undefined,
          } as Conversation;
        });
      });

      // For chats that don't include a last message preview, fetch lightweight previews in background
      (async () => {
          try {
          // Run background preview fetches on the client regardless of a local token
          // so the sidebar can display last-message previews for chats even when
          // the client hasn't stored a token locally (for example when auth is
          // cookie-based or managed server-side).
          if (typeof window === 'undefined') return; // server-side safety
          const missingAll = (normalized as Conversation[])
            .filter(c => (!(c.lastMessageText) || !c.lastMessageStatus || !c.lastDisplayPhoneNumber) && c.contactId)
            .map(c => c.contactId);
          if (missingAll.length === 0) return;

          const now = Date.now();
          const retryDelayMs = 90_000;
          // Process all missing rows in controlled batches so the entire list gets enriched.
          const maxFetchPreviews = missingAll.length;
          const toFetch = missingAll
            .filter((contactId) => {
              const key = normalizeContactId(contactId) || contactId;
              if (previewInFlightRef.current.has(key)) return false;
              const retryAt = previewRetryAtRef.current[key] ?? 0;
              return now >= retryAt;
            })
            .slice(0, maxFetchPreviews);
          if (toFetch.length === 0) return;

          const batchSize = 5;
          type PreviewEntry = {
            lastMessageText?: string | null;
            lastMessageTime?: string | Date | null;
            lastMediaPath?: string | null;
            lastMessageType?: string | null;
            lastMessageDirection?: 'incoming' | 'outgoing' | null;
            lastMessageStatus?: string | null;
            lastDisplayPhoneNumber?: string | null;
            lastSourcePhoneNumberId?: string | null;
          };
          const previewsCache: Record<string, PreviewEntry> = {};

          for (let i = 0; i < toFetch.length; i += batchSize) {
            const batchIds = toFetch.slice(i, i + batchSize);

            batchIds.forEach((contactId) => {
              const key = normalizeContactId(contactId) || contactId;
              previewInFlightRef.current.add(key);
              // Set default backoff for this attempt; successful responses will override.
              previewRetryAtRef.current[key] = Date.now() + retryDelayMs;
            });

            const results = await Promise.allSettled(batchIds.map(async (contactId) => {
              const tryFetch = async (idToUse: string) => {
                try {
                  const r = await api.get(`/api/Messages/contact/${encodeURIComponent(idToUse)}`);
                  const d = r.data;
                  // Some backends return an empty array or null for contacts with no messages
                  if (!d || (Array.isArray(d) && d.length === 0)) return null;
                  return d;
                } catch (_) {
                  return null;
                }
              };

              // Try primary endpoint with raw ID, then with +, then query-param alternative
              let data = await tryFetch(contactId);
              if (!data) {
                const withPlus = contactId.startsWith('+') ? contactId : `+${contactId}`;
                data = await tryFetch(withPlus);
              }
              if (!data) {
                // Fallback: query-param endpoint per backend contract
                try {
                  const r = await api.get(`/api/Messages?contactId=${encodeURIComponent(contactId)}`);
                  const d = r.data;
                  if (d && (!Array.isArray(d) || d.length > 0)) data = d;
                } catch (_) { /* ignore */ }
              }
              const msgs = chatAdapter.normalizeMessages(data, contactId);
              return { contactId, msgs };
            }));

            for (const res of results) {
              if (res.status === 'fulfilled') {
                const { contactId, msgs } = res.value as { contactId: string; msgs: any[] };
                const key = normalizeContactId(contactId) || contactId;
                if (msgs && msgs.length > 0) {
                  msgs.sort((a, b) => new Date((b as any).messageDateTime).getTime() - new Date((a as any).messageDateTime).getTime());
                  const last = msgs[0];
                  const latestIncomingWithDisplay = msgs.find(
                    (m) => Boolean((m as any).isIncoming) && Boolean((m as any).displayPhoneNumber)
                  );
                  let previewText = last.messageText ?? null;
                  if (!previewText && (last.mediaPath || last.messageType)) {
                    const mt = (last.messageType || "").toString().toLowerCase();
                    const isImage = mt.includes("image") || /(\.jpg|\.jpeg|\.png|\.gif|\.webp)$/i.test(String(last.mediaPath || ""));
                    previewText = isImage ? "[Image]" : "[Attachment]";
                  }
                  const entry: PreviewEntry = {
                    lastMessageText: previewText,
                    lastMessageTime: last.messageDateTime ?? null,
                    lastMediaPath: last.mediaPath ?? null,
                    lastMessageType: last.messageType ?? null,
                    lastMessageDirection: last.isIncoming ? 'incoming' : 'outgoing',
                    lastMessageStatus: null,
                    // Keep "received on" bound to the latest inbound message metadata,
                    // even if the latest message in thread is outbound.
                    lastDisplayPhoneNumber: (latestIncomingWithDisplay as any)?.displayPhoneNumber ?? null,
                    lastSourcePhoneNumberId: (latestIncomingWithDisplay as any)?.sourcePhoneNumberId ?? null,
                  };
                  previewsCache[contactId] = entry;
                  previewsCache[normalizeContactId(contactId)] = entry;

                  // Match conversation view status source by checking message status endpoint
                  // for the latest message in the thread.
                  const messageId = typeof last.messageId === 'string' ? last.messageId : null;
                  if (messageId && !messageId.startsWith('temp-')) {
                    try {
                      const statusResp = await api.get('/api/Messages/status', { params: { messageId } });
                      const payload = statusResp?.data as { status?: string; delivered?: boolean } | null;
                      const normalized = String(payload?.status ?? '').toLowerCase();
                      if (normalized === 'read' || normalized === 'seen' || normalized === 'received') {
                        entry.lastMessageStatus = 'read';
                      } else if (normalized === 'delivered' || payload?.delivered === true) {
                        entry.lastMessageStatus = 'delivered';
                      } else {
                        entry.lastMessageStatus = 'sent';
                      }
                    } catch (_) {
                      // Fallback keeps ticks deterministic when status endpoint fails.
                      entry.lastMessageStatus = 'sent';
                    }
                  }

                  // Success: stop retrying this contact.
                  previewRetryAtRef.current[key] = Number.MAX_SAFE_INTEGER;
                } else {
                  // Empty/failure: retry later with backoff.
                  previewRetryAtRef.current[key] = Date.now() + retryDelayMs;
                }
              }
            }

            batchIds.forEach((contactId) => {
              const key = normalizeContactId(contactId) || contactId;
              previewInFlightRef.current.delete(key);
            });

            if (Object.keys(previewsCache).length > 0) {
              setChats(prev => (prev || []).map(ch => {
                const key = normalizeContactId(ch.contactId) || ch.contactId;
                const p = previewsCache[key] || previewsCache[ch.contactId];
                if (!p) return ch;
                const rawStatus = ch.lastMessageStatus ?? p.lastMessageStatus ?? ch.lastMessageStatus;
                const normalizedStatus = String(rawStatus ?? '').toLowerCase();
                const safeStatus =
                  normalizedStatus === 'read' || normalizedStatus === 'seen' || normalizedStatus === 'received'
                    ? 'read'
                    : normalizedStatus === 'delivered'
                    ? 'delivered'
                    : normalizedStatus === 'sent' || !normalizedStatus
                    ? 'sent'
                    : undefined;
                return {
                  ...ch,
                  lastMessageText: ch.lastMessageText ?? p.lastMessageText ?? ch.lastMessageText,
                  lastMessageTime: ch.lastMessageTime ?? p.lastMessageTime ?? ch.lastMessageTime,
                  lastMediaPath: ch.lastMediaPath ?? p.lastMediaPath ?? ch.lastMediaPath,
                  lastMessageType: ch.lastMessageType ?? p.lastMessageType ?? ch.lastMessageType,
                  lastMessageDirection: ch.lastMessageDirection ?? p.lastMessageDirection ?? ch.lastMessageDirection,
                  lastMessageStatus: safeStatus,
                  lastDisplayPhoneNumber: ch.lastDisplayPhoneNumber ?? p.lastDisplayPhoneNumber ?? ch.lastDisplayPhoneNumber,
                  lastSourcePhoneNumberId: ch.lastSourcePhoneNumberId ?? p.lastSourcePhoneNumberId ?? ch.lastSourcePhoneNumberId,
                } as Conversation;
              }));
            }
          }
        } catch (err) {
          console.error('Background preview fetch failed', err);
        }
      })();
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

    // Wait for auth loading to finish so background message requests include token
    if (!isLoading) fetchConversations();
    startPolling();
    document.addEventListener('visibilitychange', handleVisibility);

    // Immediately re-sort when a message is sent from the chat window
    const handleChatSent = () => silentRefresh();
    window.addEventListener('chatMessageSent', handleChatSent);

    // Zero the unread badge immediately when the user opens a chat
    const handleChatOpened = (e: Event) => {
      const contactId = (e as CustomEvent<{ contactId: string }>).detail?.contactId;
      if (!contactId) return;
      const digits = String(contactId).replace(/\D/g, '');
      setChats(prev => (prev || []).map(ch => {
        const chDigits = String(ch.contactId ?? '').replace(/\D/g, '');
        return chDigits === digits ? { ...ch, unreadCount: 0 } : ch;
      }));
    };
    window.addEventListener('chatOpened', handleChatOpened);

    return () => {
      running = false;
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('chatMessageSent', handleChatSent);
      window.removeEventListener('chatOpened', handleChatOpened);
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

  const sortByLatest = (arr: Conversation[]) =>
    [...arr].sort((a, b) => {
      const tA = a.lastMessageTime ? new Date(a.lastMessageTime).getTime() : 0;
      const tB = b.lastMessageTime ? new Date(b.lastMessageTime).getTime() : 0;
      return tB - tA;
    });

  const filteredChats = useMemo(() => {
    const base = (!query || query.trim() === "")
      ? chats
      : chats.filter((c) => {
          const name = (c.contactName || "").toLowerCase();
          const id = (c.contactId || "").toLowerCase();
          const last = (c.lastMessageText || "").toLowerCase();
          const q = query.trim().toLowerCase();
          return name.includes(q) || id.includes(q) || last.includes(q);
        });
    return sortByLatest(base);
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
            prefetch={false}
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
            prefetch={false}
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
            prefetch={false}
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
            prefetch={false}
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
                  const chatHref = `/dashboard/${encodeURIComponent(chat.contactId)}`;
                  // Highlight the chat that matches the current URL
                  const isActive = pathname === chatHref ||
                    pathname === `/dashboard/${chat.contactId}` ||
                    normalizeContactId(decodeURIComponent(pathname?.split('/dashboard/')[1] || '')) === normalizeContactId(chat.contactId);
                  return (
                    <li key={keyId + '-' + idx} className={`w-100${isActive ? ' active' : ''}`}>
                      <Link prefetch={false} href={chatHref}>
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
