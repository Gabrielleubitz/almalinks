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
import { getHubspotToken } from './hubspot-auth.js';
import { upsertHubspotDeal } from '../hubspot-deal-sync.js';
import { findContactByEmail } from '../hubspot-contact-sync.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const authResult = await authorize(req);
  if (!authResult.ok) {
    const hint =
      authResult.status === 503
        ? 'Set HUBSPOT_ACCESS_TOKEN in Vercel → Environment Variables, then redeploy.'
        : undefined;
    return res.status(authResult.status).json({ ok: false, synced: false, error: authResult.error, hint });
  }

  const tokenCheck = getHubspotToken();
  if (!tokenCheck.ok) {
    return res.status(503).json({
      ok: false,
      synced: false,
      error: tokenCheck.error,
      hint: 'Set HUBSPOT_ACCESS_TOKEN in Vercel → Environment Variables, then redeploy.',
    });
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

    // Pull chapter, zoom from event doc first (may be on main doc)
    eventData.chapter = (raw.chapter ?? eventData.chapter ?? '').toString().trim();
    eventData.zoomRecordingUrl = (raw.zoomRecordingUrl ?? raw.zoom_recording_url ?? raw.zoomLink ?? eventData.zoomRecordingUrl ?? '').toString().trim();
    eventData.zoomPassword = (raw.zoomPassword ?? raw.zoom_password ?? eventData.zoomPassword ?? '').toString().trim();
    // Pictures link: use event image (not separate field)
    eventData.picturesUrl = (raw.imageUrl ?? raw.image_url ?? raw.picturesUrl ?? raw.pictures_url ?? eventData.picturesUrl ?? '').toString().trim();

    // Fetch privateDetails (overrides with locationText, meetingUrl, zoom_link, zoom_password)
    try {
      const privateSnap = await eventRef.collection('privateDetails').doc('details').get();
      if (privateSnap.exists) {
        const priv = privateSnap.data() || {};
        eventData.locationText = priv.locationText || eventData.location;
        eventData.meetingUrl = priv.meetingUrl || eventData.meetingUrl || null;
        eventData.resourceLinkUrl = priv.resourceLinkUrl || null;
        eventData.resourceLinkLabel = priv.resourceLinkLabel || null;
        const privZoom = (priv.zoomRecordingUrl ?? priv.zoom_recording_url ?? priv.zoomLink ?? '').toString().trim();
        const privPw = (priv.zoomPassword ?? priv.zoom_password ?? '').toString().trim();
        if (privZoom) eventData.zoomRecordingUrl = privZoom;
        if (privPw) eventData.zoomPassword = privPw;
      }
    } catch (privErr) {
      console.warn('[sync-event-to-hubspot] Could not fetch privateDetails (non-blocking):', privErr?.message || privErr);
    }

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
      const tokenSet = Boolean((process.env.HUBSPOT_ACCESS_TOKEN || '').trim());
      const pipeline = (process.env.HUBSPOT_DEAL_PIPELINE || 'default').trim();
      const stage = (process.env.HUBSPOT_DEAL_STAGE || 'appointmentscheduled').trim();
      let hint = tokenSet
        ? `Check HUBSPOT_DEAL_PIPELINE (${pipeline}) and HUBSPOT_DEAL_STAGE (${stage}) match HubSpot, and that event chapter is a valid HubSpot value.`
        : 'Set HUBSPOT_ACCESS_TOKEN in Vercel → Environment Variables, then redeploy.';
      if (result.error && /not set|HUBSPOT_ACCESS_TOKEN/i.test(result.error)) {
        hint = 'Set HUBSPOT_ACCESS_TOKEN in Vercel → Environment Variables, then redeploy.';
      }
      return res.status(200).json({
        ok: false,
        synced: false,
        error: result.error,
        hint,
      });
    }

    if (result.hubspotDealId && !eventData.hubspotDealId) {
      await eventRef.set({ hubspotDealId: result.hubspotDealId, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    }

    // Associate checked-in contacts with the HubSpot deal
    const dealId = result.hubspotDealId;
    if (dealId) {
      try {
        const tokenResult = getHubspotToken();
        if (tokenResult.ok) {
          const regsSnap = await eventRef.collection('registrations').get();
          const checkedInRegs = regsSnap.docs.filter((d) => d.data()?.checkedIn === true);
          const checkedInEmails = [...new Set(checkedInRegs.map((d) => (d.data()?.email || '').toString().trim().toLowerCase()).filter(Boolean))];
          for (const email of checkedInEmails) {
            const contact = await findContactByEmail(tokenResult.token, email);
            if (contact?.id) {
              const assocUrl = `https://api.hubapi.com/crm/v4/objects/deals/${dealId}/associations/default/contacts/${contact.id}`;
              const assocRes = await fetch(assocUrl, {
                method: 'PUT',
                headers: { Authorization: `Bearer ${tokenResult.token}`, 'Content-Type': 'application/json' },
              });
              if (!assocRes.ok) {
                console.warn('[sync-event-to-hubspot] Could not associate contact with deal:', email, assocRes.status);
              }
            }
          }
        }
      } catch (assocErr) {
        console.warn('[sync-event-to-hubspot] Contact association failed (non-blocking):', assocErr?.message || assocErr);
      }
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
