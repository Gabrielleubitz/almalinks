import admin from 'firebase-admin';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  try {
    // Try to use service account key from environment variable first
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      const serviceAccountKey = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
      
      console.log(`🔍 Using service account for project: ${serviceAccountKey.project_id}`);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccountKey),
        databaseURL: `https://${serviceAccountKey.project_id}-default-rtdb.firebaseio.com`
      });
    } else {
      // Use the alma-links-test service account file
      const path = require('path');
      const serviceAccountPath = path.join(__dirname, '..', '..', 'alma-links-test-firebase-adminsdk-fbsvc-0a0cc6c7cc.json');
      
      console.log(`🔍 Using alma-links-test service account from: ${serviceAccountPath}`);
      
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccountPath),
        databaseURL: 'https://alma-links-test-default-rtdb.firebaseio.com'
      });
    }
    
    console.log(`✅ Firebase Admin SDK initialized for project: ${admin.app().options.projectId || 'alma-links-test'}`);
  } catch (error) {
    console.error('❌ Firebase Admin initialization error:', error);
  }
}

// Log the project ID for verification
console.log(`🔍 Admin API - Firebase project ID: ${admin.app()?.options?.projectId || 'NOT_INITIALIZED'}`);
console.log(`🔍 Admin API - Available admin apps: ${admin.apps.length}`);

const db = getFirestore();
const auth = getAuth();

// Chat limits and validation
const CHAT_LIMITS = {
  MAX_CHAT_NAME_LENGTH: 100,
  MAX_CHAT_DESCRIPTION_LENGTH: 500,
};

// Helper function to verify Firebase ID token and check admin status
const verifyAdminFromToken = async (req) => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('❌ No valid Authorization header found');
      return { isValid: false, error: 'Missing or invalid authorization header' };
    }

    const token = authHeader.substring(7);
    console.log(`🔍 Verifying Firebase ID token...`);
    
    // Verify the Firebase ID token
    const decodedToken = await auth.verifyIdToken(token);
    console.log(`✅ Token verified for user: ${decodedToken.uid}`);
    
    // Check user's admin status in Firestore
    const userDoc = await db.collection('users').doc(decodedToken.uid).get();
    
    if (!userDoc.exists) {
      console.log(`❌ User document not found in Firestore: ${decodedToken.uid}`);
      return { isValid: false, error: 'User not found in database' };
    }
    
    const userData = userDoc.data();
    console.log(`👤 User Firestore data:`, { 
      uid: decodedToken.uid, 
      role: userData?.role, 
      email: userData?.email,
      allFields: Object.keys(userData || {})
    });
    
    const isAdmin = userData?.role === 'admin';
    console.log(`🔑 Admin verification result: ${isAdmin}`);
    
    if (!isAdmin) {
      console.log(`❌ User role check failed. Expected: 'admin', Got: '${userData?.role}'`);
      return { 
        isValid: false, 
        error: 'User does not have admin privileges',
        details: `Role in database: ${userData?.role || 'not set'}`
      };
    }
    
    return { isValid: true, uid: decodedToken.uid, userData };
    
  } catch (error) {
    console.error('❌ Error verifying admin token:', error);
    return { isValid: false, error: 'Authentication verification failed', details: error.message };
  }
};

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST requests for chat creation
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      error: 'Method not allowed',
      message: 'Only POST requests are allowed for chat creation'
    });
  }

  try {
    console.log('🚀 CREATE CHAT GROUP REQUEST:', { 
      body: req.body,
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

    // Verify user is authenticated and is admin
    console.log('🔍 Verifying authentication and admin permissions...');
    const authResult = await verifyAdminFromToken(req);
    
    if (!authResult.isValid) {
      console.log(`❌ Authentication/Authorization failed: ${authResult.error}`);
      return res.status(403).json({ 
        error: 'Access denied',
        message: authResult.error,
        details: authResult.details
      });
    }

    // Use the authenticated user's UID as the creator
    const authenticatedUserId = authResult.uid;
    console.log(`📝 Chat creation request: name="${name}", authenticatedUser="${authenticatedUserId}"`);

    // Override createdBy with the authenticated user's UID for security
    const actualCreatedBy = authenticatedUserId;

    console.log('✅ Admin verification passed');

    // Validation
    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: 'Chat name is required' });
    }

    if (name.length > CHAT_LIMITS.MAX_CHAT_NAME_LENGTH) {
      return res.status(400).json({ 
        error: `Chat name must be ${CHAT_LIMITS.MAX_CHAT_NAME_LENGTH} characters or less` 
      });
    }

    if (description.length > CHAT_LIMITS.MAX_CHAT_DESCRIPTION_LENGTH) {
      return res.status(400).json({ 
        error: `Description must be ${CHAT_LIMITS.MAX_CHAT_DESCRIPTION_LENGTH} characters or less` 
      });
    }

    if (initialAdmins.length === 0) {
      return res.status(400).json({ error: 'At least one admin is required' });
    }

    console.log('✅ Validation passed, creating chat...');

    const now = Timestamp.now();
    
    // Create chat document
    const chatData = {
      name: name.trim(),
      description: description.trim(),
      createdAt: now,
      createdBy: actualCreatedBy,
      allowRequests,
      isPublic,
      lastActivity: now
    };

    const chatRef = await db.collection('chats').add(chatData);
    const chatId = chatRef.id;

    console.log(`✅ Chat created with ID: ${chatId}`);

    // Create admin and member memberships
    const batch = db.batch();
    
    // Create admin memberships
    for (const adminId of initialAdmins) {
      const memberRef = db.collection('chat_members').doc();
      batch.set(memberRef, {
        chatId,
        userId: adminId,
        role: 'admin',
        joinedAt: now
      });
      console.log(`➕ Adding admin: ${adminId}`);
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
      console.log(`➕ Adding member: ${memberId}`);
    }

    // Add system messages for each member
    const allMembers = [...new Set([...initialAdmins, ...seedMembers])];
    console.log(`👥 Total members to add: ${allMembers.length}`);
    
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
            byAdminId: actualCreatedBy
          },
          createdAt: now
        });
        console.log(`💬 Adding system message for: ${displayName}`);
      } catch (error) {
        console.error(`❌ Error creating system message for user ${memberId}:`, error);
      }
    }

    await batch.commit();
    console.log('✅ Batch commit successful');

    // Log audit entry
    try {
      await db.collection('admin_audit_log').add({
        action: 'create_chat_group',
        performedBy: actualCreatedBy,
        targetId: chatId,
        details: {
          chatName: name,
          memberCount: allMembers.length,
          adminCount: initialAdmins.length
        },
        timestamp: now
      });
      console.log('✅ Audit log entry created');
    } catch (error) {
      console.error('❌ Error creating audit log:', error);
    }

    console.log('🎉 Chat group created successfully');

    return res.status(201).json({ 
      success: true, 
      chatId,
      message: 'Chat group created successfully',
      details: {
        name,
        memberCount: allMembers.length,
        adminCount: initialAdmins.length
      }
    });

  } catch (error) {
    console.error('❌ Error creating chat group:', error);
    return res.status(500).json({ 
      error: 'Failed to create chat group',
      message: error.message || 'An internal server error occurred',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}