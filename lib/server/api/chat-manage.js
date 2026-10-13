/**
 * POST /api/chat-manage
 * Chat management for chat-level admins (and leaving a chat) — server-side, because Firestore rules
 * can't look up a chat_members doc by (chatId, userId). Mirrors the client logic in src/services/chatService.ts;
 * site admins keep using the client path.
 *
 * Body: { action, chatId?, requestId?, targetUserId?, updates? }
 * Actions: approve-request, reject-request, add-member, promote, demote, remove-member, leave, update-chat, delete-chat
 */
import admin, { db } from '../firebase-init.js';
import { verifyUserRequest, isAdminUser } from '../admin-auth.js';

const MAX_CHAT_NAME_LENGTH = 100;
const MAX_CHAT_DESCRIPTION_LENGTH = 500;

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const now = () => admin.firestore.Timestamp.now();

async function findMember(chatId, userId) {
  const snap = await db.collection('chat_members').where('chatId', '==', chatId).where('userId', '==', userId).limit(1).get();
  return snap.empty ? null : snap.docs[0];
}

async function displayNameOf(uid, fallback) {
  const snap = await db.collection('users').doc(uid).get();
  const d = snap.data();
  return d?.displayName || d?.name || fallback;
}

async function requireManager(chatId, uid) {
  if (await isAdminUser(uid)) return;
  const member = await findMember(chatId, uid);
  if (!member || member.data().role !== 'admin') {
    throw new HttpError(403, 'You do not have permission to manage this chat');
  }
}

/** Adds a system message and bumps the chat's last message, inside `batch`. */
function addSystemMessage(batch, chatId, text, meta) {
  const message = { chatId, userId: null, type: 'system', text, meta, createdAt: now() };
  batch.set(db.collection('chat_messages').doc(), message);
  batch.update(db.collection('chats').doc(chatId), { lastMessage: message, lastActivity: message.createdAt });
}

