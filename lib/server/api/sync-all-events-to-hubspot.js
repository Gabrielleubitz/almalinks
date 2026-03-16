/**
 * POST /api/sync-all-events-to-hubspot
 *
 * Syncs all Alma events that don't have hubspotDealId to HubSpot Deals.
 * Use this to backfill events created before the sync was working.
 *
 * Auth: Bearer Firebase ID token (admin only).
 */

import '../firebase-init.js';
import { db } from '../firebase-init.js';
import admin from '../firebase-init.js';
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

  if (!db) {
    return res.status(503).json({ ok: false, error: 'Database not available' });
  }

  try {
    const snapshot = await db.collection('events').get();
    const events = snapshot.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((e) => !(e.hubspotDealId || '').toString().trim());

    const results = { synced: 0, failed: 0, errors: [] };
    for (const event of events) {
      const result = await upsertHubspotDeal(event);
      if (result.ok && result.hubspotDealId) {
        await db.collection('events').doc(event.id).set(
          { hubspotDealId: result.hubspotDealId, updatedAt: admin.firestore.FieldValue.serverTimestamp() },
          { merge: true }
        );
        results.synced++;
      } else {
        results.failed++;
        results.errors.push({ eventId: event.id, name: event.name, error: result.error || 'Unknown' });
      }
    }

    return res.status(200).json({
      ok: true,
      total: events.length,
      synced: results.synced,
      failed: results.failed,
      errors: results.errors.slice(0, 10),
    });
  } catch (err) {
    console.error('[sync-all-events-to-hubspot] Error:', err);
    return res.status(500).json({
      ok: false,
      error: err.message || 'Sync failed',
    });
  }
}
