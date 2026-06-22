/**
 * POST /api/sync-hubspot-contacts
 * Imports ALL HubSpot CRM contacts into Firestore and creates Firebase Auth accounts:
 * 1) hubspotContacts collection (by HubSpot id) - upsert with hubspotId, email, properties, syncedAt
 * 2) Firebase Auth user (email + default password) so contacts can sign in
 * 3) users collection with source: 'hubspot', status: 'approved'
 * UPSERT using set(..., { merge: true }). Pages through HubSpot API (limit=100, paging.next.after).
 *
 * Auth: Firebase Admin (Bearer) OR x-sync-secret. Token: HUBSPOT_ACCESS_TOKEN (server env only).
 */
import '../firebase-init.js';
import admin from '../firebase-init.js';
import { db, auth } from '../firebase-init.js';
import { authorize, getHubspotToken } from './hubspot-auth.js';

const HUBSPOT_CONTACTS_URL = 'https://api.hubapi.com/crm/v3/objects/contacts';
const LIMIT = 100;

/** HubSpot Contact internal name for Chapter (Settings → Properties → Contact → Chapter). */
const CHAPTER_PROPERTY_NAME = (process.env.HUBSPOT_CHAPTER_PROPERTY_NAME || 'chapter').toString().trim();

/** HubSpot "Bio Title" (label Bio Title, internal name bionew). */
const BIO_TITLE_PROPERTY_NAME = (process.env.HUBSPOT_BIO_TITLE_PROPERTY_NAME || 'bionew').toString().trim();

/** HubSpot "Membership Type" dropdown (trustees identified by Trustee option). */
const MEMBERSHIP_TYPE_PROPERTY_NAME = (process.env.HUBSPOT_MEMBERSHIP_TYPE_PROPERTY_NAME || 'membership_type').toString().trim();

/**
 * Picture URL property internal name(s), comma-separated. Tried in order; also always tries picture, profile_picture, etc.
 * Example: picture,profile_picture
 */
