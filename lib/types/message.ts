export interface Message {
  id: string | number;
  chatId: string | number;
  type?: string;
  body: string;
  direction: 'incoming' | 'outgoing';
  status: string;
  timestamp: Date;
  agentId?: number;
}