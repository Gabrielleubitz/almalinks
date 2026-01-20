import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  updateDoc,
  deleteDoc,
  query, 
  where, 
  orderBy, 
  serverTimestamp,
  limit as firestoreLimit,
  runTransaction,
  writeBatch
} from 'firebase/firestore';
import { db, retryOnNetworkFailure, auth } from '../firebase/config';
import { nanoid } from 'nanoid';
import { ConnectionRequest, ConnectionRequestStatus } from '../types/connection';
import { PrivacyService } from './privacyService';
import { ConnectionService, ConnectionReason } from './connectionService';

// Helper to generate consistent pair key for uniqueness checks
// This MUST match ConnectionService.generateConnectionId for consistency
function generatePairKey(uid1: string, uid2: string): string {
  return [uid1, uid2].sort().join('_');
}

// Verify this matches ConnectionService.generateConnectionId
// ConnectionService.generateConnectionId does: [uid1, uid2].sort().join('_')
// So they should be identical

export class ConnectionRequestService {
  /**
   * Send a connection request to another user (via backend API, with Firestore fallback for dev)
   */
  static async sendConnectionRequest(
    fromUid: string,
    toUid: string,
    options: {
      eventId?: string;
      message?: string;
    } = {}
  ): Promise<string> {
    try {
      // Get authentication token
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('User must be authenticated to send connection requests');
      }

      // Try API first (production or when vercel dev is running)
      const useApi = !import.meta.env.DEV || import.meta.env.VITE_USE_API === 'true';
      
      if (useApi) {
        try {
          const idToken = await currentUser.getIdToken();

          // Call backend API to create connection request
          const response = await fetch('/api/connection-request/create', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${idToken}`
            },
            body: JSON.stringify({
              targetId: toUid,
              eventId: options.eventId,
              message: options.message
            })
          });

          const data = await response.json();

          if (response.ok && data.ok) {
            console.log('✅ Connection request sent via API:', data.requestId);
            return data.requestId;
          } else {
            throw new Error(data.error || `HTTP ${response.status}: Failed to create connection request`);
          }
        } catch (apiError: any) {
          // If API fails in dev, fall back to Firestore
          if (import.meta.env.DEV) {
            console.warn('[ConnectionRequestService] API call failed, using Firestore fallback:', apiError.message);
            return await this.sendConnectionRequestFirestore(fromUid, toUid, options);
          }
          throw apiError;
        }
      } else {
        // Direct Firestore in dev mode
        return await this.sendConnectionRequestFirestore(fromUid, toUid, options);
      }

    } catch (error: any) {
      console.error('❌ Error sending connection request:', error);
      throw error;
    }
  }

  /**
   * Send connection request directly via Firestore (dev fallback)
   */
  private static async sendConnectionRequestFirestore(
    fromUid: string,
    toUid: string,
    options: {
      eventId?: string;
      message?: string;
    } = {}
  ): Promise<string> {
    // Prevent self-connection
    if (fromUid === toUid) {
      throw new Error('Cannot send connection request to yourself');
    }

    const pairKey = generatePairKey(fromUid, toUid);

    // Use transaction to ensure atomicity
    return await retryOnNetworkFailure(() => 
      runTransaction(db, async (transaction) => {
        // Check if connection already exists
        const connectionId = pairKey;
        const connectionRef = doc(db, 'connections', connectionId);
        const connectionDoc = await transaction.get(connectionRef);
        
        if (connectionDoc.exists()) {
          throw new Error('Connection already exists between these users');
        }

        // Check if pending request already exists (either direction)
        // Query for requests where requester is fromUid and target is toUid (pending only)
        const requestsRef = collection(db, 'connection_requests');
        const existingRequestsQuery1 = query(
          requestsRef,
          where('requesterId', '==', fromUid),
          where('targetId', '==', toUid),
          where('status', '==', 'pending')
        );
        const existingRequestsQuery2 = query(
          requestsRef,
          where('requesterId', '==', toUid),
          where('targetId', '==', fromUid),
          where('status', '==', 'pending')
        );
        
        const [snapshot1, snapshot2] = await Promise.all([
          getDocs(existingRequestsQuery1),
          getDocs(existingRequestsQuery2)
        ]);
        
        if (!snapshot1.empty || !snapshot2.empty) {
          throw new Error('Connection request already exists between these users');
        }
        
        // Also check for accepted requests (to prevent duplicate connections)
        const acceptedQuery1 = query(
          requestsRef,
          where('requesterId', '==', fromUid),
          where('targetId', '==', toUid),
          where('status', '==', 'accepted')
        );
        const acceptedQuery2 = query(
          requestsRef,
          where('requesterId', '==', toUid),
          where('targetId', '==', fromUid),
          where('status', '==', 'accepted')
        );
        
        const [acceptedSnapshot1, acceptedSnapshot2] = await Promise.all([
          getDocs(acceptedQuery1),
          getDocs(acceptedQuery2)
        ]);
        
        if (!acceptedSnapshot1.empty || !acceptedSnapshot2.empty) {
          throw new Error('Connection already exists between these users');
        }

        // Get requester user data for enriched fields
        const requesterDoc = await transaction.get(doc(db, 'users', fromUid));
        if (!requesterDoc.exists()) {
          throw new Error('Requester user not found');
        }
        const requesterData = requesterDoc.data();

        // Create connection request
        const requestId = doc(collection(db, 'connection_requests')).id;
        const requestRef = doc(db, 'connection_requests', requestId);
        const now = serverTimestamp();

        const requestData = {
          id: requestId,
          requesterId: fromUid,
          fromUid: fromUid, // Legacy alias
          targetId: toUid,
          toUid: toUid, // Legacy alias
          pairKey: pairKey, // For uniqueness checks
          eventId: options.eventId || null,
          message: options.message || null,
          note: options.message || null,
          status: 'pending' as ConnectionRequestStatus,
          source: 'user',
          createdAt: now,
          updatedAt: now,
          decidedAt: null,
          decisionBy: null,
          decisionRole: null,
          // Enriched requester data
          fromName: requesterData.displayName || requesterData.name || 'Unknown User',
          fromWork: requesterData.work || requesterData.company || 'Not specified',
          fromPosition: requesterData.position || null,
          fromProfileImage: requesterData.profileImage || requesterData.avatarUrl || null
        };

        transaction.set(requestRef, requestData);

        if (import.meta.env.DEV) {
          console.log('[connect-request-created]', {
            requestId,
            requesterId: fromUid,
            targetId: toUid,
            status: 'pending',
            pairKey,
            collection: 'connection_requests'
          });
        }
        
        console.log('✅ Connection request created via Firestore:', requestId);
        return requestId;
      })
    );
  }

  /**
   * Respond to a connection request (via backend API, with Firestore fallback for dev)
   * For accept: uses the same connection creation path as admin connections
   */
  static async respondToRequest(
    requestId: string,
    response: 'accepted' | 'rejected',
    respondingUserId: string
  ): Promise<string | null> {
    try {
      // Get authentication token
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('User must be authenticated to respond to connection requests');
      }

      if (import.meta.env.DEV) {
        console.log('[respond-to-request-start]', {
          requestId,
          response,
          respondingUserId
        });
      }

      if (response === 'accepted') {
        // STEP 1: Get request data to extract requesterId and targetId
        const requestRef = doc(db, 'connection_requests', requestId);
        const requestDoc = await retryOnNetworkFailure(() => getDoc(requestRef));
        
        if (!requestDoc.exists()) {
          throw new Error('Connection request not found');
        }
        
        const requestData = requestDoc.data();
        const requesterId = requestData.requesterId || requestData.fromUid;
        const targetId = requestData.targetId || requestData.toUid;
        
        // Verify current user is the target
        if (targetId !== currentUser.uid && requestData.toUid !== currentUser.uid) {
          throw new Error('You can only accept requests sent to you');
        }
        
        // Verify request is still pending
        if (requestData.status !== 'pending') {
          throw new Error(`Request already ${requestData.status}`);
        }
        
        // STEP 2: Update request status to accepted
        await retryOnNetworkFailure(() => updateDoc(requestRef, {
          status: 'accepted',
          updatedAt: serverTimestamp(),
          decidedAt: serverTimestamp(),
          decisionBy: currentUser.uid,
          decisionRole: 'user'
        }));
        
        // STEP 3: Call the EXACT SAME admin connection creation function
        // This is the EXACT entry point used by admin panel
        const { AdminConnectionService } = await import('./adminConnectionService');
        
        if (import.meta.env.DEV) {
          console.log('[accept-calling-admin-connection-creator]', {
            requestId,
            requesterId,
            targetId,
            callingFunction: 'AdminConnectionService.createAdminConnection',
            adminUid: currentUser.uid,
            note: 'Using EXACT same function as admin panel'
          });
        }
        
        // Call the EXACT SAME function admin panel uses
        // This will call /api/connections/admin-create (same endpoint)
        // The endpoint will handle permissions (allows non-admin when sourceRequestId provided)
        let connectionId: string;
        
        try {
          connectionId = await AdminConnectionService.createAdminConnection(
            requesterId, // fromUid
            targetId,    // toUid
            currentUser.uid, // adminUid (the accepting user)
            {
              eventId: requestData.eventId || undefined,
              reason: 'Connection request accepted by user',
              sourceRequestId: requestId // Pass to endpoint to allow non-admin
            }
          );
          
          // Store connectionId on request for audit
          await retryOnNetworkFailure(() => updateDoc(requestRef, {
            sourceRequestId: connectionId
          }));
          
        } catch (connectionError: any) {
          console.error('❌ Error creating connection via admin creator:', connectionError);
          throw new Error(`Failed to create connection: ${connectionError.message}`);
        }
        
        if (import.meta.env.DEV) {
          console.log('[accept-admin-connection-creator-result]', {
            requestId,
            connectionId,
            connectionPath: `connections/${connectionId}`,
            requesterId,
            targetId,
            adminConnectCalled: true,
            writes: [
              `connection_requests/${requestId} (status=accepted, sourceRequestId=${connectionId})`,
              `connections/${connectionId} (uid1=${requesterId}, uid2=${targetId}, source=user)`
            ]
          });
        }
        
        return connectionId;
      } else {
        // For reject: update request status only
        const requestRef = doc(db, 'connection_requests', requestId);
        const requestDoc = await retryOnNetworkFailure(() => getDoc(requestRef));
        
        if (!requestDoc.exists()) {
          throw new Error('Connection request not found');
        }
        
        const requestData = requestDoc.data();
        const targetId = requestData.targetId || requestData.toUid;
        
        // Verify current user is the target
        if (targetId !== currentUser.uid && requestData.toUid !== currentUser.uid) {
          throw new Error('You can only reject requests sent to you');
        }
        
        // Update request status
        await retryOnNetworkFailure(() => updateDoc(requestRef, {
          status: 'rejected',
          updatedAt: serverTimestamp(),
          decidedAt: serverTimestamp(),
          decisionBy: currentUser.uid,
          decisionRole: 'user'
        }));
        
        console.log('✅ Connection request rejected:', requestId);
        return null;
      }

    } catch (error: any) {
      console.error('❌ Error responding to connection request:', error);
      throw error;
    }
  }

  /**
   * Respond to connection request directly via Firestore (dev fallback)
   * Returns connectionId if accepted, null if rejected
   */
  private static async respondToRequestFirestore(
    requestId: string,
    response: 'accepted' | 'rejected',
    respondingUserId: string
  ): Promise<string | null> {
    if (import.meta.env.DEV) {
      console.log('[accept-request-start]', {
        requestId,
        response,
        respondingUserId
      });
    }

    const newStatus = response === 'accepted' ? 'accepted' : 'rejected' as ConnectionRequestStatus;

    // First, get request data outside transaction to use after
    const requestRef = doc(db, 'connection_requests', requestId);
    const requestDoc = await retryOnNetworkFailure(() => getDoc(requestRef));
    
    if (!requestDoc.exists()) {
      throw new Error('Connection request not found');
    }

    const requestData = requestDoc.data();
    const requesterId = requestData.requesterId || requestData.fromUid;
    const targetId = requestData.targetId || requestData.toUid;
    
    if (import.meta.env.DEV) {
      console.log('[accept-request-data]', {
        requestId,
        requesterId,
        targetId,
        currentStatus: requestData.status,
        pairKey: requestData.pairKey
      });
    }

    // Verify authorization: user must be target OR admin
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('User must be authenticated');
    }

    // Check if user is admin
    const userDoc = await retryOnNetworkFailure(() => getDoc(doc(db, 'users', currentUser.uid)));
    const isAdmin = userDoc.exists() && (userDoc.data().role === 'admin' || userDoc.data().admin === true);

    if (!isAdmin && targetId !== currentUser.uid && requestData.toUid !== currentUser.uid) {
      throw new Error('You can only respond to requests sent to you');
    }

    // Check if already responded
    if (requestData.status !== 'pending') {
      throw new Error(`Request already ${requestData.status}`);
    }

    // Use transaction to ensure atomicity for request update
    await retryOnNetworkFailure(() =>
      runTransaction(db, async (transaction) => {
        // Re-read request in transaction
        const requestSnap = await transaction.get(requestRef);
        
        if (!requestSnap.exists()) {
          throw new Error('Connection request not found');
        }

        const currentRequestData = requestSnap.data();
        
        // Double-check status
        if (currentRequestData.status !== 'pending') {
          throw new Error(`Request already ${currentRequestData.status}`);
        }

        const now = serverTimestamp();

        // Update request
        transaction.update(requestRef, {
          status: newStatus,
          updatedAt: now,
          decidedAt: now,
          decisionBy: currentUser.uid,
          decisionRole: isAdmin ? 'admin' : 'user'
        });

        if (import.meta.env.DEV) {
          console.log('[accept-request-updated]', {
            requestId,
            newStatus,
            decisionBy: respondingUserId
          });
        }

        console.log('✅ Connection request responded to via Firestore:', requestId, response);
      })
    );

    // If accepted, create connection using EXACT same format as admin-create endpoint
    // Do this AFTER transaction commits to ensure request is updated first
    if (response === 'accepted') {
      const connectionId = generatePairKey(requesterId, targetId);
      
      if (import.meta.env.DEV) {
        console.log('[accept-creating-connection-same-format-as-admin]', {
          requesterId,
          targetId,
          requestId,
          connectionId
        });
      }

      try {
        // Check if connection already exists (idempotency)
        const connectionRef = doc(db, 'connections', connectionId);
        const connectionDoc = await retryOnNetworkFailure(() => getDoc(connectionRef));

        if (connectionDoc.exists()) {
          if (import.meta.env.DEV) {
            console.log('[accept-connection-exists]', {
              connectionId,
              existingData: connectionDoc.data()
            });
          }
          console.log('✅ Connection already exists, skipping creation:', connectionId);
          return connectionId;
        }

        // Get user data for connection caching (same as admin-create)
        const [requesterDoc, targetDoc] = await Promise.all([
          retryOnNetworkFailure(() => getDoc(doc(db, 'users', requesterId))),
          retryOnNetworkFailure(() => getDoc(doc(db, 'users', targetId)))
        ]);

        const requesterUserData = requesterDoc.exists() ? requesterDoc.data() : {};
        const targetUserData = targetDoc.exists() ? targetDoc.data() : {};

        // Create connection document - EXACT same format as admin-create endpoint
        // Note: admin-create uses userIdA/userIdB as-is for uid1/uid2 (not normalized)
        // The doc ID is sorted, but the fields use original order
        const connectionData = {
          uid1: requesterId, // Same as admin-create uses userIdA
          uid2: targetId, // Same as admin-create uses userIdB
          userA: requesterId, // Same as uid1
          userB: targetId, // Same as uid2
          userIds: [requesterId, targetId].sort(), // Sorted for deduplication (same as admin-create)
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          createdBy: requesterId, // Original requester
          source: 'user', // Created from user request (vs 'admin' for admin-create)
          sourceRequestId: requestId,
          // Cache user data - same format as admin-create
          uid1CachedData: {
            displayName: requesterUserData.displayName || requesterUserData.name || 'Unknown User',
            name: requesterUserData.name || requesterUserData.displayName || 'Unknown User',
            email: requesterUserData.email || null,
            profileImage: requesterUserData.profileImage || requesterUserData.avatarUrl || null
          },
          uid2CachedData: {
            displayName: targetUserData.displayName || targetUserData.name || 'Unknown User',
            name: targetUserData.name || targetUserData.displayName || 'Unknown User',
            email: targetUserData.email || null,
            profileImage: targetUserData.profileImage || targetUserData.avatarUrl || null
          },
          reasons: [{
            type: 'user',
            eventId: requestData.eventId || null,
            requestId: requestId,
            context: 'user-requested connection accepted',
            timestamp: serverTimestamp()
          }]
        };

        await retryOnNetworkFailure(() => setDoc(connectionRef, connectionData));

        if (import.meta.env.DEV) {
          console.log('[accept-connection-created-same-format-as-admin]', {
            connectionId,
            connectionPath: `connections/${connectionId}`,
            requesterId,
            targetId,
            source: 'user',
            sourceRequestId: requestId
          });
        }

        console.log('✅ Connection created from accepted request (same format as admin):', connectionId);
        
        return connectionId;
      } catch (connectionError) {
        console.error('❌ Error creating connection after accepting request:', connectionError);
        // Request is already updated, but connection creation failed
        throw new Error(`Failed to create connection: ${connectionError instanceof Error ? connectionError.message : 'Unknown error'}`);
      }
    }
    
    return null; // Rejected, no connection created
  }

  /**
   * Create connection using EXACT same format as admin-create endpoint (Firestore fallback)
   * This ensures connections are created identically whether via API or direct Firestore
   */
  private static async createConnectionSameFormatAsAdmin(
    requesterId: string,
    targetId: string,
    createdBy: string,
    requestId: string,
    eventId?: string
  ): Promise<string> {
    const connectionId = generatePairKey(requesterId, targetId);
    
    if (import.meta.env.DEV) {
      console.log('[create-connection-same-format-as-admin]', {
        requesterId,
        targetId,
        connectionId,
        createdBy,
        requestId
      });
    }
    
    // Use transaction to ensure atomicity (same as admin-create)
    return await retryOnNetworkFailure(() =>
      runTransaction(db, async (transaction) => {
        // Check if connection already exists (idempotency)
        const connectionRef = doc(db, 'connections', connectionId);
        const connectionDoc = await transaction.get(connectionRef);
        
        if (connectionDoc.exists()) {
          if (import.meta.env.DEV) {
            console.log('[create-connection-exists]', { connectionId });
          }
          return connectionId;
        }
        
        // Get user data (same as admin-create)
        const [requesterDoc, targetDoc] = await Promise.all([
          transaction.get(doc(db, 'users', requesterId)),
          transaction.get(doc(db, 'users', targetId))
        ]);
        
        if (!requesterDoc.exists() || !targetDoc.exists()) {
          throw new Error('User not found');
        }
        
        const requesterData = requesterDoc.data();
        const targetData = targetDoc.data();
        const now = serverTimestamp();
        
        // Create connection document - EXACT same format as admin-create endpoint
        const connectionData = {
          uid1: requesterId, // Same as admin-create uses userIdA
          uid2: targetId, // Same as admin-create uses userIdB
          userA: requesterId,
          userB: targetId,
          userIds: [requesterId, targetId].sort(), // Sorted for deduplication
          createdAt: now,
          updatedAt: now, // REQUIRED for getUserConnections orderBy
          createdBy: createdBy,
          source: 'user', // Created from user request
          sourceRequestId: requestId,
          // Cache user data - same format as admin-create
          uid1CachedData: {
            displayName: requesterData.displayName || requesterData.name || 'Unknown User',
            name: requesterData.name || requesterData.displayName || 'Unknown User',
            email: requesterData.email || null,
            profileImage: requesterData.profileImage || requesterData.avatarUrl || null
          },
          uid2CachedData: {
            displayName: targetData.displayName || targetData.name || 'Unknown User',
            name: targetData.name || targetData.displayName || 'Unknown User',
            email: targetData.email || null,
            profileImage: targetData.profileImage || targetData.avatarUrl || null
          },
          reasons: [{
            type: 'user',
            requestId: requestId,
            eventId: eventId || null,
            context: 'Connection request accepted by user',
            timestamp: now
          }]
        };
        
        transaction.set(connectionRef, connectionData);
        
        // Also update request status in same transaction
        const requestRef = doc(db, 'connection_requests', requestId);
        transaction.update(requestRef, {
          status: 'accepted',
          updatedAt: now,
          decidedAt: now,
          decisionBy: createdBy,
          decisionRole: 'user',
          sourceRequestId: connectionId
        });
        
        if (import.meta.env.DEV) {
          console.log('[create-connection-same-format-as-admin] wrote', {
            writes: [
              `connections/${connectionId} (uid1=${requesterId}, uid2=${targetId}, source=user)`,
              `connection_requests/${requestId} (status=accepted)`
            ],
            connectionId,
            connectionPath: `connections/${connectionId}`
          });
        }
        
        return connectionId;
      })
    );
  }

  /**
   * Get pending connection requests for a user (via API for enriched data)
   */
  static async getPendingRequests(userId: string): Promise<ConnectionRequest[]> {
    try {
      // Try API first for enriched requester data
      const currentUser = auth.currentUser;
      if (currentUser) {
        try {
          const idToken = await currentUser.getIdToken();
          const response = await fetch('/api/connection-requests/incoming', {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${idToken}`
            }
          });

          if (response.ok) {
            const data = await response.json();
            if (data.ok && data.requests) {
              // Map API response to ConnectionRequest format
              return data.requests.map((req: any) => ({
                id: req.id,
                requesterId: req.requesterId,
                fromUid: req.requesterId,
                targetId: req.targetId,
                toUid: req.targetId,
                status: req.status,
                createdAt: req.createdAt?.toDate ? req.createdAt.toDate() : new Date(req.createdAt || 0),
                updatedAt: req.updatedAt?.toDate ? req.updatedAt.toDate() : undefined,
                eventId: req.eventId,
                message: req.message,
                fromName: req.requester?.displayName || req.fromName || 'Unknown User',
                fromWork: req.requester?.work || req.fromWork || '',
                fromPosition: req.requester?.position || req.fromPosition,
                fromProfileImage: req.requester?.profileImage || req.fromProfileImage,
                requester: req.requester
              })) as ConnectionRequest[];
            }
          }
        } catch (apiError) {
          console.warn('[ConnectionRequestService] API fetch failed, falling back to direct Firestore:', apiError);
        }
      }

      // Fallback to direct Firestore query
      // Query using both targetId (new) and toUid (legacy) to support both schemas
      const requestsRef = collection(db, 'connection_requests');
      
      // Try querying with targetId first (new schema) with orderBy
      let q = query(
        requestsRef,
        where('targetId', '==', userId),
        where('status', '==', 'pending'),
        orderBy('createdAt', 'desc'),
        firestoreLimit(50)
      );

      let snapshot;
      try {
        snapshot = await retryOnNetworkFailure(() => getDocs(q));
      } catch (error: any) {
        // If query fails (e.g., missing index), try without orderBy
        if (error.code === 'failed-precondition' || error.message?.includes('index')) {
          console.warn('[ConnectionRequestService] Query with orderBy failed, trying without orderBy:', error.message);
          try {
            q = query(
              requestsRef,
              where('targetId', '==', userId),
              where('status', '==', 'pending'),
              firestoreLimit(50)
            );
            snapshot = await retryOnNetworkFailure(() => getDocs(q));
            // Sort in memory
            const docs = snapshot.docs.sort((a, b) => {
              const aTime = a.data().createdAt?.toMillis() || 0;
              const bTime = b.data().createdAt?.toMillis() || 0;
              return bTime - aTime; // Descending
            });
            snapshot = { ...snapshot, docs } as any;
          } catch (error2: any) {
            // If that also fails, try legacy field
            console.warn('[ConnectionRequestService] targetId query failed, trying toUid (legacy):', error2.message);
            q = query(
              requestsRef,
              where('toUid', '==', userId),
              where('status', '==', 'pending'),
              firestoreLimit(50)
            );
            snapshot = await retryOnNetworkFailure(() => getDocs(q));
            // Sort in memory
            const docs = snapshot.docs.sort((a, b) => {
              const aTime = a.data().createdAt?.toMillis() || 0;
              const bTime = b.data().createdAt?.toMillis() || 0;
              return bTime - aTime; // Descending
            });
            snapshot = { ...snapshot, docs } as any;
          }
        } else {
          throw error;
        }
      }

      const requests = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          // Normalize field names
          requesterId: data.requesterId || data.fromUid,
          fromUid: data.fromUid || data.requesterId,
          targetId: data.targetId || data.toUid,
          toUid: data.toUid || data.targetId,
          createdAt: data.createdAt?.toDate() || new Date(0),
          updatedAt: data.updatedAt?.toDate()
        };
      }) as ConnectionRequest[];

      if (import.meta.env.DEV) {
        console.log('[incoming-requests]', {
          currentUserId: userId,
          count: requests.length,
          first: requests[0] ? {
            id: requests[0].id,
            requesterId: requests[0].requesterId,
            targetId: requests[0].targetId,
            status: requests[0].status
          } : null,
          allRequestIds: requests.map(r => r.id)
        });
      }

      return requests;

    } catch (error) {
      console.error('❌ Error getting pending requests:', error);
      return [];
    }
  }

  /**
   * Get sent connection requests for a user
   */
  static async getSentRequests(userId: string): Promise<ConnectionRequest[]> {
    try {
      const requestsRef = collection(db, 'connection_requests');
      const q = query(
        requestsRef,
        where('fromUid', '==', userId),
        orderBy('createdAt', 'desc'),
        firestoreLimit(50)
      );

      const snapshot = await retryOnNetworkFailure(() => getDocs(q));
      const requests = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(0),
        respondedAt: doc.data().respondedAt?.toDate()
      })) as ConnectionRequest[];

      return requests;

    } catch (error) {
      console.error('❌ Error getting sent requests:', error);
      return [];
    }
  }

  /**
   * Cancel a sent connection request
   */
  static async cancelRequest(requestId: string, userId: string): Promise<void> {
    try {
      const requestDoc = await retryOnNetworkFailure(() => 
        getDoc(doc(db, 'connection_requests', requestId))
      );

      if (!requestDoc.exists()) {
        throw new Error('Connection request not found');
      }

      const requestData = requestDoc.data();
      
      // Verify this user can cancel this request
      if (requestData.fromUid !== userId) {
        throw new Error('You are not authorized to cancel this request');
      }

      // Can only cancel pending requests
      if (requestData.status !== 'pending') {
        throw new Error('Can only cancel pending requests');
      }

      // Delete the request
      await retryOnNetworkFailure(() => 
        deleteDoc(doc(db, 'connection_requests', requestId))
      );

      console.log('✅ Connection request cancelled:', requestId);

    } catch (error) {
      console.error('❌ Error cancelling connection request:', error);
      throw error;
    }
  }

  /**
   * Check if connection request already exists
   */
  private static async checkExistingRequest(
    fromUid: string, 
    toUid: string, 
    eventId?: string
  ): Promise<ConnectionRequest | null> {
    try {
      const requestsRef = collection(db, 'connection_requests');
      
      let q = query(
        requestsRef,
        where('fromUid', '==', fromUid),
        where('toUid', '==', toUid),
        where('status', '==', 'pending')
      );

      // Add event filter if specified
      if (eventId) {
        q = query(q, where('eventId', '==', eventId));
      }

      const snapshot = await retryOnNetworkFailure(() => getDocs(q));
      
      if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        return {
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate() || new Date(0),
          respondedAt: doc.data().respondedAt?.toDate()
        } as ConnectionRequest;
      }

      return null;

    } catch (error) {
      console.error('❌ Error checking existing request:', error);
      return null;
    }
  }

  /**
   * Get request statistics for admin/debugging
   */
  static async getRequestStats(): Promise<{
    total: number;
    pending: number;
    accepted: number;
    rejected: number;
  }> {
    try {
      const requestsRef = collection(db, 'connection_requests');
      const snapshot = await retryOnNetworkFailure(() => getDocs(requestsRef));
      
      let total = 0;
      let pending = 0;
      let accepted = 0;
      let rejected = 0;

      snapshot.forEach(doc => {
        const data = doc.data();
        total++;
        
        switch (data.status) {
          case 'pending':
            pending++;
            break;
          case 'accepted':
            accepted++;
            break;
          case 'rejected':
            rejected++;
            break;
        }
      });

      return { total, pending, accepted, rejected };

    } catch (error) {
      console.error('❌ Error getting request stats:', error);
      return { total: 0, pending: 0, accepted: 0, rejected: 0 };
    }
  }

  /**
   * Debug: Get recent connection requests (DEV only)
   */
  static async getRecentRequests(limit: number = 20): Promise<ConnectionRequest[]> {
    if (!import.meta.env.DEV) {
      console.warn('getRecentRequests is DEV-only');
      return [];
    }

    try {
      const requestsRef = collection(db, 'connection_requests');
      const q = query(
        requestsRef,
        orderBy('createdAt', 'desc'),
        firestoreLimit(limit)
      );

      const snapshot = await retryOnNetworkFailure(() => getDocs(q));
      const requests = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          requesterId: data.requesterId || data.fromUid,
          fromUid: data.fromUid || data.requesterId,
          targetId: data.targetId || data.toUid,
          toUid: data.toUid || data.targetId,
          createdAt: data.createdAt?.toDate() || new Date(0),
          updatedAt: data.updatedAt?.toDate()
        };
      }) as ConnectionRequest[];

      console.log(`[debug] Recent ${requests.length} connection requests:`, requests.map(r => ({
        id: r.id,
        requesterId: r.requesterId,
        targetId: r.targetId,
        status: r.status,
        createdAt: r.createdAt
      })));

      return requests;
    } catch (error) {
      console.error('❌ Error getting recent requests:', error);
      return [];
    }
  }
}