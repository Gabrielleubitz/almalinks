/**
 * POST /api/remove-hubspot-users
 *
 * Deletes ONLY users that were created by the HubSpot contact sync. Safe guards:
 * - NEVER delete the user making the request (caller UID from Bearer token).
 * - NEVER delete any user with role === 'admin'.
 * - ONLY delete users that have positive proof they came from our HubSpot sync:
 *   - Doc id starts with "hubspot_", OR
 *   - (source === 'hubspot' AND hubspotId is a non-empty string).
 *   Our sync (sync-hubspot-contacts) always sets both source and hubspotId; we never delete on source alone.
 *
 * For each deleted user doc (with Auth UID), also deletes the Firebase Auth user.
 * When body includes { removeContacts: true }, also clears hubspotContacts, hubspotDeals, hubspotEvents.
 *
 * Does NOT touch: joinRequests, or any user without hubspotId.
 */
import '../firebase-init.js';
import admin from '../firebase-init.js';
import { db, auth } from '../firebase-init.js';

const USERS_PREFIX = 'hubspot_';
const BATCH_SIZE = 500;

/**
 * Authorize request; when using Bearer token, returns caller uid so we never delete them.
 * @returns {{ ok: true, callerUid?: string }} or {{ ok: false, status: number, error: string }}
 */
async function authorize(req) {
  const syncSecret = process.env.SYNC_SECRET;
  if (syncSecret && syncSecret.trim()) {
    const headerSecret = req.headers['x-sync-secret'];
    if (headerSecret === syncSecret) return { ok: true };
    return { ok: false, status: 401, error: 'Invalid or missing x-sync-secret' };
  }
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { ok: false, status: 401, error: 'Unauthorized' };
  }
  const idToken = authHeader.replace('Bearer ', '').trim();
  if (!idToken) return { ok: false, status: 401, error: 'Missing token' };
  if (!admin.apps.length || !auth) {
    return { ok: false, status: 503, error: 'Firebase not configured' };
  }
  try {
    const decoded = await auth.verifyIdToken(idToken);
    const isAdmin = decoded.role === 'admin' || decoded.admin === true;
    if (!isAdmin) return { ok: false, status: 403, error: 'Admin required' };
    return { ok: true, callerUid: decoded.uid };
  } catch (e) {
    return { ok: false, status: 401, error: 'Invalid or expired token' };
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const authResult = await authorize(req);
  if (!authResult.ok) {
    return res.status(authResult.status).json({ ok: false, error: authResult.error });
  }

  if (!db) {
    return res.status(503).json({ ok: false, error: 'Firestore not available' });
  }
  if (!auth) {
    return res.status(503).json({ ok: false, error: 'Firebase Auth not available' });
  }

  const removeContacts = req.body?.removeContacts === true;
  let deletedUsers = 0;
  let deletedContacts = 0;
  let deletedDeals = 0;
  let deletedEvents = 0;

  const callerUid = authResult.callerUid || null;

  try {
    const usersRef = db.collection('users');
    const snapshot = await usersRef.get();
    const hubspotDocs = snapshot.docs.filter((d) => {
      const data = d.data();
      const hasHubspotId = typeof data?.hubspotId === 'string' && data.hubspotId.trim().length > 0;
      const isFromHubspotSync = d.id.startsWith(USERS_PREFIX) || (data?.source === 'hubspot' && hasHubspotId);
      if (!isFromHubspotSync) return false;
      if (callerUid && d.id === callerUid) return false;
      if (data?.role === 'admin') return false;
      return true;
    });

    const skippedCaller = callerUid && snapshot.docs.some((d) => d.id === callerUid);
    const skippedAdmins = snapshot.docs.filter((d) => {
      const data = d.data();
      const hasHubspotId = typeof data?.hubspotId === 'string' && data.hubspotId.trim().length > 0;
      return (d.id.startsWith(USERS_PREFIX) || (data?.source === 'hubspot' && hasHubspotId)) && data?.role === 'admin';
    }).length;
    if (skippedCaller || skippedAdmins > 0) {
      console.log('[remove-hubspot-users] Safeguards: skipped caller=', !!skippedCaller, 'skipped admins=', skippedAdmins);
    }

    for (const docSnap of hubspotDocs) {
      const uid = docSnap.id;
      if (!uid.startsWith(USERS_PREFIX)) {
        try {
          await auth.deleteUser(uid);
        } catch (e) {
          if (e.code !== 'auth/user-not-found') {
            console.warn('[remove-hubspot-users] Auth delete failed for', uid, e.code);
          }
        }
      }
    }

    for (let i = 0; i < hubspotDocs.length; i += BATCH_SIZE) {
      const batch = db.batch();
      const chunk = hubspotDocs.slice(i, i + BATCH_SIZE);
      for (const d of chunk) {
        batch.delete(d.ref);
        deletedUsers += 1;
      }
      await batch.commit();
    }

    // Helper to delete all docs in a collection in batches, returning the count.
    const deleteCollection = async (collectionName) => {
      const colRef = db.collection(collectionName);
      const snap = await colRef.get();
      let count = 0;
      for (let i = 0; i < snap.docs.length; i += BATCH_SIZE) {
        const batch = db.batch();
        const chunk = snap.docs.slice(i, i + BATCH_SIZE);
        for (const d of chunk) {
          batch.delete(d.ref);
          count += 1;
        }
        await batch.commit();
      }
      return count;
    };

    if (removeContacts) {
      deletedContacts = await deleteCollection('hubspotContacts');
      deletedDeals = await deleteCollection('hubspotDeals');
      deletedEvents = await deleteCollection('hubspotEvents');
    }

    return res.status(200).json({
      ok: true,
      deletedUsers,
      deletedContacts: removeContacts ? deletedContacts : undefined,
      deletedDeals: removeContacts ? deletedDeals : undefined,
      deletedEvents: removeContacts ? deletedEvents : undefined,
    });
  } catch (err) {
    console.error('[remove-hubspot-users] Error:', err);
    return res.status(500).json({
      ok: false,
      error: err.message || 'Remove failed',
    });
  }
}
