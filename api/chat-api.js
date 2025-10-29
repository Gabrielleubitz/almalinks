import { initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

// Initialize Firebase Admin SDK
let adminApp;
try {
  adminApp = initializeApp({
    credential: require('firebase-admin').credential.applicationDefault()
  });
} catch (error) {
  console.log('Firebase Admin already initialized');
}

const db = getFirestore();
const auth = getAuth();

// Chat limits and validation
const CHAT_LIMITS = {
  MAX_JOIN_REQUESTS_PER_DAY: 5,
  MAX_MESSAGES_PER_MINUTE: 10,
  REQUEST_EXPIRY_DAYS: 14,
  MAX_CHAT_NAME_LENGTH: 100,
  MAX_CHAT_DESCRIPTION_LENGTH: 500,
  MAX_MESSAGE_LENGTH: 2000,
  MAX_REQUEST_MESSAGE_LENGTH: 500,
};

// Helper functions
const verifyAdmin = async (uid) => {
  try {
    console.log(`🔍 Verifying admin status for user: ${uid}`);
    const userDoc = await db.collection('users').doc(uid).get();
    if (!userDoc.exists) {
      console.log(`❌ User document not found: ${uid}`);
      throw new Error('User not found');
    }
    
    const userData = userDoc.data();
    console.log(`👤 User data:`, { uid, role: userData.role, email: userData.email });
    const isAdmin = userData.role === 'admin';
    console.log(`🔑 Admin verification result: ${isAdmin}`);
    return isAdmin;
  } catch (error) {
    console.error('❌ Error verifying admin:', error);
    return false;
  }
};

const verifyChatMember = async (chatId, userId) => {
  try {
    const memberQuery = await db.collection('chat_members')
      .where('chatId', '==', chatId)
      .where('userId', '==', userId)
      .get();
    
    return !memberQuery.empty;
  } catch (error) {
    console.error('Error verifying chat member:', error);
    return false;
  }
};

const verifyChatAdmin = async (chatId, userId) => {
  try {
    const memberQuery = await db.collection('chat_members')
      .where('chatId', '==', chatId)
      .where('userId', '==', userId)
      .where('role', '==', 'admin')
      .get();
    
    return !memberQuery.empty;
  } catch (error) {
    console.error('Error verifying chat admin:', error);
    return false;
  }
};

const sanitizeMessage = (text) => {
  if (!text) return '';
  
  return text
    .replace(/<[^>]*>/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .trim();
};

// API Handlers

/**
 * POST /api/admin/chats - Create ChatGroup (Admin only)
 */
export const createChatGroup = async (req, res) => {
  try {
    console.log('🚀 CREATE CHAT GROUP REQUEST:', { 
      body: req.body, 
      user: req.user,
      headers: Object.keys(req.headers)
    });

    const { 
      name, 
      description = '', 
      allowRequests = false, 
      isPublic = false,
      initialAdmins = [],
      seedMembers = [],
      createdBy 
    } = req.body;

    console.log(`📝 Chat creation request: name="${name}", createdBy="${createdBy}"`);

    if (!createdBy) {
      console.log('❌ No createdBy field in request');
      return res.status(400).json({ error: 'createdBy field is required' });
    }

    // Verify user is admin
    console.log('🔍 Verifying admin permissions...');
    const isAdmin = await verifyAdmin(createdBy);
    if (!isAdmin) {
      console.log(`❌ User ${createdBy} is not an admin`);
      return res.status(403).json({ 
        error: 'Only users with admin role can create chat groups',
        details: `User ${createdBy} does not have admin privileges`
      });
    }

    console.log('✅ Admin verification passed');

    // Validation
    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: 'Chat name is required' });
    }

    if (name.length > CHAT_LIMITS.MAX_CHAT_NAME_LENGTH) {
      return res.status(400).json({ error: `Chat name must be ${CHAT_LIMITS.MAX_CHAT_NAME_LENGTH} characters or less` });
    }

    if (description.length > CHAT_LIMITS.MAX_CHAT_DESCRIPTION_LENGTH) {
      return res.status(400).json({ error: `Description must be ${CHAT_LIMITS.MAX_CHAT_DESCRIPTION_LENGTH} characters or less` });
    }

    if (initialAdmins.length === 0) {
      return res.status(400).json({ error: 'At least one admin is required' });
    }

    const now = Timestamp.now();
    
    // Create chat document
    const chatData = {
      name: name.trim(),
      description: description.trim(),
      createdAt: now,
      createdBy,
      allowRequests,
      isPublic,
      lastActivity: now
    };

    const chatRef = await db.collection('chats').add(chatData);
    const chatId = chatRef.id;

    // Create admin memberships
    const batch = db.batch();
    
    for (const adminId of initialAdmins) {
      const memberRef = db.collection('chat_members').doc();
      batch.set(memberRef, {
        chatId,
        userId: adminId,
        role: 'admin',
        joinedAt: now
      });
    }

    // Create member memberships
    for (const memberId of seedMembers) {
      const memberRef = db.collection('chat_members').doc();
      batch.set(memberRef, {
        chatId,
        userId: memberId,
        role: 'member',
        joinedAt: now
      });
    }

    // Add system messages for each member
    const allMembers = [...new Set([...initialAdmins, ...seedMembers])];
    
    for (const memberId of allMembers) {
      try {
        const userDoc = await db.collection('users').doc(memberId).get();
        const userData = userDoc.exists ? userDoc.data() : {};
        const displayName = userData.displayName || userData.name || 'User';
        
        const messageRef = db.collection('chat_messages').doc();
        batch.set(messageRef, {
          chatId,
          userId: null,
          type: 'system',
          text: `${displayName} joined the chat.`,
          meta: {
            action: 'join',
            actorId: memberId,
            byAdminId: createdBy
          },
          createdAt: now
        });
      } catch (error) {
        console.error(`Error creating system message for user ${memberId}:`, error);
      }
    }

    await batch.commit();

    // Log audit entry
    await db.collection('admin_audit_log').add({
      action: 'create_chat_group',
      performedBy: createdBy,
      targetId: chatId,
      details: {
        chatName: name,
        memberCount: allMembers.length,
        adminCount: initialAdmins.length
      },
      timestamp: now
    });

    res.status(201).json({ 
      success: true, 
      chatId,
      message: 'Chat group created successfully'
    });

  } catch (error) {
    console.error('Error creating chat group:', error);
    res.status(500).json({ 
      error: 'Failed to create chat group',
      details: error.message
    });
  }
};

