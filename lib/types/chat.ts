// TypeScript types for chats and messages
export interface Chat {
  id: string | number;
  whatsAppUserId: string;
  whatsAppUserName: string;
  assignedAgentId?: number;
  lastMessageAt: Date;
  unreadCount: number;
}

