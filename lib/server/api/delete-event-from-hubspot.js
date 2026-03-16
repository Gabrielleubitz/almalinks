/**
 * POST /api/delete-event-from-hubspot
 *
 * Deletes the HubSpot Deal associated with an Alma event.
 * Called when an event is deleted so the corresponding deal is removed from HubSpot.
 *
 * Body: { eventId?: string, hubspotDealId?: string } — at least one required.
 * If eventId is provided, fetches the event to get hubspotDealId (no-op if event has no deal).
 * If hubspotDealId is provided directly, deletes that deal.
 *
 * Auth: Bearer Firebase ID token (admin only).
 */

import '../firebase-init.js';
import { db } from '../firebase-init.js';
import { authorize } from './hubspot-auth.js';
import { deleteHubspotDeal } from '../hubspot-deal-sync.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const authResult = await authorize(req);
  if (!authResult.ok) {
    return res.status(authResult.status).json({ ok: false, error: authResult.error });
  }

  const eventId = (req.body?.eventId || '').toString().trim();
  const hubspotDealId = (req.body?.hubspotDealId || '').toString().trim();

  let dealIdToDelete = hubspotDealId;

  if (!dealIdToDelete && eventId) {
    if (!db) {
      return res.status(503).json({ ok: false, error: 'Database not available' });
    }
    const eventSnap = await db.collection('events').doc(eventId).get();
    if (eventSnap.exists) {
      dealIdToDelete = (eventSnap.data()?.hubspotDealId || '').toString().trim() || null;
    }
  }

  if (!dealIdToDelete) {
    return res.status(200).json({
      ok: true,
      deleted: false,
      message: eventId ? 'Event has no linked HubSpot deal' : 'No hubspotDealId provided',
    });
  }

  try {
    const result = await deleteHubspotDeal(dealIdToDelete);
    if (!result.ok) {
      return res.status(200).json({
        ok: true,
        deleted: false,
        error: result.error,
      });
    }
    return res.status(200).json({
      ok: true,
      deleted: true,
      hubspotDealId: dealIdToDelete,
    });
  } catch (err) {
    console.error('[delete-event-from-hubspot] Error:', err);
    return res.status(500).json({
      ok: false,
      error: err.message || 'Delete failed',
    });
  }
}
