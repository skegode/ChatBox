// components/chat/ChatItem.tsx
// ChatItem component to display individual chat in the list
// components/chat/ChatItem.tsx
// ChatItem component to display individual chat in the list

import React from 'react';
import { Check, CheckCheck } from 'lucide-react';
import type { Conversation } from './ChatList';
import Avatar from '../ui/Avatar';
import StableImage from './StableImage';

function formatDate(input?: string | Date | null) {
  if (!input) return '—';
  
  try {
    const d = typeof input === 'string' ? new Date(input) : input;
    
    // If today, show only time
    const now = new Date();
    if (d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    
    // If this week, show day name
    const diff = (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24);
    if (diff < 7) {
      return d.toLocaleDateString([], { weekday: 'short' });
    }
    
    // Otherwise show date
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  } catch (err) {
    console.error('Error formatting date:', input, err);
    return '—';
  }
}

function truncateText(text: string, maxLength: number) {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

type ConversationWithAvatar = Conversation & {
  contactAvatarUrl?: string;
  avatarUrl?: string;
};

// Extend conversation with last media preview fields (may be added at runtime)
type ConversationWithMedia = Conversation & {
  lastMediaPath?: string | null;
  lastMessageType?: string | null;
};

// helper to detect phone-like strings so we don't treat a returned phone as a saved name
function digitsOnly(s?: string) {
  return (s ?? '').replace(/\D/g, '');
}

function looksLikePhoneName(candidate?: string, contactId?: string) {
  if (!candidate) return false;
  const a = digitsOnly(candidate);
  if (!a) return false; // contains non-digits -> probably a real name
  const b = digitsOnly(contactId ?? '');
  if (!b) return true; // candidate is digits but no contactId to compare -> treat as phone
  return a === b || a.endsWith(b) || b.endsWith(a);
}

function ChatItemInner({ chat }: { chat: Conversation }) {
  // Prefer saved contact name; if backend returned a phone in contactName treat it as unsaved
  const rawName = chat?.contactName ?? undefined;
  const isPhoneLike = looksLikePhoneName(rawName, chat?.contactId);
  const name = rawName && !isPhoneLike ? rawName : (chat?.contactId ?? 'Unknown');

  const lastAt = chat?.lastMessageTime ?? null;
  const unread = Number(chat?.unreadCount ?? 0);

  // Determine if the last message was outgoing (sent by us)
  // Priority: explicit fields from API, fallback to heuristic (unreadCount === 0 means we likely sent last message)
  const isLastMessageOutgoing = 
    chat?.lastMessageDirection === 'outgoing' ||
    chat?.isLastMessageIncoming === false ||
    chat?.lastMessageIsIncoming === false ||
    (chat?.lastMessageDirection === undefined && 
     chat?.isLastMessageIncoming === undefined && 
     chat?.lastMessageIsIncoming === undefined &&
     unread === 0);

  // Get message status (default to 'delivered' for outgoing messages without explicit status)
  const lastMessageStatus = chat?.lastMessageStatus ?? 'delivered';

  // Type guard to check for avatar fields
  const hasContactAvatarUrl = (c: Conversation): c is ConversationWithAvatar =>
    'contactAvatarUrl' in c && typeof (c as ConversationWithAvatar).contactAvatarUrl === 'string';

  const hasAvatarUrl = (c: Conversation): c is ConversationWithAvatar =>
    'avatarUrl' in c && typeof (c as ConversationWithAvatar).avatarUrl === 'string';

  let avatarSrc = '/images/default-avatar.png';
  if (hasContactAvatarUrl(chat) && chat.contactAvatarUrl) {
    avatarSrc = chat.contactAvatarUrl;
  } else if (hasAvatarUrl(chat) && chat.avatarUrl) {
    avatarSrc = chat.avatarUrl;
  }

  return (
    <div className="d-flex">
      <div className="chat-user-img away align-self-center me-3 ms-0">
        <img src={avatarSrc} className="rounded-circle avatar-xs" alt={name} />
        <span className="user-status" />
      </div>
      <div className="flex-grow-1 overflow-hidden">
        <h5 className="text-truncate font-size-15 mb-1">{name}</h5>
        <p className="chat-user-message text-truncate mb-0 d-flex align-items-center">
          {isLastMessageOutgoing && (
            <span className="me-1 d-inline-flex align-items-center">
              {lastMessageStatus === 'read' ? (
                <CheckCheck size={14} style={{ color: '#3b82f6' }} />
              ) : lastMessageStatus === 'delivered' ? (
                <CheckCheck size={14} style={{ color: '#9ca3af' }} />
              ) : (
                <Check size={14} style={{ color: '#9ca3af' }} />
              )}
            </span>
          )}
          {/* If there is an image/media preview, show a small thumbnail */}
          {((chat as ConversationWithMedia).lastMediaPath) ? (
            (() => {
              const mp = (chat as ConversationWithMedia).lastMediaPath as string | null | undefined;
              const mt = (chat as ConversationWithMedia).lastMessageType ?? '';
              const isImage = !!mp && (/(\.jpg|\.jpeg|\.png|\.gif|\.webp)$/i.test(mp) || String(mt).toLowerCase().includes('image'));
              if (isImage && mp) {
                // Route image requests through the server proxy to avoid CORS/auth issues
                // Keep proxy URL stable (no changing query params).
                const proxySrc = `/api/image/proxy?url=${encodeURIComponent(mp)}`;
                return (
                  <StableImage src={proxySrc} alt="preview" className="me-2 rounded" style={{ width: 36, height: 36, objectFit: 'cover' }} />
                );
              }
              // Non-image attachments: show an icon/label
              return <span className="me-2 small text-muted">[Attachment]</span>;
            })()
          ) : (
            <span className="text-truncate">{truncateText(chat?.lastMessageText ?? 'No messages yet', 25)}</span>
          )}
        </p>
      </div>
      <div className="font-size-11">{formatDate(lastAt)}</div>
      {unread > 0 && (
        <div className="unread-message">
          <span className="badge badge-soft-danger rounded-pill">{unread}</span>
        </div>
      )}
    </div>
  );
}

// Memoize ChatItem to avoid unnecessary re-renders which can cause image reloads.
function areEqual(prev: { chat: Conversation }, next: { chat: Conversation }) {
  const a = prev.chat;
  const b = next.chat;
  // Compare only the fields that affect visual output and the image preview.
  return (
    a.id === b.id &&
    a.contactId === b.contactId &&
    a.contactName === b.contactName &&
    a.lastMessageText === b.lastMessageText &&
    (a as any).lastMediaPath === (b as any).lastMediaPath &&
    a.lastMessageTime === b.lastMessageTime &&
    (a.unreadCount ?? 0) === (b.unreadCount ?? 0)
  );
}

export default React.memo(ChatItemInner, areEqual);