async function deleteWhere(collection, chatId) {
  const snap = await db.collection(collection).where('chatId', '==', chatId).get();
  for (let i = 0; i < snap.docs.length; i += 450) {
    const batch = db.batch();
    snap.docs.slice(i, i + 450).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
}

const actions = {
  async 'approve-request'(uid, { requestId }) {
    const ref = db.collection('chat_requests').doc(String(requestId || ''));
    const snap = await ref.get();
    if (!snap.exists) throw new HttpError(404, 'Request not found');
    const request = snap.data();
    await requireManager(request.chatId, uid);
    if (request.status !== 'pending') throw new HttpError(400, 'Request is no longer pending');

    const batch = db.batch();
    batch.update(ref, { status: 'approved', resolvedAt: now(), resolvedBy: uid });
    if (!(await findMember(request.chatId, request.userId))) {
      batch.set(db.collection('chat_members').doc(), { chatId: request.chatId, userId: request.userId, role: 'member', joinedAt: now() });
    }
    const name = await displayNameOf(request.userId, 'User');
    addSystemMessage(batch, request.chatId, `${name} joined (request approved).`, { action: 'join', actorId: request.userId, byAdminId: uid });
    await batch.commit();
  },

  async 'reject-request'(uid, { requestId }) {
    const ref = db.collection('chat_requests').doc(String(requestId || ''));
    const snap = await ref.get();
    if (!snap.exists) throw new HttpError(404, 'Request not found');
    const request = snap.data();
    await requireManager(request.chatId, uid);
    if (request.status !== 'pending') throw new HttpError(400, 'Request is no longer pending');
    await ref.update({ status: 'rejected', resolvedAt: now(), resolvedBy: uid });
  },

  async 'add-member'(uid, { chatId, targetUserId }) {
    await requireManager(chatId, uid);
    if (!targetUserId) throw new HttpError(400, 'targetUserId is required');
    if (await findMember(chatId, targetUserId)) throw new HttpError(400, 'User is already a member of this chat');
    const target = await db.collection('users').doc(targetUserId).get();
    if (!target.exists) throw new HttpError(404, 'User not found');

    const batch = db.batch();
    batch.set(db.collection('chat_members').doc(), { chatId, userId: targetUserId, role: 'member', joinedAt: now() });
    const [name, adminName] = await Promise.all([displayNameOf(targetUserId, 'User'), displayNameOf(uid, 'Admin')]);
    addSystemMessage(batch, chatId, `${name} was added by ${adminName}.`, { action: 'add', actorId: targetUserId, byAdminId: uid });
    await batch.commit();
  },

  async promote(uid, { chatId, targetUserId }) {
    await requireManager(chatId, uid);
    const member = await findMember(chatId, targetUserId);
    if (!member) throw new HttpError(400, 'User is not a member of this chat');
    await member.ref.update({ role: 'admin', updatedAt: now() });
  },

  async demote(uid, { chatId, targetUserId }) {
    await requireManager(chatId, uid);
    if (targetUserId === uid) throw new HttpError(400, 'Ask another admin to demote you, or leave the chat.');
    const admins = await db.collection('chat_members').where('chatId', '==', chatId).where('role', '==', 'admin').get();
    if (admins.size <= 1) throw new HttpError(400, 'Cannot demote the last admin');
    const member = await findMember(chatId, targetUserId);
    if (!member) throw new HttpError(400, 'User is not a member of this chat');
    if (member.data().role !== 'admin') throw new HttpError(400, 'User is not a chat admin');

    const batch = db.batch();
    batch.update(member.ref, { role: 'member', updatedAt: now() });
    const name = await displayNameOf(targetUserId, 'User');
    addSystemMessage(batch, chatId, `${name} is no longer an admin.`, {
      action: 'demote', actorId: targetUserId, byAdminId: uid, previousRole: 'admin', newRole: 'member',
    });
    await batch.commit();
  },

  async 'remove-member'(uid, { chatId, targetUserId }) {
    const self = targetUserId === uid;
    if (!self) await requireManager(chatId, uid);
    const member = await findMember(chatId, targetUserId);
    if (!member) throw new HttpError(400, 'User is not a member of this chat');

    const batch = db.batch();
    batch.delete(member.ref);
    const name = await displayNameOf(targetUserId, 'User');
    addSystemMessage(
      batch,
      chatId,
      self ? `${name} left the chat.` : `${name} was removed.`,
      self ? { action: 'leave', actorId: targetUserId } : { action: 'remove', actorId: targetUserId, byAdminId: uid }
    );
    await batch.commit();
  },

  async leave(uid, { chatId }) {
    return actions['remove-member'](uid, { chatId, targetUserId: uid });
  },

  async 'update-chat'(uid, { chatId, updates }) {
    await requireManager(chatId, uid);
    const u = updates && typeof updates === 'object' ? updates : {};
    if (u.name !== undefined) {
      if (typeof u.name !== 'string' || !u.name.trim()) throw new HttpError(400, 'Chat name cannot be empty');
      if (u.name.length > MAX_CHAT_NAME_LENGTH) throw new HttpError(400, `Chat name must be ${MAX_CHAT_NAME_LENGTH} characters or less`);
    }
    if (u.description !== undefined && (typeof u.description !== 'string' || u.description.length > MAX_CHAT_DESCRIPTION_LENGTH)) {
      throw new HttpError(400, `Description must be ${MAX_CHAT_DESCRIPTION_LENGTH} characters or less`);
    }

    const chatRef = db.collection('chats').doc(chatId);
    const chatSnap = await chatRef.get();
    if (!chatSnap.exists) throw new HttpError(404, 'Chat not found');
    const current = chatSnap.data();

    const data = { lastActivity: now() };
    if (u.name !== undefined) data.name = u.name.trim();
    if (u.description !== undefined) data.description = u.description.trim();
    if (u.allowRequests !== undefined) data.allowRequests = u.allowRequests === true;
    if (u.isPublic !== undefined) data.isPublic = u.isPublic === true;
    if (u.imageUrl !== undefined) data.imageUrl = (typeof u.imageUrl === 'string' && u.imageUrl.trim()) || null;
    if (u.imageCrop !== undefined) data.imageCrop = u.imageCrop ?? null;
    await chatRef.update(data);

    const changes = [];
    if (data.name !== undefined && data.name !== (current.name || '').trim()) changes.push(`changed the chat name to "${data.name}".`);
    if (data.description !== undefined && data.description !== (current.description || '').trim()) changes.push('updated the chat description.');
    if (data.imageUrl !== undefined && (data.imageUrl || '') !== (current.imageUrl || '').trim()) changes.push('changed the group icon.');
    if (data.allowRequests !== undefined && data.allowRequests !== (current.allowRequests ?? false)) {
      changes.push(data.allowRequests ? 'opened this chat for join requests.' : 'closed this chat to new join requests.');
    }
    if (data.isPublic !== undefined && data.isPublic !== (current.isPublic ?? false)) {
      changes.push(data.isPublic ? 'made this chat discoverable.' : 'made this chat no longer discoverable.');
    }
    if (changes.length) {
      const adminName = await displayNameOf(uid, 'Admin');
      for (const text of changes) {
        const batch = db.batch();
        addSystemMessage(batch, chatId, `${adminName} ${text}`, { action: 'edit', byAdminId: uid });
        await batch.commit();
      }
    }
  },

  async 'delete-chat'(uid, { chatId }) {
    await requireManager(chatId, uid);
    await deleteWhere('chat_messages', chatId);
    await deleteWhere('chat_members', chatId);
    await deleteWhere('chat_requests', chatId);
    await db.collection('chats').doc(chatId).delete();
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }
  if (!db) {
    return res.status(503).json({ ok: false, error: 'Database not available' });
  }

  const caller = await verifyUserRequest(req);
  if (!caller.ok) {
    return res.status(caller.status).json({ ok: false, error: caller.error });
  }

  const body = typeof req.body === 'object' && req.body !== null ? req.body : {};
  const run = Object.hasOwn(actions, body.action) ? actions[body.action] : null;
  if (!run) {
    return res.status(400).json({ ok: false, error: 'Unknown action' });
  }
  if (body.action !== 'approve-request' && body.action !== 'reject-request' && (typeof body.chatId !== 'string' || !body.chatId)) {
    return res.status(400).json({ ok: false, error: 'chatId is required' });
  }

  try {
    await run(caller.uid, body);
    return res.status(200).json({ ok: true });
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ ok: false, error: err.message });
    }
    console.error('[chat-manage]', body.action, err?.message || err);
    return res.status(500).json({ ok: false, error: 'Something went wrong. Please try again.' });
  }
}
