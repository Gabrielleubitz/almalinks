/**
 * HubSpot Deal sync: create or update a HubSpot Deal from an Alma event.
 * Mirrors the contact sync pattern (hubspot-contact-sync.js). Uses HUBSPOT_ACCESS_TOKEN.
 * HubSpot auto-assigns to default pipeline when pipeline/dealstage not specified.
 *
 * Identity: event.hubspotDealId (stored on event after first create) or create new.
 */

import { getHubspotToken } from './api/hubspot-auth.js';

const HUBSPOT_DEALS_URL = 'https://api.hubapi.com/crm/v3/objects/deals';

/** Custom property for Alma event ID (for lookup). Create in HubSpot if needed. */
const ALMA_EVENT_ID_PROPERTY = 'alma_event_id';

/** Optional custom property names from env (e.g. HUBSPOT_DEAL_PROPERTY_LOCATION, HUBSPOT_DEAL_PROPERTY_CEO_GUEST_LIST) */
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

  // Required: dealname
  const dealname = (e.name || '').toString().trim() || `Event ${(e.id || '').toString().slice(0, 8)}`;
  props.dealname = dealname;

  // Date -> closedate (ms)
  const dateVal = e.date;
  if (dateVal) {
    const d = typeof dateVal === 'string' ? new Date(dateVal) : new Date(dateVal);
    if (!Number.isNaN(d.getTime())) {
      props.closedate = d.getTime().toString();
    }
  }

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
  const status = (e.status || '').toString().trim();
  if (status) {
    const statusProp = (typeof process !== 'undefined' && process.env?.HUBSPOT_DEAL_PROPERTY_STATUS) ? String(process.env.HUBSPOT_DEAL_PROPERTY_STATUS).trim() : '';
    if (statusProp) props[statusProp] = status;
  }

  // Alma event ID for lookup
  const eventId = (e.id || '').toString().trim();
  if (eventId) props[ALMA_EVENT_ID_PROPERTY] = eventId;

  // CEO Guest List (custom property; set HUBSPOT_DEAL_PROPERTY_CEO_GUEST_LIST in HubSpot)
  if (CUSTOM_PROP_CEO_GUEST_LIST && (e.ceoGuestList || e.ceo_guest_list)) {
    const val = String(e.ceoGuestList || e.ceo_guest_list || '').trim();
    if (val) props[CUSTOM_PROP_CEO_GUEST_LIST] = val;
  }

  // Meeting URL (optional custom property)
  const meetingUrl = (e.meetingUrl || '').toString().trim();
  const meetingProp = (typeof process !== 'undefined' && process.env?.HUBSPOT_DEAL_PROPERTY_MEETING_URL) ? String(process.env.HUBSPOT_DEAL_PROPERTY_MEETING_URL).trim() : '';
  if (meetingProp && meetingUrl) props[meetingProp] = meetingUrl;

  // Filter out empty values (HubSpot may reject empty strings)
  const filtered = {};
  for (const [k, v] of Object.entries(props)) {
    if (v !== undefined && v !== null && String(v).trim() !== '') filtered[k] = typeof v === 'string' ? v.trim() : v;
  }
  return filtered;
}

/**
 * Create a HubSpot deal. Logs full API response when rejected (like contact sync).
 * @returns {{ id: string } | { error: string }}
 */
async function createDeal(token, properties) {
  const payload = { properties };
  console.log('[hubspot-deal-sync] DEBUG POST request to HubSpot - payload:', JSON.stringify(payload, null, 2));
  const res = await fetch(HUBSPOT_DEALS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  console.log('[hubspot-deal-sync] DEBUG POST response - status:', res.status, 'body:', JSON.stringify(data, null, 2));
  if (!res.ok) {
    const msg = data.message || data.errors?.[0]?.message || data.category || `HTTP ${res.status}`;
    console.error('[hubspot-deal-sync] CREATE rejected:', res.status, JSON.stringify(data));
    console.error('[hubspot-deal-sync] Sent properties:', JSON.stringify(properties));
    return { error: msg };
  }
  return { id: String(data.id) };
}

/**
 * Update a HubSpot deal by id. Logs full API response when rejected.
 * @returns {{ ok: boolean, error?: string }}
 */
async function updateDeal(token, dealId, properties) {
  if (!dealId) return { ok: false, error: 'Missing deal id' };
  const payload = { properties };
  console.log('[hubspot-deal-sync] DEBUG PATCH request to HubSpot - dealId:', dealId, 'payload:', JSON.stringify(payload, null, 2));
  const res = await fetch(`${HUBSPOT_DEALS_URL}/${dealId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  console.log('[hubspot-deal-sync] DEBUG PATCH response - status:', res.status, 'body:', JSON.stringify(data, null, 2));
  if (!res.ok) {
    const msg = data.message || data.errors?.[0]?.message || `HTTP ${res.status}`;
    console.error('[hubspot-deal-sync] PATCH rejected:', res.status, 'dealId:', dealId, JSON.stringify(data));
    console.error('[hubspot-deal-sync] Sent properties:', JSON.stringify(properties));
    return { ok: false, error: msg };
  }
  return { ok: true };
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
