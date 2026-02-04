/**
 * GET /api/hubspot-contacts
 * Returns all documents from Firestore hubspotContacts (for admin UI list).
 * Auth: Firebase Admin (Bearer) OR x-sync-secret.
 */

import '../firebase-init.js';
import { db } from '../firebase-init.js';
import { authorize } from './hubspot-auth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
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
    const snap = await db.collection('hubspotContacts').get();
    const contacts = snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));
    return res.status(200).json({ ok: true, contacts });
  } catch (err) {
    console.error('[list-hubspot-contacts] Error:', err);
    return res.status(500).json({ ok: false, error: err.message || 'List failed' });
  }
}
