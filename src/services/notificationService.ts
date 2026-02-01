import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  writeBatch,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { db, retryOnNetworkFailure } from '../firebase/config';
import type { AppNotification, NotificationType } from '../types/notification';

const COLLECTION = 'notifications';

/**
 * Create a single notification for a user.
 */
export async function createNotification(
  userId: string,
  type: NotificationType,
  title: string,
  options: {
    body?: string;
    link?: string;
    metadata?: AppNotification['metadata'];
  } = {}
): Promise<string> {
  const ref = await addDoc(collection(db, COLLECTION), {
    userId,
    type,
    title,
    body: options.body ?? null,
    link: options.link ?? null,
    read: false,
    createdAt: serverTimestamp(),
    metadata: options.metadata ?? null
  });
  return ref.id;
}

/**
 * Create notification for target user when someone sends a connection request.
 */
export async function createConnectionRequestNotification(
  targetUserId: string,
  fromUserName: string,
  requestId: string
): Promise<string> {
  return createNotification(
    targetUserId,
    'connection_request',
    `Request to connect from ${fromUserName}`,
    {
      link: '/members',
      metadata: { requestId, fromUserName }
    }
  );
}

/**
 * Create notification for a user when they receive a new chat message.
 */
export async function createChatMessageNotification(
  userId: string,
  chatId: string,
  chatName: string,
  fromUserName: string
): Promise<string> {
  return createNotification(
    userId,
    'chat_message',
    `New message in ${chatName}`,
    {
      body: fromUserName ? `From ${fromUserName}` : undefined,
      link: `/chats/${chatId}`,
      metadata: { chatId, chatName, fromUserName }
    }
  );
}

/**
 * Create notification for a user when a new event is created.
 */
export async function createEventCreatedNotification(
  userId: string,
  eventId: string,
  eventName: string
): Promise<string> {
  return createNotification(
    userId,
    'event_created',
    'New event created',
    {
      body: eventName,
      link: `/events/${eventId}`,
      metadata: { eventId, eventName }
    }
  );
}

/**
 * Subscribe to notifications for a user (all, newest first).
 */
export function subscribeToNotifications(
  userId: string,
  maxCount: number,
  onUpdate: (notifications: AppNotification[]) => void,
  onError?: (error: Error) => void
): () => void {
  if (!userId) {
    onUpdate([]);
    return () => {};
  }
  const q = query(
    collection(db, COLLECTION),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc'),
    limit(maxCount)
  );
  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const list: AppNotification[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          userId: data.userId,
          type: data.type,
          title: data.title,
          body: data.body,
          link: data.link,
          read: data.read === true,
          createdAt: data.createdAt,
          metadata: data.metadata
        } as AppNotification;
      });
      onUpdate(list);
    },
    (err) => {
      console.error('❌ Notifications subscription error:', err);
      onError?.(err);
    }
  );
  return unsubscribe;
}

/**
 * Mark a single notification as read.
 */
export async function markNotificationRead(notificationId: string): Promise<void> {
  await updateDoc(doc(db, COLLECTION, notificationId), { read: true });
}

/**
 * Mark all notifications for a user as read.
 */
export async function markAllNotificationsRead(userId: string): Promise<void> {
  const q = query(
    collection(db, COLLECTION),
    where('userId', '==', userId),
    where('read', '==', false)
  );
  const snapshot = await retryOnNetworkFailure(() => getDocs(q));
  if (snapshot.empty) return;
  const batch = writeBatch(db);
  snapshot.docs.forEach((d) => {
    batch.update(doc(db, COLLECTION, d.id), { read: true });
  });
  await batch.commit();
}

/**
 * Delete all notifications for a user.
 */
export async function deleteAllNotifications(userId: string): Promise<void> {
  const q = query(collection(db, COLLECTION), where('userId', '==', userId));
  const snapshot = await retryOnNetworkFailure(() => getDocs(q));
  if (snapshot.empty) return;
  const batches: ReturnType<typeof writeBatch>[] = [];
  let currentBatch = writeBatch(db);
  let count = 0;
  snapshot.docs.forEach((d) => {
    currentBatch.delete(doc(db, COLLECTION, d.id));
    count++;
    if (count >= 500) {
      batches.push(currentBatch);
      currentBatch = writeBatch(db);
      count = 0;
    }
  });
  if (count > 0) batches.push(currentBatch);
  for (const b of batches) await b.commit();
}

/**
 * Notify approved users of a new event (called after admin creates event). Runs in background; does not block.
 */
export function notifyAllUsersOfNewEvent(eventId: string, eventName: string): void {
  (async () => {
    try {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('status', '==', 'approved'), limit(300));
      const snapshot = await retryOnNetworkFailure(() => getDocs(q));
      const userIds = snapshot.docs.map((d) => d.id).filter(Boolean);
      for (const uid of userIds) {
        createEventCreatedNotification(uid, eventId, eventName).catch((e) =>
          console.warn('Failed to create event notification for', uid, e)
        );
      }
    } catch (e) {
      console.warn('Failed to notify users of new event', e);
    }
  })();
}
