/**
 * POST /api/sync-hubspot-events
 *
 * Imports HubSpot events/activities into Firestore. NOTE: This is NOT the same as
 * "event registrations/RSVPs" in Alma. Here we sync:
 * - Primary: HubSpot **Events API (Event Analytics)** at /events/v3/events
 * - Fallback: HubSpot CRM activity objects (meetings, calls, notes, tasks, emails)
 *
 * For Alma "events" (past events page, event-based connections): we use HubSpot DEALS
 * via sync-hubspot-deals and create-events-from-deals. If your HubSpot logs event
 * signups as FORM SUBMISSIONS only (not Deals), those are the source of truth for
 * participation; this sync does not pull form submissions. See create-events-from-deals
 * for warnings when no deals exist.
 *
 * Firestore:
 * - Collection: hubspotEvents
 * - Doc ID: HubSpot event/engagement id (string)
 * - Data (minimum shape):
 *   { hubspotEventId, type, occurredAt, properties, associations, syncedAt }
 * - Writes use set(..., { merge: true }) for upsert semantics.
 *
 * Auth: SYNC_SECRET or Bearer admin token. Env: HUBSPOT_ACCESS_TOKEN (required).
 */

import '../firebase-init.js';
import admin from '../firebase-init.js';
import { db } from '../firebase-init.js';
import { authorize } from './hubspot-auth.js';

const HUBSPOT_EVENTS_URL = 'https://api.hubapi.com/events/v3/events';
const HUBSPOT_CRM_BASE = 'https://api.hubapi.com/crm/v3/objects';
const PAGE_LIMIT = 100;

// Fallback CRM activity object types we sync when Events API isn't available.
const CRM_OBJECT_TYPES = [
  { objectType: 'meetings', type: 'meeting' },
  { objectType: 'calls', type: 'call' },
  { objectType: 'notes', type: 'note' },
  { objectType: 'tasks', type: 'task' },
  { objectType: 'emails', type: 'email' },
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(url, options, maxRetries = 3) {
  let attempt = 0;
  let lastErr;
  while (attempt <= maxRetries) {
    const res = await fetch(url, options);
    if (res.status !== 429 && res.status < 500) {
      return res;
    }
    // Handle rate limits / transient errors with basic backoff.
    const retryAfterHeader = res.headers.get('Retry-After');
    const retryAfterMs = retryAfterHeader ? Number(retryAfterHeader) * 1000 : 1000 * Math.pow(2, attempt);
    await sleep(retryAfterMs);
    attempt += 1;
    lastErr = res;
  }
  return lastErr;
}

function safeParseDate(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return admin.firestore.Timestamp.fromDate(d);
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

  const eventsCol = db.collection('hubspotEvents');
  let totalUpserted = 0;
  const totalsByType = {};
  const warnings = [];

  const commonHeaders = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  // Helper to record per-type totals.
  const bumpType = (type) => {
    if (!totalsByType[type]) totalsByType[type] = 0;
    totalsByType[type] += 1;
  };

  // 1) Attempt to use HubSpot Events API (Event Analytics).
  let eventsApiUsed = false;
  try {
    let after = undefined;
    do {
      const params = new URLSearchParams();
      params.set('limit', String(PAGE_LIMIT));
      if (after) params.set('after', after);

      const url = `${HUBSPOT_EVENTS_URL}?${params.toString()}`;
      const hubRes = await fetchWithRetry(url, { method: 'GET', headers: commonHeaders });

      if (hubRes.status === 401 || hubRes.status === 403) {
        warnings.push(
          'HubSpot Events API (Event Analytics) is not available for this token/portal (401/403). Falling back to CRM activity objects.'
        );
        break;
      }

      if (!hubRes.ok) {
        const text = await hubRes.text();
        warnings.push(
          `HubSpot Events API returned ${hubRes.status}. Response: ${text.slice(0, 400)}. Falling back to CRM activity objects.`
        );
        break;
      }

      const data = await hubRes.json();
      const results = data.results || [];
      const next = data.paging?.next?.after;

      if (results.length === 0 && !next) {
        break;
      }

      eventsApiUsed = true;
      const batch = db.batch();

      for (const ev of results) {
        const docId = String(ev.id);
        const occurredAt =
          safeParseDate(ev.occurredAt) ||
          (ev.properties && safeParseDate(ev.properties.occurredAt)) ||
          null;

        const payload = {
          hubspotEventId: docId,
          type: 'event_analytics',
          occurredAt: occurredAt || null,
          properties: ev.properties || {},
          associations: ev.associations || ev.object || null,
          objectId: ev.objectId ?? null,
          objectType: ev.objectType ?? null,
          syncedAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        batch.set(eventsCol.doc(docId), payload, { merge: true });
        totalUpserted += 1;
        bumpType('event_analytics');
      }

      if (results.length > 0) {
        await batch.commit();
      }

      after = next || null;
      if (after) {
        await sleep(200);
      }
    } while (after);
  } catch (e) {
    console.error('[sync-hubspot-events] Events API failed:', e);
    warnings.push(`Events API failed: ${e.message || String(e)}`);
  }

  // 2) Fallback: CRM activity objects (meetings, calls, notes, tasks, emails, ...).
  if (!eventsApiUsed) {
    for (const { objectType, type } of CRM_OBJECT_TYPES) {
      try {
        let after = undefined;
        do {
          const params = new URLSearchParams();
          params.set('limit', String(PAGE_LIMIT));
          if (after) params.set('after', after);

          const url = `${HUBSPOT_CRM_BASE}/${objectType}?${params.toString()}`;
          const hubRes = await fetchWithRetry(url, { method: 'GET', headers: commonHeaders });

          if (hubRes.status === 401 || hubRes.status === 403) {
            warnings.push(
              `HubSpot CRM object "${objectType}" not accessible for this token (status ${hubRes.status}). Skipping.`
            );
            break;
          }

          if (!hubRes.ok) {
            const text = await hubRes.text();
            warnings.push(
              `HubSpot CRM object "${objectType}" returned ${hubRes.status}. Response: ${text.slice(
                0,
                400
              )}. Skipping this type.`
            );
            break;
          }

          const data = await hubRes.json();
          const results = data.results || [];
          const next = data.paging?.next?.after;

          if (results.length === 0 && !next) break;

          const batch = db.batch();

          for (const obj of results) {
            const docId = String(obj.id);
            const props = obj.properties || {};

            // Best-effort occurredAt: use hs_timestamp / start time / createdate / createdAt.
            const occurredAt =
              safeParseDate(props.hs_timestamp) ||
              safeParseDate(props.hs_meeting_start_time) ||
              safeParseDate(props.hs_email_opened_at) ||
              safeParseDate(props.hs_createdate) ||
              safeParseDate(obj.createdAt) ||
              null;

            const payload = {
              hubspotEventId: docId,
              type,
              occurredAt,
              properties: props,
              associations: obj.associations || null,
              syncedAt: admin.firestore.FieldValue.serverTimestamp(),
            };

            batch.set(eventsCol.doc(docId), payload, { merge: true });
            totalUpserted += 1;
            bumpType(type);
          }

          if (results.length > 0) {
            await batch.commit();
          }

          after = next || null;
          if (after) {
            await sleep(200);
          }
        } while (after);
      } catch (e) {
        console.error(`[sync-hubspot-events] Error syncing CRM object "${objectType}":`, e);
        warnings.push(
          `Error syncing CRM object "${objectType}": ${e.message || String(e)}`
        );
      }
    }
  }

  return res.status(200).json({
    ok: true,
    totalUpserted,
    totalsByType,
    warnings: warnings.length ? warnings : undefined,
  });
}

