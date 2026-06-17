/**
 * POST /api/create-events-from-deals
 *
 * Creates AlmaLinks past events from HubSpot deals already stored in Firestore.
 *
 * HUBSPOT SOURCE OF TRUTH (events):
 * - This flow assumes event registrations/activities in HubSpot are represented as DEALS
 *   in the HubSpot Deals pipeline. We sync deals via sync-hubspot-deals, then create
 *   one Alma event per deal here.
 * - If in your HubSpot setup event signups/RSVPs appear only as FORM SUBMISSIONS on the
 *   contact timeline (and not as Deals), this flow will not create events from them.
 *   In that case, event participation would need to be derived from HubSpot form
 *   submissions instead (not implemented here). We return a warning when no deals
 *   exist so you don't silently mis-track events.
 *
 * - Reads from collection: hubspotDeals (from sync-hubspot-deals).
 * - For each deal that does not already have an event (by hubspotDealId), creates
 *   a document in the events collection with status 'completed'.
 *
 * Auth: Same as sync-hubspot-deals (SYNC_SECRET or Bearer admin token).
 * When using Bearer token, createdBy is the admin's uid. When using x-sync-secret,
 * send { "adminUid": "<admin-firebase-uid>" } in the body so events have a createdBy.
 */

import '../firebase-init.js';
import admin from '../firebase-init.js';
import { db } from '../firebase-init.js';
import crypto from 'crypto';
import { authorize } from './hubspot-auth.js';

function generateSlug(name) {
  const base = (name || 'event')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
    .replace(/^-+|-+$/g, '') || 'event';
  return base;
}

/** Parse HubSpot date (ms or ISO string) to ISO date string for event.date */
function toEventDate(value) {
  if (!value) return null;
  const n = Number(value);
  const date = Number.isFinite(n) ? new Date(n) : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}


export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const authResult = await authorize(req);
  if (!authResult.ok) {
    return res.status(authResult.status).json({ ok: false, error: authResult.error });
  }

  const createdBy = authResult.uid || req.body?.adminUid;
  if (!createdBy || typeof createdBy !== 'string') {
    return res.status(400).json({
      ok: false,
      error: 'createdBy is required. When using x-sync-secret, send { "adminUid": "<firebase-uid>" } in the body.',
    });
  }

  if (!db) {
    return res.status(503).json({ ok: false, error: 'Firestore not available' });
  }

  const dealsCol = db.collection('hubspotDeals');
  const eventsCol = db.collection('events');

  try {
    const dealsSnap = await dealsCol.get();
    let created = 0;
    let skipped = 0;

    for (const dealDoc of dealsSnap.docs) {
      const hubspotDealId = dealDoc.id;
      const data = dealDoc.data();
      const props = data.properties || {};

      const dealname = props.dealname || `Deal ${hubspotDealId}`;
      const closedate = toEventDate(props.closedate);
      const createdate = toEventDate(props.createdate);
      const eventDate = closedate || createdate || new Date().toISOString();

      const existing = await eventsCol.where('hubspotDealId', '==', hubspotDealId).limit(1).get();
      if (!existing.empty) {
        skipped += 1;
        continue;
      }

      const eventId = crypto.randomBytes(6).toString('hex');
      const baseSlug = generateSlug(dealname);
      const slug = `${baseSlug}-${hubspotDealId}`;

      const now = admin.firestore.FieldValue.serverTimestamp();
      const eventDoc = {
        id: eventId,
        name: String(dealname),
        slug,
        location: '',
        date: eventDate,
        description: '',
        imageUrl: '',
        status: 'completed',
        createdBy,
        createdAt: now,
        updatedAt: now,
        autoConnectEnabled: true,
        hubspotDealId,
        importedFrom: 'hubspot',
        hubspotObjectType: 'event',
        hubspotId: hubspotDealId,
        importedAt: now,
      };

      await eventsCol.doc(eventId).set(eventDoc);
      created += 1;
    }

    const warnings = [];
    if (dealsSnap.size === 0) {
      warnings.push(
        'No HubSpot deals found. If event registrations in HubSpot are logged as form submissions (not Deals), events will not be created here. Consider using a Deals pipeline for events or pulling event participation from form submissions.'
      );
    }

    return res.status(200).json({
      ok: true,
      created,
      skipped,
      totalDeals: dealsSnap.size,
      warnings: warnings.length ? warnings : undefined,
    });
  } catch (err) {
    console.error('[create-events-from-deals] Error:', err);
    return res.status(500).json({
      ok: false,
      error: err.message || 'Create events failed',
    });
  }
}