/**
 * GET /api/chats/mine - Get user's chats
 */
export const getUserChats = async (req, res) => {
  try {
    const userId = req.user?.uid; // Assuming auth middleware sets req.user
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Get user's memberships
    const membershipsSnapshot = await db.collection('chat_members')
      .where('userId', '==', userId)
      .get();

    if (membershipsSnapshot.empty) {
      return res.json([]);
    }

    const memberships = membershipsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Get chat details for each membership
    const chatPromises = memberships.map(async (membership) => {
      try {
        const chatDoc = await db.collection('chats').doc(membership.chatId).get();
        if (!chatDoc.exists) return null;

        const chatData = { id: chatDoc.id, ...chatDoc.data() };

        // Get member count
        const membersSnapshot = await db.collection('chat_members')
          .where('chatId', '==', membership.chatId)
          .get();
        
        const memberCount = membersSnapshot.size;

        return {
          ...chatData,
          memberCount,
          userRole: membership.role,
          lastMessagePreview: chatData.lastMessage?.text || 'No messages yet'
        };
      } catch (error) {
        console.error(`Error loading chat ${membership.chatId}:`, error);
        return null;
      }
    });

    const chats = (await Promise.all(chatPromises))
      .filter(Boolean)
      .sort((a, b) => {
        const aTime = a.lastActivity?.toMillis() || a.createdAt?.toMillis() || 0;
        const bTime = b.lastActivity?.toMillis() || b.createdAt?.toMillis() || 0;
        return bTime - aTime;
      });

    res.json(chats);

  } catch (error) {
    console.error('Error getting user chats:', error);
    res.status(500).json({ error: 'Failed to load chats' });
  }
};

/**
 * GET /api/chats/:chatId/messages - Get chat messages with pagination
 */
export const getChatMessages = async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user?.uid;
    const { limit = 50, cursor } = req.query;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Verify user is a member
    const isMember = await verifyChatMember(chatId, userId);
    if (!isMember) {
      return res.status(403).json({ error: 'You are not a member of this chat' });
    }

    let query = db.collection('chat_messages')
      .where('chatId', '==', chatId)
      .orderBy('createdAt', 'desc')
      .limit(parseInt(limit));

    if (cursor) {
      const cursorDoc = await db.collection('chat_messages').doc(cursor).get();
      if (cursorDoc.exists) {
        query = query.startAfter(cursorDoc);
      }
    }

    const snapshot = await query.get();
    const messages = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    res.json({
      messages: messages.reverse(), // Reverse to show oldest first
      hasMore: snapshot.docs.length === parseInt(limit),
      lastDoc: snapshot.docs[snapshot.docs.length - 1]?.id
    });

  } catch (error) {
    console.error('Error getting chat messages:', error);
    res.status(500).json({ error: 'Failed to load messages' });
  }
};

