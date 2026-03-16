/**
 * HubSpot Deal sync: create or update a HubSpot Deal from an Alma event.
 * Uses same token as contact sync (HUBSPOT_ACCESS_TOKEN). HubSpot auto-assigns to default pipeline.
 *
 * Identity: event.hubspotDealId (stored on event after first create) or create new.
 */

import { getHubspotToken } from './api/hubspot-auth.js';

const HUBSPOT_DEALS_URL = 'https://api.hubapi.com/crm/v3/objects/deals';

/** Custom property to store Alma event ID on the deal (for lookup). Create in HubSpot if needed. */
const ALMA_EVENT_ID_PROPERTY = 'alma_event_id';

/**
 * Build HubSpot deal properties from an Alma event.
 * HubSpot uses default pipeline when pipeline/dealstage not specified (same as contacts).
 */
function buildDealProperties(event) {
  const e = event || {};
  const props = {};
  const dealname = (e.name || '').toString().trim() || `Event ${(e.id || '').toString().slice(0, 8)}`;
  props.dealname = dealname;

  const dateVal = e.date;
  if (dateVal) {
    const d = typeof dateVal === 'string' ? new Date(dateVal) : new Date(dateVal);
    if (!Number.isNaN(d.getTime())) {
      props.closedate = d.getTime().toString();
    }
  }

  const eventId = (e.id || '').toString().trim();
  if (eventId) props[ALMA_EVENT_ID_PROPERTY] = eventId;

  return props;
}

/**
 * Create a HubSpot deal.
 * @returns {{ id: string } | { error: string }}
 */
async function createDeal(token, properties) {
  const res = await fetch(HUBSPOT_DEALS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ properties }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data.message || data.errors?.[0]?.message || data.category || `HTTP ${res.status}`;
    console.error('[hubspot-deal-sync] create failed:', res.status, data);
    return { error: msg };
  }
  return { id: String(data.id) };
}

/**
 * Update a HubSpot deal by id.
 * @returns {{ ok: boolean, error?: string }}
 */
async function updateDeal(token, dealId, properties) {
  if (!dealId) return { ok: false, error: 'Missing deal id' };
  const res = await fetch(`${HUBSPOT_DEALS_URL}/${dealId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ properties }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const msg = data.message || data.errors?.[0]?.message || `HTTP ${res.status}`;
    console.error('[hubspot-deal-sync] update failed:', res.status, data);
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
