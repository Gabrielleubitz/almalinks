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
 * Standard HubSpot: email, firstname, lastname, jobtitle, company, phone.
 * Custom: use the exact internal names from HubSpot Settings → Properties → Contact.
 * (bio_short was mapping to "Bio old"; use Bio One Liner / Bio Paragraph internal names instead.)
 */
const HUBSPOT_PROPERTY_MAP = {
  email: 'email',
  firstname: 'firstname',
  lastname: 'lastname',
  title: 'jobtitle',
  organization: 'company',
  company: 'company',
  phone: 'phone',
  linkedinUrl: 'linkedin_profile',
  chapter: 'chapter',
  work: 'job_description',
  jobDescription: 'job_description',
  bioShort: 'bio_one_liner',
  bioLong: 'bio_paragraph',
};

/**
 * Normalize LinkedIn to full URL https://www.linkedin.com/in/{id}.
 * - If already a full URL: extract id and return https://www.linkedin.com/in/{id}.
 * - If username only: trim, strip leading/trailing slashes, return https://www.linkedin.com/in/{username}.
 */
function normalizeLinkedInUrl(value) {
  if (value == null || typeof value !== 'string') return '';
  const raw = String(value).trim().replace(/^\/+|\/+$/g, '');
  if (!raw) return '';
  const match = raw.match(/^(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/([^/?]+)/i);
  const id = match ? match[1].replace(/\/+$/, '') : raw;
  return `https://www.linkedin.com/in/${id}`;
}

/**
 * Build HubSpot properties object from Alma user profile.
 * Profile may have: fullName/displayName/name/firstName/lastName, email, title/position, company/organization, phone,
 * linkedinUrl/linkedin/linkedinUsername, chapter, work/jobDescription, bioTitle/bioShort, bio/bioLong.
 * Only non-empty values are sent; empty optionals are omitted.
 */
function buildHubSpotProperties(profile) {
  const p = profile || {};
  const fullName = (p.fullName || p.displayName || p.name || '').trim() || `${(p.firstName || '').trim()} ${(p.lastName || '').trim()}`.trim();
  const parts = fullName.split(/\s+/).filter(Boolean);
  const firstname = (p.firstName != null && String(p.firstName).trim() !== '' ? String(p.firstName).trim() : (parts[0] || '')).trim();
  const lastname = (p.lastName != null && String(p.lastName).trim() !== '' ? String(p.lastName).trim() : (parts.length > 1 ? parts.slice(1).join(' ') : '')).trim();

  const props = {};
  const emailVal = (p.email && String(p.email).trim()) || '';
  if (emailVal) props[HUBSPOT_PROPERTY_MAP.email] = emailVal;

  if (firstname) props[HUBSPOT_PROPERTY_MAP.firstname] = firstname;
  if (lastname) props[HUBSPOT_PROPERTY_MAP.lastname] = lastname;

  const title = (p.title || p.position || '').trim();
  if (title) props[HUBSPOT_PROPERTY_MAP.title] = title;

  const org = (p.organization || p.company || '').trim();
  if (org) props[HUBSPOT_PROPERTY_MAP.organization] = org;

  const phone = (p.phone && String(p.phone).trim()) || '';
  if (phone) props[HUBSPOT_PROPERTY_MAP.phone] = phone;

  const linkedinRaw = p.linkedinUrl || p.linkedin || p.linkedinUsername || '';
  const linkedin = linkedinRaw ? normalizeLinkedInUrl(linkedinRaw) : '';
  if (linkedin) props[HUBSPOT_PROPERTY_MAP.linkedinUrl] = linkedin;

  const chapter = (p.chapter && String(p.chapter).trim()) || '';
  if (chapter) props[HUBSPOT_PROPERTY_MAP.chapter] = chapter;

  const jobDesc = (p.work || p.jobDescription || '').trim();
  if (jobDesc) props[HUBSPOT_PROPERTY_MAP.work] = jobDesc;

  const bioShort = (p.bioShort || p.bioTitle || '').trim();
  if (bioShort) props[HUBSPOT_PROPERTY_MAP.bioShort] = bioShort;

  const bioLong = (p.bioLong || p.bio || '').trim();
  if (bioLong) props[HUBSPOT_PROPERTY_MAP.bioLong] = bioLong;

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
