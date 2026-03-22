// Admin Chat Monitoring Service - Allows admins to view all chats and messages
import {
  collection,
  doc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
  Timestamp,
  onSnapshot,
  writeBatch
} from 'firebase/firestore';
import { db, retryOnNetworkFailure } from '../firebase/config';
import {
  ChatGroup,
  ChatMessage,
  ChatWithMembers,
  ChatMember
} from '../types/chat';
import { UserProfile } from '../types/user';

export interface AdminChatSummary {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  isPublic: boolean;
  allowRequests?: boolean;
  memberCount: number;
  messageCount: number;
  lastActivity?: Timestamp;
  createdAt: Timestamp;
  createdBy: string;
}

export interface AdminChatDetails extends AdminChatSummary {
  members: Array<{
    userId: string;
    userName: string;
    userEmail: string;
    role: string;
    joinedAt: Timestamp;
  }>;
  recentMessages: ChatMessage[];
}

export class AdminChatService {
  /**
   * Get all chats for admin overview
   */
  static async getAllChats(): Promise<AdminChatSummary[]> {
    try {
      const chatsQuery = query(
        collection(db, 'chats'),
        orderBy('lastActivity', 'desc')
      );

      const chatsSnap = await retryOnNetworkFailure(() => getDocs(chatsQuery));
      const chats = chatsSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ChatGroup[];

      // Get member and message counts for each chat
      const chatSummaries = await Promise.all(
        chats.map(async (chat) => {
          // Get member count
          const membersQuery = query(
            collection(db, 'chat_members'),
            where('chatId', '==', chat.id)
          );
          const membersSnap = await getDocs(membersQuery);
          const memberCount = membersSnap.size;

          // Get message count
          const messagesQuery = query(
            collection(db, 'chat_messages'),
            where('chatId', '==', chat.id)
          );
          const messagesSnap = await getDocs(messagesQuery);
          const messageCount = messagesSnap.size;

          return {
            id: chat.id,
            name: chat.name,
            description: chat.description,
            imageUrl: chat.imageUrl,
            isPublic: chat.isPublic || false,
            allowRequests: chat.allowRequests ?? false,
            memberCount,
            messageCount,
            lastActivity: chat.lastActivity,
            createdAt: chat.createdAt,
            createdBy: chat.createdBy
          };
        })
      );

      return chatSummaries;
    } catch (error) {
      console.error('❌ Error getting all chats for admin:', error);
      throw error;
    }
  }

  /**
   * Get detailed chat information including members and recent messages
   */
  static async getChatDetails(chatId: string): Promise<AdminChatDetails> {
    try {
      // Get chat document
      const chatDoc = await retryOnNetworkFailure(() =>
        getDoc(doc(db, 'chats', chatId))
      );

      if (!chatDoc.exists()) {
        throw new Error('Chat not found');
      }

      const chatData = { id: chatDoc.id, ...chatDoc.data() } as ChatGroup;

      // Get members with their details
      const membersQuery = query(
        collection(db, 'chat_members'),
        where('chatId', '==', chatId),
        orderBy('joinedAt', 'desc')
      );
      const membersSnap = await getDocs(membersQuery);
      const members = membersSnap.docs.map(doc => ({
        userId: doc.data().userId,
        userName: doc.data().userName,
        userEmail: doc.data().userEmail,
        role: doc.data().role,
        joinedAt: doc.data().joinedAt
      }));

      // Get recent messages (last 100)
      const messagesQuery = query(
        collection(db, 'chat_messages'),
        where('chatId', '==', chatId),
        orderBy('createdAt', 'desc'),
        firestoreLimit(100)
      );
      const messagesSnap = await getDocs(messagesQuery);
      const recentMessages = messagesSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ChatMessage[];

      // Get message count
      const allMessagesQuery = query(
        collection(db, 'chat_messages'),
        where('chatId', '==', chatId)
      );
      const allMessagesSnap = await getDocs(allMessagesQuery);
      const messageCount = allMessagesSnap.size;

      return {
        id: chatData.id,
        name: chatData.name,
        description: chatData.description,
        imageUrl: chatData.imageUrl,
        isPublic: chatData.isPublic || false,
        allowRequests: chatData.allowRequests ?? false,
        memberCount: members.length,
        messageCount,
        lastActivity: chatData.lastActivity,
        createdAt: chatData.createdAt,
        createdBy: chatData.createdBy,
        members,
        recentMessages: recentMessages.reverse() // Show oldest first
      };
    } catch (error) {
      console.error('❌ Error getting chat details for admin:', error);
      throw error;
    }
  }

