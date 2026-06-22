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
 * HubSpot chapter property: allowed enum values (exact strings). Invalid values cause API errors.
 * Map website values to one of these only.
 */
const HUBSPOT_CHAPTER_ALLOWED = new Set([
  'New York',
  'Tel Aviv',
  'Johannesburg',
  'London',
  'Mexico City',
  'Philadelphia',
  'Sydney',
  'Toronto',
  'Costa Rica',
  'International',
]);

/**
 * Map website/stored chapter values (lowercase) to exact HubSpot allowed option.
 * Only these mapped values are sent; unknown values are omitted.
 */
const CHAPTER_VALUE_MAP = {
  'new york': 'New York',
  'tel aviv': 'Tel Aviv',
  'johannesburg': 'Johannesburg',
  'london': 'London',
  'mexico city': 'Mexico City',
  'philadelphia': 'Philadelphia',
  'sydney': 'Sydney',
  'toronto': 'Toronto',
  'costa rica': 'Costa Rica',
  'international': 'International',
  // Do not map "usa" / "us" etc. — omit invalid values per HubSpot owner.
};

/**
 * Alma profile field -> HubSpot contact property internal name.
 * job_description does not exist in HubSpot — not sent. Long bio uses bio_25 per HubSpot owner.
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
  city: 'city',
  country: 'country',
  website: 'website',
  twitter: 'twitterhandle',
  bioShort: (typeof process !== 'undefined' && process.env?.HUBSPOT_BIO_TITLE_PROPERTY_NAME)
    ? String(process.env.HUBSPOT_BIO_TITLE_PROPERTY_NAME).trim()
    : 'bionew',
  bioLong: 'bio_25',
  address: 'address',
  specialty: (typeof process !== 'undefined' && process.env?.HUBSPOT_PROPERTY_SPECIALTY)
    ? String(process.env.HUBSPOT_PROPERTY_SPECIALTY).trim()
    : 'specialty',
  industry: (typeof process !== 'undefined' && process.env?.HUBSPOT_PROPERTY_INDUSTRY)
    ? String(process.env.HUBSPOT_PROPERTY_INDUSTRY).trim()
    : 'industry',
  position: (typeof process !== 'undefined' && process.env?.HUBSPOT_PROPERTY_POSITION)
    ? String(process.env.HUBSPOT_PROPERTY_POSITION).trim()
    : 'position',
  lookingToGain: (typeof process !== 'undefined' && process.env?.HUBSPOT_PROPERTY_LOOKING_TO_GAIN)
    ? String(process.env.HUBSPOT_PROPERTY_LOOKING_TO_GAIN).trim()
    : 'looking_to_gain_from_almalinks_this_year',
  offerToMembers: (typeof process !== 'undefined' && process.env?.HUBSPOT_PROPERTY_ASSIST_MEMBERS)
    ? String(process.env.HUBSPOT_PROPERTY_ASSIST_MEMBERS).trim()
    : 'how_would_you_like_to_assist_other_members',
  heardAboutAlma: (typeof process !== 'undefined' && process.env?.HUBSPOT_PROPERTY_HEARD_ABOUT)
    ? String(process.env.HUBSPOT_PROPERTY_HEARD_ABOUT).trim()
    : 'how_did_you_hear_about_almalinks',
};

/** Optional job description: only sent if HubSpot has this property and env is set. */
const JOB_DESCRIPTION_PROPERTY = (typeof process !== 'undefined' && process.env && process.env.HUBSPOT_PROPERTY_JOB_DESCRIPTION) ? String(process.env.HUBSPOT_PROPERTY_JOB_DESCRIPTION).trim() : '';

/**
 * HubSpot Contact property used to store the profile picture URL.
 * Defaults to 'picture' (the standard custom property used in this portal).
 * Override with env HUBSPOT_CONTACT_PROPERTY_PROFILE_IMAGE if your portal uses a different internal name.
 */
const PROFILE_IMAGE_PROPERTY = (typeof process !== 'undefined' && process.env && process.env.HUBSPOT_CONTACT_PROPERTY_PROFILE_IMAGE)
  ? String(process.env.HUBSPOT_CONTACT_PROPERTY_PROFILE_IMAGE).trim()
  : 'picture';

