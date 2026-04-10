export interface Message {
  id: string | number;
  messageId?: string | null;
  isOutgoing?: boolean;
  sourcePhoneNumberId?: string | null;
  displayPhoneNumber?: string | null;
  chatId: string | number;
  type?: string;
  body: string;
  direction: 'incoming' | 'outgoing';
  status: string;
  timestamp: Date;
  agentId?: number;
}