const PICTURE_PROPERTY_KEYS = (process.env.HUBSPOT_CONTACT_PROPERTY_PICTURE || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

/** If set, replaces the entire property list HubSpot is asked for (comma-separated internal names). */
const PROPERTIES_FULL_OVERRIDE = (process.env.HUBSPOT_SYNC_CONTACT_PROPERTIES || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

/** Comma-separated internal names appended to the default list. */
const PROPERTIES_EXTRA = (process.env.HUBSPOT_SYNC_CONTACT_PROPERTIES_EXTRA || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

/**
 * If not 'false', sync fetches the full list of Contact property internal names from HubSpot and merges them
 * into the request (capped by HUBSPOT_SYNC_MAX_PROPERTIES — HubSpot list URLs have practical limits).
 */
const FETCH_ALL_PROPERTY_NAMES = process.env.HUBSPOT_SYNC_FETCH_ALL_PROPERTIES !== 'false';

/** Max number of property names to send on GET /contacts (default 100). */
const MAX_PROPERTIES_PER_REQUEST = Math.min(
  200,
  Math.max(20, parseInt(process.env.HUBSPOT_SYNC_MAX_PROPERTIES || '150', 10) || 150)
);

/** Default properties to request — matches common Alma/HubSpot fields + typical custom labels (internal names may vary by portal). */
const BASE_HUBSPOT_PROPERTIES = [
  'email',
  'firstname',
  'lastname',
  'phone',
  'mobilephone',
  'jobtitle',
  'company',
  'city',
  'state',
  'hs_state',
  'ip_state',
  'ip_city',
  'zip',
  'country',
  'timezone',
  'hs_timezone',
  'website',
  'hs_personal_website',
  'hs_linkedin_url',
  'linkedin_profile',
  'linkedin',
  CHAPTER_PROPERTY_NAME,
  BIO_TITLE_PROPERTY_NAME,
  MEMBERSHIP_TYPE_PROPERTY_NAME,
  'bio_one_liner',
  'bio_short',
  'bio_25',
  'bio_paragraph',
  'bio_long',
  'bio',
  'bio_old',
  'linkedinbio',
  'interests',
  'industry',
  'hs_industry',
  'year_joined',
  'joined_year',
  'picture',
  'profile_picture',
  'photo_url',
  'profile_photo_url',
  'hs_avatar_filemanager_url',
  'hs_avatar_url',
  'avatar_url',
  'facebook_avatar',
  'mailchimp',
  'portal',
  'phl_whatsapp_group',
  'ny_whatsapp_group',
  'whatsapp_group',
  'spotlight_member',
];

function buildHubspotPropertiesList() {
  if (PROPERTIES_FULL_OVERRIDE.length) {
    return [...new Set(PROPERTIES_FULL_OVERRIDE)];
  }
  const merged = [...BASE_HUBSPOT_PROPERTIES, ...PICTURE_PROPERTY_KEYS, ...PROPERTIES_EXTRA];
  return [...new Set(merged)];
}

/** Resolved per sync run (may include all portal property names). */
let PROPERTIES = buildHubspotPropertiesList();

/**
 * GET /crm/v3/properties/contacts — all contact property internal names for this portal.
 * @param {string} token
 * @returns {Promise<string[]>}
 */
async function fetchAllContactPropertyInternalNames(token) {
  try {
    const url = 'https://api.hubapi.com/crm/v3/properties/contacts';
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    if (!res.ok) {
      const text = await res.text();
      console.warn('[sync-hubspot-contacts] properties/contacts list failed:', res.status, text.slice(0, 200));
      return [];
    }
    const data = await res.json();
    const results = data.results || [];
    return results.map((p) => p.name).filter(Boolean);
  } catch (e) {
    console.warn('[sync-hubspot-contacts] fetchAllContactPropertyInternalNames:', e?.message || e);
    return [];
  }
}

/**
 * Merge BASE + portal properties, cap length for GET list URL limits.
 * @param {string} token
 */
async function resolvePropertiesForSync(token) {
  if (PROPERTIES_FULL_OVERRIDE.length) {
    PROPERTIES = [...new Set(PROPERTIES_FULL_OVERRIDE)];
    return;
  }
  let merged = [...BASE_HUBSPOT_PROPERTIES, ...PICTURE_PROPERTY_KEYS, ...PROPERTIES_EXTRA];
  if (FETCH_ALL_PROPERTY_NAMES) {
    const allNames = await fetchAllContactPropertyInternalNames(token);
    if (allNames.length) {
      merged = [...merged, ...allNames];
    }
  }
  const seen = new Set();
  const ordered = [];
  for (const p of merged) {
    if (!p || seen.has(p)) continue;
    seen.add(p);
    ordered.push(p);
    if (ordered.length >= MAX_PROPERTIES_PER_REQUEST) break;
  }
  PROPERTIES = ordered;
  console.log(
    `[sync-hubspot-contacts] Requesting ${PROPERTIES.length} HubSpot contact properties (cap ${MAX_PROPERTIES_PER_REQUEST}).`
  );
}

/**
 * Flatten HubSpot property map to JSON-safe values for Firestore (hubspotContactProperties).
 * @param {Record<string, unknown>} props
 */
function flattenHubspotPropertiesForFirestore(props) {
  const out = {};
  for (const [k, raw] of Object.entries(props || {})) {
    if (raw === undefined || raw === null) {
      out[k] = null;
      continue;
    }
    if (typeof raw === 'object' && raw !== null && Object.prototype.hasOwnProperty.call(raw, 'value')) {
      const v = raw.value;
      if (v === undefined || v === null) out[k] = null;
      else if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') out[k] = v;
      else out[k] = String(v);
    } else if (typeof raw === 'string' || typeof raw === 'number' || typeof raw === 'boolean') {
      out[k] = raw;
    } else {
      try {
        out[k] = JSON.stringify(raw);
      } catch (e) {
        out[k] = String(raw);
      }
    }
  }
  return out;
}

/**
 * Profile fields we only fill on existing users when currently empty (do not overwrite member edits).
 * avatarUrl / profileImage are intentionally NOT here — they are handled separately below so that
 * HubSpot always wins unless the user has uploaded their own picture via Cloudinary (profileImagePublicId set).
 */
const FILL_ONLY_IF_EMPTY_KEYS = new Set([
  'name',
  'displayName',
  'firstName',
  'lastName',
  'phone',
  'title',
  'position',
  'company',
  'organization',
  'city',
  'state',
  'country',
  'timezone',
  'website',
  'linkedin',
  'linkedinUrl',
  'twitter',
  'bio',
  'skills',
  'industry',
  'yearJoined',
]);

function isProfileValueEmpty(v) {
  if (v === undefined || v === null) return true;
  if (typeof v === 'string' && v.trim() === '') return true;
  if (Array.isArray(v) && v.length === 0) return true;
  return false;
}

/** Firestore rejects `undefined` in document data; strip before set/merge. */
function omitUndefinedFirestoreValues(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj;
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v;
  }
  return out;
}

/**
 * Merge HubSpot patch into user doc: new users get full patch; existing users get missing fields filled + always refresh HubSpot metadata/raw properties.
 * @param {Record<string, unknown>|undefined} existing
 * @param {Record<string, unknown>} patch
 * @param {boolean} isNewUser
 */
function mergeHubspotUserPatch(existing, patch, isNewUser) {
  const ex = existing && typeof existing === 'object' ? existing : {};
  const out = { ...patch };

  if (!isNewUser && Object.keys(ex).length > 0) {
    if (ex.createdAt) delete out.createdAt;
    if (ex.importedAt) delete out.importedAt;

    if (ex.role === 'admin') {
      delete out.role;
      delete out.status;
    }

    const isExistingHubspotUser = ex.importedFrom === 'hubspot' || ex.source === 'hubspot';
    if (!isExistingHubspotUser) {
      delete out.source;
      delete out.importedFrom;
      delete out.hubspotObjectType;
      delete out.role;
      delete out.status;
      delete out.registrationComplete;
    }

    for (const key of FILL_ONLY_IF_EMPTY_KEYS) {
      if (key in patch && !isProfileValueEmpty(ex[key])) {
        delete out[key];
      }
    }

    if (ex.registrationComplete === true && 'registrationComplete' in out) {
      delete out.registrationComplete;
    }
    if (ex.profileVisibility && 'profileVisibility' in out) {
      delete out.profileVisibility;
    }

    // avatarUrl / profileImage: HubSpot always wins UNLESS the user has a Cloudinary-uploaded picture
    // (indicated by profileImagePublicId being set via the app uploader).
    if (ex.profileImagePublicId && String(ex.profileImagePublicId).trim()) {
      delete out.avatarUrl;
      delete out.profileImage;
    }

    if (patch.hubspotImportExtras && ex.hubspotImportExtras && typeof ex.hubspotImportExtras === 'object') {
      out.hubspotImportExtras = { ...ex.hubspotImportExtras, ...patch.hubspotImportExtras };
    }
  }

  return out;
}

const DEFAULT_PASSWORD = process.env.HUBSPOT_IMPORT_DEFAULT_PASSWORD || '123456789';
const DEFAULT_PROFILE_VISIBILITY = process.env.HUBSPOT_IMPORT_PROFILE_VISIBILITY || 'public';
const DEFAULT_REGISTRATION_COMPLETE = process.env.HUBSPOT_IMPORT_REGISTRATION_COMPLETE
  ? process.env.HUBSPOT_IMPORT_REGISTRATION_COMPLETE === 'true'
  : true;

function normalizeEmail(email) {
  return email == null ? '' : String(email).trim().toLowerCase();
}

/** Only persist avatar URLs that browsers can load (avoids broken <img> from bad HubSpot values). */
function isValidHttpImageUrl(s) {
  if (!s || typeof s !== 'string') return false;
  const t = s.trim();
  if (!t || t === 'undefined' || t === 'null') return false;
  try {
    const u = new URL(t, 'https://placeholder.invalid');
    if (!u.hostname || u.hostname === 'placeholder.invalid') return false;
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

/** Read a HubSpot v3 contact property value (string or { value }). */
function propVal(props, key) {
  if (!props || key == null || key === '') return '';
  const raw = props[key];
  if (raw === undefined || raw === null) return '';
  if (typeof raw === 'object' && raw !== null && Object.prototype.hasOwnProperty.call(raw, 'value')) {
    const v = raw.value;
    return v == null || v === '' ? '' : String(v).trim();
  }
  return String(raw).trim();
}

/** First non-empty among keys (order matters). */
function firstProp(props, keys) {
  for (const k of keys) {
    const v = propVal(props, k);
    if (v) return v;
  }
  return '';
}

/** HubSpot Membership Type dropdown: Trustee / Mentor options (semicolon-separated multi-select). */
function membershipTypeTokens(raw) {
  const s = String(raw || '').trim();
  if (!s) return [];
  return s
    .split(/[;,]/)
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
}

function membershipTypeIndicatesTrustee(raw) {
  return membershipTypeTokens(raw).some((t) => {
    if (t === 'trustee' || t === 'trustees') return true;
    if (/\btrustee\b/.test(t) && !/non|not|former/.test(t)) return true;
    return false;
  });
}

function membershipTypeIndicatesMentor(raw) {
  return membershipTypeTokens(raw).some((t) => {
    if (t.includes('mentee')) return false;
    if (t === 'mentor' || t === 'mentors') return true;
    if (/\bmentor\b/.test(t) && !/non|not|former/.test(t)) return true;
    return false;
  });
}

/**
 * Map HubSpot contact properties → Firestore users/{uid} fields (merge-friendly).
 * @param {object} opts
 * @param {Record<string, unknown>} opts.props
 * @param {string} opts.docId - HubSpot contact id
 * @param {FirebaseFirestore.FieldValue} opts.userNow - serverTimestamp()
 */
function buildUserDocFromHubspot({ props, docId, userNow }) {
  const first = propVal(props, 'firstname');
  const last = propVal(props, 'lastname');
  const email = normalizeEmail(propVal(props, 'email'));
  const name = [first, last].filter(Boolean).join(' ') || email || 'HubSpot Contact';
  const phone = firstProp(props, ['phone', 'mobilephone']) || null;
  const chapterRaw = propVal(props, CHAPTER_PROPERTY_NAME);
  const chapter = chapterRaw || null;

  const title = firstProp(props, ['jobtitle']) || null;
  const company = firstProp(props, ['company']) || null;
  const city = firstProp(props, ['city', 'ip_city']) || null;
  const state = firstProp(props, ['state', 'hs_state', 'ip_state']) || null;
  const country = firstProp(props, ['country']) || null;
  const timezone = firstProp(props, ['timezone', 'hs_timezone']) || null;
  const website = firstProp(props, ['website', 'hs_personal_website']) || null;
  const linkedin = firstProp(props, ['linkedin_profile', 'hs_linkedin_url', 'linkedin']) || null;
  const twitter = firstProp(props, ['twitter', 'twitterhandle', 'hs_twitter_handle', 'twitterusername']) || null;

  const bioTitle =
    firstProp(props, [BIO_TITLE_PROPERTY_NAME, 'bionew', 'bio_short', 'bio_one_liner']) || null;

  const membershipTypeRaw = propVal(props, MEMBERSHIP_TYPE_PROPERTY_NAME);
  const isTrustee = membershipTypeIndicatesTrustee(membershipTypeRaw);
  const isMentor = membershipTypeIndicatesMentor(membershipTypeRaw);
  const bioOld = firstProp(props, ['bio_old']);
  let bio = firstProp(props, ['bio_long', 'bio_paragraph', 'bio_25', 'bio', 'linkedinbio']);
  if (!bio && bioOld) bio = bioOld;

  const interests = firstProp(props, ['interests']);
  let skills;
  if (interests) {
    skills = interests
      .split(/[,;]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 12);
    if (skills.length === 0) skills = undefined;
  }

  const pictureKeys = [
    ...new Set([
      ...PICTURE_PROPERTY_KEYS,
      'hs_avatar_filemanager_url',
      'hs_avatar_url',
      'picture',
      'profile_picture',
      'photo_url',
      'profile_photo_url',
      'avatar_url',
      'facebook_avatar',
    ]),
  ];
  const pictureUrl = firstProp(props, pictureKeys) || null;

  const industry = firstProp(props, ['industry', 'hs_industry']) || null;
  const yearJoined = firstProp(props, ['year_joined', 'joined_year']) || null;

  const mailchimp = propVal(props, 'mailchimp') || '';
  const portal = propVal(props, 'portal') || '';
  const phlWhatsapp = propVal(props, 'phl_whatsapp_group') || '';
  const nyWhatsapp = propVal(props, 'ny_whatsapp_group') || '';
  const whatsappGroup = propVal(props, 'whatsapp_group') || '';
  const spotlightMember = propVal(props, 'spotlight_member') || '';

  const patch = {
    email,
    name,
    displayName: name,
    firstName: first || undefined,
    lastName: last || undefined,
    phone,
    status: 'approved',
    role: 'member',
    source: 'hubspot',
    importedFrom: 'hubspot',
    hubspotObjectType: 'contact',

    hubspotContactId: docId,
    hubspotLastSyncedAt: userNow,
    hubspotSyncStatus: 'ok',
    hubspotSyncError: null,

    hubspotId: docId,

    registrationComplete: DEFAULT_REGISTRATION_COMPLETE,
    profileVisibility: DEFAULT_PROFILE_VISIBILITY,

    updatedAt: userNow,

    chapter: chapter || null,
    title: title || undefined,
    position: title || undefined,
    company: company || undefined,
    organization: company || undefined,
    city: city || undefined,
    state: state || undefined,
    country: country || undefined,
    timezone: timezone || undefined,
    website: website || undefined,
    linkedin: linkedin || undefined,
    linkedinUrl: linkedin || undefined,
    twitter: twitter || undefined,
    bioTitle: bioTitle || undefined,
    bio: bio || undefined,
    isTrustee,
    isMentor,

    /** Full flattened snapshot of all requested HubSpot contact fields (for fields not mapped to profile columns). */
    hubspotContactProperties: flattenHubspotPropertiesForFirestore(props),
  };

  if (skills?.length) patch.skills = skills;
  if (pictureUrl && isValidHttpImageUrl(pictureUrl)) {
    patch.avatarUrl = pictureUrl;
    patch.profileImage = pictureUrl;
  }
  if (industry) patch.industry = industry;
  if (yearJoined) patch.yearJoined = yearJoined;

  const extras = {};
  if (mailchimp) extras.mailchimp = mailchimp;
  if (portal) extras.portal = portal;
  if (phlWhatsapp) extras.phlWhatsappGroup = phlWhatsapp;
  if (nyWhatsapp) extras.nyWhatsappGroup = nyWhatsapp;
  if (whatsappGroup) extras.whatsappGroup = whatsappGroup;
  if (spotlightMember) extras.spotlightMember = spotlightMember;
  if (bioOld && bio && bio !== bioOld) extras.bioOld = bioOld;

  if (Object.keys(extras).length) patch.hubspotImportExtras = extras;

  return patch;
}

function getTimestampMillis(ts) {
  if (!ts) return 0;
  try {
    if (typeof ts.toDate === 'function') return ts.toDate().getTime();
    if (typeof ts.seconds === 'number') {
      const nanos = typeof ts.nanoseconds === 'number' ? ts.nanoseconds / 1e6 : 0;
      return ts.seconds * 1000 + nanos;
    }
  } catch (e) {
    // ignore
  }
  return 0;
}

function getHubspotContactIdFromUserData(data) {
  const id1 = typeof data?.hubspotContactId === 'string' ? data.hubspotContactId.trim() : '';
  if (id1) return id1;
  const id2 = typeof data?.hubspotId === 'string' ? data.hubspotId.trim() : '';
  if (id2) return id2;
  return '';
}

async function deleteImportedHubspotUser(uid) {
  // uid === Firebase Auth user id (doc id in /users)
  try {
    await auth.deleteUser(uid);
  } catch (e) {
    if (e?.code !== 'auth/user-not-found') {
      console.warn('[sync-hubspot-contacts] auth.deleteUser failed for', uid, e?.code);
    }
  }
  await db.collection('users').doc(uid).delete();
}

async function dedupeImportedHubspotUsersByEmail({ callerUid, dryRun }) {
  // Dedupe safety net: ensure there is at most one importedFrom=hubspot user per email.
  // This prevents duplicates when re-running sync after partial/older imports.
  const usersCol = db.collection('users');
  const snap = await usersCol.where('importedFrom', '==', 'hubspot').get();
  if (snap.empty) return { deletedUsers: 0 };

  const deleted = new Set();
  const groups = new Map(); // email -> array of docs
  for (const d of snap.docs) {
    const data = d.data() || {};
    if (data?.role === 'admin') continue;
    if (callerUid && d.id === callerUid) continue;

    const email = normalizeEmail(data?.email);
    if (!email) continue; // if there is no email, we cannot reliably dedupe

    if (!groups.has(email)) groups.set(email, []);
    groups.get(email).push(d);
  }

  let deletedUsers = 0;
  for (const [, docs] of groups) {
    if (docs.length <= 1) continue;

    const aliveDocs = docs.filter((d) => !deleted.has(d.id));
    if (aliveDocs.length <= 1) continue;

    // Keep the best candidate: prefer docs that already have hubspot contact id, then latest timestamp.
    const best = aliveDocs.reduce((acc, cur) => {
      const accHasId = !!getHubspotContactIdFromUserData(acc.data());
      const curHasId = !!getHubspotContactIdFromUserData(cur.data());
      if (accHasId !== curHasId) return accHasId ? acc : cur;

      const accMillis =
        getTimestampMillis(acc.data()?.hubspotLastSyncedAt) ||
        getTimestampMillis(acc.data()?.importedAt) ||
        getTimestampMillis(acc.data()?.updatedAt) ||
        getTimestampMillis(acc.data()?.createdAt);
      const curMillis =
        getTimestampMillis(cur.data()?.hubspotLastSyncedAt) ||
        getTimestampMillis(cur.data()?.importedAt) ||
        getTimestampMillis(cur.data()?.updatedAt) ||
        getTimestampMillis(cur.data()?.createdAt);

      return curMillis > accMillis ? cur : acc;
    });

    const toDelete = aliveDocs.filter((d) => d.id !== best.id);
    if (dryRun) continue;
    for (const d of toDelete) {
      deleted.add(d.id);
      await deleteImportedHubspotUser(d.id);
      deletedUsers += 1;
    }
  }

  // Second pass: dedupe by hubspot contact id too (covers cases where email is missing/changed).
  const groupsByHubspotId = new Map(); // hubspotContactId -> array of docs
  for (const d of snap.docs) {
    if (deleted.has(d.id)) continue;
    const data = d.data() || {};
    if (data?.role === 'admin') continue;
    if (callerUid && d.id === callerUid) continue;

    const hubspotContactId = getHubspotContactIdFromUserData(data);
    if (!hubspotContactId) continue;

    if (!groupsByHubspotId.has(hubspotContactId)) groupsByHubspotId.set(hubspotContactId, []);
    groupsByHubspotId.get(hubspotContactId).push(d);
  }

  for (const [, docs] of groupsByHubspotId) {
    if (docs.length <= 1) continue;

    const aliveDocs = docs.filter((d) => !deleted.has(d.id));
    if (aliveDocs.length <= 1) continue;

    const best = aliveDocs.reduce((acc, cur) => {
      const accMillis =
        getTimestampMillis(acc.data()?.hubspotLastSyncedAt) ||
        getTimestampMillis(acc.data()?.importedAt) ||
        getTimestampMillis(acc.data()?.updatedAt) ||
        getTimestampMillis(acc.data()?.createdAt);
      const curMillis =
        getTimestampMillis(cur.data()?.hubspotLastSyncedAt) ||
        getTimestampMillis(cur.data()?.importedAt) ||
        getTimestampMillis(cur.data()?.updatedAt) ||
        getTimestampMillis(cur.data()?.createdAt);
      return curMillis > accMillis ? cur : acc;
    });

    const toDelete = aliveDocs.filter((d) => d.id !== best.id);
    if (dryRun) continue;
    for (const d of toDelete) {
      deleted.add(d.id);
      await deleteImportedHubspotUser(d.id);
      deletedUsers += 1;
    }
  }

  return { deletedUsers };
}

/**
 * Fetch existing user docs in parallel chunks (for merge-before-write).
 * @param {FirebaseFirestore.CollectionReference} usersCol
 * @param {string[]} uids
 * @returns {Promise<Map<string, FirebaseFirestore.DocumentSnapshot>>}
 */
async function fetchExistingUserSnapshots(usersCol, uids) {
  const unique = [...new Set(uids.filter(Boolean))];
  const map = new Map();
  const chunkSize = 30;
  for (let i = 0; i < unique.length; i += chunkSize) {
    const chunk = unique.slice(i, i + chunkSize);
    const snaps = await Promise.all(chunk.map((uid) => usersCol.doc(uid).get()));
    snaps.forEach((snap) => map.set(snap.id, snap));
  }
  return map;
}

export async function syncHubspotContactsToFirestore(options) {
  const { token, fullResync = false, dedupeByEmail = true, callerUid = null } = options || {};
  if (!db) throw new Error('Firestore not available');
  if (!auth) throw new Error('Firebase Auth not available');

  const hubspotCol = db.collection('hubspotContacts');
  const usersCol = db.collection('users');

  let deletedUsers = 0;
  if (fullResync) {
    const usersSnap = await usersCol.where('importedFrom', '==', 'hubspot').get();
    for (const docSnap of usersSnap.docs) {
      const data = docSnap.data() || {};
      if (data?.role === 'admin') continue;
      if (callerUid && docSnap.id === callerUid) continue;

      const hubspotId = getHubspotContactIdFromUserData(data);
      // Only delete records that look like HubSpot-imported users.
      if (!hubspotId) continue;

      await deleteImportedHubspotUser(docSnap.id);
      deletedUsers += 1;
    }
  } else if (dedupeByEmail) {
    const res = await dedupeImportedHubspotUsersByEmail({ callerUid, dryRun: false });
    deletedUsers = res.deletedUsers || 0;
  }

  await resolvePropertiesForSync(token);

  let totalUpserted = 0;
  let contactsWithoutEmail = 0;
  let newAuthUsers = 0;
  let reusedAuthUsers = 0;
  let authErrors = 0;
  let firestoreProfilesCreated = 0;
  let firestoreProfilesUpdated = 0;
  let after = undefined;

  do {
    const params = new URLSearchParams();
    params.set('limit', String(LIMIT));
    PROPERTIES.forEach((p) => params.append('properties', p));
    if (after) params.set('after', after);

    const url = `${HUBSPOT_CONTACTS_URL}?${params.toString()}`;
    const hubRes = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!hubRes.ok) {
      const errText = await hubRes.text();
      console.error('[sync-hubspot-contacts] HubSpot error:', hubRes.status, errText);
      throw new Error(`HubSpot API error: ${hubRes.status}`);
    }

    const data = await hubRes.json();
    const results = data.results || [];
    const next = data.paging?.next?.after;

    if (results.length === 0 && !next) break;

    const batch = db.batch();
    /** @type {{ uid: string, docId: string, props: Record<string, unknown>, email: string, name: string }[]} */
    const pageRows = [];

    for (const contact of results) {
      const docId = String(contact.id);
      const props = contact.properties || {};
      const email = normalizeEmail(propVal(props, 'email'));
      const first = propVal(props, 'firstname');
      const last = propVal(props, 'lastname');
      const name = [first, last].filter(Boolean).join(' ') || email || 'HubSpot Contact';
      const chapterRaw = propVal(props, CHAPTER_PROPERTY_NAME);
      const chapter = chapterRaw || null;

      const now = admin.firestore.FieldValue.serverTimestamp();
      batch.set(
        hubspotCol.doc(docId),
        {
          hubspotId: docId,
          email: email || propVal(props, 'email') || null,
          chapter,
          properties: props,
          syncedAt: now,
          importedFrom: 'hubspot',
          hubspotObjectType: 'contact',
          importedAt: now,
        },
        { merge: true }
      );

      if (email) {
        let uid;
        try {
          const userRecord = await auth.createUser({
            email,
            password: DEFAULT_PASSWORD,
            displayName: name || undefined,
            emailVerified: false,
          });
          uid = userRecord.uid;
          newAuthUsers += 1;
        } catch (e) {
          if (e.code === 'auth/email-already-exists') {
            const existing = await auth.getUserByEmail(email);
            uid = existing.uid;
            reusedAuthUsers += 1;
          } else {
            console.warn('[sync-hubspot-contacts] Auth createUser failed for', email, e.code, e.message);
            authErrors += 1;
            totalUpserted += 1;
            continue;
          }
        }

        pageRows.push({ uid, docId, props, email, name });
      } else {
        contactsWithoutEmail += 1;
      }

      totalUpserted += 1;
    }

    const existingSnaps = await fetchExistingUserSnapshots(
      usersCol,
      pageRows.map((r) => r.uid)
    );

    for (const row of pageRows) {
      const snap = existingSnaps.get(row.uid);
      const existingData = snap?.exists ? snap.data() : {};
      const isNewUser = !snap?.exists;

      const userNow = admin.firestore.FieldValue.serverTimestamp();
      const patch = buildUserDocFromHubspot({ props: row.props, docId: row.docId, userNow });
      if (isNewUser) {
        patch.createdAt = userNow;
        patch.importedAt = userNow;
      }

      const merged = mergeHubspotUserPatch(existingData, patch, isNewUser);
      batch.set(usersCol.doc(row.uid), omitUndefinedFirestoreValues(merged), { merge: true });
      if (isNewUser) firestoreProfilesCreated += 1;
      else firestoreProfilesUpdated += 1;
    }

    if (results.length > 0) {
      await batch.commit();
    }

    after = next || null;
    if (after) {
      await new Promise((r) => setTimeout(r, 150));
    }
  } while (after);

  return {
    ok: true,
    totalUpserted,
    /** Total HubSpot contact records written to hubspotContacts */
    totalHubspotContacts: totalUpserted,
    deletedUsers,
    contactsWithoutEmail,
    newAuthUsers,
    reusedAuthUsers,
    authErrors,
    firestoreProfilesCreated,
    firestoreProfilesUpdated,
    propertiesRequested: PROPERTIES.length,
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

  const tokenResult = getHubspotToken();
  if (!tokenResult.ok) {
    return res.status(tokenResult.status).json({ ok: false, error: tokenResult.error });
  }
  const token = tokenResult.token;

  try {
    const fullResync = req.body?.fullResync === true;
    const dedupeByEmail = req.body?.dedupeByEmail !== false;

    const result = await syncHubspotContactsToFirestore({
      token,
      fullResync,
      dedupeByEmail,
      callerUid: authResult.uid || null,
    });

    return res.status(200).json(result);
  } catch (err) {
    console.error('[sync-hubspot-contacts] Error:', err);
    return res.status(500).json({
      ok: false,
      error: err.message || 'Sync failed',
    });
  }
}
