export type MessageType = 'text' | 'event';

export interface EventSnapshot {
  title: string;
  emoji: string;
  type: string;
  startAt: any;
}

export interface Message {
  id: string;
  senderId: string;
  text: string;
  type: MessageType;
  eventId?: string;
  eventSnapshot?: EventSnapshot;
  createdAt: any;
}

export interface ChatRoom {
  id: string;
  participants: [string, string];
  participantNames: Record<string, string>;
  participantPhotos: Record<string, string>;
  lastMessage?: {
    text: string;
    senderId: string;
    createdAt: any;
    type: MessageType;
  };
  updatedAt: any;
  unreadCounts: Record<string, number>;
}
