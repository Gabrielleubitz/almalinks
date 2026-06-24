/**
 * HubSpot Deal sync: create or update a HubSpot Deal from an Alma event.
 * Mirrors the contact sync pattern (hubspot-contact-sync.js). Uses HUBSPOT_ACCESS_TOKEN.
 * HubSpot auto-assigns to default pipeline when pipeline/dealstage not specified.
 *
 * Identity: event.hubspotDealId (stored on event after first create) or create new.
 */

import { getHubspotToken } from './api/hubspot-auth.js';

const HUBSPOT_DEALS_URL = 'https://api.hubapi.com/crm/v3/objects/deals';

/** Alma event ID property. Only sent if explicitly set (create the property in HubSpot first, then set this env var). */
const ALMA_EVENT_ID_PROPERTY = (typeof process !== 'undefined' && process.env?.HUBSPOT_DEAL_PROPERTY_ALMA_EVENT_ID) ? String(process.env.HUBSPOT_DEAL_PROPERTY_ALMA_EVENT_ID).trim() : '';

/** Required: pipeline and dealstage. HubSpot Deals require these. Override via env. */
const DEFAULT_PIPELINE = (typeof process !== 'undefined' && process.env?.HUBSPOT_DEAL_PIPELINE) ? String(process.env.HUBSPOT_DEAL_PIPELINE).trim() : 'default';
const DEFAULT_DEAL_STAGE = (typeof process !== 'undefined' && process.env?.HUBSPOT_DEAL_STAGE) ? String(process.env.HUBSPOT_DEAL_STAGE).trim() : 'appointmentscheduled';

/**
 * HubSpot DEAL chapter enumeration: allowed values (must match exactly).
 * Note: the deal `chapter` property has fewer options than the contact one —
 * it does NOT include Toronto or International.
 */
const HUBSPOT_CHAPTER_ALLOWED = new Set([
  'New York', 'Tel Aviv', 'Johannesburg', 'London', 'Mexico City',
  'Philadelphia', 'Sydney', 'Costa Rica',
]);
const CHAPTER_VALUE_MAP = {
  'new york': 'New York', 'newyork': 'New York',
  'tel aviv': 'Tel Aviv', 'tel-aviv': 'Tel Aviv', 'telaviv': 'Tel Aviv',
  'johannesburg': 'Johannesburg', 'johannesberg': 'Johannesburg',
  'london': 'London',
  'mexico city': 'Mexico City', 'mexicocity': 'Mexico City',
  'philadelphia': 'Philadelphia', 'philly': 'Philadelphia',
  'sydney': 'Sydney',
  'costa rica': 'Costa Rica', 'costarica': 'Costa Rica',
};
/** Convert slugified value (e.g. 'tel-aviv') to display name (e.g. 'Tel Aviv') - exact HubSpot enum format */
function slugToDisplay(slug) {
  if (!slug || typeof slug !== 'string') return '';
  return slug.replace(/-/g, ' ').split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ').trim();
}

function normalizeChapter(value) {
  if (value == null || typeof value !== 'string') return '';
  const raw = String(value).trim();
  if (!raw) return '';
  if (HUBSPOT_CHAPTER_ALLOWED.has(raw)) return raw;
  const key = raw.toLowerCase();
  const fromMap = CHAPTER_VALUE_MAP[key];
  if (fromMap && HUBSPOT_CHAPTER_ALLOWED.has(fromMap)) return fromMap;
  const fromSlug = slugToDisplay(raw);
  if (fromSlug && HUBSPOT_CHAPTER_ALLOWED.has(fromSlug)) return fromSlug;
  return '';
}

/**
 * Normalize Alma status variants to a stable HubSpot-facing value.
 * Supports both legacy statuses (active/non-active) and UI labels (public/hidden).
 */
function normalizeEventStatus(value) {
  if (value == null) return '';
  const raw = String(value).trim().toLowerCase();
  if (!raw) return '';

  if (raw === 'active' || raw === 'public') return 'public';
  if (raw === 'non-active' || raw === 'non_active' || raw === 'hidden') return 'hidden';
  if (raw === 'sold-out' || raw === 'sold out' || raw === 'sold_out') return 'sold-out';
  if (raw === 'completed' || raw === 'complete') return 'completed';
  return '';
}

