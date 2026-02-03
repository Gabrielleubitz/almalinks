/**
 * POST /api/clear-hubspot-deals
 *
 * Deletes all documents in the hubspotDeals collection (clears the deals import only).
 * Auth: same as sync-hubspot-deals (admin Bearer or x-sync-secret).
 */

import '../firebase-init.js';
import admin from '../firebase-init.js';
import { db } from '../firebase-init.js';

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
  if (!admin?.apps?.length) {
    return { ok: false, status: 503, error: 'Firebase not configured' };
  }
  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
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
  try {
    const colRef = db.collection('hubspotDeals');
    const snap = await colRef.get();
    let deleted = 0;
    for (let i = 0; i < snap.docs.length; i += BATCH_SIZE) {
      const batch = db.batch();
      const chunk = snap.docs.slice(i, i + BATCH_SIZE);
      for (const d of chunk) {
        batch.delete(d.ref);
        deleted += 1;
      }
      await batch.commit();
    }
    return res.status(200).json({ ok: true, deleted });
  } catch (err) {
    console.error('[clear-hubspot-deals] Error:', err);
    return res.status(500).json({ ok: false, error: err.message || 'Clear failed' });
  }
}