/** Property internal names we are allowed to send (safeguard: do not send unknown properties). */
const ALLOWED_PROPERTIES_FOR_SEND = new Set([
  'email',
  'firstname',
  'lastname',
  'jobtitle',
  'company',
  'city',
  'country',
  'website',
  'twitterhandle',
  'phone',
  'linkedin_profile',
  'chapter',
  'bionew',
  'bio_one_liner',
  'bio_25',
  'address',
  HUBSPOT_PROPERTY_MAP.specialty,
  HUBSPOT_PROPERTY_MAP.industry,
  HUBSPOT_PROPERTY_MAP.position,
  HUBSPOT_PROPERTY_MAP.lookingToGain,
  HUBSPOT_PROPERTY_MAP.offerToMembers,
  HUBSPOT_PROPERTY_MAP.heardAboutAlma,
  ...(JOB_DESCRIPTION_PROPERTY ? [JOB_DESCRIPTION_PROPERTY] : []),
  ...(PROFILE_IMAGE_PROPERTY ? [PROFILE_IMAGE_PROPERTY] : []),
]);

/**
 * HubSpot multi-select: semicolon-separated string (e.g. "SaaS;Sales;AI").
 * @param {string|string[]|null|undefined} value
 * @returns {string}
 */
function toHubspotMultiValue(value) {
  if (value == null) return '';
  if (Array.isArray(value)) {
    return value.map((v) => String(v).trim()).filter(Boolean).join(';');
  }
  const s = String(value).trim();
  if (!s) return '';
  if (s.includes(';')) {
    return s
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .join(';');
  }
  return s;
}

/**
 * Normalize chapter to an exact HubSpot-allowed value. Returns the allowed string or empty string (omit).
 * @param {string} value - Raw chapter from website (e.g. "usa", "New York")
 * @returns {string} One of HUBSPOT_CHAPTER_ALLOWED or ''
 */
function normalizeChapter(value) {
  if (value == null || typeof value !== 'string') return '';
  const key = String(value).trim().toLowerCase();
  if (!key) return '';
  if (HUBSPOT_CHAPTER_ALLOWED.has(String(value).trim())) return String(value).trim();
  const mapped = CHAPTER_VALUE_MAP[key];
  return mapped && HUBSPOT_CHAPTER_ALLOWED.has(mapped) ? mapped : '';
}

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
 * Only sends properties in ALLOWED_PROPERTIES_FOR_SEND. Chapter normalized to HubSpot allowed options; invalid (e.g. "usa") omitted.
 * job_description not sent (does not exist in HubSpot). Long bio -> bio_25.
 */
