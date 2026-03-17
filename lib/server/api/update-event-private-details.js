/**
 * POST /api/update-event-private-details
 *
 * Updates event private details (locationText, meetingUrl, resourceLinkUrl, resourceLinkLabel)
 * using Admin SDK. Bypasses client Firestore rules that may reject the write.
 *
 * Body: { eventId: string, locationText?: string, meetingUrl?: string | null, resourceLinkUrl?: string | null, resourceLinkLabel?: string | null }
 * Auth: Bearer Firebase ID token (admin only).
 */

import '../firebase-init.js';
import admin from '../firebase-init.js';
import { db } from '../firebase-init.js';
import { authorize } from './hubspot-auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const authResult = await authorize(req);
  if (!authResult.ok) {
    return res.status(authResult.status).json({ ok: false, error: authResult.error });
  }

  const eventId = (req.body?.eventId || '').toString().trim();
  if (!eventId) {
    return res.status(400).json({ ok: false, error: 'eventId is required' });
  }

  if (!db) {
    return res.status(503).json({ ok: false, error: 'Database not available' });
  }

  try {
    const ref = db.collection('events').doc(eventId).collection('privateDetails').doc('details');
    const data = {
      locationText: (req.body?.locationText ?? '').toString().trim(),
      meetingUrl: (req.body?.meetingUrl ?? '').toString().trim() || null,
      resourceLinkUrl: (req.body?.resourceLinkUrl ?? '').toString().trim() || null,
      resourceLinkLabel: (req.body?.resourceLinkLabel ?? '').toString().trim() || null,
      zoomRecordingUrl: (req.body?.zoomRecordingUrl ?? '').toString().trim() || null,
      zoomPassword: (req.body?.zoomPassword ?? '').toString().trim() || null,
      picturesUrl: (req.body?.picturesUrl ?? '').toString().trim() || null,
    };
    await ref.set(data, { merge: true });
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[update-event-private-details] Error:', err);
    return res.status(500).json({ ok: false, error: err.message || 'Update failed' });
  }
}
