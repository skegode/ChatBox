//components/chat/ChatList.tsx
'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { PlusCircle, RefreshCw } from 'lucide-react';
import ChatItem from './ChatItem';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useAuth } from '../providers/AuthProvider';
import { PERMISSIONS } from '@/lib/permissions';

export type Conversation = {
  contactId: string;
  contactName?: string | null;
  lastMessageText?: string | null;
  lastMessageTime?: string | Date | null;
  unreadCount?: number;
  messageCount?: number;
};

export default function ChatList() {
  const [chats, setChats] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true); // initial full load
  const [isRefreshing, setIsRefreshing] = useState(false); // background refresh indicator
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState<string>('');
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
      const response = await api.get('api/Messages');
      if (Array.isArray(response.data)) setChats(response.data);
      else if (showLoading) setChats([]);
    } catch (err: unknown) {
      console.error('Error fetching conversations:', err);
      if (showLoading) setChats([]);
      setError('Failed to load chats.');
    } finally {
      if (showLoading) setLoading(false);
      else setIsRefreshing(false);
    }
  }, []);

  // Silent refresh
  const silentRefresh = useCallback(() => fetchConversations(false), [fetchConversations]);

  useEffect(() => {
    fetchConversations();
    const interval = setInterval(silentRefresh, 15000);
    return () => clearInterval(interval);
  }, [fetchConversations, silentRefresh]);

  const handleNewChat = () => {
    const contactId = window.prompt('Enter contact phone (e.g. 254XXXXXXXXX):');
    if (!contactId) return;
    router.push(`/dashboard/${encodeURIComponent(contactId)}`);
  };

  const handleManualRefresh = () => {
    fetchConversations(true);
  };

  const filteredChats = useMemo(() => {
    if (!query || query.trim() === '') return chats;
    const q = query.trim().toLowerCase();
    return chats.filter((c) => {
      const name = (c.contactName || '').toLowerCase();
      const id = (c.contactId || '').toLowerCase();
      const last = (c.lastMessageText || '').toLowerCase();
      return name.includes(q) || id.includes(q) || last.includes(q);
    });
  }, [chats, query]);

  // Loading state: ensure header remains visible (header is absolute inside the sidebar,
  // messages / list area scrolls with top padding so content passes behind the header)
  if (loading) {
     return (
      <div className="p-4">
        <div className='d-flex mb-4'>
          <h4 className="mb-0 flex-grow-1">Chats</h4>
          <button onClick={handleNewChat} type="button" className="btn btn-link text-decoration-none text-muted font-size-18 py-0">
            <i className="ri-user-add-line"></i>
          </button>
        </div>
        <div className="search-box chat-search-box">
          <div className="input-group mb-3 rounded-3">
            <span className="input-group-text text-muted bg-light pe-1 ps-3" id="basic-addon1">
              <i className="ri-search-line search-icon font-size-18" />
            </span>
            <input type="text" className="form-control bg-light" onChange={(e) => setQuery(e.target.value)} placeholder="Search messages or users" aria-label="Search messages or users" aria-describedby="basic-addon1" />
          </div>
        </div>

          <div className="text-start text-muted">
            Loading conversations…
          </div>
        </div>
      );
  }

  if (error && (!chats || chats.length === 0)) {
     return (
        <div className="p-4">
          <div className='d-flex mb-4'>
            <h4 className="mb-0 flex-grow-1">Chats</h4>
            <button onClick={handleNewChat} type="button" className="btn btn-link text-decoration-none text-muted font-size-18 py-0">
              <i className="ri-user-add-line"></i>
            </button>
          </div>
          <div className="search-box chat-search-box">
            <div className="input-group mb-3 rounded-3">
              <span className="input-group-text text-muted bg-light pe-1 ps-3" id="basic-addon1">
                <i className="ri-search-line search-icon font-size-18" />
              </span>
              <input type="text" className="form-control bg-light" onChange={(e) => setQuery(e.target.value)} placeholder="Search messages or users" aria-label="Search messages or users" aria-describedby="basic-addon1" />
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
        <div className='d-flex mb-4'>
          <h4 className="mb-0 flex-grow-1">Chats</h4>
          <button onClick={handleNewChat} type="button" className="btn btn-link text-decoration-none text-muted font-size-18 py-0">
            <i className="ri-user-add-line"></i>
          </button>
        </div>
        <div className="search-box chat-search-box">
          <div className="input-group mb-3 rounded-3">
            <span className="input-group-text text-muted bg-light pe-1 ps-3" id="basic-addon1">
              <i className="ri-search-line search-icon font-size-18" />
            </span>
            <input type="text" className="form-control bg-light" onChange={(e) => setQuery(e.target.value)} placeholder="Search messages or users" aria-label="Search messages or users" aria-describedby="basic-addon1" />
          </div>
        </div>
        <h3 className="text-muted">
          {canViewAllChats ? "No chats available" : "No assigned conversations yet"}
        </h3>
        <p className="text-muted">
          {canViewAllChats ? "Start a new conversation to begin chatting" : "Wait for an admin to assign contacts to you, or start a new conversation"}
        </p>
      </div>
      );
   }

  return (
      <div>
        <div className="px-4 pt-4">
          <div className='d-flex mb-4'>
            <h4 className="mb-0 flex-grow-1">Chats</h4>
            <button onClick={handleNewChat} type="button" className="btn btn-link text-decoration-none text-muted font-size-18 py-0">
              <i className="ri-user-add-line"></i>
            </button>
          </div>
          <div className="search-box chat-search-box">
            <div className="input-group mb-3 rounded-3">
              <span className="input-group-text text-muted bg-light pe-1 ps-3" id="basic-addon1">
                <i className="ri-search-line search-icon font-size-18" />
              </span>
              <input type="text" className="form-control bg-light" onChange={(e) => setQuery(e.target.value)} placeholder="Search messages or users" aria-label="Search messages or users" aria-describedby="basic-addon1" />
            </div>
          </div>
        </div>
        <div>
          <div className="chat-message-list px-2">
            <ul className="list-unstyled chat-list chat-user-list">
              {filteredChats.map((chat) => (
                <li key={chat.contactId}>
                  <Link href={`/dashboard/${encodeURIComponent(chat.contactId)}`}>
                    <ChatItem chat={chat} />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
      );
  }
