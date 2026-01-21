// POST /api/connections/admin-create
// Create a connection immediately (admin only, bypasses request workflow)
// Requires authentication (admin)
import '../../../../../firebase-init.js';
import { db, auth } from '../../../../../firebase-init.js';
import admin from '../../../../../firebase-init.js';

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  // Log entry (DEV only)
  if (process.env.NODE_ENV !== 'production') {
    console.log('[ADMIN_CONNECT_USED] ENTRY', {
      method: req.method,
      body: {
        userIdA: req.body.userIdA,
        userIdB: req.body.userIdB,
        sourceRequestId: req.body.sourceRequestId,
        hasAuth: !!req.headers.authorization
      },
      note: 'Admin connection creator called'
    });
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
        
        // IDEMPOTENCY: If request is already accepted, check if connection exists
        // If connection exists, return success (idempotent)
        // If connection doesn't exist, create it anyway (recover from partial state)
        if (requestData.status === 'accepted') {
          const connectionId = generateConnectionId(userIdA, userIdB);
          const connectionRef = db.collection('connections').doc(connectionId);
          const connectionSnap = await connectionRef.get();
          
          if (connectionSnap.exists) {
            // Request already accepted AND connection exists - idempotent success
            console.log(`[connections/admin-create] Request already accepted and connection exists: ${connectionId} (idempotent)`);
            return res.status(200).json({
              ok: true,
              connectionId: connectionId,
              connectionPath: `connections/${connectionId}`,
              created: false,
              existed: true,
              idempotent: true
            });
          } else {
            // Request marked as accepted but no connection exists - create it (recover from partial state)
            console.log(`[connections/admin-create] Request already accepted but no connection found - creating connection (recovery)`);
            // Continue to connection creation below
          }
        } else if (requestData.status !== 'pending') {
          // Request is rejected or cancelled - cannot accept
          return res.status(409).json({ ok: false, error: `Request is ${requestData.status}. Cannot accept.` });
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
    // This ID is ALWAYS returned, even if connection already exists
    // CRITICAL: connectionId is generated BEFORE transaction, so it's ALWAYS available
    const connectionId = generateConnectionId(userIdA, userIdB);
    const connectionPath = `connections/${connectionId}`;
    
    // Validate connectionId is generated correctly
    if (!connectionId || typeof connectionId !== 'string' || connectionId.length === 0) {
      console.error('[connections/admin-create] CRITICAL: Failed to generate connectionId', {
        userIdA,
        userIdB,
        connectionId,
        generateConnectionIdResult: generateConnectionId(userIdA, userIdB)
      });
      return res.status(500).json({
        ok: false,
        error: 'Failed to generate connection ID',
        details: `connectionId is ${connectionId === null ? 'null' : connectionId === undefined ? 'undefined' : `invalid: ${connectionId}`}`
      });
    }
    
    if (process.env.NODE_ENV !== 'production') {
      console.log('[connections/admin-create] Generated connectionId BEFORE transaction', {
        connectionId,
        connectionPath,
        userIdA,
        userIdB,
        note: 'This connectionId will ALWAYS be returned, even if connection already exists'
      });
    }

    // Use Firestore transaction to ensure atomicity
    let connectionCreated = false;
    let connectionExisted = false;
    const writes = []; // Track all writes for logging
    
    await db.runTransaction(async (transaction) => {
      // Check if connection already exists
      const connectionRef = db.collection('connections').doc(connectionId);
      const connectionSnap = await transaction.get(connectionRef);

      if (connectionSnap.exists) {
        connectionExisted = true;
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
        // Connection exists - we'll still return connectionId
        return;
      }

      const now = admin.firestore.FieldValue.serverTimestamp();
      const nowISO = new Date().toISOString(); // For use in arrays (serverTimestamp() cannot be used in arrays)

      // Create connection document
      // CRITICAL: Must include uid1, uid2, updatedAt for UI queries to work
      const connectionData = {
        uid1: userIdA, // REQUIRED for getUserConnections query (where uid1==userId OR uid2==userId)
        uid2: userIdB, // REQUIRED for getUserConnections query
        userA: userIdA,
        userB: userIdB,
        userIds: [userIdA, userIdB].sort(), // Sorted for deduplication
        createdAt: now, // Root-level serverTimestamp() - OK
        updatedAt: now, // Root-level serverTimestamp() - REQUIRED for getUserConnections orderBy updatedAt
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
          timestamp: nowISO // Use ISO string instead of serverTimestamp() (serverTimestamp() cannot be used in arrays)
        }]
      };

      // Use set() to ensure all fields are written (not merge, to avoid missing fields)
      transaction.set(connectionRef, connectionData);
      connectionCreated = true;
      
      // Track this write for logging
      writes.push({
        path: `connections/${connectionId}`,
        collection: 'connections',
        docId: connectionId,
        keys: Object.keys(connectionData),
        data: {
          uid1: connectionData.uid1,
          uid2: connectionData.uid2,
          userA: connectionData.userA,
          userB: connectionData.userB,
          userIds: connectionData.userIds,
          hasUpdatedAt: true,
          hasCreatedAt: true,
          source: connectionData.source,
          createdBy: connectionData.createdBy
        }
      });
      
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
        
        // Track this write for logging
        writes.push({
          path: `connection_requests/${req.body.sourceRequestId}`,
          collection: 'connection_requests',
          docId: req.body.sourceRequestId,
          keys: ['status', 'updatedAt', 'decidedAt', 'decisionBy', 'decisionRole', 'sourceRequestId'],
          data: {
            status: 'accepted',
            sourceRequestId: connectionId
          }
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
    });
    
    // DEV log: Show EXACT writes performed (AFTER transaction completes)
    // This log is CRITICAL for understanding the real schema
    if (process.env.NODE_ENV !== 'production' && writes.length > 0) {
      console.log('[ADMIN_CONNECT_WRITE]', {
        writes: writes.map(w => ({
          path: w.path, // Full Firestore path string
          collection: w.collection, // Collection name
          id: w.docId, // Document ID
          keys: w.keys, // Top-level keys written (Object.keys(data))
          data: w.data // Sample data values
        })),
        // REAL SCHEMA DISCOVERED FROM ACTUAL WRITES
        realSchema: {
          connectionCollection: 'connections',
          connectionDocId: connectionId,
          connectionPath: `connections/${connectionId}`,
          userFields: {
            uid1: userIdA,
            uid2: userIdB,
            userA: userIdA,
            userB: userIdB,
            userIds: [userIdA, userIdB].sort()
          },
          timestampFields: {
            createdAt: 'serverTimestamp()',
            updatedAt: 'serverTimestamp()'
          },
          metadataFields: {
            createdBy: adminId,
            source: isRequestAcceptance ? 'user' : 'admin'
          }
        },
        // Query compatibility info based on REAL schema
        queryCompatibility: {
          checkExistingConnection: `Query: connections where (uid1==${userIdA} AND uid2==${userIdB}) OR (uid1==${userIdB} AND uid2==${userIdA})`,
          getUserConnections_userA: `Query: connections where (uid1==${userIdA} OR uid2==${userIdA}) orderBy updatedAt desc`,
          getUserConnections_userB: `Query: connections where (uid1==${userIdB} OR uid2==${userIdB}) orderBy updatedAt desc`
        },
        note: 'REAL SCHEMA: connections/{sortedId} with uid1, uid2, updatedAt fields. Use this to verify queries match.'
      });
    }
    
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

    // ALWAYS return connection ID and path (even if connection already existed)
    // This is CRITICAL for Accept handler to verify connection was created
    // connectionId is generated BEFORE transaction, so it should NEVER be null here
    
    // Final validation: connectionId MUST be a non-empty string
    if (!connectionId || typeof connectionId !== 'string' || connectionId.length === 0) {
      const errorMsg = `CRITICAL: connectionId is ${connectionId === null ? 'null' : connectionId === undefined ? 'undefined' : `invalid: ${typeof connectionId} "${connectionId}"`} after transaction`;
      console.error('[connections/admin-create]', errorMsg, {
        userIdA,
        userIdB,
        connectionId,
        connectionPath,
        connectionIdType: typeof connectionId,
        connectionIdLength: connectionId?.length
      });
      // Throw error instead of returning null
      throw new Error(`Admin connect failed: ${errorMsg}`);
    }
    
    // Verify the connection doc exists (DEV only) - but don't fail if it doesn't (eventual consistency)
    if (process.env.NODE_ENV !== 'production') {
      try {
        const connectionRef = db.collection('connections').doc(connectionId);
        const verifyDoc = await connectionRef.get();
        
        if (!verifyDoc.exists) {
          console.warn('[connections/admin-create] VERIFICATION WARNING: Connection doc does not exist after write (may be eventual consistency)', {
            connectionId,
            connectionPath,
            created: connectionCreated,
            existed: connectionExisted,
            note: 'This may be normal if Firestore is eventually consistent. Doc should appear shortly.'
          });
        } else {
          const verifyData = verifyDoc.data();
          console.log('[connections/admin-create] VERIFICATION PASSED: Connection doc exists', {
            connectionId,
            connectionPath,
            docExists: verifyDoc.exists,
            hasUid1: !!verifyData.uid1,
            hasUid2: !!verifyData.uid2,
            hasUpdatedAt: !!verifyData.updatedAt,
            uid1: verifyData.uid1,
            uid2: verifyData.uid2
          });
        }
      } catch (verifyError) {
        console.error('[connections/admin-create] Verification check error (non-fatal):', verifyError);
      }
    }
    
    // Construct response - connectionId is guaranteed to be non-null string at this point
    const response = {
      ok: true,
      connectionId: connectionId, // GUARANTEED non-null string
      connectionPath: connectionPath, // GUARANTEED non-null string
      created: connectionCreated,
      existed: connectionExisted
    };
    
    // CRITICAL: Log return value RIGHT BEFORE returning to verify it's non-null
    console.log('[ADMIN_CONNECT_RETURN]', {
      connectionId: response.connectionId,
      connectionPath: response.connectionPath,
      created: response.created,
      existed: response.existed,
      connectionIdType: typeof response.connectionId,
      connectionIdIsNull: response.connectionId === null,
      connectionIdIsUndefined: response.connectionId === undefined,
      connectionIdLength: response.connectionId?.length,
      responseOk: response.ok,
      note: 'Admin connect ALWAYS returns connectionId/path (even if connection already existed). This is the return value RIGHT BEFORE res.json().'
    });
    
    // Return response - connectionId is guaranteed non-null
    return res.status(200).json(response);

  } catch (error) {
    console.error('[connections/admin-create] Error:', error);
    
    // Log error with context
    if (process.env.NODE_ENV !== 'production') {
      console.error('[ADMIN_CONNECT_RETURN] ERROR PATH', {
        error: error.message,
        stack: error.stack,
        note: 'Admin connect threw error - returning error response (NOT null connectionId)'
      });
    }
    
    // Return error response - NEVER return null connectionId
    return res.status(500).json({
      ok: false,
      error: error.message || 'Internal server error',
      connectionId: null, // Explicitly null to indicate failure
      note: 'Error occurred - connectionId is null because operation failed'
    });
  }
}

// Generate consistent connection ID (same as frontend)
function generateConnectionId(uid1, uid2) {
  const sorted = [uid1, uid2].sort();
  return `${sorted[0]}_${sorted[1]}`;
}