  /**
   * Get all messages for a specific chat (for admin viewing)
   */
  static async getAllChatMessages(chatId: string, limitCount: number = 500): Promise<ChatMessage[]> {
    try {
      const messagesQuery = query(
        collection(db, 'chat_messages'),
        where('chatId', '==', chatId),
        orderBy('createdAt', 'asc'),
        firestoreLimit(limitCount)
      );

      const messagesSnap = await retryOnNetworkFailure(() => getDocs(messagesQuery));
      const messages = messagesSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ChatMessage[];

      return messages;
    } catch (error) {
      console.error('❌ Error getting chat messages for admin:', error);
      throw error;
    }
  }

  /**
   * Subscribe to real-time messages for a chat (admin view)
   */
  static subscribeToAdminChatMessages(
    chatId: string,
    onMessagesUpdate: (messages: ChatMessage[]) => void,
    onError: (error: Error) => void
  ): () => void {
    try {
      const messagesQuery = query(
        collection(db, 'chat_messages'),
        where('chatId', '==', chatId),
        orderBy('createdAt', 'asc'),
        firestoreLimit(500)
      );

      const unsubscribe = onSnapshot(
        messagesQuery,
        (snapshot) => {
          const messages = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as ChatMessage[];
          onMessagesUpdate(messages);
        },
        (error) => {
          console.error('❌ Error in admin chat messages subscription:', error);
          onError(error);
        }
      );

      return unsubscribe;
    } catch (error) {
      console.error('❌ Error setting up admin chat messages subscription:', error);
      onError(error as Error);
      return () => {};
    }
  }

  /**
   * Get chat activity summary for a specific user
   */
  static async getUserChatActivity(userId: string): Promise<Array<{
    chatId: string;
    chatName: string;
    messageCount: number;
    lastMessageAt?: Timestamp;
  }>> {
    try {
      // Get all chats the user is a member of
      const membershipsQuery = query(
        collection(db, 'chat_members'),
        where('userId', '==', userId)
      );
      const membershipsSnap = await getDocs(membershipsQuery);
      const membershipChatIds = membershipsSnap.docs.map(doc => doc.data().chatId);

      if (membershipChatIds.length === 0) {
        return [];
      }

      // Get message counts for each chat
      const chatActivity = await Promise.all(
        membershipChatIds.map(async (chatId) => {
          // Get chat name
          const chatDoc = await getDoc(doc(db, 'chats', chatId));
          const chatName = chatDoc.exists() ? chatDoc.data().name : 'Unknown Chat';

          // Get user's message count in this chat
          const messagesQuery = query(
            collection(db, 'chat_messages'),
            where('chatId', '==', chatId),
            where('userId', '==', userId)
          );
          const messagesSnap = await getDocs(messagesQuery);
          const messageCount = messagesSnap.size;

          // Get last message timestamp
          let lastMessageAt: Timestamp | undefined;
          if (messagesSnap.docs.length > 0) {
            const sortedMessages = messagesSnap.docs.sort((a, b) => {
              const aTime = a.data().createdAt?.toMillis() || 0;
              const bTime = b.data().createdAt?.toMillis() || 0;
              return bTime - aTime;
            });
            lastMessageAt = sortedMessages[0].data().createdAt;
          }

          return {
            chatId,
            chatName,
            messageCount,
            lastMessageAt
          };
        })
      );

      // Sort by message count (most active first)
      return chatActivity.sort((a, b) => b.messageCount - a.messageCount);
    } catch (error) {
      console.error('❌ Error getting user chat activity:', error);
      throw error;
    }
  }

