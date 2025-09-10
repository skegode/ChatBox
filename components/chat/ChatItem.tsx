// components/chat/ChatItem.tsx
// ChatItem component to display individual chat in the list
// components/chat/ChatItem.tsx
// ChatItem component to display individual chat in the list

import React from 'react';
import type { Conversation } from './ChatList';
import Avatar from '../ui/Avatar';

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

export default function ChatItem({ chat }: { chat: Conversation }) {
  // Prefer saved contact name; if backend returned a phone in contactName treat it as unsaved
  const rawName = chat?.contactName ?? undefined;
  const isPhoneLike = looksLikePhoneName(rawName, chat?.contactId);
  const name = rawName && !isPhoneLike ? rawName : (chat?.contactId ?? 'Unknown');

  const lastAt = chat?.lastMessageTime ?? null;
  const unread = Number(chat?.unreadCount ?? 0);

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
        <p className="chat-user-message text-truncate mb-0">{truncateText(chat?.lastMessageText ?? 'No messages yet', 25)}</p>
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
