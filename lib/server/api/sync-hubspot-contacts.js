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
  'zip',
  'country',
  'website',
  'hs_personal_website',
  'hs_linkedin_url',
  'linkedin_profile',
  'linkedin',
  CHAPTER_PROPERTY_NAME,
  'bio_one_liner',
  'bio_25',
  'bio_paragraph',
  'bio',
  'bio_old',
  'interests',
  'industry',
  'hs_industry',
  'year_joined',
  'joined_year',
  'picture',
  'profile_picture',
  'photo_url',
  'profile_photo_url',
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

const PROPERTIES = buildHubspotPropertiesList();

const DEFAULT_PASSWORD = process.env.HUBSPOT_IMPORT_DEFAULT_PASSWORD || '123456789';
const DEFAULT_PROFILE_VISIBILITY = process.env.HUBSPOT_IMPORT_PROFILE_VISIBILITY || 'public';
const DEFAULT_REGISTRATION_COMPLETE = process.env.HUBSPOT_IMPORT_REGISTRATION_COMPLETE
  ? process.env.HUBSPOT_IMPORT_REGISTRATION_COMPLETE === 'true'
  : true;

function normalizeEmail(email) {
  return email == null ? '' : String(email).trim().toLowerCase();
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
  const city = firstProp(props, ['city']) || null;
  const country = firstProp(props, ['country']) || null;
  const website = firstProp(props, ['website', 'hs_personal_website']) || null;
  const linkedin = firstProp(props, ['linkedin_profile', 'hs_linkedin_url', 'linkedin']) || null;

  const bioTitle = firstProp(props, ['bio_one_liner']) || null;
  const bioOld = firstProp(props, ['bio_old']);
  let bio = firstProp(props, ['bio_25', 'bio_paragraph', 'bio']);
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

  const pictureKeys = [...new Set([...PICTURE_PROPERTY_KEYS, 'picture', 'profile_picture', 'photo_url', 'profile_photo_url'])];
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

    importedAt: userNow,
    registrationComplete: DEFAULT_REGISTRATION_COMPLETE,
    profileVisibility: DEFAULT_PROFILE_VISIBILITY,

    createdAt: userNow,
    updatedAt: userNow,

    chapter: chapter || null,
    title: title || undefined,
    position: title || undefined,
    company: company || undefined,
    organization: company || undefined,
    city: city || undefined,
    country: country || undefined,
    website: website || undefined,
    linkedin: linkedin || undefined,
    linkedinUrl: linkedin || undefined,
    bioTitle: bioTitle || undefined,
    bio: bio || undefined,
  };

  if (skills?.length) patch.skills = skills;
  if (pictureUrl) {
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

  let totalUpserted = 0;
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
        } catch (e) {
          if (e.code === 'auth/email-already-exists') {
            const existing = await auth.getUserByEmail(email);
            uid = existing.uid;
          } else {
            console.warn('[sync-hubspot-contacts] Auth createUser failed for', email, e.code, e.message);
            totalUpserted += 1;
            continue;
          }
        }

        const userNow = admin.firestore.FieldValue.serverTimestamp();
        const userPayload = buildUserDocFromHubspot({ props, docId, userNow });
        batch.set(usersCol.doc(uid), userPayload, { merge: true });
      }

      totalUpserted += 1;
    }

    if (results.length > 0) {
      await batch.commit();
    }

    after = next || null;
    if (after) {
      await new Promise((r) => setTimeout(r, 150));
    }
  } while (after);

  return { ok: true, totalUpserted, deletedUsers };
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
      callerUid: authResult.callerUid || null,
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