  /**
   * Check if a user is a member of a chat
   */
  static async isUserInChat(chatId: string, userId: string): Promise<boolean> {
    const q = query(
      collection(db, 'chat_members'),
      where('chatId', '==', chatId),
      where('userId', '==', userId)
    );
    const snap = await getDocs(q);
    return !snap.empty;
  }

  /**
   * Add a user to a chat (app admin only). Bypasses chat-level admin check.
   * Firestore rules must allow isAdmin() to create chat_members.
   */
  static async addMemberToChat(chatId: string, targetUserId: string, appAdminUserId: string): Promise<void> {
    const existing = await this.isUserInChat(chatId, targetUserId);
    if (existing) {
      throw new Error('User is already a member of this chat');
    }

    const [userDoc, adminDoc, chatDoc] = await Promise.all([
      getDoc(doc(db, 'users', targetUserId)),
      getDoc(doc(db, 'users', appAdminUserId)),
      getDoc(doc(db, 'chats', chatId))
    ]);

    if (!chatDoc.exists()) throw new Error('Chat not found');
    if (!userDoc.exists()) throw new Error('User not found');

    const userData = userDoc.data();
    const adminData = adminDoc.data();
    const displayName = userData?.displayName || userData?.name || 'User';
    const adminName = adminData?.displayName || adminData?.name || 'Admin';

    const now = Timestamp.now();
    const batch = writeBatch(db);

    const memberRef = doc(collection(db, 'chat_members'));
    batch.set(memberRef, {
      chatId,
      userId: targetUserId,
      role: 'member',
      joinedAt: now
    });

    const systemMessageRef = doc(collection(db, 'chat_messages'));
    batch.set(systemMessageRef, {
      chatId,
      userId: null,
      type: 'system',
      text: `${displayName} was added by ${adminName} (admin).`,
      meta: { action: 'add', actorId: targetUserId, byAdminId: appAdminUserId },
      createdAt: now
    });

    batch.update(doc(db, 'chats', chatId), {
      lastMessage: { chatId, userId: null, type: 'system', text: `${displayName} was added by ${adminName} (admin).`, createdAt: now },
      lastActivity: now
    });

    await batch.commit();
  }

  /**
   * Join a chat as app admin (add yourself to the chat, as chat admin so you can manage it).
   */
  static async joinChatAsAppAdmin(chatId: string, appAdminUserId: string): Promise<void> {
    const existing = await this.isUserInChat(chatId, appAdminUserId);
    if (existing) {
      throw new Error('You are already a member of this chat');
    }

    const adminDoc = await getDoc(doc(db, 'users', appAdminUserId));
    const chatDoc = await getDoc(doc(db, 'chats', chatId));
    if (!chatDoc.exists()) throw new Error('Chat not found');
    const adminName = adminDoc.exists() ? (adminDoc.data()?.displayName || adminDoc.data()?.name || 'Admin') : 'Admin';

    const now = Timestamp.now();
    const batch = writeBatch(db);

    const memberRef = doc(collection(db, 'chat_members'));
    batch.set(memberRef, {
      chatId,
      userId: appAdminUserId,
      role: 'admin',
      joinedAt: now
    });

    const systemMessageRef = doc(collection(db, 'chat_messages'));
    batch.set(systemMessageRef, {
      chatId,
      userId: null,
      type: 'system',
      text: `${adminName} joined the chat (admin).`,
      meta: { action: 'join', actorId: appAdminUserId },
      createdAt: now
    });

    batch.update(doc(db, 'chats', chatId), {
      lastMessage: { chatId, userId: null, type: 'system', text: `${adminName} joined the chat (admin).`, createdAt: now },
      lastActivity: now
    });

    await batch.commit();
  }
}
