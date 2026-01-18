// POST /api/connection-request/respond
// Respond to a connection request (accept/reject)
// Requires authentication (target user OR admin)
import '../firebase-init.js';
import { db, auth } from '../firebase-init.js';
import admin from '../firebase-init.js';

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
    let currentUserId;
    let isAdmin = false;
    try {
      const decodedToken = await auth.verifyIdToken(idToken);
      currentUserId = decodedToken.uid;
      // Check if user is admin
      isAdmin = decodedToken.role === 'admin' || decodedToken.admin === true;
    } catch (authError) {
      console.error('[connection-request/respond] Auth error:', authError.message);
      return res.status(401).json({ ok: false, error: 'Unauthorized: Invalid token' });
    }

    // Parse request body
    const { requestId, action } = req.body;

    // Validate input
    if (!requestId || typeof requestId !== 'string') {
      return res.status(400).json({ ok: false, error: 'requestId is required and must be a string' });
    }

    if (!action || !['accept', 'reject'].includes(action)) {
      return res.status(400).json({ ok: false, error: 'action must be "accept" or "reject"' });
    }

    // Get request document
    const requestRef = db.collection('connection_requests').doc(requestId);
    const requestDoc = await requestRef.get();

    if (!requestDoc.exists) {
      return res.status(404).json({ ok: false, error: 'Connection request not found' });
    }

    const requestData = requestDoc.data();

    // Verify authorization: user must be target OR admin
    if (!isAdmin && requestData.targetId !== currentUserId) {
      return res.status(403).json({ ok: false, error: 'Forbidden: You can only respond to requests sent to you' });
    }

    // Check if already responded
    if (requestData.status !== 'pending') {
      return res.status(409).json({
        ok: false,
        error: `Request already ${requestData.status}`,
        currentStatus: requestData.status
      });
    }

    // Use Firestore transaction to ensure atomicity
    await db.runTransaction(async (transaction) => {
      // Re-read request to ensure it's still pending
      const requestSnap = await transaction.get(requestRef);
      if (!requestSnap.exists) {
        throw new Error('Request no longer exists');
      }

      const currentRequestData = requestSnap.data();
      if (currentRequestData.status !== 'pending') {
        throw new Error(`Request is already ${currentRequestData.status}`);
      }

      const now = admin.firestore.FieldValue.serverTimestamp();
      const newStatus = action === 'accept' ? 'accepted' : 'rejected';

      // Update request
      transaction.update(requestRef, {
        status: newStatus,
        updatedAt: now,
        decisionBy: currentUserId,
        decisionRole: isAdmin ? 'admin' : 'user'
      });

      // If accepted, create connection atomically
      if (action === 'accept') {
        const connectionId = generateConnectionId(requestData.requesterId, requestData.targetId);

        // Check if connection already exists (idempotency)
        const connectionRef = db.collection('connections').doc(connectionId);
        const connectionSnap = await transaction.get(connectionRef);

        if (!connectionSnap.exists) {
          // Get user data for connection caching
          const [requesterDoc, targetDoc] = await Promise.all([
            db.collection('users').doc(requestData.requesterId).get(),
            db.collection('users').doc(requestData.targetId).get()
          ]);

          const requesterUserData = requesterDoc.data();
          const targetUserData = targetDoc.data();

          // Create connection document
          const connectionData = {
            uid1: requestData.requesterId,
            uid2: requestData.targetId,
            updatedAt: now,
            createdAt: now,
            sourceRequestId: requestId,
            reasons: [{
              type: 'user',
              eventId: requestData.eventId || null,
              requestId: requestId,
              context: 'user-requested connection accepted',
              timestamp: now
            }],
            // Cache user data
            uid1CachedData: {
              displayName: requesterUserData?.displayName || requesterUserData?.name || 'Unknown User',
              name: requesterUserData?.name || requesterUserData?.displayName || 'Unknown User',
              email: requesterUserData?.email || null,
              profileImage: requesterUserData?.profileImage || requesterUserData?.avatarUrl || null
            },
            uid2CachedData: {
              displayName: targetUserData?.displayName || targetUserData?.name || 'Unknown User',
              name: targetUserData?.name || targetUserData?.displayName || 'Unknown User',
              email: targetUserData?.email || null,
              profileImage: targetUserData?.profileImage || targetUserData?.avatarUrl || null
            }
          };

          transaction.set(connectionRef, connectionData);

          console.log(`[connection-request/respond] Connection created: ${connectionId} from request ${requestId}`);
        } else {
          console.log(`[connection-request/respond] Connection already exists: ${connectionId}, skipping creation`);
        }

        // Update request with sourceRequestId
        transaction.update(requestRef, {
          sourceRequestId: requestId
        });
      }
    });

    console.log(`[connection-request/respond] Request ${requestId} ${action}ed by ${currentUserId} (${isAdmin ? 'admin' : 'user'})`);

    return res.status(200).json({
      ok: true,
      requestId,
      action,
      status: action === 'accept' ? 'accepted' : 'rejected',
      connectionCreated: action === 'accept'
    });

  } catch (error) {
    console.error('[connection-request/respond] Error:', error);
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
