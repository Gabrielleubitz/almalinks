// POST /api/connection-request/create
// Create a connection request (pending status)
// Requires authentication
import '../../../firebase-init.js';
import { db, auth } from '../../../firebase-init.js';
import admin from '../../../firebase-init.js';

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ ok: false, error: 'Unauthorized: Missing or invalid token' });
    }

    const idToken = authHeader.split('Bearer ')[1];
    let requesterId;
    try {
      const decodedToken = await auth.verifyIdToken(idToken);
      requesterId = decodedToken.uid;
    } catch (authError) {
      console.error('[connection-request/create] Auth error:', authError.message);
      return res.status(401).json({ ok: false, error: 'Unauthorized: Invalid token' });
    }

    // Parse request body
    const { targetId, eventId, message } = req.body;

    // Validate input
    if (!targetId || typeof targetId !== 'string') {
      return res.status(400).json({ ok: false, error: 'targetId is required and must be a string' });
    }

    // Prevent self-connection
    if (requesterId === targetId) {
      return res.status(400).json({ ok: false, error: 'Cannot send connection request to yourself' });
    }

    // Check if users exist
    const [requesterDoc, targetDoc] = await Promise.all([
      db.collection('users').doc(requesterId).get(),
      db.collection('users').doc(targetId).get()
    ]);

    if (!requesterDoc.exists) {
      return res.status(404).json({ ok: false, error: 'Requester user not found' });
    }

    if (!targetDoc.exists) {
      return res.status(404).json({ ok: false, error: 'Target user not found' });
    }

    const requesterData = requesterDoc.data();
    const targetData = targetDoc.data();

    // Check if connection already exists
    const connectionId = generateConnectionId(requesterId, targetId);
    const connectionDoc = await db.collection('connections').doc(connectionId).get();
    if (connectionDoc.exists) {
      return res.status(409).json({ ok: false, error: 'Connection already exists between these users' });
    }

    // Check if a pending request already exists (not yet responded to).
    // Only block on 'pending'; if the only existing request is 'accepted' but the connection was
    // removed (e.g. admin deleted it), allow a new request.
    const existingRequestsQuery = db.collection('connection_requests')
      .where('requesterId', '==', requesterId)
      .where('targetId', '==', targetId)
      .where('status', '==', 'pending');

    const existingRequestsSnapshot = await existingRequestsQuery.get();
    if (!existingRequestsSnapshot.empty) {
      return res.status(409).json({ ok: false, error: 'Connection request already sent and not yet responded to' });
    }

    // Daily limit: 5 manual connection requests per calendar day (UTC). Resets at midnight UTC.
    // Applies only to manual requests from Members/profile; auto post-event connections do NOT use this endpoint.
    const DAILY_LIMIT = 5;
    const todayUTC = new Date().toISOString().slice(0, 10);
    const dailyRef = db.collection('connection_request_daily').doc(requesterId);
    const dailySnap = await dailyRef.get();
    if (dailySnap.exists) {
      const d = dailySnap.data();
      if (d && d.date === todayUTC && typeof d.count === 'number' && d.count >= DAILY_LIMIT) {
        return res.status(403).json({
          ok: false,
          error: "You've reached today's connection limit. Try again tomorrow."
        });
      }
    }

    // Create connection request
    const requestId = db.collection('connection_requests').doc().id;
    const now = admin.firestore.FieldValue.serverTimestamp();

    const requestData = {
      id: requestId,
      requesterId,
      fromUid: requesterId, // Legacy alias
      targetId,
      toUid: targetId, // Legacy alias
      eventId: eventId || null,
      message: message || null,
      status: 'pending',
      source: 'user', // Indicates this is a user-initiated request
      createdAt: now,
      updatedAt: now,
      decidedAt: null,
      decisionBy: null,
      decisionRole: null,
      note: message || null,
      // Enriched requester data
      fromName: requesterData.displayName || requesterData.name || 'Unknown User',
      fromWork: requesterData.work || requesterData.company || 'Not specified',
      fromPosition: requesterData.position || null,
      fromProfileImage: requesterData.profileImage || requesterData.avatarUrl || null
    };

    await db.collection('connection_requests').doc(requestId).set(requestData);

    // Increment daily manual request count (calendar day UTC)
    if (dailySnap.exists && dailySnap.data()?.date === todayUTC) {
      await dailyRef.update({
        count: admin.firestore.FieldValue.increment(1)
      });
    } else {
      await dailyRef.set({ date: todayUTC, count: 1 });
    }

    // Create in-app notification for target user (so it appears in notification center)
    const fromName = requesterData.displayName || requesterData.name || 'Someone';
    try {
      await db.collection('notifications').add({
        userId: targetId,
        type: 'connection_request',
        title: `Request to connect from ${fromName}`,
        body: message || null,
        link: '/members',
        read: false,
        createdAt: now,
        metadata: { requestId, fromUserName: fromName }
      });
    } catch (notifErr) {
      console.warn('[connection-request/create] Notification create failed:', notifErr.message);
    }

    console.log(`[connection-request/create] Request created: ${requestId} (${requesterId} -> ${targetId})`);

    return res.status(200).json({
      ok: true,
      requestId,
      status: 'pending'
    });

  } catch (error) {
    console.error('[connection-request/create] Error:', error);
    return res.status(500).json({
      ok: false,
      error: error.message || 'Internal server error'
    });
  }
}

// Generate consistent connection ID (same as frontend)
function generateConnectionId(uid1, uid2) {
  const sorted = [uid1, uid2].sort();
  return `${sorted[0]}_${sorted[1]}`;
}
