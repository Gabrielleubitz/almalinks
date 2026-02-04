/**
 * DELETE /api/hubspot-deals/:id
 * Deletes one document from Firestore hubspotDeals. Does NOT delete from HubSpot.
 * Auth: Firebase Admin (Bearer) OR x-sync-secret.
 */

import '../firebase-init.js';
import { db } from '../firebase-init.js';
import { authorize } from './hubspot-auth.js';

export default async function handler(req, res, id) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const authResult = await authorize(req);
  if (!authResult.ok) {
    return res.status(authResult.status).json({ ok: false, error: authResult.error });
  }

  if (!db) {
    return res.status(503).json({ ok: false, error: 'Firestore not available' });
  }

  const dealId = (typeof id === 'string' ? id : '').trim();
  if (!dealId) {
    return res.status(400).json({ ok: false, error: 'Deal id is required' });
  }

  try {
    const ref = db.collection('hubspotDeals').doc(dealId);
    await ref.delete();
    return res.status(200).json({ ok: true, deleted: dealId });
  } catch (err) {
    console.error('[delete-hubspot-deal] Error:', err);
    return res.status(500).json({ ok: false, error: err.message || 'Delete failed' });
  }
}
