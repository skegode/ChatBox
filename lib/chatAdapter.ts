// lib/chatAdapter.ts
import { MessageVm as _MessageVm } from "../app/dashboard/[chatId]/page";

type Raw = Record<string, unknown>;

export type ConversationView = {
  contactId: string;
  contactName?: string | null;
  lastMessageText?: string | null;
  lastMessageTime?: string | Date | null;
  unreadCount?: number;
  messageCount?: number;
  lastMessageDirection?: 'incoming' | 'outgoing' | null;
  lastMessageStatus?: string | null;
  contactAvatarUrl?: string | null;
};

function firstString(obj: Raw, keys: string[]) {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'string') return v;
    if (typeof v === 'number') return String(v);
  }
  return undefined;
}

export function normalizeConversations(input: unknown): ConversationView[] {
  const arr: Raw[] = Array.isArray(input) ? input as Raw[] : (input && typeof input === 'object' && 'items' in (input as any) && Array.isArray((input as any).items) ? (input as any).items : []);
  return arr.map((c) => {
    const contactId = firstString(c, ['contactId', 'phoneNumber', 'phone', 'contactWaId', 'id']) ?? '';
    const contactName = firstString(c, ['contactName', 'name', 'displayName', 'contactName']) ?? null;
    const lastMessageText = firstString(c, ['lastMessageText', 'lastMessage', 'lastMessageBody', 'body']) ?? null;
    const lastMessageTime = firstString(c, ['lastMessageAt', 'lastMessageTime', 'updatedAt', 'timestamp']) ?? null;
    const unreadCount = typeof c['unreadCount'] === 'number' ? (c['unreadCount'] as number) : (typeof c['unread'] === 'number' ? (c['unread'] as number) : 0);
    const messageCount = typeof c['messageCount'] === 'number' ? (c['messageCount'] as number) : (typeof c['messagesCount'] === 'number' ? (c['messagesCount'] as number) : 0);
    const lastMessageDirection = typeof c['lastMessageDirection'] === 'string' ? (c['lastMessageDirection'] as 'incoming'|'outgoing') : undefined;
    const lastMessageStatus = firstString(c, ['lastMessageStatus', 'status']) ?? null;
    const contactAvatarUrl = firstString(c, ['contactAvatarUrl', 'avatarUrl', 'avatar']) ?? null;

    return {
      contactId,
      contactName,
      lastMessageText,
      lastMessageTime,
      unreadCount,
      messageCount,
      lastMessageDirection,
      lastMessageStatus,
      contactAvatarUrl,
    };
  });
}

// Avoid importing page types at runtime; define a minimal MessageVm here
export type MessageVm = {
  id: number | string;
  messageId?: string | null;
  contactName?: string | null;
  contactWaId: string;
  messageText?: string | null;
  messageType?: string | null;
  mediaPath?: string | null;
  messageDateTime: string | Date;
  isIncoming: boolean;
  contextMessageId?: string | null;
  sentBy?: number | null;
  senderName?: string | null;
};

export function normalizeMessages(input: unknown, contactIdFallback?: string): MessageVm[] {
  const arr: Raw[] = Array.isArray(input) ? input as Raw[] : (input && typeof input === 'object' && 'items' in (input as any) && Array.isArray((input as any).items) ? (input as any).items : []);
  return arr.map((m) => {
    const id = m['id'] ?? m['messageId'] ?? m['msgId'] ?? m['message_id'] ?? 0;
    const messageId = typeof m['messageId'] === 'string' ? (m['messageId'] as string) : typeof m['message_id'] === 'string' ? (m['message_id'] as string) : (typeof m['msgId'] === 'string' ? (m['msgId'] as string) : (typeof id === 'string' ? id : undefined));
    const contactWaId = firstString(m, ['contactWaId', 'contactId', 'phoneNumber', 'phone', 'to', 'recipient']) ?? (contactIdFallback ?? '');
    const contactName = firstString(m, ['contactName', 'name', 'senderName', 'displayName']) ?? null;
    const messageText = firstString(m, ['messageText', 'text', 'body', 'message']) ?? null;
    const messageType = firstString(m, ['messageType', 'type', 'mediaType']) ?? null;
    const mediaPath = firstString(m, ['mediaPath', 'mediaUrl', 'media', 'filePath']) ?? null;
    const msgTimeRaw = firstString(m, ['messageDateTime', 'timestamp', 'createdAt', 'time']) ?? new Date().toISOString();
    const messageDateTime = typeof msgTimeRaw === 'string' ? new Date(msgTimeRaw) : new Date();
    const isIncoming = (typeof m['isIncoming'] === 'boolean' ? m['isIncoming'] as boolean : (m['direction'] === 'incoming' || (m['from'] && String(m['from']).toLowerCase() !== 'me'))) as boolean;
    const contextMessageId = (typeof m['contextMessageId'] === 'string' ? m['contextMessageId'] as string : typeof m['replyTo'] === 'string' ? m['replyTo'] as string : undefined) ?? null;
    const sentBy = typeof m['sentBy'] === 'number' ? (m['sentBy'] as number) : typeof m['senderId'] === 'number' ? (m['senderId'] as number) : null;
    const senderName = firstString(m, ['senderName', 'fromName', 'displayName']) ?? null;

    return {
      id: id as any,
      messageId: messageId ?? null,
      contactName,
      contactWaId,
      messageText,
      messageType,
      mediaPath,
      messageDateTime,
      isIncoming,
      contextMessageId,
      sentBy,
      senderName,
    } as MessageVm;
  });
}

export default {
  normalizeConversations,
  normalizeMessages,
};