function buildHubSpotProperties(profile) {
  const p = profile || {};
  const fullName = (p.fullName || p.displayName || p.name || '').trim() || `${(p.firstName || '').trim()} ${(p.lastName || '').trim()}`.trim();
  const parts = fullName.split(/\s+/).filter(Boolean);
  const firstname = (p.firstName != null && String(p.firstName).trim() !== '' ? String(p.firstName).trim() : (parts[0] || '')).trim();
  const lastname = (p.lastName != null && String(p.lastName).trim() !== '' ? String(p.lastName).trim() : (parts.length > 1 ? parts.slice(1).join(' ') : '')).trim();

  const props = {};
  const emailVal = (p.email != null && String(p.email).trim()) ? String(p.email).trim() : '';
  if (emailVal) props[HUBSPOT_PROPERTY_MAP.email] = emailVal;

  if (firstname) props[HUBSPOT_PROPERTY_MAP.firstname] = firstname;
  if (lastname) props[HUBSPOT_PROPERTY_MAP.lastname] = lastname;

  const positionMulti = toHubspotMultiValue(p.position);
  // `work` is the dashboard/completion-flow field name for job title; `title` is used in admin/profile-edit.
  const titleSingle = (p.title || p.jobTitle || p.work || '').trim();
  const jobTitleVal = titleSingle || (positionMulti ? positionMulti.split(';')[0].trim() : '');
  if (jobTitleVal) props[HUBSPOT_PROPERTY_MAP.title] = jobTitleVal;

  // Prefer `company` — `organization` is a legacy alias (e.g. from HubSpot import) and must not shadow updates.
  const org = (p.company || p.organization || '').trim();
  if (org) props[HUBSPOT_PROPERTY_MAP.organization] = org;

  const addressVal = (p.address || '').trim();
  if (addressVal) props[HUBSPOT_PROPERTY_MAP.address] = addressVal;

  const cityVal = (p.city || '').trim();
  if (cityVal) props[HUBSPOT_PROPERTY_MAP.city] = cityVal;

  const countryVal = (p.country || '').trim();
  if (countryVal) props[HUBSPOT_PROPERTY_MAP.country] = countryVal;

  const websiteVal = (p.website || '').trim();
  if (websiteVal) props[HUBSPOT_PROPERTY_MAP.website] = websiteVal;

  // Normalize Twitter: strip URL prefix and @ so only the handle is stored.
  const twitterRaw = (p.twitter || p.twitterUsername || '').trim();
  const twitterHandle = twitterRaw
    .replace(/^(https?:\/\/)?(www\.)?(twitter\.com\/|x\.com\/)@?/i, '')
    .replace(/^@/, '')
    .split(/[/?#]/)[0]
    .trim();
  if (twitterHandle) props[HUBSPOT_PROPERTY_MAP.twitter] = twitterHandle;

  const specialtyVal = toHubspotMultiValue(p.specialty ?? p.expertiseAreas ?? p.skills);
  if (specialtyVal) props[HUBSPOT_PROPERTY_MAP.specialty] = specialtyVal;

  const industryVal = toHubspotMultiValue(p.industry);
  if (industryVal) props[HUBSPOT_PROPERTY_MAP.industry] = industryVal;

  if (positionMulti) props[HUBSPOT_PROPERTY_MAP.position] = positionMulti;

  const lookingVal = toHubspotMultiValue(p.lookingToGain);
  if (lookingVal) props[HUBSPOT_PROPERTY_MAP.lookingToGain] = lookingVal;

  const offerVal = (p.offerToMembers != null && String(p.offerToMembers).trim()) ? String(p.offerToMembers).trim() : '';
  if (offerVal) props[HUBSPOT_PROPERTY_MAP.offerToMembers] = offerVal;

  const heardVal = (p.heardAboutAlma != null && String(p.heardAboutAlma).trim()) ? String(p.heardAboutAlma).trim() : '';
  if (heardVal) props[HUBSPOT_PROPERTY_MAP.heardAboutAlma] = heardVal;

  const phone = (p.phone != null && String(p.phone).trim()) ? String(p.phone).trim() : '';
  if (phone) props[HUBSPOT_PROPERTY_MAP.phone] = phone;

  const linkedinRaw = (p.linkedinUrl || p.linkedin || p.linkedinUsername || '').trim();
  const linkedin = linkedinRaw ? normalizeLinkedInUrl(linkedinRaw) : '';
  if (linkedin) props[HUBSPOT_PROPERTY_MAP.linkedinUrl] = linkedin;

  const chapterNormalized = normalizeChapter(p.chapter);
  if (chapterNormalized) props[HUBSPOT_PROPERTY_MAP.chapter] = chapterNormalized;

  const bioShort = (p.bioShort || p.bioTitle || '').trim();
  if (bioShort) props[HUBSPOT_PROPERTY_MAP.bioShort] = bioShort;

  const bioLong = (p.bioLong || p.bio || '').trim();
  if (bioLong) props[HUBSPOT_PROPERTY_MAP.bioLong] = bioLong;

  const jobDescVal = (p.work || p.jobDescription || '').trim();
  if (JOB_DESCRIPTION_PROPERTY && jobDescVal) props[JOB_DESCRIPTION_PROPERTY] = jobDescVal;

  const profileImageUrl = (p.profileImage ?? p.profile_image ?? p.avatarUrl ?? p.avatar_url ?? '').toString().trim();
  if (PROFILE_IMAGE_PROPERTY && profileImageUrl) props[PROFILE_IMAGE_PROPERTY] = profileImageUrl;

  // Safeguard: only send properties that are in the allowed set (avoid invalid/unknown property errors)
  const filtered = {};
  for (const [key, val] of Object.entries(props)) {
    if (key && val !== undefined && val !== null && String(val).trim() !== '' && ALLOWED_PROPERTIES_FOR_SEND.has(key)) {
      filtered[key] = typeof val === 'string' ? val.trim() : val;
    }
  }
  return filtered;
}

/**
 * Fetch a single contact by ID and return its email (for identity verification).
 * @returns { Promise<string | null> } contact's email or null
 */
async function getContactEmail(token, contactId) {
  if (!contactId || !String(contactId).trim()) return null;
  const url = `${CONTACTS_URL}/${encodeURIComponent(String(contactId).trim())}?properties=email`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) return null;
  const data = await res.json().catch(() => ({}));
  const email = data.properties?.email;
  return email != null && String(email).trim() !== '' ? String(email).trim().toLowerCase() : null;
}

/**
 * Search for a HubSpot contact by email (exact match only).
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
 * Delete a HubSpot contact by email (used when rejecting applicants).
 * @returns {Promise<{ ok: boolean, deleted?: boolean, skipped?: boolean, reason?: string, hubspotContactId?: string, error?: string }>}
 */
export async function deleteHubspotContactByEmail(email) {
  const tokenResult = getHubspotToken();
  if (!tokenResult.ok) {
    return { ok: true, skipped: true, reason: 'hubspot_not_configured' };
  }

  const norm = String(email || '').trim().toLowerCase();
  if (!norm) {
    return { ok: false, error: 'Email is required' };
  }

  const token = tokenResult.token;
  const found = await findContactByEmail(token, norm);
  if (!found?.id) {
    return { ok: true, skipped: true, reason: 'not_found' };
  }

  const res = await fetch(`${CONTACTS_URL}/${encodeURIComponent(found.id)}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok && res.status !== 404) {
    const text = await res.text().catch(() => '');
    console.error('[hubspot-contact-sync] delete failed:', res.status, text);
    return { ok: false, error: `HubSpot delete failed (${res.status})` };
  }

  console.log('[hubspot-contact-sync] Deleted contact by email:', norm, found.id);
  return { ok: true, deleted: true, hubspotContactId: found.id };
}

/**
 * Upsert a contact in HubSpot from Alma profile. Use this from API route or Cloud Function.
 * Identity: use ONLY profile._lookupEmail (canonical DB email for this user) for search.
 * Never use profile.email for lookup (it may come from request body and can overwrite another contact).
 * - If profile.hubspotContactId is set: verify that contact's email matches _lookupEmail; if yes, PATCH; if no, ignore id and fall back.
 * - Else: only if profile._lookupEmail is set, search by that email; if found, PATCH and return id.
 * - If not found or no _lookupEmail: create new contact (never search by profile.email).
 *
 * @param {object} profile - Alma user profile. Caller MUST set profile._lookupEmail to canonical user email (e.g. current.email from users doc) for correct identity.
 * @returns { Promise<{ ok: boolean, hubspotContactId?: string, error?: string }> }
 */
export async function upsertHubspotContact(profile) {
  const tokenResult = getHubspotToken();
  if (!tokenResult.ok) {
    return { ok: false, error: tokenResult.error };
  }
  const token = tokenResult.token;
  const lookupEmail = (profile?._lookupEmail && String(profile._lookupEmail).trim())
    ? String(profile._lookupEmail).trim().toLowerCase()
    : null;
  const properties = buildHubSpotProperties(profile);

  console.log('[hubspot-debug] upsertHubspotContact INPUT', {
    hasLookupEmail: !!lookupEmail,
    lookupEmail: lookupEmail || '(none)',
    profileEmail: profile?.email || '(none)',
    storedHubspotContactId: (profile?.hubspotContactId || '').toString().trim() || null,
    payloadKeys: Object.keys(properties),
  });

  if (Object.keys(properties).length === 0) {
    return { ok: false, error: 'No properties to sync' };
  }
  if (!properties.email && !lookupEmail) {
    return { ok: false, error: 'Cannot sync: no email for contact identity' };
  }

  let contactId = (profile?.hubspotContactId || '').toString().trim() || null;
  let path = null;

  if (contactId && lookupEmail) {
    const existingEmail = await getContactEmail(token, contactId);
    if (existingEmail !== lookupEmail) {
      contactId = null;
    }
  }

  if (contactId) {
    path = 'UPDATE_BY_STORED_ID';
    const updateResult = await updateContact(token, contactId, properties);
    if (!updateResult.ok) {
      return { ok: false, error: updateResult.error };
    }
    console.log('[hubspot-debug] upsertHubspotContact RESULT', { path, matchType: 'stored_id', selectedHubspotContactId: contactId, lookupEmail, payloadKeys: Object.keys(properties), payload: properties });
    return { ok: true, hubspotContactId: contactId };
  }

  if (lookupEmail) {
    const found = await findContactByEmail(token, lookupEmail);
    if (found) {
      const primaryEmail = await getContactEmail(token, found.id);
      const primaryMatches = primaryEmail != null && primaryEmail === lookupEmail;
      if (primaryMatches) {
        contactId = found.id;
        path = 'UPDATE_BY_EMAIL_SEARCH';
        const updateResult = await updateContact(token, contactId, properties);
        if (!updateResult.ok) {
          return { ok: false, error: updateResult.error };
        }
        console.log('[hubspot-debug] upsertHubspotContact RESULT', { path, matchType: 'primary_email', selectedHubspotContactId: contactId, lookupEmail, payloadKeys: Object.keys(properties), payload: properties });
        return { ok: true, hubspotContactId: contactId };
      }
      console.log('[hubspot-contact-sync] Email search found contact but primary email does not match; creating new contact', { foundContactId: found.id, primaryEmail: primaryEmail || '(none)', lookupEmail });
    }
  }

  path = 'CREATE';
  const createResult = await createContact(token, properties);
  if (createResult.error) {
    return { ok: false, error: createResult.error };
  }
  contactId = createResult.id;
  console.log('[hubspot-debug] upsertHubspotContact RESULT', { path, matchType: 'new_contact', selectedHubspotContactId: contactId, lookupEmail, payloadKeys: Object.keys(properties), payload: properties });
  return { ok: true, hubspotContactId: contactId };
}

export { HUBSPOT_PROPERTY_MAP, buildHubSpotProperties, findContactByEmail };