/** Optional custom property names from env */
const CUSTOM_PROP_LOCATION = (typeof process !== 'undefined' && process.env?.HUBSPOT_DEAL_PROPERTY_LOCATION) ? String(process.env.HUBSPOT_DEAL_PROPERTY_LOCATION).trim() : '';
const CUSTOM_PROP_DESCRIPTION = (typeof process !== 'undefined' && process.env?.HUBSPOT_DEAL_PROPERTY_DESCRIPTION) ? String(process.env.HUBSPOT_DEAL_PROPERTY_DESCRIPTION).trim() : '';
const CUSTOM_PROP_CEO_GUEST_LIST = (typeof process !== 'undefined' && process.env?.HUBSPOT_DEAL_PROPERTY_CEO_GUEST_LIST) ? String(process.env.HUBSPOT_DEAL_PROPERTY_CEO_GUEST_LIST).trim() : '';

/**
 * Build HubSpot deal properties from an Alma event (mirrors buildHubSpotProperties for contacts).
 * Standard: dealname, closedate. Optional: description, notes, custom properties.
 */
function buildDealProperties(event) {
  const e = event || {};
  const props = {};

  // dealname: from event name (not chapter)
  const dealname = (e.name || '').toString().trim() || `Event ${(e.id || '').toString().slice(0, 8)}`;
  props.dealname = dealname;

  // Required: pipeline and dealstage (HubSpot Deals require these)
  if (DEFAULT_PIPELINE) props.pipeline = DEFAULT_PIPELINE;
  if (DEFAULT_DEAL_STAGE) props.dealstage = DEFAULT_DEAL_STAGE;

  // date (internal name: date) - Unix ms timestamp at UTC midnight. Send 0 if missing.
  const dateVal = e.date;
  let dateMs = 0;
  if (dateVal != null) {
    let d;
    if (typeof dateVal === 'number') d = new Date(dateVal);
    else if (typeof dateVal.toDate === 'function') d = dateVal.toDate();
    else if (typeof dateVal.toMillis === 'function') d = new Date(dateVal.toMillis());
    else d = new Date(dateVal);
    if (!Number.isNaN(d.getTime())) {
      dateMs = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0);
    }
  }
  // date (internal name: date) - Unix Millisecond Timestamp. Owner confirmed date, not closedate.
  props.date = Number(Number.isFinite(dateMs) ? dateMs : 0);

  // Location: standard 'description' or custom property (HubSpot deal has 'description')
  const location = (e.location || e.locationText || '').toString().trim();
  const desc = (e.description || '').toString().trim();
  if (location || desc) {
    const combined = [location, desc].filter(Boolean).join(' | ');
    if (CUSTOM_PROP_LOCATION && location) props[CUSTOM_PROP_LOCATION] = location;
    if (CUSTOM_PROP_DESCRIPTION && desc) props[CUSTOM_PROP_DESCRIPTION] = desc;
    if (!CUSTOM_PROP_LOCATION && !CUSTOM_PROP_DESCRIPTION) props.description = combined || location || desc;
  }

  // Status (optional; use custom property if HUBSPOT_DEAL_PROPERTY_STATUS set)
  const statusProp = (typeof process !== 'undefined' && process.env?.HUBSPOT_DEAL_PROPERTY_STATUS) ? String(process.env.HUBSPOT_DEAL_PROPERTY_STATUS).trim() : '';
  if (statusProp) {
    const normalizedStatus = normalizeEventStatus(e.status);
    if (normalizedStatus) {
      props[statusProp] = normalizedStatus;
    } else if (e.status != null && String(e.status).trim()) {
      // Avoid failing entire deal upsert due to invalid enum value in HubSpot custom property.
      console.warn('[hubspot-deal-sync] Ignoring unsupported event status for HubSpot status property:', e.status);
    }
  }

  // Alma event ID for lookup. Only send if property exists in HubSpot (set HUBSPOT_DEAL_PROPERTY_ALMA_EVENT_ID to enable).
  const eventId = (e.id || '').toString().trim();
  if (eventId && ALMA_EVENT_ID_PROPERTY) props[ALMA_EVENT_ID_PROPERTY] = eventId;

  // CEO Guest List (custom property; set HUBSPOT_DEAL_PROPERTY_CEO_GUEST_LIST in HubSpot)
  if (CUSTOM_PROP_CEO_GUEST_LIST && (e.ceoGuestList || e.ceo_guest_list)) {
    const val = String(e.ceoGuestList || e.ceo_guest_list || '').trim();
    if (val) props[CUSTOM_PROP_CEO_GUEST_LIST] = val;
  }

  // Meeting URL (optional custom property)
  const meetingUrl = (e.meetingUrl || '').toString().trim();
  const meetingProp = (typeof process !== 'undefined' && process.env?.HUBSPOT_DEAL_PROPERTY_MEETING_URL) ? String(process.env.HUBSPOT_DEAL_PROPERTY_MEETING_URL).trim() : '';
  if (meetingProp && meetingUrl) props[meetingProp] = meetingUrl;

  // chapter (internal name: chapter) - String, enumeration. Must match HubSpot exactly (e.g. 'Tel Aviv').
  props.chapter = String(normalizeChapter(e.chapter ?? '') || '');

  // attended (internal name: attended) - Number.
  const attendedCount = e.attendedCount ?? e.attended_count;
  props.attended = Number(typeof attendedCount === 'number' && attendedCount >= 0 ? attendedCount : 0);

  // zoom_link (internal name: zoom_link) - String. Not zoom_recording_link.
  props.zoom_link = String((e.zoomRecordingUrl ?? e.zoom_recording_url ?? e.zoomLink ?? '').toString().trim() || '');

  // zoom_password (internal name: zoom_password) - String.
  props.zoom_password = String((e.zoomPassword ?? e.zoom_password ?? '').toString().trim() || '');

  // pictures_link (internal name: pictures_link) - String. Use event image URL.
  props.pictures_link = String((e.imageUrl ?? e.image_url ?? e.picturesUrl ?? e.pictures_url ?? '').toString().trim() || '');

  // rsvp (internal name: rsvp) - Number.
  const rsvpCount = e.rsvpCount ?? e.rsvp_count;
  props.rsvp = Number(typeof rsvpCount === 'number' && rsvpCount >= 0 ? rsvpCount : 0);

  // Filter: remove undefined/null; keep "" and 0 (HubSpot: send "" or 0 for missing fields)
  const filtered = {};
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined || v === null) continue;
    filtered[k] = typeof v === 'string' ? v.trim() : v;
  }
  return filtered;
}

