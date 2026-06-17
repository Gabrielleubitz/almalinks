import { 
  collection, 
  doc, 
  getDocs, 
  getDoc,
  setDoc,
  addDoc, 
  updateDoc, 
  deleteDoc,
  query, 
  where, 
  orderBy, 
  limit,
  startAfter,
  Timestamp,
  writeBatch,
  onSnapshot,
  DocumentSnapshot,
  QueryConstraint
} from 'firebase/firestore';
import { db, retryOnNetworkFailure } from '../firebase/config';
import { isAppAdminDoc } from '../utils/adminAccess';
import { 
  ChatGroup, 
  ChatMember, 
  ChatMessage, 
  ChatRequest, 
  ChatListItem,
  ChatWithMembers,
  ChatJoinRequestWithUser,
  CreateChatGroupForm,
  SendMessageForm,
  JoinRequestForm,
  ChatRateLimit,
  ChatPermissions,
  CHAT_LIMITS,
  MessageReaction
} from '../types/chat';

export class ChatService {
  /**
   * Get discoverable public chats for a user
   */
  static async getDiscoverableChats(userId: string): Promise<{
    id: string;
    name: string;
    description?: string;
    imageUrl?: string;
    memberCount: number;
    allowRequests: boolean;
    isAlreadyMember: boolean;
    hasPendingRequest: boolean;
    canRequest: boolean;
    createdAt: any;
    lastActivity?: any;
  }[]> {
    try {
      // Get all public chats (both requestable and exclusive)
      const publicChatsQuery = query(
        collection(db, 'chats'),
        where('isPublic', '==', true),
        orderBy('lastActivity', 'desc')
      );

      const publicChatsSnap = await retryOnNetworkFailure(() => getDocs(publicChatsQuery));
      const publicChats = publicChatsSnap.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      })) as ChatGroup[];

      // Get user's current memberships
      const membershipsQuery = query(
        collection(db, 'chat_members'),
        where('userId', '==', userId)
      );
      const membershipsSnap = await getDocs(membershipsQuery);
      const membershipChatIds = new Set(membershipsSnap.docs.map(doc => doc.data().chatId));

      // Get user's pending requests
      const requestsQuery = query(
        collection(db, 'chat_requests'),
        where('userId', '==', userId),
        where('status', '==', 'pending')
      );
      const requestsSnap = await getDocs(requestsQuery);
      const pendingRequestChatIds = new Set(requestsSnap.docs.map(doc => doc.data().chatId));

      // Process each chat to get additional info
      const discoverableChats = await Promise.all(
        publicChats.map(async (chat) => {
          // Get member count
          const membersQuery = query(
            collection(db, 'chat_members'),
            where('chatId', '==', chat.id)
          );
          const membersSnap = await getDocs(membersQuery);
          const memberCount = membersSnap.size;

          const isAlreadyMember = membershipChatIds.has(chat.id);
          const hasPendingRequest = pendingRequestChatIds.has(chat.id);
          const canRequest = !isAlreadyMember && !hasPendingRequest && chat.allowRequests;

          return {
            id: chat.id,
            name: chat.name,
            description: chat.description,
            imageUrl: chat.imageUrl,
            memberCount,
            allowRequests: chat.allowRequests,
            isAlreadyMember,
            hasPendingRequest,
            canRequest,
            createdAt: chat.createdAt,
            lastActivity: chat.lastActivity
          };
        })
      );

      // Filter out chats where user is already a member (optional - you might want to show them differently)
      return discoverableChats;

    } catch (error) {
      console.error('❌ Error getting discoverable chats:', error);
      throw error;
    }
  }

  /**
   * Get all chats for a user
   */
  static async getUserChats(userId: string): Promise<ChatListItem[]> {
    try {
      // Get user's chat memberships
      const membershipsQuery = query(
        collection(db, 'chat_members'),
        where('userId', '==', userId)
      );

      const membershipsSnap = await retryOnNetworkFailure(() => getDocs(membershipsQuery));
      const memberships = membershipsSnap.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      })) as ChatMember[];

      if (memberships.length === 0) {
        return [];
      }

      // Get chat details for each membership
      const chatPromises = memberships.map(async (membership) => {
        const chatDoc = await retryOnNetworkFailure(() => getDoc(doc(db, 'chats', membership.chatId)));
        if (!chatDoc.exists()) return null;

        const chatData = { id: chatDoc.id, ...chatDoc.data() } as ChatGroup;

        // Get member count
        const membersQuery = query(
          collection(db, 'chat_members'),
          where('chatId', '==', membership.chatId)
        );
        const membersSnap = await getDocs(membersQuery);
        const memberCount = membersSnap.size;

        // Get unread count by comparing lastRead timestamp with message timestamps
        let unreadCount = 0;
        const isMuted = membership.muted || false;

        // Only calculate unread if not muted (muted chats don't show notifications)
        if (!isMuted) {
          const lastRead = membership.lastRead?.toMillis() || 0;

          // Get messages in this chat
          const messagesQuery = query(
            collection(db, 'chat_messages'),
            where('chatId', '==', membership.chatId)
          );

          try {
            const messagesSnap = await getDocs(messagesQuery);
            unreadCount = messagesSnap.docs.filter(msgDoc => {
              const msgData = msgDoc.data();
              const msgTime = msgData.createdAt?.toMillis() || 0;
              const isFromOther = msgData.userId !== userId && msgData.type !== 'system';
              const isNewer = msgTime > lastRead;
              return isNewer && isFromOther;
            }).length;
          } catch (error) {
            console.error(`❌ Error counting unread messages for chat ${membership.chatId}:`, error);
          }
        }

        // Get last message preview
        let lastMessagePreview = 'No messages yet';
        if (chatData.lastMessage) {
          lastMessagePreview = chatData.lastMessage.type === 'system'
            ? chatData.lastMessage.text
            : `${chatData.lastMessage.text?.substring(0, 50)}...`;
        }

        const chatListItem: ChatListItem = {
          ...chatData,
          memberCount,
          unreadCount,
          userRole: membership.role,
          lastMessagePreview
        };

        return chatListItem;
      });

      const chats = (await Promise.all(chatPromises)).filter(Boolean) as ChatListItem[];

      // Sort by last activity
      return chats.sort((a, b) => {
        const aTime = a.lastActivity?.toMillis() || a.createdAt?.toMillis() || 0;
        const bTime = b.lastActivity?.toMillis() || b.createdAt?.toMillis() || 0;
        return bTime - aTime;
      });

    } catch (error) {
      console.error('❌ Error getting user chats:', error);
      throw error;
    }
  }

  /**
   * Get chat details with members
   */
  static async getChat(chatId: string, userId: string): Promise<ChatWithMembers | null> {
    try {
      // Check if user is a member
      const membershipQuery = query(
        collection(db, 'chat_members'),
        where('chatId', '==', chatId),
        where('userId', '==', userId)
      );

      const membershipSnap = await getDocs(membershipQuery);
      if (membershipSnap.empty) {
        return null; // User is not a member
      }

      const userMembership = membershipSnap.docs[0].data() as ChatMember;

      // Get chat details
      const chatDoc = await getDoc(doc(db, 'chats', chatId));
      if (!chatDoc.exists()) {
        return null;
      }

      const chatData = { id: chatDoc.id, ...chatDoc.data() } as ChatGroup;

      // Get all members
      const membersQuery = query(
        collection(db, 'chat_members'),
        where('chatId', '==', chatId)
      );

      const membersSnap = await getDocs(membersQuery);
      const membershipData = membersSnap.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      })) as ChatMember[];

      // Get user profile data for each member
      const members = await Promise.all(
        membershipData.map(async (member) => {
          try {
            const userDoc = await getDoc(doc(db, 'users', member.userId));
            const userData = userDoc.data();
            
            return {
              ...member,
              displayName: userData?.displayName || userData?.name || 'Unknown User',
              email: userData?.email,
              profileImage: userData?.profileImage
            };
          } catch (error) {
            console.error(`❌ Error loading profile for user ${member.userId}:`, error);
            return {
              ...member,
              displayName: 'Unknown User',
              email: null,
              profileImage: null
            };
          }
        })
      );

      const chatWithMembers: ChatWithMembers = {
        ...chatData,
        members,
        userRole: userMembership.role,
        memberCount: members.length
      };

      return chatWithMembers;

    } catch (error) {
      console.error('❌ Error getting chat:', error);
      throw error;
    }
  }

  /**
   * Get chat messages with pagination
   */
  static async getChatMessages(
    chatId: string, 
    userId: string,
    limitCount: number = 50,
    cursor?: DocumentSnapshot
  ): Promise<{ messages: ChatMessage[], hasMore: boolean, lastDoc?: DocumentSnapshot }> {
    try {
      // Verify user is a member
      const isUserMember = await this.isUserMember(chatId, userId);
      if (!isUserMember) {
        throw new Error('User is not a member of this chat');
      }

      const constraints: QueryConstraint[] = [
        where('chatId', '==', chatId),
        orderBy('createdAt', 'desc'),
        limit(limitCount)
      ];

      if (cursor) {
        constraints.push(startAfter(cursor));
      }

      const messagesQuery = query(collection(db, 'chat_messages'), ...constraints);
      const messagesSnap = await getDocs(messagesQuery);

      const messages = messagesSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ChatMessage[];

      // Reverse to show oldest first
      messages.reverse();

      return {
        messages,
        hasMore: messagesSnap.docs.length === limitCount,
        lastDoc: messagesSnap.docs[messagesSnap.docs.length - 1]
      };

    } catch (error) {
      console.error('❌ Error getting chat messages:', error);
      throw error;
    }
  }

  /**
   * Send a message
   */
  static async sendMessage(form: SendMessageForm, userId: string): Promise<ChatMessage> {
    try {
      // Verify user is a member
      const isUserMember = await this.isUserMember(form.chatId, userId);
      if (!isUserMember) {
        throw new Error('User is not a member of this chat');
      }

      // Check rate limits
      await this.checkMessageRateLimit(userId);

      // Sanitize message
      const sanitizedText = this.sanitizeMessage(form.text);
      if (!sanitizedText.trim()) {
        throw new Error('Message cannot be empty');
      }

      if (sanitizedText.length > CHAT_LIMITS.MAX_MESSAGE_LENGTH) {
        throw new Error(`Message too long (max ${CHAT_LIMITS.MAX_MESSAGE_LENGTH} characters)`);
      }

      const now = Timestamp.now();

      const messageData: Omit<ChatMessage, 'id'> = {
        chatId: form.chatId,
        userId,
        type: 'user',
        text: sanitizedText,
        createdAt: now,
        status: 'sent',
        reactions: [],
        readBy: []
      };

      // Add message
      const messageRef = await addDoc(collection(db, 'chat_messages'), messageData);

      // Update chat's last message and activity
      await updateDoc(doc(db, 'chats', form.chatId), {
        lastMessage: messageData,
        lastActivity: now
      });

      // Update rate limit
      await this.updateMessageRateLimit(userId);

      // Create in-app notifications for other chat members (new message in xxx)
      try {
        const chatSnap = await getDoc(doc(db, 'chats', form.chatId));
        const chatName = chatSnap.exists() ? (chatSnap.data()?.name || 'Chat') : 'Chat';
        const membersSnap = await getDocs(
          query(collection(db, 'chat_members'), where('chatId', '==', form.chatId))
        );
        const senderSnap = await getDoc(doc(db, 'users', userId));
        const senderName = senderSnap.exists()
          ? (senderSnap.data()?.displayName || senderSnap.data()?.name || 'Someone')
          : 'Someone';
        const { createChatMessageNotification } = await import('./notificationService');
        for (const memberDoc of membersSnap.docs) {
          const memberUserId = memberDoc.data()?.userId;
          if (memberUserId && memberUserId !== userId) {
            createChatMessageNotification(memberUserId, form.chatId, chatName, senderName).catch((e) =>
              console.warn('Failed to create chat notification for', memberUserId, e)
            );
          }
        }
      } catch (e) {
        console.warn('Failed to create chat message notifications', e);
      }

      return {
        id: messageRef.id,
        ...messageData
      };

    } catch (error) {
      console.error('❌ Error sending message:', error);
      throw error;
    }
  }

  /**
   * Edit a message
   */
  static async editMessage(chatId: string, messageId: string, newText: string, userId: string): Promise<void> {
    try {
      // Verify user is a member
      const isUserMember = await this.isUserMember(chatId, userId);
      if (!isUserMember) {
        throw new Error('User is not a member of this chat');
      }

      // Sanitize message
      const sanitizedText = this.sanitizeMessage(newText);
      if (!sanitizedText.trim()) {
        throw new Error('Message cannot be empty');
      }

      if (sanitizedText.length > CHAT_LIMITS.MAX_MESSAGE_LENGTH) {
        throw new Error(`Message too long (max ${CHAT_LIMITS.MAX_MESSAGE_LENGTH} characters)`);
      }

      // Get the message to verify ownership
      const messageRef = doc(db, 'chat_messages', messageId);
      const messageDoc = await getDoc(messageRef);

      if (!messageDoc.exists()) {
        throw new Error('Message not found');
      }

      const messageData = messageDoc.data() as ChatMessage;
      
      // Verify the user owns this message
      if (messageData.userId !== userId) {
        throw new Error('You can only edit your own messages');
      }

      // Verify the message belongs to this chat
      if (messageData.chatId !== chatId) {
        throw new Error('Message does not belong to this chat');
      }

      // Update the message
      await updateDoc(messageRef, {
        text: sanitizedText,
        editedAt: Timestamp.now()
      });

    } catch (error) {
      console.error('❌ Error editing message:', error);
      throw error;
    }
  }

  /**
   * Create a join request
   */
  static async createJoinRequest(form: JoinRequestForm, userId: string): Promise<ChatRequest> {
    try {
      // Check if chat allows requests
      const chatDoc = await getDoc(doc(db, 'chats', form.chatId));
      if (!chatDoc.exists()) {
        throw new Error('Chat not found');
      }

      const chatData = chatDoc.data() as ChatGroup;
      if (!chatData.allowRequests) {
        throw new Error('This chat does not allow join requests');
      }

      // Check if user is already a member
      const isUserMember = await this.isUserMember(form.chatId, userId);
      if (isUserMember) {
        throw new Error('User is already a member of this chat');
      }

      // Check for existing pending request
      const existingRequestQuery = query(
        collection(db, 'chat_requests'),
        where('chatId', '==', form.chatId),
        where('userId', '==', userId),
        where('status', '==', 'pending')
      );

      const existingRequestSnap = await getDocs(existingRequestQuery);
      if (!existingRequestSnap.empty) {
        throw new Error('You already have a pending request for this chat');
      }

      // Check rate limits
      await this.checkJoinRequestRateLimit(userId);

      const requestData: Omit<ChatRequest, 'id'> = {
        chatId: form.chatId,
        userId,
        status: 'pending',
        createdAt: Timestamp.now(),
        message: form.message
      };

      const requestRef = await addDoc(collection(db, 'chat_requests'), requestData);

      // Update rate limit
      await this.updateJoinRequestRateLimit(userId);

      return {
        id: requestRef.id,
        ...requestData
      };

    } catch (error) {
      console.error('❌ Error creating join request:', error);
      throw error;
    }
  }

  /**
   * Get pending join requests for a chat (admin only)
   */
  static async getPendingRequests(chatId: string, adminUserId: string): Promise<ChatJoinRequestWithUser[]> {
    try {
      const canManage = await this.canManageChat(chatId, adminUserId);
      if (!canManage) {
        throw new Error('You do not have permission to manage this chat');
      }

      const requestsQuery = query(
        collection(db, 'chat_requests'),
        where('chatId', '==', chatId),
        where('status', '==', 'pending'),
        orderBy('createdAt', 'desc')
      );

      const requestsSnap = await getDocs(requestsQuery);
      const requests = requestsSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ChatRequest[];

      // Get user details for each request
      const requestsWithUsers = await Promise.all(
        requests.map(async (request) => {
          const userDoc = await getDoc(doc(db, 'users', request.userId));
          const userData = userDoc.data();

          return {
            ...request,
            userDisplayName: userData?.displayName || userData?.name || 'Unknown User',
            userAvatarUrl: userData?.avatarUrl || userData?.profileImage
          } as ChatJoinRequestWithUser;
        })
      );

      return requestsWithUsers;

    } catch (error) {
      console.error('❌ Error getting pending requests:', error);
      throw error;
    }
  }

  /**
   * Approve join request
   */
  static async approveJoinRequest(requestId: string, adminUserId: string): Promise<void> {
    try {
      const requestDoc = await getDoc(doc(db, 'chat_requests', requestId));
      if (!requestDoc.exists()) {
        throw new Error('Request not found');
      }

      const requestData = requestDoc.data() as ChatRequest;

      const canManage = await this.canManageChat(requestData.chatId, adminUserId);
      if (!canManage) {
        throw new Error('You do not have permission to manage this chat');
      }

      if (requestData.status !== 'pending') {
        throw new Error('Request is no longer pending');
      }

      const now = Timestamp.now();
      const batch = writeBatch(db);

      // Update request status
      batch.update(doc(db, 'chat_requests', requestId), {
        status: 'approved',
        resolvedAt: now,
        resolvedBy: adminUserId
      });

      // Add user as member
      const memberData: Omit<ChatMember, 'id'> = {
        chatId: requestData.chatId,
        userId: requestData.userId,
        role: 'member',
        joinedAt: now
      };

      const memberRef = doc(collection(db, 'chat_members'));
      batch.set(memberRef, memberData);

      // Get user details for system message
      const userDoc = await getDoc(doc(db, 'users', requestData.userId));
      const userData = userDoc.data();
      const displayName = userData?.displayName || userData?.name || 'User';

      // Add system message
      const systemMessageData: Omit<ChatMessage, 'id'> = {
        chatId: requestData.chatId,
        userId: null,
        type: 'system',
        text: `${displayName} joined (request approved).`,
        meta: {
          action: 'join',
          actorId: requestData.userId,
          byAdminId: adminUserId
        },
        createdAt: now
      };

      const messageRef = doc(collection(db, 'chat_messages'));
      batch.set(messageRef, systemMessageData);

      // Update chat activity
      batch.update(doc(db, 'chats', requestData.chatId), {
        lastMessage: systemMessageData,
        lastActivity: now
      });

      await batch.commit();

    } catch (error) {
      console.error('❌ Error approving join request:', error);
      throw error;
    }
  }

  /**
   * Reject join request
   */
  static async rejectJoinRequest(requestId: string, adminUserId: string): Promise<void> {
    try {
      const requestDoc = await getDoc(doc(db, 'chat_requests', requestId));
      if (!requestDoc.exists()) {
        throw new Error('Request not found');
      }

      const requestData = requestDoc.data() as ChatRequest;

      const canManage = await this.canManageChat(requestData.chatId, adminUserId);
      if (!canManage) {
        throw new Error('You do not have permission to manage this chat');
      }

      if (requestData.status !== 'pending') {
        throw new Error('Request is no longer pending');
      }

      await updateDoc(doc(db, 'chat_requests', requestId), {
        status: 'rejected',
        resolvedAt: Timestamp.now(),
        resolvedBy: adminUserId
      });

    } catch (error) {
      console.error('❌ Error rejecting join request:', error);
      throw error;
    }
  }

  /**
   * Add member to chat (admin only)
   */
  static async addMember(chatId: string, targetUserId: string, adminUserId: string): Promise<void> {
    try {
      const canManage = await this.canManageChat(chatId, adminUserId);
      if (!canManage) {
        throw new Error('You do not have permission to manage this chat');
      }

      // Check if user is already a member
      const isUserMember = await this.isUserMember(chatId, targetUserId);
      if (isUserMember) {
        throw new Error('User is already a member of this chat');
      }

      const now = Timestamp.now();
      const batch = writeBatch(db);

      // Add user as member
      const memberData: Omit<ChatMember, 'id'> = {
        chatId,
        userId: targetUserId,
        role: 'member',
        joinedAt: now
      };

      const memberRef = doc(collection(db, 'chat_members'));
      batch.set(memberRef, memberData);

      // Get user details for system message
      const [userDoc, adminDoc] = await Promise.all([
        getDoc(doc(db, 'users', targetUserId)),
        getDoc(doc(db, 'users', adminUserId))
      ]);

      const userData = userDoc.data();
      const adminData = adminDoc.data();
      const displayName = userData?.displayName || userData?.name || 'User';
      const adminName = adminData?.displayName || adminData?.name || 'Admin';

      // Add system message
      const systemMessageData: Omit<ChatMessage, 'id'> = {
        chatId,
        userId: null,
        type: 'system',
        text: `${displayName} was added by ${adminName}.`,
        meta: {
          action: 'add',
          actorId: targetUserId,
          byAdminId: adminUserId
        },
        createdAt: now
      };

      const messageRef = doc(collection(db, 'chat_messages'));
      batch.set(messageRef, systemMessageData);

      // Update chat activity
      batch.update(doc(db, 'chats', chatId), {
        lastMessage: systemMessageData,
        lastActivity: now
      });

      await batch.commit();

    } catch (error) {
      console.error('❌ Error adding member:', error);
      throw error;
    }
  }

  /**
   * Promote member to admin
   */
  static async promoteMemberToAdmin(chatId: string, userId: string, adminUserId: string): Promise<void> {
    try {
      const canManage = await this.canManageChat(chatId, adminUserId);
      if (!canManage) {
        throw new Error('You do not have permission to manage this chat');
      }

      // Update the member's role
      const memberQuery = query(
        collection(db, 'chat_members'),
        where('chatId', '==', chatId),
        where('userId', '==', userId)
      );
      
      const memberSnap = await getDocs(memberQuery);
      if (memberSnap.empty) {
        throw new Error('User is not a member of this chat');
      }

      const memberDoc = memberSnap.docs[0];
      await retryOnNetworkFailure(() => updateDoc(memberDoc.ref, {
        role: 'admin',
        updatedAt: Timestamp.now()
      }));

      console.log('✅ Member promoted to admin successfully');

    } catch (error) {
      console.error('❌ Error promoting member to admin:', error);
      throw error;
    }
  }

  /**
   * Demote a chat admin to member (requires another admin to remain).
   */
  static async demoteAdminToMember(chatId: string, userId: string, adminUserId: string): Promise<void> {
    try {
      const canManage = await this.canManageChat(chatId, adminUserId);
      if (!canManage) {
        throw new Error('You do not have permission to manage this chat');
      }
      if (userId === adminUserId) {
        throw new Error('Ask another admin to demote you, or leave the chat.');
      }

      const adminCount = await this.getAdminCount(chatId);
      if (adminCount <= 1) {
        throw new Error('Cannot demote the last admin');
      }

      const memberQuery = query(
        collection(db, 'chat_members'),
        where('chatId', '==', chatId),
        where('userId', '==', userId)
      );
      const memberSnap = await getDocs(memberQuery);
      if (memberSnap.empty) {
        throw new Error('User is not a member of this chat');
      }

      const memberDoc = memberSnap.docs[0];
      const role = (memberDoc.data() as ChatMember).role;
      if (role !== 'admin') {
        throw new Error('User is not a chat admin');
      }

      const now = Timestamp.now();
      const userDoc = await getDoc(doc(db, 'users', userId));
      const displayName = userDoc.data()?.displayName || userDoc.data()?.name || 'User';

      await retryOnNetworkFailure(() =>
        updateDoc(memberDoc.ref, { role: 'member', updatedAt: now })
      );

      const systemMessageData: Omit<ChatMessage, 'id'> = {
        chatId,
        userId: null,
        type: 'system',
        text: `${displayName} is no longer an admin.`,
        meta: { action: 'demote', actorId: userId, byAdminId: adminUserId, previousRole: 'admin', newRole: 'member' },
        createdAt: now,
      };
      await addDoc(collection(db, 'chat_messages'), systemMessageData);
      await updateDoc(doc(db, 'chats', chatId), {
        lastMessage: systemMessageData,
        lastActivity: now,
      });
    } catch (error) {
      console.error('❌ Error demoting admin:', error);
      throw error;
    }
  }

  /**
   * Get admin count for a chat
   */
  static async getAdminCount(chatId: string): Promise<number> {
    try {
      const adminQuery = query(
        collection(db, 'chat_members'),
        where('chatId', '==', chatId),
        where('role', '==', 'admin')
      );
      
      const adminSnap = await getDocs(adminQuery);
      return adminSnap.size;

    } catch (error) {
      console.error('❌ Error getting admin count:', error);
      throw error;
    }
  }

  /**
   * Get non-admin members for promotion
   */
  static async getNonAdminMembers(chatId: string): Promise<ChatMember[]> {
    try {
      const memberQuery = query(
        collection(db, 'chat_members'),
        where('chatId', '==', chatId),
        where('role', '==', 'member')
      );
      
      const memberSnap = await getDocs(memberQuery);
      return memberSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ChatMember[];

    } catch (error) {
      console.error('❌ Error getting non-admin members:', error);
      throw error;
    }
  }

  /**
   * Remove member from chat
   */
  static async removeMember(chatId: string, targetUserId: string, adminUserId: string): Promise<void> {
    try {
      // Verify admin permissions or self-removal
      const isSelfRemoval = targetUserId === adminUserId;
      if (!isSelfRemoval) {
        const canManage = await this.canManageChat(chatId, adminUserId);
        if (!canManage) {
          throw new Error('You do not have permission to remove members from this chat');
        }
      }

      // Get member document
      const memberQuery = query(
        collection(db, 'chat_members'),
        where('chatId', '==', chatId),
        where('userId', '==', targetUserId)
      );

      const memberSnap = await getDocs(memberQuery);
      if (memberSnap.empty) {
        throw new Error('User is not a member of this chat');
      }

      const memberDoc = memberSnap.docs[0];
      const memberData = memberDoc.data() as ChatMember;

      const now = Timestamp.now();
      const batch = writeBatch(db);

      // Remove member
      batch.delete(memberDoc.ref);

      // Get user details for system message
      const userDoc = await getDoc(doc(db, 'users', targetUserId));
      const userData = userDoc.data();
      const displayName = userData?.displayName || userData?.name || 'User';

      // Add system message
      const systemMessageData: Omit<ChatMessage, 'id'> = {
        chatId,
        userId: null,
        type: 'system',
        text: isSelfRemoval ? `${displayName} left the chat.` : `${displayName} was removed.`,
        meta: {
          action: isSelfRemoval ? 'leave' : 'remove',
          actorId: targetUserId,
          byAdminId: isSelfRemoval ? undefined : adminUserId
        },
        createdAt: now
      };

      const messageRef = doc(collection(db, 'chat_messages'));
      batch.set(messageRef, systemMessageData);

      // Update chat activity
      batch.update(doc(db, 'chats', chatId), {
        lastMessage: systemMessageData,
        lastActivity: now
      });

      await batch.commit();

    } catch (error) {
      console.error('❌ Error removing member:', error);
      throw error;
    }
  }

  /**
   * Delete chat (admin only)
   */
  static async deleteChat(chatId: string, adminUserId: string): Promise<void> {
    try {
      const canManage = await this.canManageChat(chatId, adminUserId);
      if (!canManage) {
        throw new Error('You do not have permission to delete this chat');
      }

      const batch = writeBatch(db);

      // Delete all chat messages
      const messagesQuery = query(
        collection(db, 'chat_messages'),
        where('chatId', '==', chatId)
      );
      const messagesSnap = await getDocs(messagesQuery);
      messagesSnap.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      // Delete all chat members
      const membersQuery = query(
        collection(db, 'chat_members'),
        where('chatId', '==', chatId)
      );
      const membersSnap = await getDocs(membersQuery);
      membersSnap.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      // Delete all chat requests
      const requestsQuery = query(
        collection(db, 'chat_requests'),
        where('chatId', '==', chatId)
      );
      const requestsSnap = await getDocs(requestsQuery);
      requestsSnap.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      // Delete the chat itself
      batch.delete(doc(db, 'chats', chatId));

      await batch.commit();

    } catch (error) {
      console.error('❌ Error deleting chat:', error);
      throw error;
    }
  }

  /**
   * Update chat details (admin only)
   */
  static async updateChat(
    chatId: string,
    updates: { name?: string; description?: string; allowRequests?: boolean; isPublic?: boolean; imageUrl?: string; imageCrop?: { scale: number; panX: number; panY: number } | null },
    adminUserId: string
  ): Promise<void> {
    try {
      const canManage = await this.canManageChat(chatId, adminUserId);
      if (!canManage) {
        throw new Error('You do not have permission to manage this chat');
      }

      // Validate updates
      if (updates.name !== undefined) {
        if (!updates.name.trim()) {
          throw new Error('Chat name cannot be empty');
        }
        if (updates.name.length > CHAT_LIMITS.MAX_CHAT_NAME_LENGTH) {
          throw new Error(`Chat name must be ${CHAT_LIMITS.MAX_CHAT_NAME_LENGTH} characters or less`);
        }
      }

      if (updates.description !== undefined && updates.description.length > CHAT_LIMITS.MAX_CHAT_DESCRIPTION_LENGTH) {
        throw new Error(`Description must be ${CHAT_LIMITS.MAX_CHAT_DESCRIPTION_LENGTH} characters or less`);
      }

      // Get current chat to detect actual changes for system messages
      const chatRef = doc(db, 'chats', chatId);
      const chatSnap = await getDoc(chatRef);
      const current = (chatSnap.exists() ? chatSnap.data() : {}) as ChatGroup;

      // Prepare update data
      const updateData: any = {
        lastActivity: Timestamp.now()
      };

      if (updates.name !== undefined) updateData.name = updates.name.trim();
      if (updates.description !== undefined) updateData.description = updates.description.trim();
      if (updates.allowRequests !== undefined) updateData.allowRequests = updates.allowRequests;
      if (updates.isPublic !== undefined) updateData.isPublic = updates.isPublic;
      if (updates.imageUrl !== undefined) updateData.imageUrl = updates.imageUrl?.trim() || null;
      if (updates.imageCrop !== undefined) updateData.imageCrop = updates.imageCrop ?? null;

      await updateDoc(chatRef, updateData);

      // Helper to post a system message and update chat lastMessage
      const postSystemMessage = async (text: string) => {
        const userDoc = await getDoc(doc(db, 'users', adminUserId));
        const userData = userDoc.data();
        const adminName = userData?.displayName || userData?.name || 'Admin';
        const systemMessageData: Omit<ChatMessage, 'id'> = {
          chatId,
          userId: null,
          type: 'system',
          text: `${adminName} ${text}`,
          meta: { action: 'edit', byAdminId: adminUserId },
          createdAt: Timestamp.now()
        };
        await addDoc(collection(db, 'chat_messages'), systemMessageData);
        await updateDoc(chatRef, { lastMessage: systemMessageData, lastActivity: Timestamp.now() });
      };

      const currentName = (current.name || '').trim();
      const newName = (updates.name ?? currentName).trim();
      const nameChanged = updates.name !== undefined && newName !== currentName;

      const currentDesc = (current.description || '').trim();
      const newDesc = (updates.description ?? currentDesc).trim();
      const descriptionChanged = updates.description !== undefined && newDesc !== currentDesc;

      const currentImage = (current.imageUrl || '').trim();
      const newImage = (updates.imageUrl ?? currentImage).trim();
      const imageChanged = updates.imageUrl !== undefined && newImage !== currentImage;

      const allowRequestsChanged = updates.allowRequests !== undefined && updates.allowRequests !== (current.allowRequests ?? false);
      const isPublicChanged = updates.isPublic !== undefined && updates.isPublic !== (current.isPublic ?? false);

      if (nameChanged) {
        await postSystemMessage(`changed the chat name to "${newName}".`);
      }
      if (descriptionChanged) {
        await postSystemMessage('updated the chat description.');
      }
      if (imageChanged) {
        await postSystemMessage('changed the group icon.');
      }
      if (allowRequestsChanged) {
        await postSystemMessage(updates.allowRequests ? 'opened this chat for join requests.' : 'closed this chat to new join requests.');
      }
      if (isPublicChanged) {
        await postSystemMessage(updates.isPublic ? 'made this chat discoverable.' : 'made this chat no longer discoverable.');
      }

    } catch (error) {
      console.error('❌ Error updating chat:', error);
      throw error;
    }
  }

  /**
   * Get user's chat permissions
   */
  static async getUserPermissions(chatId: string, userId: string): Promise<ChatPermissions> {
    try {
      const isUserMember = await this.isUserMember(chatId, userId);
      if (!isUserMember) {
        return {
          canReadMessages: false,
          canSendMessages: false,
          canManageMembers: false,
          canManageRequests: false,
          canChangeRoles: false,
          canDeleteChat: false,
          canLeave: false
        };
      }

      const isAdmin = await this.isUserAdmin(chatId, userId);

      return {
        canReadMessages: true,
        canSendMessages: true,
        canManageMembers: isAdmin,
        canManageRequests: isAdmin,
        canChangeRoles: isAdmin,
        canDeleteChat: isAdmin,
        canLeave: true
      };

    } catch (error) {
      console.error('❌ Error getting user permissions:', error);
      return {
        canReadMessages: false,
        canSendMessages: false,
        canManageMembers: false,
        canManageRequests: false,
        canChangeRoles: false,
        canDeleteChat: false,
        canLeave: false
      };
    }
  }

  /**
   * Subscribe to chat messages in real-time
   */
  static subscribeToMessages(
    chatId: string,
    userId: string,
    callback: (messages: ChatMessage[]) => void,
    onError?: (error: Error) => void
  ) {
    const messagesQuery = query(
      collection(db, 'chat_messages'),
      where('chatId', '==', chatId),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    return onSnapshot(
      messagesQuery,
      async (snapshot) => {
        const messages = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as ChatMessage[];

        // Enrich messages with user profile data
        const enrichedMessages = await Promise.all(
          messages.map(async (message) => {
            if (message.userId && !message.userDisplayName) {
              try {
                const userDoc = await getDoc(doc(db, 'users', message.userId));
                if (userDoc.exists()) {
                  const userData = userDoc.data();
                  return {
                    ...message,
                    userDisplayName: userData.name || userData.displayName,
                    userProfileImage: userData.profileImage || userData.avatarUrl
                  };
                }
              } catch (error) {
                console.error('Error loading user data for message:', error);
              }
            }
            return message;
          })
        );

        // Reverse to show oldest first
        enrichedMessages.reverse();
        callback(enrichedMessages);

        // Update lastRead timestamp when messages are loaded
        if (messages.length > 0) {
          await this.markChatAsRead(chatId, userId);
        }
      },
      (error) => {
        console.error('❌ Error in messages subscription:', error);
        onError?.(error);
      }
    );
  }

  /**
   * Mark chat as read by updating lastRead timestamp
   */
  static async markChatAsRead(chatId: string, userId: string): Promise<void> {
    try {
      // Find the chat_member document
      const memberQuery = query(
        collection(db, 'chat_members'),
        where('chatId', '==', chatId),
        where('userId', '==', userId)
      );

      const memberSnap = await getDocs(memberQuery);
      if (memberSnap.empty) {
        console.warn(`⚠️ Chat membership not found for user ${userId} in chat ${chatId}`);
        return;
      }

      const memberDoc = memberSnap.docs[0];
      await updateDoc(doc(db, 'chat_members', memberDoc.id), {
        lastRead: Timestamp.now()
      });

      console.log(`✅ Marked chat ${chatId} as read for user ${userId}`);
    } catch (error) {
      console.error('❌ Error marking chat as read:', error);
      // Don't throw error - this is a non-critical operation
    }
  }

  // Private helper methods

  private static async isUserMember(chatId: string, userId: string): Promise<boolean> {
    const memberQuery = query(
      collection(db, 'chat_members'),
      where('chatId', '==', chatId),
      where('userId', '==', userId)
    );

    const memberSnap = await getDocs(memberQuery);
    return !memberSnap.empty;
  }

  private static async isUserAdmin(chatId: string, userId: string): Promise<boolean> {
    const memberQuery = query(
      collection(db, 'chat_members'),
      where('chatId', '==', chatId),
      where('userId', '==', userId),
      where('role', '==', 'admin')
    );

    const memberSnap = await getDocs(memberQuery);
    return !memberSnap.empty;
  }

  /** Alma app admins can manage any chat without being a chat member. */
  private static async isAppAdmin(userId: string): Promise<boolean> {
    try {
      const userDoc = await retryOnNetworkFailure(() => getDoc(doc(db, 'users', userId)));
      if (!userDoc.exists()) return false;
      return isAppAdminDoc(userDoc.data());
    } catch {
      return false;
    }
  }

  /** Chat admin OR app admin (Admin panel). */
  private static async canManageChat(chatId: string, userId: string): Promise<boolean> {
    if (await this.isUserAdmin(chatId, userId)) return true;
    return this.isAppAdmin(userId);
  }

  private static async checkJoinRequestRateLimit(userId: string): Promise<void> {
    const ref = doc(db, 'chat_rate_limits', `join_${userId}`);
    const snap = await retryOnNetworkFailure(() => getDoc(ref));
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const data = snap.data();
    if (data?.date === today && (data?.count ?? 0) >= CHAT_LIMITS.MAX_JOIN_REQUESTS_PER_DAY) {
      throw new Error(`You can only submit ${CHAT_LIMITS.MAX_JOIN_REQUESTS_PER_DAY} join requests per day. Try again tomorrow.`);
    }
  }

  private static async updateJoinRequestRateLimit(userId: string): Promise<void> {
    const ref = doc(db, 'chat_rate_limits', `join_${userId}`);
    const today = new Date().toISOString().slice(0, 10);
    const snap = await retryOnNetworkFailure(() => getDoc(ref));
    const data = snap.data();
    const count = (data?.date === today ? (data?.count ?? 0) : 0) + 1;
    await retryOnNetworkFailure(() =>
      setDoc(ref, { date: today, count, updatedAt: Timestamp.now() }, { merge: true })
    );
  }

  private static async checkMessageRateLimit(userId: string): Promise<void> {
    const ref = doc(db, 'chat_rate_limits', `msg_${userId}`);
    const snap = await retryOnNetworkFailure(() => getDoc(ref));
    const now = Date.now();
    const minute = Math.floor(now / 60000);
    const data = snap.data();
    if (data?.minute === minute && (data?.count ?? 0) >= CHAT_LIMITS.MAX_MESSAGES_PER_MINUTE) {
      throw new Error(`You can send up to ${CHAT_LIMITS.MAX_MESSAGES_PER_MINUTE} messages per minute. Please wait a moment.`);
    }
  }

  private static async updateMessageRateLimit(userId: string): Promise<void> {
    const ref = doc(db, 'chat_rate_limits', `msg_${userId}`);
    const minute = Math.floor(Date.now() / 60000);
    const snap = await retryOnNetworkFailure(() => getDoc(ref));
    const data = snap.data();
    const count = (data?.minute === minute ? (data?.count ?? 0) : 0) + 1;
    await retryOnNetworkFailure(() =>
      setDoc(ref, { minute, count, updatedAt: Timestamp.now() }, { merge: true })
    );
  }

  private static sanitizeMessage(text: string): string {
    // Sanitize: Remove HTML tags only, preserve plain text characters
    // Do NOT HTML-escape text since we render as plain text content (not HTML)
    // Store and transmit messages as raw UTF-8 plain text
    return text
      .replace(/<[^>]*>/g, '') // Remove HTML tags for security
      .trim();
  }

  /**
   * Add or toggle a reaction to a message
   */
  static async toggleReaction(
    chatId: string,
    messageId: string,
    userId: string,
    emoji: string
  ): Promise<void> {
    try {
      // Verify user is a member
      const isUserMember = await this.isUserMember(chatId, userId);
      if (!isUserMember) {
        throw new Error('User is not a member of this chat');
      }

      const messageRef = doc(db, 'chat_messages', messageId);
      const messageDoc = await getDoc(messageRef);

      if (!messageDoc.exists()) {
        throw new Error('Message not found');
      }

      const messageData = messageDoc.data() as ChatMessage;
      const reactions = messageData.reactions || [];
      
      // Check if user already reacted with this emoji
      const existingReactionIndex = reactions.findIndex(
        r => r.userId === userId && r.emoji === emoji
      );

      if (existingReactionIndex >= 0) {
        // Remove reaction
        reactions.splice(existingReactionIndex, 1);
      } else {
        // Add reaction
        // Get user display name
        const userDoc = await getDoc(doc(db, 'users', userId));
        const userData = userDoc.data();
        
        reactions.push({
          emoji,
          userId,
          userDisplayName: userData?.name || userData?.displayName || 'Unknown User',
          createdAt: Timestamp.now()
        });
      }

      await updateDoc(messageRef, {
        reactions
      });

    } catch (error) {
      console.error('❌ Error toggling reaction:', error);
      throw error;
    }
  }

  /**
   * Mark message as read
   */
  static async markMessageAsRead(
    chatId: string,
    messageId: string,
    userId: string
  ): Promise<void> {
    try {
      const messageRef = doc(db, 'chat_messages', messageId);
      const messageDoc = await getDoc(messageRef);

      if (!messageDoc.exists()) {
        return;
      }

      const messageData = messageDoc.data() as ChatMessage;
      const readBy = messageData.readBy || [];

      if (!readBy.includes(userId)) {
        readBy.push(userId);
        await updateDoc(messageRef, {
          readBy
        });

        // Update message status if it's the sender checking
        if (messageData.userId && messageData.userId !== userId) {
          // This is someone else's message, update their status
          const allMembers = await this.getChatMembers(chatId);
          const allMemberIds = allMembers.map(m => m.userId);
          const allRead = allMemberIds.every(id => id === messageData.userId || readBy.includes(id));
          
          if (allRead && messageData.status !== 'read') {
            await updateDoc(messageRef, {
              status: 'read'
            });
          } else if (messageData.status === 'sent') {
            await updateDoc(messageRef, {
              status: 'delivered'
            });
          }
        }
      }
    } catch (error) {
      console.error('❌ Error marking message as read:', error);
      // Don't throw - this is a non-critical operation
    }
  }
}