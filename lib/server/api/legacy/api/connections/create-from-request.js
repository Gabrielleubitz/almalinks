// POST /api/connections/create-from-request
// Create a connection from an accepted connection request (user-initiated)
// Requires authentication (user must be the target of the request)
import '../../../../firebase-init.js';
import { db, auth } from '../../../../firebase-init.js';
import admin from '../../../../firebase-init.js';

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
      isAdmin = decodedToken.role === 'admin' || decodedToken.admin === true;
    } catch (authError) {
      console.error('[connections/create-from-request] Auth error:', authError.message);
      return res.status(401).json({ ok: false, error: 'Unauthorized: Invalid token' });
    }

    // Parse request body
    const { requestId } = req.body;

    // Validate input
    if (!requestId || typeof requestId !== 'string') {
      return res.status(400).json({ ok: false, error: 'requestId is required and must be a string' });
    }

    // Get the connection request
    const requestDoc = await db.collection('connection_requests').doc(requestId).get();
    
    if (!requestDoc.exists) {
      return res.status(404).json({ ok: false, error: 'Connection request not found' });
    }

    const requestData = requestDoc.data();

    // Verify authorization: user must be target OR admin
    const requesterId = requestData.requesterId || requestData.fromUid;
    const targetId = requestData.targetId || requestData.toUid;

    if (!isAdmin && targetId !== currentUserId && requestData.toUid !== currentUserId) {
      return res.status(403).json({ ok: false, error: 'Forbidden: You can only accept requests sent to you' });
    }

    // Check if request is still pending
    if (requestData.status !== 'pending') {
      return res.status(409).json({ 
        ok: false, 
        error: `Request already ${requestData.status}`,
        currentStatus: requestData.status
      });
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

    // Generate connection ID (sorted for consistency) - same as admin-create
    // Note: admin-create uses userIdA/userIdB as-is for uid1/uid2 fields
    // but the doc ID is sorted. We'll match that behavior.
    const connectionId = generateConnectionId(requesterId, targetId);
    // For uid1/uid2, use the original order (like admin-create does)
    // The queries check both uid1 and uid2, so order doesn't matter for queries
    const uid1 = requesterId;
    const uid2 = targetId;

    // Use Firestore transaction to ensure atomicity
    let connectionCreated = false;
    await db.runTransaction(async (transaction) => {
      // Re-read request to ensure it's still pending
      const requestRef = db.collection('connection_requests').doc(requestId);
      const requestSnap = await transaction.get(requestRef);
      
      if (!requestSnap.exists) {
        throw new Error('Request no longer exists');
      }

      const currentRequestData = requestSnap.data();
      if (currentRequestData.status !== 'pending') {
        throw new Error(`Request is already ${currentRequestData.status}`);
      }

      // Check if connection already exists (idempotency)
      const connectionRef = db.collection('connections').doc(connectionId);
      const connectionSnap = await transaction.get(connectionRef);

      const now = admin.firestore.FieldValue.serverTimestamp();

      // Update request status
      transaction.update(requestRef, {
        status: 'accepted',
        updatedAt: now,
        decidedAt: now,
        decisionBy: currentUserId,
        decisionRole: isAdmin ? 'admin' : 'user'
      });

      if (connectionSnap.exists) {
        console.log(`[connections/create-from-request] Connection already exists: ${connectionId}`);
        connectionCreated = false; // Connection exists, but request is updated
      } else {
        // Create connection document - using EXACT same format as admin-create
        const connectionData = {
          uid1: uid1, // requesterId (same as admin-create uses userIdA)
          uid2: uid2, // targetId (same as admin-create uses userIdB)
          userA: requesterId, // Same as uid1
          userB: targetId, // Same as uid2
          userIds: [requesterId, targetId].sort(), // Sorted for deduplication (same as admin-create)
          createdAt: now,
          updatedAt: now,
          createdBy: requesterId, // Original requester
          source: 'user', // Created from user request (vs 'admin' for admin-create)
          sourceRequestId: requestId,
          // Cache user data - same format as admin-create
          uid1CachedData: {
            displayName: requesterData?.displayName || requesterData?.name || 'Unknown User',
            name: requesterData?.name || requesterData?.displayName || 'Unknown User',
            email: requesterData?.email || null,
            profileImage: requesterData?.profileImage || requesterData?.avatarUrl || null
          },
          uid2CachedData: {
            displayName: targetData?.displayName || targetData?.name || 'Unknown User',
            name: targetData?.name || targetData?.displayName || 'Unknown User',
            email: targetData?.email || null,
            profileImage: targetData?.profileImage || targetData?.avatarUrl || null
          },
          reasons: [{
            type: 'user',
            eventId: requestData.eventId || null,
            requestId: requestId,
            context: 'user-requested connection accepted',
            timestamp: now
          }]
        };

        transaction.set(connectionRef, connectionData);
        connectionCreated = true;

        console.log(`[connections/create-from-request] Connection created: ${connectionId} from request ${requestId}`);
        
        if (process.env.NODE_ENV !== 'production') {
          console.log('[ADMIN_CREATE_CONNECTION wrote]', {
            path: `connections/${connectionId}`,
            uid1,
            uid2,
            userA: requesterId,
            userB: targetId,
            source: 'user',
            sourceRequestId: requestId,
            hasUpdatedAt: true,
            hasCreatedAt: true
          });
        }
      }
    });

    return res.status(200).json({
      ok: true,
      connectionId,
      requestId,
      created: connectionCreated,
      status: 'accepted'
    });

  } catch (error) {
    console.error('[connections/create-from-request] Error:', error);
    return res.status(500).json({
      ok: false,
      error: error.message || 'Internal server error'
    });
  }
}

// Generate consistent connection ID (same as admin-create and frontend)
function generateConnectionId(uid1, uid2) {
  const sorted = [uid1, uid2].sort();
  return `${sorted[0]}_${sorted[1]}`;
}
