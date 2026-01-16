import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';

export interface NotificationCounts {
  unreadChats: number;
  pendingRegistrations: number;
  totalUnread: number;
}

export const useNotifications = (userId: string | undefined, isAdmin: boolean = false) => {
  const [counts, setCounts] = useState<NotificationCounts>({
    unreadChats: 0,
    pendingRegistrations: 0,
    totalUnread: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setCounts({ unreadChats: 0, pendingRegistrations: 0, totalUnread: 0 });
      setLoading(false);
      return;
    }

    let unsubscribeChats: (() => void) | undefined;
    let unsubscribePending: (() => void) | undefined;

    const loadNotifications = async () => {
      try {
        // Subscribe to chat notifications
        unsubscribeChats = await subscribeToUnreadChats(userId);

        // Subscribe to pending registrations (admin only)
        if (isAdmin) {
          unsubscribePending = await subscribeToPendingRegistrations();
        }

        setLoading(false);
      } catch (error) {
        console.error('❌ Error loading notifications:', error);
        setLoading(false);
      }
    };

    // Subscribe to unread chats count (excluding muted chats)
    const subscribeToUnreadChats = async (uid: string) => {
      console.log('🔔 Setting up unread chats subscription for user:', uid);

      // Get user's chat memberships
      const membershipsQuery = query(
        collection(db, 'chat_members'),
        where('userId', '==', uid)
      );

      return onSnapshot(membershipsQuery, async (snapshot) => {
        console.log(`📊 Processing ${snapshot.docs.length} chat memberships`);
        let totalUnread = 0;

        for (const memberDoc of snapshot.docs) {
          const memberData = memberDoc.data();
          const chatId = memberData.chatId;
          const isMuted = memberData.muted || false;
          const lastRead = memberData.lastRead?.toMillis() || 0;

          console.log(`💬 Chat ${chatId}:`, {
            isMuted,
            lastRead: lastRead > 0 ? new Date(lastRead).toISOString() : 'never read',
            lastReadTimestamp: lastRead
          });

          // Skip muted chats
          if (isMuted) {
            console.log(`🔇 Chat ${chatId} is muted, skipping unread count`);
            continue;
          }

          // Get unread message count for this chat
          const messagesQuery = query(
            collection(db, 'chat_messages'),
            where('chatId', '==', chatId)
          );

          try {
            const messagesSnap = await getDocs(messagesQuery);
            console.log(`📨 Chat ${chatId} has ${messagesSnap.docs.length} total messages`);

            const unreadMessages = messagesSnap.docs.filter(msgDoc => {
              const msgData = msgDoc.data();
              const msgTime = msgData.createdAt?.toMillis() || 0;
              const isFromOther = msgData.userId !== uid && msgData.type !== 'system';
              const isNewer = msgTime > lastRead;

              if (isFromOther && isNewer) {
                console.log(`  ✉️ Unread message from ${msgData.userId} at ${new Date(msgTime).toISOString()}`);
              }

              return isNewer && isFromOther;
            });

            const unreadInChat = unreadMessages.length;
            console.log(`  📬 ${unreadInChat} unread messages in chat ${chatId}`);
            totalUnread += unreadInChat;
          } catch (error) {
            console.error(`❌ Error counting unread messages for chat ${chatId}:`, error);
          }
        }

        console.log(`🔔 Total unread messages: ${totalUnread}`);
        setCounts(prev => ({
          ...prev,
          unreadChats: totalUnread,
          totalUnread: totalUnread + prev.pendingRegistrations
        }));
      });
    };

    // Subscribe to pending registrations count (admin only)
    // Now uses joinRequests collection instead of users
    const subscribeToPendingRegistrations = async () => {
      const pendingQuery = query(
        collection(db, 'joinRequests'),
        where('status', '==', 'pending')
      );

      return onSnapshot(pendingQuery, (snapshot) => {
        const pendingCount = snapshot.size;

        setCounts(prev => ({
          ...prev,
          pendingRegistrations: pendingCount,
          totalUnread: prev.unreadChats + pendingCount
        }));
      });
    };

    loadNotifications();

    // Cleanup subscriptions on unmount
    return () => {
      if (unsubscribeChats) unsubscribeChats();
      if (unsubscribePending) unsubscribePending();
    };
  }, [userId, isAdmin]);

  return { counts, loading };
};

// Helper function to toggle mute status for a chat
export const toggleChatMute = async (userId: string, chatId: string, currentMuteStatus: boolean): Promise<boolean> => {
  try {
    // Find the chat_member document
    const membershipsQuery = query(
      collection(db, 'chat_members'),
      where('userId', '==', userId),
      where('chatId', '==', chatId)
    );

    const snapshot = await getDocs(membershipsQuery);

    if (snapshot.empty) {
      throw new Error('Chat membership not found');
    }

    const memberDoc = snapshot.docs[0];
    const { updateDoc } = await import('firebase/firestore');

    await updateDoc(doc(db, 'chat_members', memberDoc.id), {
      muted: !currentMuteStatus
    });

    console.log(`✅ Chat ${chatId} ${!currentMuteStatus ? 'muted' : 'unmuted'}`);
    return !currentMuteStatus;
  } catch (error) {
    console.error('❌ Error toggling chat mute:', error);
    throw error;
  }
};

// Helper function to get mute status for a chat
export const getChatMuteStatus = async (userId: string, chatId: string): Promise<boolean> => {
  try {
    const membershipsQuery = query(
      collection(db, 'chat_members'),
      where('userId', '==', userId),
      where('chatId', '==', chatId)
    );

    const snapshot = await getDocs(membershipsQuery);

    if (snapshot.empty) {
      return false;
    }

    const memberData = snapshot.docs[0].data();
    return memberData.muted || false;
  } catch (error) {
    console.error('❌ Error getting chat mute status:', error);
    return false;
  }
};