/**
 * POST /api/chats/:chatId/messages - Send a message
 */
export const sendMessage = async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user?.uid;
    const { text } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Verify user is a member
    const isMember = await verifyChatMember(chatId, userId);
    if (!isMember) {
      return res.status(403).json({ error: 'You are not a member of this chat' });
    }

    // Validate message
    const sanitizedText = sanitizeMessage(text);
    if (!sanitizedText.trim()) {
      return res.status(400).json({ error: 'Message cannot be empty' });
    }

    if (sanitizedText.length > CHAT_LIMITS.MAX_MESSAGE_LENGTH) {
      return res.status(400).json({ 
        error: `Message too long (max ${CHAT_LIMITS.MAX_MESSAGE_LENGTH} characters)` 
      });
    }

    // TODO: Check rate limits here

    const now = Timestamp.now();
    
    const messageData = {
      chatId,
      userId,
      type: 'user',
      text: sanitizedText,
      createdAt: now
    };

    // Add message
    const messageRef = await db.collection('chat_messages').add(messageData);

    // Update chat's last message and activity
    await db.collection('chats').doc(chatId).update({
      lastMessage: messageData,
      lastActivity: now
    });

    res.status(201).json({
      id: messageRef.id,
      ...messageData
    });

  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
};

/**
 * POST /api/chats/:chatId/requests - Create join request
 */
export const createJoinRequest = async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user?.uid;
    const { message = '' } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Check if chat exists and allows requests
    const chatDoc = await db.collection('chats').doc(chatId).get();
    if (!chatDoc.exists) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    const chatData = chatDoc.data();
    if (!chatData.allowRequests) {
      return res.status(400).json({ error: 'This chat does not allow join requests' });
    }

    // Check if user is already a member
    const isMember = await verifyChatMember(chatId, userId);
    if (isMember) {
      return res.status(409).json({ error: 'You are already a member of this chat' });
    }

    // Check for existing pending request
    const existingRequestQuery = await db.collection('chat_requests')
      .where('chatId', '==', chatId)
      .where('userId', '==', userId)
      .where('status', '==', 'pending')
      .get();

    if (!existingRequestQuery.empty) {
      return res.status(409).json({ error: 'You already have a pending request for this chat' });
    }

    // TODO: Check rate limits here

    const requestData = {
      chatId,
      userId,
      status: 'pending',
      createdAt: Timestamp.now(),
      message: message.substring(0, CHAT_LIMITS.MAX_REQUEST_MESSAGE_LENGTH)
    };

    const requestRef = await db.collection('chat_requests').add(requestData);

    res.status(201).json({
      id: requestRef.id,
      ...requestData
    });

  } catch (error) {
    console.error('Error creating join request:', error);
    res.status(500).json({ error: 'Failed to create join request' });
  }
};

/**
 * GET /api/chats/:chatId/requests - Get pending join requests (Admin only)
 */
export const getPendingRequests = async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user?.uid;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Verify user is admin of this chat
    const isAdmin = await verifyChatAdmin(chatId, userId);
    if (!isAdmin) {
      return res.status(403).json({ error: 'Only chat admins can view join requests' });
    }

    const requestsSnapshot = await db.collection('chat_requests')
      .where('chatId', '==', chatId)
      .where('status', '==', 'pending')
      .orderBy('createdAt', 'desc')
      .get();

    const requests = await Promise.all(
      requestsSnapshot.docs.map(async (doc) => {
        const requestData = { id: doc.id, ...doc.data() };
        
        // Get user details
        try {
          const userDoc = await db.collection('users').doc(requestData.userId).get();
          const userData = userDoc.exists ? userDoc.data() : {};
          
          return {
            ...requestData,
            userDisplayName: userData.displayName || userData.name || 'Unknown User',
            userAvatarUrl: userData.avatarUrl || userData.profileImage
          };
        } catch (error) {
          console.error('Error loading user data:', error);
          return {
            ...requestData,
            userDisplayName: 'Unknown User'
          };
        }
      })
    );

    res.json(requests);

  } catch (error) {
    console.error('Error getting pending requests:', error);
    res.status(500).json({ error: 'Failed to load requests' });
  }
};

/**
 * POST /api/chats/:chatId/requests/:requestId/approve - Approve join request (Admin only)
 */
