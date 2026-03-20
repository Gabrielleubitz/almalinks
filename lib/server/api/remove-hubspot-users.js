/**
 * POST /api/remove-hubspot-users
 *
 * Deletes ONLY records that are explicitly marked as HubSpot-imported.
 * Non-negotiable: ANY delete MUST satisfy importedFrom === "hubspot" and (for users) hubspotId OR hubspotContactId present.
 *
 * - NEVER deletes native users (no importedFrom or importedFrom !== "hubspot").
 * - NEVER deletes the caller or any admin.
 * - NEVER touches HubSpot via API (Firebase only).
 * - All deletes are QUERY-BASED with where('importedFrom', '==', 'hubspot').
 *
 * When body includes { removeContacts: true }, also deletes HubSpot-imported docs in
 * hubspotContacts, hubspotDeals, and events (where importedFrom === 'hubspot').
 *
 * Audit: logs action type, admin uid, counts, timestamp.
 */
import '../firebase-init.js';
import admin from '../firebase-init.js';
import { db, auth } from '../firebase-init.js';
import { logHubspotDeleteAudit } from './hubspot-delete-audit.js';

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

/**
 * Delete docs from a query in batches. Returns number deleted.
 */
async function deleteQueryBatch(query, batchSize = BATCH_SIZE) {
  const snapshot = await query.get();
  let deleted = 0;
  for (let i = 0; i < snapshot.docs.length; i += batchSize) {
    const batch = db.batch();
    const chunk = snapshot.docs.slice(i, i + batchSize);
    for (const d of chunk) {
      batch.delete(d.ref);
      deleted += 1;
    }
    await batch.commit();
  }
  return deleted;
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
  const callerUid = authResult.callerUid || null;

  try {
    // --- Users: QUERY only importedFrom === 'hubspot', then filter caller + admins + require hubspotId/hubspotContactId ---
    const usersQuery = db.collection('users').where('importedFrom', '==', 'hubspot');
    const usersSnap = await usersQuery.get();
    const toDelete = usersSnap.docs.filter((d) => {
      const data = d.data();
      const hubspotId = data?.hubspotId;
      const hubspotContactId = data?.hubspotContactId;
      const hasHubspotId = typeof hubspotId === 'string' && hubspotId.trim().length > 0;
      const hasHubspotContactId = typeof hubspotContactId === 'string' && hubspotContactId.trim().length > 0;
      if (!hasHubspotId && !hasHubspotContactId) return false;
      if (callerUid && d.id === callerUid) return false;
      if (data?.role === 'admin') return false;
      return true;
    });

    let deletedUsers = 0;
    for (const docSnap of toDelete) {
      const uid = docSnap.id;
      try {
        await auth.deleteUser(uid);
      } catch (e) {
        if (e.code !== 'auth/user-not-found') {
          console.warn('[remove-hubspot-users] Auth delete failed for', uid, e.code);
        }
      }
    }
    for (let i = 0; i < toDelete.length; i += BATCH_SIZE) {
      const batch = db.batch();
      const chunk = toDelete.slice(i, i + BATCH_SIZE);
      for (const d of chunk) {
        batch.delete(d.ref);
        deletedUsers += 1;
      }
      await batch.commit();
    }

    let deletedContacts = 0;
    let deletedDeals = 0;
    let deletedEvents = 0;

    if (removeContacts) {
      deletedContacts = await deleteQueryBatch(
        db.collection('hubspotContacts').where('importedFrom', '==', 'hubspot')
      );
      deletedDeals = await deleteQueryBatch(
        db.collection('hubspotDeals').where('importedFrom', '==', 'hubspot')
      );
      deletedEvents = await deleteQueryBatch(
        db.collection('events').where('importedFrom', '==', 'hubspot')
      );
    }

    logHubspotDeleteAudit('remove-hubspot-users', callerUid, {
      users: deletedUsers,
      contacts: removeContacts ? deletedContacts : undefined,
      deals: removeContacts ? deletedDeals : undefined,
      events: removeContacts ? deletedEvents : undefined,
    });

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