/**
 * Extract HubSpot property internal names that failed validation (invalid option or
 * unknown property) from an error body, so we can drop them and retry.
 * @returns {string[]}
 */
function extractInvalidPropertyNames(data) {
  const names = new Set();
  const scan = (text) => {
    if (!text) return;
    const s = String(text);
    const reName = /"name"\s*:\s*"([^"]+)"/g;
    let m;
    while ((m = reName.exec(s)) !== null) names.add(m[1]);
    const reMissing = /Property\s+"([^"]+)"\s+does not exist/gi;
    while ((m = reMissing.exec(s)) !== null) names.add(m[1]);
  };
  scan(data?.message);
  if (Array.isArray(data?.errors)) {
    for (const e of data.errors) {
      if (e?.name) names.add(e.name);
      scan(e?.message);
    }
  }
  return [...names];
}

/**
 * Create a HubSpot deal. Retries once without any property HubSpot rejects, so one
 * invalid field never blocks the whole deal. Logs full API response when rejected.
 * @returns {{ id: string } | { error: string }}
 */
async function createDeal(token, properties) {
  let props = { ...properties };
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(HUBSPOT_DEALS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ properties: props }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) return { id: String(data.id) };

    const invalid = extractInvalidPropertyNames(data);
    if (attempt === 0 && res.status === 400 && invalid.length) {
      const remaining = { ...props };
      let dropped = 0;
      for (const n of invalid) { if (n in remaining) { delete remaining[n]; dropped++; } }
      if (dropped > 0 && Object.keys(remaining).length > 0) {
        console.warn('[hubspot-deal-sync] create dropping invalid properties and retrying:', invalid);
        props = remaining;
        continue;
      }
    }
    const msg = data.message || data.errors?.[0]?.message || data.category || `HTTP ${res.status}`;
    console.error('[hubspot-deal-sync] CREATE rejected:', res.status, JSON.stringify(data));
    console.error('[hubspot-deal-sync] Sent properties:', JSON.stringify(props));
    return { error: msg };
  }
  return { error: 'create failed after retry' };
}

