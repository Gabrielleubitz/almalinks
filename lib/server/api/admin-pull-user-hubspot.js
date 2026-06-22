/**
 * POST /api/admin-pull-user-hubspot
 * Admin-only: fetch a single user's HubSpot contact data and write it back to Firestore.
 * Primarily used to pull the `picture` (avatar) URL from HubSpot onto the user's profile.
 * Preserves user-uploaded Cloudinary pictures (profileImagePublicId takes precedence).
 *
 * Body: { adminId: string, targetUserId: string }
 */

import '../firebase-init.js';
import admin from '../firebase-init.js';
import { db } from '../firebase-init.js';
import { authorizeUser } from './hubspot-auth.js';
import { getHubspotToken } from './hubspot-auth.js';

const HUBSPOT_CONTACTS_URL = 'https://api.hubapi.com/crm/v3/objects/contacts';

/** Picture property keys to try, in priority order. */
const PICTURE_KEYS = [
  'picture',
  'profile_picture',
  'hs_avatar_filemanager_url',
  'hs_avatar_url',
  'photo_url',
  'profile_photo_url',
  'avatar_url',
  'facebook_avatar',
];

function isValidHttpImageUrl(s) {
  if (!s || typeof s !== 'string') return false;
  const t = s.trim();
  if (!t || t === 'undefined' || t === 'null') return false;
  try {
    const u = new URL(t);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

function propVal(props, key) {
  const raw = props[key];
  if (raw === undefined || raw === null) return '';
  if (typeof raw === 'object' && raw !== null && 'value' in raw) {
    return raw.value == null ? '' : String(raw.value).trim();
  }
  return String(raw).trim();
}

function firstProp(props, keys) {
  for (const k of keys) {
    const v = propVal(props, k);
    if (v) return v;
  }
  return '';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const authResult = await authorizeUser(req);
  if (!authResult.ok) {
    return res.status(authResult.status).json({ ok: false, error: authResult.error });
  }

  const { targetUserId } = req.body || {};
  if (!targetUserId) {
    return res.status(400).json({ ok: false, error: 'targetUserId is required' });
  }

  if (!db) {
    return res.status(503).json({ ok: false, error: 'Database not available' });
  }

  try {
    // Verify admin
    const callerUid = authResult.uid;
    const callerSnap = await db.collection('users').doc(callerUid).get();
    if (!callerSnap.exists || callerSnap.data()?.role !== 'admin') {
      return res.status(403).json({ ok: false, error: 'Admin access required' });
    }

    // Load target user
    const targetRef = db.collection('users').doc(targetUserId);
    const targetSnap = await targetRef.get();
    if (!targetSnap.exists) {
      return res.status(404).json({ ok: false, error: 'User not found' });
    }
    const userData = targetSnap.data();

    // If user uploaded their own picture, respect it
    if (userData.profileImagePublicId && String(userData.profileImagePublicId).trim()) {
      return res.status(200).json({
        ok: true,
        skipped: true,
        reason: 'User has a custom uploaded picture — HubSpot picture not applied.',
      });
    }

    const hubspotContactId = userData.hubspotContactId || null;
    if (!hubspotContactId) {
      return res.status(404).json({
        ok: false,
        error: 'No hubspotContactId on this user — run Sync to HubSpot first to link the contact.',
      });
    }

    const tokenResult = getHubspotToken();
    if (!tokenResult.ok) {
      return res.status(tokenResult.status).json({ ok: false, error: tokenResult.error });
    }
    const token = tokenResult.token;

    // Fetch the HubSpot contact with picture properties
    const propertiesParam = PICTURE_KEYS.join(',');
    const url = `${HUBSPOT_CONTACTS_URL}/${hubspotContactId}?properties=${propertiesParam}`;
    const hsRes = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });

    if (!hsRes.ok) {
      const text = await hsRes.text();
      console.error('[admin-pull-user-hubspot] HubSpot fetch failed:', hsRes.status, text.slice(0, 200));
      return res.status(502).json({ ok: false, error: `HubSpot API error: ${hsRes.status}` });
    }

    const hsData = await hsRes.json();
    const props = hsData.properties || {};
    const pictureUrl = firstProp(props, PICTURE_KEYS);

    if (!pictureUrl || !isValidHttpImageUrl(pictureUrl)) {
      return res.status(200).json({
        ok: true,
        skipped: true,
        reason: 'HubSpot contact has no valid picture URL on the "picture" property.',
      });
    }

    await targetRef.set(
      {
        avatarUrl: pictureUrl,
        profileImage: pictureUrl,
        hubspotPictureLastPulledAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    console.log('[admin-pull-user-hubspot] Updated picture for', targetUserId, pictureUrl);
    return res.status(200).json({ ok: true, pictureUrl });
  } catch (err) {
    console.error('[admin-pull-user-hubspot] Error:', err);
    return res.status(500).json({ ok: false, error: err.message || 'Failed to pull from HubSpot' });
  }
}
