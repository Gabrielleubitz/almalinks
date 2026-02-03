/**
 * POST /api/sync-hubspot-deals
 *
 * Imports ALL HubSpot deals (pipeline records) into Firestore.
 *
 * - HubSpot CRM v3 Deals API:
 *   GET https://api.hubapi.com/crm/v3/objects/deals
 *   Query params:
 *     - limit=100
 *     - properties=dealname,amount,dealstage,pipeline,closedate,createdate
 *     - after=<cursor> for pagination
 *
 * Firestore:
 * - Collection: hubspotDeals
 * - Doc ID: HubSpot deal id (string)
 * - Data shape (minimum):
 *   {
 *     hubspotDealId: string,
 *     properties: { ...raw properties from HubSpot },
 *     syncedAt: server timestamp
 *   }
 * - Writes are upserts using set(..., { merge: true }).
 *
 * Auth protection (same pattern as sync-hubspot-contacts):
 * - If SYNC_SECRET is set in env, require header x-sync-secret: <SYNC_SECRET>.
 * - Otherwise require Firebase Auth ID token for an admin user
 *   (Authorization: Bearer <idToken>, role === 'admin' or admin === true).
 *
 * Env:
 * - HUBSPOT_ACCESS_TOKEN (required) – server-side only.
 * - SYNC_SECRET (optional) – see above.
 */

import '../firebase-init.js';
import admin from '../firebase-init.js';
import { db } from '../firebase-init.js';

const HUBSPOT_DEALS_URL = 'https://api.hubapi.com/crm/v3/objects/deals';
const PAGE_LIMIT = 100;
const DEAL_PROPERTIES = [
  'dealname',
  'amount',
  'dealstage',
  'pipeline',
  'closedate',
  'createdate',
];

async function authorize(req) {
  const syncSecret = process.env.SYNC_SECRET;
  if (syncSecret && syncSecret.trim()) {
    const headerSecret = req.headers['x-sync-secret'];
    if (headerSecret === syncSecret) return { ok: true };
    return { ok: false, status: 401, error: 'Invalid or missing x-sync-secret' };
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { ok: false, status: 401, error: 'Unauthorized' };
  }

  const idToken = authHeader.replace('Bearer ', '').trim();
  if (!idToken) return { ok: false, status: 401, error: 'Missing token' };

  if (!admin?.apps?.length) {
    return { ok: false, status: 503, error: 'Firebase not configured' };
  }

  let decoded;
  try {
    decoded = await admin.auth().verifyIdToken(idToken);
  } catch (e) {
    return { ok: false, status: 401, error: 'Invalid or expired token' };
  }
  const isAdmin = decoded.role === 'admin' || decoded.admin === true;
  if (!isAdmin) return { ok: false, status: 403, error: 'Admin required' };
  return { ok: true };
}

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

  const token = process.env.HUBSPOT_ACCESS_TOKEN;
  if (!token || !token.trim()) {
    return res.status(503).json({
      ok: false,
      error: 'HUBSPOT_ACCESS_TOKEN is not set. Add it in Vercel (or .env) and redeploy.',
    });
  }

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

        batch.set(
          dealsCol.doc(docId),
          {
            hubspotDealId: docId,
            properties: props,
            syncedAt: admin.firestore.FieldValue.serverTimestamp(),
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

