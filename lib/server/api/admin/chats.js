/**
 * POST /api/admin/chats — create group chat (Admin SDK).
 * ESM so api/index.js can static-import it; Vercel does not ship lazy ../lib paths.
 */
import admin from 'firebase-admin';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

const db = admin.apps.length ? getFirestore() : null;
const auth = admin.apps.length ? getAuth() : null;

const CHAT_LIMITS = {
  MAX_CHAT_NAME_LENGTH: 100,
  MAX_CHAT_DESCRIPTION_LENGTH: 500,
};

function getJsonBody(req) {
  const b = req.body;
  if (b && typeof b === 'object' && !Buffer.isBuffer(b)) return b;
  if (typeof b === 'string') {
    try {
      return JSON.parse(b);
    } catch {
      return {};
    }
  }
  return {};
}

function asTrimmedString(v) {
  const s = typeof v === 'string' ? v : v == null ? '' : String(v);
  return s.trim();
}

function asBool(v, defaultVal = false) {
  if (v === true || v === 'true' || v === 1 || v === '1') return true;
  if (v === false || v === 'false' || v === 0 || v === '0') return false;
  if (v === null || v === undefined) return defaultVal;
  return defaultVal;
}

function asUidArray(v) {
  if (!Array.isArray(v)) return [];
  return v.filter((id) => typeof id === 'string' && id.trim().length > 0).map((id) => id.trim());
}

function omitUndefinedDeep(value) {
  if (value === undefined) return undefined;
  if (value === null || typeof value !== 'object') return value;
  if (value instanceof Timestamp) return value;
  if (Array.isArray(value)) {
    return value.map((x) => omitUndefinedDeep(x)).filter((x) => x !== undefined);
  }
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    if (v === undefined) continue;
    const inner = omitUndefinedDeep(v);
    if (inner !== undefined) out[k] = inner;
  }
  return out;
}

function normalizeImageCrop(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const scale = Number(raw.scale);
  const panX = Number(raw.panX);
  const panY = Number(raw.panY);
  if (!Number.isFinite(scale) || !Number.isFinite(panX) || !Number.isFinite(panY)) return null;
  return { scale, panX, panY };
}

const verifyAdminFromToken = async (req) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('❌ No valid Authorization header found');
      return { isValid: false, error: 'Missing or invalid authorization header' };
    }

    const token = authHeader.substring(7);
    console.log(`🔍 Verifying Firebase ID token...`);

    const decodedToken = await auth.verifyIdToken(token);
    console.log(`✅ Token verified for user: ${decodedToken.uid}`);

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
      allFields: Object.keys(userData || {}),
    });

    const isAdmin = userData?.role === 'admin';
    console.log(`🔑 Admin verification result: ${isAdmin}`);

    if (!isAdmin) {
      console.log(`❌ User role check failed. Expected: 'admin', Got: '${userData?.role}'`);
      return {
        isValid: false,
        error: 'User does not have admin privileges',
        details: `Role in database: ${userData?.role || 'not set'}`,
      };
    }

    return { isValid: true, uid: decodedToken.uid, userData };
  } catch (error) {
    console.error('❌ Error verifying admin token:', error);
    const msg = error instanceof Error ? error.message : String(error);
    return { isValid: false, error: 'Authentication verification failed', details: msg };
  }
};

