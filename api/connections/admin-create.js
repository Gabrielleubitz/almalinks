// POST /api/connections/admin-create
// Create a connection immediately (admin only, bypasses request workflow)
// Requires authentication (admin)
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
    let adminId;
    let currentUserId;
    let isAdmin = false;
    try {
      const decodedToken = await auth.verifyIdToken(idToken);
      adminId = decodedToken.uid;
      currentUserId = decodedToken.uid; // Same as adminId, but clearer name for request acceptance check
      isAdmin = decodedToken.role === 'admin' || decodedToken.admin === true;
    } catch (authError) {
      console.error('[connections/admin-create] Auth error:', authError.message);
      return res.status(401).json({ ok: false, error: 'Unauthorized: Invalid token' });
    }

    // Allow admin OR allow if this is a connection request acceptance
    // Check if this is being called from a request acceptance by checking for sourceRequestId in body
    const isRequestAcceptance = req.body.sourceRequestId !== undefined;
    
    if (!isAdmin && !isRequestAcceptance) {
      return res.status(403).json({ ok: false, error: 'Forbidden: Admin access required' });
    }
    
    // For request acceptance, verify the current user is the target of the request
    if (isRequestAcceptance && !isAdmin) {
      const { sourceRequestId } = req.body;
      if (!sourceRequestId) {
        return res.status(400).json({ ok: false, error: 'sourceRequestId required for request acceptance' });
      }
      
      // Verify the request exists and current user is the target
      const requestDoc = await db.collection('connection_requests').doc(sourceRequestId).get();
      if (!requestDoc.exists) {
        return res.status(404).json({ ok: false, error: 'Connection request not found' });
      }
      
      const requestData = requestDoc.data();
      const targetId = requestData.targetId || requestData.toUid;
      
      if (targetId !== currentUserId && requestData.toUid !== currentUserId) {
        return res.status(403).json({ ok: false, error: 'Forbidden: You can only accept requests sent to you' });
      }
      
      if (requestData.status !== 'pending') {
        return res.status(409).json({ ok: false, error: `Request already ${requestData.status}` });
      }
    }

    // Parse request body
    const { userIdA, userIdB, eventId, reason } = req.body;

    // Validate input
    if (!userIdA || !userIdB || typeof userIdA !== 'string' || typeof userIdB !== 'string') {
      return res.status(400).json({ ok: false, error: 'userIdA and userIdB are required and must be strings' });
    }

    // Prevent self-connection
    if (userIdA === userIdB) {
      return res.status(400).json({ ok: false, error: 'Cannot connect user to themselves' });
    }

    // Check if users exist
    const [userADoc, userBDoc] = await Promise.all([
      db.collection('users').doc(userIdA).get(),
      db.collection('users').doc(userIdB).get()
    ]);

    if (!userADoc.exists) {
      return res.status(404).json({ ok: false, error: 'User A not found' });
    }

    if (!userBDoc.exists) {
      return res.status(404).json({ ok: false, error: 'User B not found' });
    }

    const userAData = userADoc.data();
    const userBData = userBDoc.data();

    // Generate connection ID (sorted for consistency)
    const connectionId = generateConnectionId(userIdA, userIdB);

    // Use Firestore transaction to ensure atomicity
    let connectionCreated = false;
    await db.runTransaction(async (transaction) => {
      // Check if connection already exists
      const connectionRef = db.collection('connections').doc(connectionId);
      const connectionSnap = await transaction.get(connectionRef);

      if (connectionSnap.exists) {
        // Connection exists, but ensure it has required fields (uid1, uid2, updatedAt)
        const existingData = connectionSnap.data();
        const needsUpdate = !existingData.uid1 || !existingData.uid2 || !existingData.updatedAt;
        
        if (needsUpdate) {
          // Backfill missing required fields
          const updateData = {
            ...(existingData.uid1 ? {} : { uid1: userIdA }),
            ...(existingData.uid2 ? {} : { uid2: userIdB }),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          };
          transaction.update(connectionRef, updateData);
          
          if (process.env.NODE_ENV !== 'production') {
            console.log(`[connections/admin-create] Connection exists but missing required fields, backfilling: ${connectionId}`, updateData);
          }
        } else {
          console.log(`[connections/admin-create] Connection already exists: ${connectionId}`);
        }
        return; // Connection already exists (or was just backfilled)
      }

      const now = admin.firestore.FieldValue.serverTimestamp();

      // Create connection document
      // CRITICAL: Must include uid1, uid2, updatedAt for UI queries to work
      const connectionData = {
        uid1: userIdA, // REQUIRED for getUserConnections query (where uid1==userId OR uid2==userId)
        uid2: userIdB, // REQUIRED for getUserConnections query
        userA: userIdA,
        userB: userIdB,
        userIds: [userIdA, userIdB].sort(), // Sorted for deduplication
        createdAt: now,
        updatedAt: now, // REQUIRED for getUserConnections orderBy updatedAt
        createdBy: adminId,
        source: isRequestAcceptance ? 'user' : 'admin',
        // Cache user data
        uid1CachedData: {
          displayName: userAData?.displayName || userAData?.name || 'Unknown User',
          name: userAData?.name || userAData?.displayName || 'Unknown User',
          email: userAData?.email || null,
          profileImage: userAData?.profileImage || userAData?.avatarUrl || null
        },
        uid2CachedData: {
          displayName: userBData?.displayName || userBData?.name || 'Unknown User',
          name: userBData?.name || userBData?.displayName || 'Unknown User',
          email: userBData?.email || null,
          profileImage: userBData?.profileImage || userBData?.avatarUrl || null
        },
        reasons: [{
          type: isRequestAcceptance ? 'user' : 'admin',
          ...(isRequestAcceptance ? { requestId: req.body.sourceRequestId } : { adminId: adminId }),
          eventId: eventId || null,
          context: isRequestAcceptance ? 'Connection request accepted by user' : (reason || 'Admin-created connection'),
          timestamp: now
        }]
      };

      // DEV log: Show EXACT data being written
      if (process.env.NODE_ENV !== 'production') {
        console.log('[ADMIN_CONNECT_WRITE]', {
          path: `connections/${connectionId}`,
          id: connectionId,
          data: {
            // Show actual values for critical fields (these are what queries need)
            uid1: connectionData.uid1,
            uid2: connectionData.uid2,
            userA: connectionData.userA,
            userB: connectionData.userB,
            userIds: connectionData.userIds,
            createdAt: 'serverTimestamp()',
            updatedAt: 'serverTimestamp()', // REQUIRED for getUserConnections orderBy
            createdBy: connectionData.createdBy,
            source: connectionData.source,
            // Verification flags
            hasUid1: true,
            hasUid2: true,
            hasUpdatedAt: true,
            hasCreatedAt: true,
            // Other fields
            hasUid1CachedData: !!connectionData.uid1CachedData,
            hasUid2CachedData: !!connectionData.uid2CachedData,
            hasReasons: !!connectionData.reasons
          },
          note: 'This is the EXACT data written to Firestore. uid1, uid2, updatedAt are REQUIRED for UI queries.'
        });
      }

      // Use set() to ensure all fields are written (not merge, to avoid missing fields)
      transaction.set(connectionRef, connectionData);
      connectionCreated = true;
      
      // If this is a request acceptance, also update the request status in the same transaction
      if (isRequestAcceptance && req.body.sourceRequestId) {
        const requestRef = db.collection('connection_requests').doc(req.body.sourceRequestId);
        transaction.update(requestRef, {
          status: 'accepted',
          updatedAt: now,
          decidedAt: now,
          decisionBy: currentUserId,
          decisionRole: 'user',
          sourceRequestId: connectionId
        });
      }

      // DEV log: Show EXACT write format
      if (process.env.NODE_ENV !== 'production') {
        console.log('[ADMIN_CONNECT_WRITE]', {
          connectionCollection: 'connections',
          connectionDocId: connectionId,
          dataWritten: {
            uid1: userIdA,
            uid2: userIdB,
            userA: userIdA,
            userB: userIdB,
            userIds: [userIdA, userIdB].sort(),
            createdAt: 'serverTimestamp()',
            updatedAt: 'serverTimestamp()',
            createdBy: adminId,
            source: isRequestAcceptance ? 'user' : 'admin',
            sourceRequestId: isRequestAcceptance ? req.body.sourceRequestId : null,
            uid1CachedData: 'object',
            uid2CachedData: 'object',
            reasons: 'array'
          },
          docPath: `connections/${connectionId}`,
          note: 'Doc ID is sorted: smaller_uid_larger_uid'
        });
      }

      console.log(`[connections/admin-create] Connection created: ${connectionId} by ${isAdmin ? 'admin' : 'user accepting request'} ${adminId}`);
      
      // DEV log to track admin connection creator usage (same format as frontend)
      if (process.env.NODE_ENV !== 'production') {
        console.log('[ADMIN_CONNECT_USED]', {
          userA: userIdA,
          userB: userIdB,
          adminUid: adminId,
          connectionId,
          eventId: eventId || null,
          reason: reason || (isRequestAcceptance ? 'Connection request accepted by user' : 'Admin-created connection'),
          source: isRequestAcceptance ? 'user' : 'admin',
          sourceRequestId: isRequestAcceptance ? req.body.sourceRequestId : null,
          endpoint: '/api/connections/admin-create',
          writes: [
            `connections/${connectionId} (uid1=${userIdA}, uid2=${userIdB}, source=${isRequestAcceptance ? 'user' : 'admin'}, createdBy=${adminId})`
          ],
          connectionPath: `connections/${connectionId}`,
          fields: {
            uid1: userIdA,
            uid2: userIdB,
            userA: userIdA,
            userB: userIdB,
            userIds: [userIdA, userIdB].sort(),
            source: isRequestAcceptance ? 'user' : 'admin',
            createdBy: adminId,
            hasUpdatedAt: true,
            hasCreatedAt: true,
            hasUid1CachedData: true,
            hasUid2CachedData: true,
            hasReasons: true
          }
        });
      }
    });

    return res.status(200).json({
      ok: true,
      connectionId,
      created: connectionCreated
    });

  } catch (error) {
    console.error('[connections/admin-create] Error:', error);
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
