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

    // Fetch complete event document from Firestore
    const raw = snap.data() || {};
    const eventData = { id: eventId, ...raw };

    // Normalize date for HubSpot (ms or ISO string). Firestore Timestamp has .toDate()
    const dateVal = raw.date;
    if (dateVal && typeof dateVal.toDate === 'function') {
      eventData.date = dateVal.toDate().toISOString();
    } else if (dateVal && typeof dateVal.toMillis === 'function') {
      eventData.date = dateVal.toMillis();
    }

    // Fetch privateDetails (locationText, meetingUrl, zoom_link, zoom_password, pictures_link, etc.)
    try {
      const privateSnap = await eventRef.collection('privateDetails').doc('details').get();
      if (privateSnap.exists) {
        const priv = privateSnap.data() || {};
        eventData.locationText = priv.locationText || eventData.location;
        eventData.meetingUrl = priv.meetingUrl || eventData.meetingUrl || null;
        eventData.resourceLinkUrl = priv.resourceLinkUrl || null;
        eventData.resourceLinkLabel = priv.resourceLinkLabel || null;
        // zoom_link (Zoom Recording URL)
        eventData.zoomRecordingUrl = priv.zoomRecordingUrl || priv.zoom_recording_url || priv.zoomLink || raw.zoomRecordingUrl || raw.zoom_recording_url || raw.zoomLink || '';
        // zoom_password
        eventData.zoomPassword = priv.zoomPassword || priv.zoom_password || raw.zoomPassword || raw.zoom_password || '';
        // pictures_link
        eventData.picturesUrl = priv.picturesUrl || priv.pictures_url || raw.picturesUrl || raw.pictures_url || '';
      }
    } catch (privErr) {
      console.warn('[sync-event-to-hubspot] Could not fetch privateDetails (non-blocking):', privErr?.message || privErr);
    }

    // Chapter from event doc (e.g. Tel Aviv)
    eventData.chapter = raw.chapter ?? eventData.chapter ?? '';

    // Compute attendedCount and rsvpCount from registrations
    try {
      const regsSnap = await eventRef.collection('registrations').get();
      const totalRegs = regsSnap.docs.length;
      const attendedCount = regsSnap.docs.filter((d) => (d.data()?.checkedIn === true)).length;
      eventData.attendedCount = attendedCount;
      eventData.rsvpCount = totalRegs;
    } catch (regErr) {
      console.warn('[sync-event-to-hubspot] Could not fetch registrations (non-blocking):', regErr?.message || regErr);
      eventData.attendedCount = 0;
      eventData.rsvpCount = 0;
    }

    // Ensure fallbacks for missing fields (empty string or 0)
    if (eventData.attendedCount == null) eventData.attendedCount = 0;
    if (eventData.rsvpCount == null) eventData.rsvpCount = 0;
    if (eventData.zoomRecordingUrl == null) eventData.zoomRecordingUrl = '';
    if (eventData.zoomPassword == null) eventData.zoomPassword = '';
    if (eventData.picturesUrl == null) eventData.picturesUrl = '';
    if (eventData.chapter == null) eventData.chapter = '';

    console.log('[sync-event-to-hubspot] Full event object from database:', JSON.stringify(eventData, null, 2));

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
