/**
 * POST /api/sync-hubspot-deals
 *
 * Imports ALL HubSpot deals into Firestore. GET deals (limit=100, paging.next.after).
 * Firestore: hubspotDeals, docId = deal.id, set(..., { merge: true }).
 * Schema: { hubspotDealId, properties, syncedAt }.
 *
 * HUBSPOT EVENTS SOURCE: Event import (create-events-from-deals) uses this collection.
 * If your HubSpot only logs event registrations/RSVPs as form submissions (contact
 * timeline), not as Deals, sync-hubspot-events and create-events-from-deals will not
 * reflect those; event participation would need to come from form submissions (see
 * create-events-from-deals for warnings when no deals exist).
 *
 * Auth: Firebase Admin (Bearer) OR x-sync-secret. Token: HUBSPOT_ACCESS_TOKEN (server env only).
 */

import '../firebase-init.js';
import admin from '../firebase-init.js';
import { db } from '../firebase-init.js';
import { authorize, getHubspotToken } from './hubspot-auth.js';

const HUBSPOT_DEALS_URL = 'https://api.hubapi.com/crm/v3/objects/deals';
const PAGE_LIMIT = 100;
const DEAL_PROPERTIES = [
  'dealname',
  'amount',
  'dealstage',
  'pipeline',
  'closedate',
  'createdate',
  'date',
  'year',
  'chapter',
  'speaker',
  'description',
  'pictures_link',
  'zoom_link',
  'zoom_password',
  'rsvp',
  'attended',
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(url, options, maxRetries = 3) {
  let attempt = 0;
  let lastRes;
  while (attempt <= maxRetries) {
    const res = await fetch(url, options);
    if (res.status !== 429 && res.status < 500) {
      return res;
    }
    const retryAfterHeader = res.headers.get('Retry-After');
    const retryAfterMs = retryAfterHeader ? Number(retryAfterHeader) * 1000 : 1000 * Math.pow(2, attempt);
    await sleep(retryAfterMs);
    attempt += 1;
    lastRes = res;
  }
  return lastRes;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const authResult = await authorize(req);
  if (!authResult.ok) {
    return res.status(authResult.status).json({ ok: false, error: authResult.error });
  }

  const tokenResult = getHubspotToken();
  if (!tokenResult.ok) {
    return res.status(tokenResult.status).json({ ok: false, error: tokenResult.error });
  }
  const token = tokenResult.token;

  if (!db) {
    return res.status(503).json({ ok: false, error: 'Firestore not available' });
  }

  const dealsCol = db.collection('hubspotDeals');
  let totalUpserted = 0;
  let after = undefined;

  try {
    do {
      const params = new URLSearchParams();
      params.set('limit', String(PAGE_LIMIT));
      DEAL_PROPERTIES.forEach((p) => params.append('properties', p));
      if (after) params.set('after', after);

      const url = `${HUBSPOT_DEALS_URL}?${params.toString()}`;
      const hubRes = await fetchWithRetry(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!hubRes.ok) {
        const text = await hubRes.text().catch(() => '');
        console.error('[sync-hubspot-deals] HubSpot API error:', hubRes.status, text);
        return res.status(502).json({
          ok: false,
          error: `HubSpot Deals API error: ${hubRes.status}`,
          details: text.slice(0, 500),
        });
      }

      const data = await hubRes.json();
      const results = data.results || [];
      const next = data.paging?.next?.after;

      if (results.length === 0 && !next) break;

      const batch = db.batch();

      for (const deal of results) {
        const docId = String(deal.id);
        const props = deal.properties || {};

        const now = admin.firestore.FieldValue.serverTimestamp();
        batch.set(
          dealsCol.doc(docId),
          {
            hubspotDealId: docId,
            hubspotId: docId,
            properties: props,
            syncedAt: now,
            importedFrom: 'hubspot',
            hubspotObjectType: 'deal',
            importedAt: now,
          },
          { merge: true }
        );

        totalUpserted += 1;
      }

      if (results.length > 0) {
        await batch.commit();
      }

      after = next || null;
      if (after) {
        await sleep(200);
      }
    } while (after);

    return res.status(200).json({ ok: true, totalUpserted });
  } catch (err) {
    console.error('[sync-hubspot-deals] Error:', err);
    return res.status(500).json({
      ok: false,
      error: err.message || 'Sync failed',
    });
  }
}

