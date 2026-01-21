// GET /api/connection-requests/incoming
// Get all pending connection requests where current user is the target
// Requires authentication
import '../../../../firebase-init.js';
import { db, auth } from '../../../../firebase-init.js';
import admin from '../../../../firebase-init.js';

export default async function handler(req, res) {
  // Only allow GET
  if (req.method !== 'GET') {
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
    try {
      const decodedToken = await auth.verifyIdToken(idToken);
      currentUserId = decodedToken.uid;
    } catch (authError) {
      console.error('[connection-requests/incoming] Auth error:', authError.message);
      return res.status(401).json({ ok: false, error: 'Unauthorized: Invalid token' });
    }

    // Get all pending requests where current user is the target
    const requestsSnapshot = await db.collection('connection_requests')
      .where('targetId', '==', currentUserId)
      .where('status', '==', 'pending')
      .orderBy('createdAt', 'desc')
      .get();

    const requests = [];
    const requesterIds = new Set();

    // Collect request data and requester IDs
    requestsSnapshot.forEach(doc => {
      const data = doc.data();
      requesterIds.add(data.requesterId);
      requests.push({
        id: doc.id,
        requesterId: data.requesterId,
        targetId: data.targetId,
        status: data.status,
        source: data.source || 'user',
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        eventId: data.eventId || null,
        message: data.message || null,
        note: data.note || data.message || null,
        // Include enriched data if available
        fromName: data.fromName || null,
        fromWork: data.fromWork || null,
        fromPosition: data.fromPosition || null,
        fromProfileImage: data.fromProfileImage || null
      });
    });

    // Batch-load requester profiles for complete user info
    const requesterProfiles = new Map();
    if (requesterIds.size > 0) {
      // Firestore 'in' query supports up to 10, so batch if needed
      const requesterArray = Array.from(requesterIds);
      const BATCH_SIZE = 10;
      
      for (let i = 0; i < requesterArray.length; i += BATCH_SIZE) {
        const batch = requesterArray.slice(i, i + BATCH_SIZE);
        const userDocs = await Promise.all(
          batch.map(uid => db.collection('users').doc(uid).get())
        );
        
        userDocs.forEach((userDoc, index) => {
          if (userDoc.exists) {
            const userData = userDoc.data();
            requesterProfiles.set(batch[index], {
              uid: batch[index],
              displayName: userData.displayName || userData.name || 'Unknown User',
              name: userData.name || userData.displayName || 'Unknown User',
              email: userData.email || null,
              profileImage: userData.profileImage || userData.avatarUrl || null,
              work: userData.work || userData.company || null,
              position: userData.position || null
            });
          }
        });
      }
    }

    // Enrich requests with full requester profile data
    const enrichedRequests = requests.map(request => {
      const profile = requesterProfiles.get(request.requesterId);
      return {
        ...request,
        requester: profile || {
          uid: request.requesterId,
          displayName: request.fromName || 'Unknown User',
          name: request.fromName || 'Unknown User',
          email: null,
          profileImage: request.fromProfileImage || null,
          work: request.fromWork || null,
          position: request.fromPosition || null
        }
      };
    });

    console.log(`[connection-requests/incoming] Returning ${enrichedRequests.length} incoming requests for user ${currentUserId}`);

    return res.status(200).json({
      ok: true,
      requests: enrichedRequests,
      count: enrichedRequests.length
    });

  } catch (error) {
    console.error('[connection-requests/incoming] Error:', error);
    return res.status(500).json({
      ok: false,
      error: error.message || 'Internal server error'
    });
  }
}