/**
 * Update a HubSpot deal by id. Retries once without any property HubSpot rejects.
 * @returns {{ ok: boolean, error?: string }}
 */
async function updateDeal(token, dealId, properties) {
  if (!dealId) return { ok: false, error: 'Missing deal id' };
  let props = { ...properties };
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(`${HUBSPOT_DEALS_URL}/${dealId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ properties: props }),
    });
    if (res.ok) return { ok: true };

    const data = await res.json().catch(() => ({}));
    const invalid = extractInvalidPropertyNames(data);
    if (attempt === 0 && res.status === 400 && invalid.length) {
      const remaining = { ...props };
      let dropped = 0;
      for (const n of invalid) { if (n in remaining) { delete remaining[n]; dropped++; } }
      if (dropped > 0 && Object.keys(remaining).length > 0) {
        console.warn('[hubspot-deal-sync] update dropping invalid properties and retrying:', invalid);
        props = remaining;
        continue;
      }
    }
    const msg = data.message || data.errors?.[0]?.message || `HTTP ${res.status}`;
    console.error('[hubspot-deal-sync] PATCH rejected:', res.status, 'dealId:', dealId, JSON.stringify(data));
    console.error('[hubspot-deal-sync] Sent properties:', JSON.stringify(props));
    return { ok: false, error: msg };
  }
  return { ok: false, error: 'update failed after retry' };
}

/**
 * Upsert a HubSpot deal from an Alma event.
 * - If event.hubspotDealId is set: update that deal.
 * - Else: create a new deal and return its id (caller should persist on event).
 *
 * @param {object} event - Alma event { id, name, date, hubspotDealId?, ... }
 * @returns {Promise<{ ok: boolean, hubspotDealId?: string, path?: string, error?: string }>}
 */
export async function upsertHubspotDeal(event) {
  const tokenResult = getHubspotToken();
  if (!tokenResult.ok) {
    return { ok: false, error: tokenResult.error };
  }
  const token = tokenResult.token;
  const websiteEventId = (event?.id || '').toString().trim();
  const eventTitle = (event?.name || '').toString().trim() || '(no name)';
  const properties = buildDealProperties(event);

  console.log('[hubspot-deal-sync] INPUT', { websiteEventId, eventTitle, hasStoredDealId: !!(event?.hubspotDealId) });
  console.log('[hubspot-deal-sync] Syncing these fields:', JSON.stringify(properties, null, 2));

  let dealId = (event?.hubspotDealId || '').toString().trim() || null;
  let path = null;

  if (dealId) {
    path = 'UPDATE';
    const updateResult = await updateDeal(token, dealId, properties);
    if (!updateResult.ok) {
      return { ok: false, error: updateResult.error, path: 'UPDATE' };
    }
    console.log('[hubspot-deal-sync] RESULT', { path, websiteEventId, eventTitle, hubspotDealId: dealId });
    return { ok: true, hubspotDealId: dealId, path };
  }

  path = 'CREATE';
  const createResult = await createDeal(token, properties);
  if (createResult.error) {
    return { ok: false, error: createResult.error, path: 'CREATE' };
  }
  dealId = createResult.id;
  console.log('[hubspot-deal-sync] RESULT', { path, websiteEventId, eventTitle, hubspotDealId: dealId });
  return { ok: true, hubspotDealId: dealId, path };
}

/**
 * Delete a HubSpot deal by id.
 * @param {string} dealId - HubSpot deal ID
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
export async function deleteHubspotDeal(dealId) {
  const tokenResult = getHubspotToken();
  if (!tokenResult.ok) {
    return { ok: false, error: tokenResult.error };
  }
  const id = (dealId || '').toString().trim();
  if (!id) return { ok: false, error: 'Missing deal id' };

  const res = await fetch(`${HUBSPOT_DEALS_URL}/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${tokenResult.token}` },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const msg = data.message || data.errors?.[0]?.message || `HTTP ${res.status}`;
    console.error('[hubspot-deal-sync] delete failed:', res.status, data);
    return { ok: false, error: msg };
  }
  console.log('[hubspot-deal-sync] Deleted deal:', id);
  return { ok: true };
}
