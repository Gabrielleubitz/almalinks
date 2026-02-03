/**
 * POST /api/remove-hubspot-users
 *
 * Deletes all HubSpot-synced users from Firestore and Firebase Auth:
 * - Firestore users where doc id starts with "hubspot_" OR source === 'hubspot'
 * - For docs with Auth UID (source === 'hubspot', id not hubspot_*), also deletes the Auth user
 *
 * When body includes { removeContacts: true }, also removes ALL HubSpot data collections:
 * - hubspotContacts
 * - hubspotDeals
 * - hubspotEvents
 *
 * Same auth as sync: Firebase admin or x-sync-secret.
 */
import '../firebase-init.js';
import admin from '../firebase-init.js';
import { db, auth } from '../firebase-init.js';

const USERS_PREFIX = 'hubspot_';
const BATCH_SIZE = 500;

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
    return { ok: true };
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

  try {
    const usersRef = db.collection('users');
    const snapshot = await usersRef.get();
    const hubspotDocs = snapshot.docs.filter(
      (d) => d.id.startsWith(USERS_PREFIX) || (d.data()?.source === 'hubspot')
    );

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
