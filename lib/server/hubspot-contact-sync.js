/**
 * HubSpot contact sync: map Alma profile fields to HubSpot contact properties and upsert.
 * All HubSpot API calls are server-side only. Never expose HUBSPOT_ACCESS_TOKEN to frontend.
 *
 * Env: HUBSPOT_ACCESS_TOKEN (required for sync).
 */

import { getHubspotToken } from './api/hubspot-auth.js';

const HUBSPOT_BASE = 'https://api.hubapi.com/crm/v3';
const CONTACTS_URL = `${HUBSPOT_BASE}/objects/contacts`;
const SEARCH_URL = `${HUBSPOT_BASE}/objects/contacts/search`;

/**
 * Alma profile field -> HubSpot contact property internal name.
 * TODO: Confirm custom property internal names in your HubSpot portal (Settings → Properties → Contact).
 * Standard HubSpot: email, firstname, lastname, jobtitle, company, phone.
 */
const HUBSPOT_PROPERTY_MAP = {
  email: 'email',
  firstname: 'firstname',
  lastname: 'lastname',
  // fullName is split to firstname/lastname in buildProperties()
  title: 'jobtitle',
  organization: 'company',
  company: 'company', // alias
  phone: 'phone',
  linkedinUrl: 'linkedinbio', // TODO: or custom e.g. "linkedin_profile" if you use a custom property
  chapter: 'chapter', // TODO: replace with actual internal name if different (e.g. hs_chapter)
  bioShort: 'bio_short', // TODO: create custom property in HubSpot if not exists
  bioLong: 'bio_long', // TODO: create custom property in HubSpot if not exists
};

/**
 * Build HubSpot properties object from Alma user profile.
 * Profile may have: name/displayName/firstName+lastName, title, company/organization, phone, linkedin, chapter, bioTitle/bioShort, bio/bioLong.
 */
function buildHubSpotProperties(profile) {
  const p = profile || {};
  const fullName = (p.fullName || p.displayName || p.name || '').trim() || `${(p.firstName || '').trim()} ${(p.lastName || '').trim()}`.trim();
  const parts = fullName.split(/\s+/).filter(Boolean);
  const firstname = (p.firstName || (parts[0] || '')).trim();
  const lastname = (p.lastName || (parts.length > 1 ? parts.slice(1).join(' ') : '')).trim();

  const props = {};
  if (p.email) props[HUBSPOT_PROPERTY_MAP.email] = String(p.email).trim();
  if (firstname) props[HUBSPOT_PROPERTY_MAP.firstname] = firstname;
  if (lastname) props[HUBSPOT_PROPERTY_MAP.lastname] = lastname;

  const title = p.title || p.position || '';
  if (title) props[HUBSPOT_PROPERTY_MAP.title] = String(title).trim();

  const org = p.organization || p.company || '';
  if (org) props[HUBSPOT_PROPERTY_MAP.organization] = String(org).trim();

  const phone = p.phone || '';
  if (phone) props[HUBSPOT_PROPERTY_MAP.phone] = String(phone).trim();

  let linkedin = p.linkedinUrl || p.linkedin || '';
  if (!linkedin && p.linkedinUsername) {
    const un = String(p.linkedinUsername).trim().replace(/^(https?:\/\/)?(www\.)?linkedin\.com\/in\//i, '').replace(/\/$/, '');
    if (un) linkedin = `https://linkedin.com/in/${un}`;
  }
  if (linkedin) props[HUBSPOT_PROPERTY_MAP.linkedinUrl] = String(linkedin).trim();

  const chapter = p.chapter || '';
  if (chapter) props[HUBSPOT_PROPERTY_MAP.chapter] = String(chapter).trim();

  const bioShort = p.bioShort || p.bioTitle || '';
  if (bioShort) props[HUBSPOT_PROPERTY_MAP.bioShort] = String(bioShort).trim();

  const bioLong = p.bioLong || p.bio || '';
  if (bioLong) props[HUBSPOT_PROPERTY_MAP.bioLong] = String(bioLong).trim();

  return props;
}

/**
 * Search for a HubSpot contact by email.
 * @returns { Promise<{ id: string } | null> }
 */
async function findContactByEmail(token, email) {
  if (!email || !String(email).trim()) return null;
  const res = await fetch(SEARCH_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      filterGroups: [
        {
          filters: [
            { propertyName: 'email', operator: 'EQ', value: String(email).trim().toLowerCase() },
          ],
        },
      ],
      limit: 1,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    console.error('[hubspot-contact-sync] search failed:', res.status, text);
    return null;
  }
  const data = await res.json().catch(() => ({}));
  const first = data.results?.[0];
  return first ? { id: String(first.id) } : null;
}

/**
 * Create a HubSpot contact.
 * @returns { Promise<{ id: string } | { error: string }> }
 */
async function createContact(token, properties) {
  const res = await fetch(CONTACTS_URL, {
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
    console.error('[hubspot-contact-sync] create failed:', res.status, data);
    return { error: msg };
  }
  return { id: String(data.id) };
}

/**
 * Update a HubSpot contact by id.
 * @returns { Promise<{ ok: boolean, error?: string }> }
 */
async function updateContact(token, contactId, properties) {
  if (!contactId) return { ok: false, error: 'Missing contact id' };
  const res = await fetch(`${CONTACTS_URL}/${contactId}`, {
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
    console.error('[hubspot-contact-sync] update failed:', res.status, data);
    return { ok: false, error: msg };
  }
  return { ok: true };
}

/**
 * Upsert a contact in HubSpot from Alma profile. Use this from API route or Cloud Function.
 * - If profile.hubspotContactId is set: PATCH that contact.
 * - Else: search by profile.email; if found, PATCH and return id; if not found, POST create and return id.
 *
 * @param {object} profile - Alma user profile (users/{uid} doc shape): email, fullName/displayName/name/firstName/lastName, title, organization/company, phone, linkedinUrl/linkedin, chapter, bioShort/bioTitle, bioLong/bio, hubspotContactId
 * @returns { Promise<{ ok: boolean, hubspotContactId?: string, error?: string }> }
 */
export async function upsertHubspotContact(profile) {
  const tokenResult = getHubspotToken();
  if (!tokenResult.ok) {
    return { ok: false, error: tokenResult.error };
  }
  const token = tokenResult.token;
  const email = (profile?.email || '').toString().trim().toLowerCase();
  const properties = buildHubSpotProperties(profile);
  if (Object.keys(properties).length === 0) {
    return { ok: false, error: 'No properties to sync' };
  }

  let contactId = (profile?.hubspotContactId || '').toString().trim() || null;

  if (contactId) {
    const updateResult = await updateContact(token, contactId, properties);
    if (!updateResult.ok) {
      return { ok: false, error: updateResult.error };
    }
    return { ok: true, hubspotContactId: contactId };
  }

  const found = await findContactByEmail(token, email);
  if (found) {
    contactId = found.id;
    const updateResult = await updateContact(token, contactId, properties);
    if (!updateResult.ok) {
      return { ok: false, error: updateResult.error };
    }
    return { ok: true, hubspotContactId: contactId };
  }

  const createResult = await createContact(token, properties);
  if (createResult.error) {
    return { ok: false, error: createResult.error };
  }
  return { ok: true, hubspotContactId: createResult.id };
}

export { HUBSPOT_PROPERTY_MAP, buildHubSpotProperties };