async function handler(req, res) {
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

  if (!db || !auth) {
    return res.status(503).json({ error: 'Firebase not configured. Set FIREBASE_SERVICE_ACCOUNT_KEY in .env.' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed',
      message: 'Only POST requests are allowed for chat creation',
    });
  }

  try {
    const body = getJsonBody(req);
    console.log('🚀 CREATE CHAT GROUP REQUEST:', {
      bodyKeys: Object.keys(body || {}),
      headers: Object.keys(req.headers || {}),
    });

    console.log('🔍 Verifying authentication and admin permissions...');
    const authResult = await verifyAdminFromToken(req);

    if (!authResult.isValid) {
      console.log(`❌ Authentication/Authorization failed: ${authResult.error}`);
      return res.status(403).json({
        error: 'Access denied',
        message: authResult.error,
        details: authResult.details,
      });
    }

    const authenticatedUserId = authResult.uid;
    const actualCreatedBy = authenticatedUserId;

    const nameTrimmed = asTrimmedString(body.name);
    const descTrimmed = asTrimmedString(body.description);
    const imageUrlTrimmed = asTrimmedString(body.imageUrl);
    const normalizedCrop = normalizeImageCrop(body.imageCrop);
    const allowRequests = asBool(body.allowRequests, false);
    const isPublic = asBool(body.isPublic, false);
    const adminIds = [...new Set(asUidArray(body.initialAdmins))];
    const seedIds = asUidArray(body.seedMembers).filter((id) => !adminIds.includes(id));

    console.log(`📝 Chat creation request: name="${nameTrimmed}", authenticatedUser="${authenticatedUserId}"`);

    console.log('✅ Admin verification passed');

    if (!nameTrimmed) {
      return res.status(400).json({ error: 'Chat name is required' });
    }

    if (nameTrimmed.length > CHAT_LIMITS.MAX_CHAT_NAME_LENGTH) {
      return res.status(400).json({
        error: `Chat name must be ${CHAT_LIMITS.MAX_CHAT_NAME_LENGTH} characters or less`,
      });
    }

    if (descTrimmed.length > CHAT_LIMITS.MAX_CHAT_DESCRIPTION_LENGTH) {
      return res.status(400).json({
        error: `Description must be ${CHAT_LIMITS.MAX_CHAT_DESCRIPTION_LENGTH} characters or less`,
      });
    }

    if (adminIds.length === 0) {
      return res.status(400).json({ error: 'At least one admin is required' });
    }

    console.log('✅ Validation passed, creating chat...');

    const now = Timestamp.now();

    const chatData = omitUndefinedDeep({
      name: nameTrimmed,
      description: descTrimmed,
      ...(imageUrlTrimmed ? { imageUrl: imageUrlTrimmed } : {}),
      ...(normalizedCrop ? { imageCrop: normalizedCrop } : {}),
      createdAt: now,
      createdBy: actualCreatedBy,
      allowRequests,
      isPublic,
      lastActivity: now,
    });

    const chatRef = await db.collection('chats').add(chatData);
    const chatId = chatRef.id;

    console.log(`✅ Chat created with ID: ${chatId}`);

    const batch = db.batch();

    for (const adminId of adminIds) {
      const memberRef = db.collection('chat_members').doc();
      batch.set(memberRef, {
        chatId,
        userId: adminId,
        role: 'admin',
        joinedAt: now,
      });
      console.log(`➕ Adding admin: ${adminId}`);
    }

    for (const memberId of seedIds) {
      const memberRef = db.collection('chat_members').doc();
      batch.set(memberRef, {
        chatId,
        userId: memberId,
        role: 'member',
        joinedAt: now,
      });
      console.log(`➕ Adding member: ${memberId}`);
    }

    const allMembers = [...adminIds, ...seedIds];
    console.log(`👥 Total members to add: ${allMembers.length}`);

    for (const memberId of allMembers) {
      try {
        const userDoc = await db.collection('users').doc(memberId).get();
        const userData = userDoc.exists ? userDoc.data() : {};
        const displayName = userData.displayName || userData.name || 'User';

        const messageRef = db.collection('chat_messages').doc();
        batch.set(
          messageRef,
          omitUndefinedDeep({
            chatId,
            userId: null,
            type: 'system',
            text: `${displayName} joined the chat.`,
            meta: {
              action: 'join',
              actorId: memberId,
              byAdminId: actualCreatedBy,
            },
            createdAt: now,
          })
        );
        console.log(`💬 Adding system message for: ${displayName}`);
      } catch (error) {
        console.error(`❌ Error creating system message for user ${memberId}:`, error);
      }
    }

    await batch.commit();
    console.log('✅ Batch commit successful');

    try {
      await db.collection('admin_audit_log').add({
        action: 'create_chat_group',
        performedBy: actualCreatedBy,
        targetId: chatId,
        details: {
          chatName: nameTrimmed,
          memberCount: allMembers.length,
          adminCount: adminIds.length,
        },
        timestamp: now,
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
        name: nameTrimmed,
        memberCount: allMembers.length,
        adminCount: adminIds.length,
      },
    });
  } catch (error) {
    console.error('❌ Error creating chat group:', error);
    const msg = error instanceof Error ? error.message : 'An internal server error occurred';
    return res.status(500).json({
      error: 'Failed to create chat group',
      message: msg,
      details: process.env.NODE_ENV === 'development' && error instanceof Error ? error.stack : undefined,
    });
  }
}

export default handler;
