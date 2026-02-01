export type NotificationType = 'connection_request' | 'chat_message' | 'event_created';

export interface AppNotification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  link?: string;
  read: boolean;
  createdAt: any; // Firestore Timestamp
  metadata?: {
    requestId?: string;
    fromUserId?: string;
    fromUserName?: string;
    chatId?: string;
    chatName?: string;
    eventId?: string;
    eventName?: string;
  };
}
