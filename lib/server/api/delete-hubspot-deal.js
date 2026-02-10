/**
 * DELETE /api/hubspot-deals/:id
 *
 * Deletes ONE document from Firestore hubspotDeals ONLY if it is HubSpot-originated.
 * - Validates: importedFrom === 'hubspot'. Returns 403 if not.
 * - Does NOT delete from HubSpot. Firebase only.
 *
 * Auth: Firebase Admin (Bearer) OR x-sync-secret.
 */

import '../firebase-init.js';
import { db } from '../firebase-init.js';
import { authorize } from './hubspot-auth.js';
import { logHubspotDeleteAudit } from './hubspot-delete-audit.js';

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
    const snap = await ref.get();
    if (!snap.exists) {
      return res.status(404).json({ ok: false, error: 'Deal not found' });
    }
    const data = snap.data();
    if (data?.importedFrom !== 'hubspot') {
      return res.status(403).json({
        ok: false,
        error: 'Cannot delete: this record was not imported from HubSpot. Only HubSpot-imported records can be removed here.',
      });
    }

    await ref.delete();
    logHubspotDeleteAudit('delete-hubspot-deal', authResult.uid, { dealId, count: 1 });
    return res.status(200).json({ ok: true, deleted: dealId });
  } catch (err) {
    console.error('[delete-hubspot-deal] Error:', err);
    return res.status(500).json({ ok: false, error: err.message || 'Delete failed' });
  }
}
