/**
 * POST /api/create-events-from-deals
 *
 * Creates or updates AlmaLinks past events from HubSpot deals in Firestore hubspotDeals.
 *
 * Body (optional):
 *   { year?: "2026", updateExisting?: boolean }  — default updateExisting=true
 *
 * Auth: SYNC_SECRET or Bearer admin token.
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

/** HubSpot deal chapter values (contacts have more options than deals). */
const HUBSPOT_DEAL_CHAPTER_ALLOWED = new Set([
  'New York', 'Tel Aviv', 'Johannesburg', 'London', 'Mexico City',
  'Philadelphia', 'Sydney', 'Costa Rica',
]);
const CHAPTER_VALUE_MAP = {
  'new york': 'New York',
  'tel aviv': 'Tel Aviv',
  'johannesburg': 'Johannesburg',
  'london': 'London',
  'mexico city': 'Mexico City',
  'philadelphia': 'Philadelphia',
  'sydney': 'Sydney',
  'costa rica': 'Costa Rica',
};

function normalizeChapter(value) {
  if (value == null || typeof value !== 'string') return '';
  const raw = String(value).trim();
  if (!raw) return '';
  if (HUBSPOT_DEAL_CHAPTER_ALLOWED.has(raw)) return raw;
  const mapped = CHAPTER_VALUE_MAP[raw.toLowerCase()];
  return mapped && HUBSPOT_DEAL_CHAPTER_ALLOWED.has(mapped) ? mapped : '';
}

/** Prefer HubSpot custom event `date`, then closedate, then createdate, then year-only fallback. */
function pickEventDate(props) {
  const fromDate = toEventDate(props?.date);
  if (fromDate) return fromDate;
  const fromClose = toEventDate(props?.closedate);
  if (fromClose) return fromClose;
  const fromCreate = toEventDate(props?.createdate);
  if (fromCreate) return fromCreate;
  const year = parseInt(String(props?.year ?? '').trim(), 10);
  if (Number.isFinite(year) && year >= 2000 && year <= 2100) {
    return new Date(Date.UTC(year, 0, 1, 12, 0, 0)).toISOString();
  }
  return new Date().toISOString();
}

function eventYearFromProps(props) {
  const y = parseInt(String(props?.year ?? '').trim(), 10);
  if (Number.isFinite(y)) return y;
  const iso = pickEventDate(props);
  if (!iso) return null;
  return new Date(iso).getUTCFullYear();
}

function dealMatchesYearFilter(props, yearFilter) {
  if (!yearFilter) return true;
  const want = parseInt(String(yearFilter).trim(), 10);
  if (!Number.isFinite(want)) return true;
  const got = eventYearFromProps(props);
  return got === want;
}

function buildEventFieldsFromDeal(props, dealname) {
  const chapter = normalizeChapter(props.chapter);
  const zoomLink = String(props.zoom_link || '').trim();
  const speakerName = String(props.speaker || '').trim();
  const imageUrl = String(props.pictures_link || '').trim();
  const description = String(props.description || '').trim();
  const location = chapter || '';
  const eventFormat = zoomLink ? 'virtual' : (chapter ? 'in_person' : null);

  return {
    name: String(dealname),
    date: pickEventDate(props),
    description,
    imageUrl,
    location,
    status: 'completed',
    ...(chapter ? { chapter } : {}),
    ...(speakerName ? { speakerName } : {}),
    ...(eventFormat ? { eventFormat } : {}),
    ...(props.year ? { hubspotYear: String(props.year).trim() } : {}),
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const authResult = await authorize(req);
  if (!authResult.ok) {
    return res.status(authResult.status).json({ ok: false, error: authResult.error });
  }

  const body = typeof req.body === 'object' && req.body !== null ? req.body : {};
  const createdBy = authResult.uid || body.adminUid;
  if (!createdBy || typeof createdBy !== 'string') {
    return res.status(400).json({
      ok: false,
      error: 'createdBy is required. When using x-sync-secret, send { "adminUid": "<firebase-uid>" } in the body.',
    });
  }

  const yearFilter = body.year != null ? String(body.year).trim() : '';
  const updateExisting = body.updateExisting !== false;

  if (!db) {
    return res.status(503).json({ ok: false, error: 'Firestore not available' });
  }

  const dealsCol = db.collection('hubspotDeals');
  const eventsCol = db.collection('events');

  try {
    const [dealsSnap, eventsSnap] = await Promise.all([
      dealsCol.get(),
      eventsCol.get(),
    ]);

    // Map hubspotDealId -> existing event doc (avoid N+1 queries per deal).
    const eventByDealId = new Map();
    for (const evDoc of eventsSnap.docs) {
      const dealId = String(evDoc.data()?.hubspotDealId || '').trim();
      if (dealId) eventByDealId.set(dealId, evDoc);
    }

    let created = 0;
    let updated = 0;
    let skipped = 0;
    let filteredOut = 0;
    const now = admin.firestore.FieldValue.serverTimestamp();

    for (const dealDoc of dealsSnap.docs) {
      const hubspotDealId = dealDoc.id;
      const data = dealDoc.data();
      const props = data.properties || {};

      if (!dealMatchesYearFilter(props, yearFilter)) {
        filteredOut += 1;
        continue;
      }

      const dealname = props.dealname || `Deal ${hubspotDealId}`;
      const fields = buildEventFieldsFromDeal(props, dealname);
      const existingDoc = eventByDealId.get(hubspotDealId);

      if (existingDoc) {
        if (!updateExisting) {
          skipped += 1;
          continue;
        }
        await existingDoc.ref.set(
          { ...fields, updatedAt: now, hubspotDealId, importedFrom: 'hubspot' },
          { merge: true }
        );
        updated += 1;
        continue;
      }

      const eventId = crypto.randomBytes(6).toString('hex');
      const baseSlug = generateSlug(dealname);
      const slug = `${baseSlug}-${hubspotDealId}`;

      const eventDoc = {
        id: eventId,
        slug,
        ...fields,
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
        'No HubSpot deals found in Firestore. Run "Import HubSpot Deals" first (or "Import 2026 events" for a targeted pull).'
      );
    } else if (created === 0 && updated === 0 && yearFilter) {
      warnings.push(
        `No deals matched year ${yearFilter} in hubspotDeals. Try "Import 2026 events" to pull ${yearFilter} deals from HubSpot first.`
      );
    }

    return res.status(200).json({
      ok: true,
      created,
      updated,
      skipped,
      filteredOut,
      totalDeals: dealsSnap.size,
      yearFilter: yearFilter || undefined,
      updateExisting,
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
