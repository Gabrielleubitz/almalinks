import { useState, useEffect } from 'react';
import {
  subscribeToNotifications,
  markAllNotificationsRead,
  deleteAllNotifications,
  markNotificationRead
} from '../services/notificationService';
import type { AppNotification } from '../types/notification';

const MAX_NOTIFICATIONS = 100;

export function useNotificationItems(userId: string | undefined) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setNotifications([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsubscribe = subscribeToNotifications(
      userId,
      MAX_NOTIFICATIONS,
      (list) => {
        setNotifications(list);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return () => unsubscribe();
  }, [userId]);

  const unread = notifications.filter((n) => !n.read);
  const unreadCount = unread.length;

  const markAllRead = async () => {
    if (!userId) return;
    try {
      await markAllNotificationsRead(userId);
    } catch (e) {
      console.error('Failed to mark all notifications read', e);
    }
  };

  const deleteAll = async () => {
    if (!userId) return;
    try {
      await deleteAllNotifications(userId);
      setNotifications([]);
    } catch (e) {
      console.error('Failed to delete all notifications', e);
    }
  };

  const markOneRead = async (id: string) => {
    try {
      await markNotificationRead(id);
    } catch (e) {
      console.error('Failed to mark notification read', e);
    }
  };

  return {
    notifications,
    unread,
    unreadCount,
    loading,
    markAllRead,
    deleteAll,
    markOneRead
  };
}
