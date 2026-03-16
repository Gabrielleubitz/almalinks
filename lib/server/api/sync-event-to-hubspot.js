/**
 * POST /api/sync-event-to-hubspot
 *
 * Creates or updates a HubSpot Deal for the given Alma event.
 * Called after event create (AddEvent) or event update (EditEvent).
 * If a new deal is created, the event document is updated with hubspotDealId.
 *
 * Body: { eventId: string }
 * Auth: Bearer Firebase ID token (admin only). Same token as sync-hubspot-deals.
 */

import '../firebase-init.js';
import admin from '../firebase-init.js';
import { db } from '../firebase-init.js';
import { authorize } from './hubspot-auth.js';
import { upsertHubspotDeal } from '../hubspot-deal-sync.js';

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

  console.log('[sync-event-to-hubspot] Sync requested for eventId:', eventId, 'HUBSPOT_ACCESS_TOKEN set:', !!process.env.HUBSPOT_ACCESS_TOKEN);

  if (!db) {
    return res.status(503).json({ ok: false, error: 'Database not available' });
  }

  try {
    const eventRef = db.collection('events').doc(eventId);
    const snap = await eventRef.get();
    if (!snap.exists) {
      return res.status(404).json({ ok: false, error: 'Event not found' });
    }

    const eventData = { id: eventId, ...snap.data() };

    // Fetch privateDetails (locationText, meetingUrl, etc.) for full mapping
    try {
      const privateSnap = await eventRef.collection('privateDetails').doc('details').get();
      if (privateSnap.exists) {
        const priv = privateSnap.data() || {};
        eventData.locationText = priv.locationText || eventData.location;
        eventData.meetingUrl = priv.meetingUrl || null;
        eventData.resourceLinkUrl = priv.resourceLinkUrl || null;
        eventData.resourceLinkLabel = priv.resourceLinkLabel || null;
      }
    } catch (privErr) {
      console.warn('[sync-event-to-hubspot] Could not fetch privateDetails (non-blocking):', privErr?.message || privErr);
    }

    const result = await upsertHubspotDeal(eventData);

    if (!result.ok) {
      console.error('[sync-event-to-hubspot] HubSpot API rejected event sync:', eventId, result.error);
      return res.status(200).json({
        ok: false,
        synced: false,
        error: result.error,
      });
    }

    if (result.hubspotDealId && !eventData.hubspotDealId) {
      await eventRef.set({ hubspotDealId: result.hubspotDealId, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    }

    return res.status(200).json({
      ok: true,
      synced: true,
      hubspotDealId: result.hubspotDealId,
      path: result.path,
    });
  } catch (err) {
    console.error('[sync-event-to-hubspot] Error:', err);
    return res.status(500).json({
      ok: false,
      error: err.message || 'Sync failed',
    });
  }
}
