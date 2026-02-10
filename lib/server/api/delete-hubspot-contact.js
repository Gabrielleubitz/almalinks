/**
 * DELETE /api/hubspot-contacts/:id
 *
 * Deletes ONE document from Firestore hubspotContacts ONLY if it is HubSpot-originated.
 * - Validates: importedFrom === 'hubspot' and hubspotId exists. Returns 403 if not.
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

  const contactId = (typeof id === 'string' ? id : '').trim();
  if (!contactId) {
    return res.status(400).json({ ok: false, error: 'Contact id is required' });
  }

  try {
    const ref = db.collection('hubspotContacts').doc(contactId);
    const snap = await ref.get();
    if (!snap.exists) {
      return res.status(404).json({ ok: false, error: 'Contact not found' });
    }
    const data = snap.data();
    if (data?.importedFrom !== 'hubspot') {
      return res.status(403).json({
        ok: false,
        error: 'Cannot delete: this record was not imported from HubSpot. Only HubSpot-imported records can be removed here.',
      });
    }
    const hasHubspotId = typeof data?.hubspotId === 'string' && data.hubspotId.trim().length > 0;
    if (!hasHubspotId) {
      return res.status(403).json({
        ok: false,
        error: 'Cannot delete: record is not marked as HubSpot-originated (missing hubspotId).',
      });
    }

    await ref.delete();
    logHubspotDeleteAudit('delete-hubspot-contact', authResult.uid, { contactId, count: 1 });
    return res.status(200).json({ ok: true, deleted: contactId });
  } catch (err) {
    console.error('[delete-hubspot-contact] Error:', err);
    return res.status(500).json({ ok: false, error: err.message || 'Delete failed' });
  }
}
