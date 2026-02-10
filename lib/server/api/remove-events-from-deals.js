/**
 * POST /api/remove-events-from-deals
 *
 * Deletes ONLY events that were created from HubSpot deals: query where importedFrom === 'hubspot'.
 * Never deletes native events. Auth: admin Bearer or x-sync-secret.
 */

import '../firebase-init.js';
import { db } from '../firebase-init.js';
import { authorize } from './hubspot-auth.js';
import { logHubspotDeleteAudit } from './hubspot-delete-audit.js';

const BATCH_SIZE = 500;

async function deleteQueryBatch(query) {
  const snapshot = await query.get();
  let deleted = 0;
  for (let i = 0; i < snapshot.docs.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const chunk = snapshot.docs.slice(i, i + BATCH_SIZE);
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
  try {
    const deleted = await deleteQueryBatch(
      db.collection('events').where('importedFrom', '==', 'hubspot')
    );
    logHubspotDeleteAudit('remove-events-from-deals', authResult.uid, { events: deleted });
    return res.status(200).json({ ok: true, deleted });
  } catch (err) {
    console.error('[remove-events-from-deals] Error:', err);
    return res.status(500).json({ ok: false, error: err.message || 'Remove failed' });
  }
}