export const approveJoinRequest = async (req, res) => {
  try {
    const { chatId, requestId } = req.params;
    const adminUserId = req.user?.uid;

    if (!adminUserId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Verify admin permissions
    const isAdmin = await verifyChatAdmin(chatId, adminUserId);
    if (!isAdmin) {
      return res.status(403).json({ error: 'Only chat admins can approve requests' });
    }

    // Get request
    const requestDoc = await db.collection('chat_requests').doc(requestId).get();
    if (!requestDoc.exists) {
      return res.status(404).json({ error: 'Request not found' });
    }

    const requestData = requestDoc.data();
    if (requestData.status !== 'pending') {
      return res.status(400).json({ error: 'Request is no longer pending' });
    }

    const now = Timestamp.now();
    const batch = db.batch();

    // Update request status
    batch.update(db.collection('chat_requests').doc(requestId), {
      status: 'approved',
      resolvedAt: now,
      resolvedBy: adminUserId
    });

    // Add user as member
    const memberRef = db.collection('chat_members').doc();
    batch.set(memberRef, {
      chatId: requestData.chatId,
      userId: requestData.userId,
      role: 'member',
      joinedAt: now
    });

    // Get user details for system message
    const userDoc = await db.collection('users').doc(requestData.userId).get();
    const userData = userDoc.exists ? userDoc.data() : {};
    const displayName = userData.displayName || userData.name || 'User';

    // Add system message
    const systemMessageRef = db.collection('chat_messages').doc();
    const systemMessageData = {
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

    batch.set(systemMessageRef, systemMessageData);

    // Update chat activity
    batch.update(db.collection('chats').doc(requestData.chatId), {
      lastMessage: systemMessageData,
      lastActivity: now
    });

    await batch.commit();

    res.json({ success: true, message: 'Join request approved' });

  } catch (error) {
    console.error('Error approving join request:', error);
    res.status(500).json({ error: 'Failed to approve request' });
  }
};

/**
 * POST /api/chats/:chatId/requests/:requestId/reject - Reject join request (Admin only)
 */
export const rejectJoinRequest = async (req, res) => {
  try {
    const { chatId, requestId } = req.params;
    const adminUserId = req.user?.uid;

    if (!adminUserId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Verify admin permissions
    const isAdmin = await verifyChatAdmin(chatId, adminUserId);
    if (!isAdmin) {
      return res.status(403).json({ error: 'Only chat admins can reject requests' });
    }

    // Get request
    const requestDoc = await db.collection('chat_requests').doc(requestId).get();
    if (!requestDoc.exists) {
      return res.status(404).json({ error: 'Request not found' });
    }

    const requestData = requestDoc.data();
    if (requestData.status !== 'pending') {
      return res.status(400).json({ error: 'Request is no longer pending' });
    }

    await db.collection('chat_requests').doc(requestId).update({
      status: 'rejected',
      resolvedAt: Timestamp.now(),
      resolvedBy: adminUserId
    });

    res.json({ success: true, message: 'Join request rejected' });

  } catch (error) {
    console.error('Error rejecting join request:', error);
    res.status(500).json({ error: 'Failed to reject request' });
  }
};

// Express app setup (if this is the main file)
export default async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    // Simple routing based on URL path
    const { method } = req;
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathParts = url.pathname.split('/').filter(Boolean);

    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      try {
        const decodedToken = await auth.verifyIdToken(token);
        req.user = decodedToken;
      } catch (error) {
        console.error('Token verification failed:', error);
      }
    }

    // Route to appropriate handler
    if (pathParts[0] === 'api') {
      if (pathParts[1] === 'admin' && pathParts[2] === 'chats' && method === 'POST') {
        return createChatGroup(req, res);
      }
      
      if (pathParts[1] === 'chats') {
        if (pathParts[2] === 'mine' && method === 'GET') {
          return getUserChats(req, res);
        }
        
        if (pathParts.length >= 3) {
          const chatId = pathParts[2];
          
          if (pathParts[3] === 'messages' && method === 'GET') {
            return getChatMessages(req, res);
          }
          
          if (pathParts[3] === 'messages' && method === 'POST') {
            return sendMessage(req, res);
          }
          
          if (pathParts[3] === 'requests') {
            if (method === 'POST') {
              return createJoinRequest(req, res);
            }
            if (method === 'GET') {
              return getPendingRequests(req, res);
            }
            
            if (pathParts.length >= 6) {
              const requestId = pathParts[4];
              if (pathParts[5] === 'approve' && method === 'POST') {
                return approveJoinRequest(req, res);
              }
              if (pathParts[5] === 'reject' && method === 'POST') {
                return rejectJoinRequest(req, res);
              }
            }
          }
        }
      }
    }

    res.status(404).json({ error: 'API endpoint not found' });

  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
};