/**
 * POST /api/admin-rebuild-directory
 * Admin-only server-side job: iterate every user in `users` collection and
 * write a fresh `user_directory` entry resolving the best available avatar
 * (profileImage → avatarUrl → hubspotContactProperties picture keys).
 *
 * Runs fully server-side to avoid browser memory / Firestore client quotas.
 */

import '../firebase-init.js';
import admin from '../firebase-init.js';
import { db } from '../firebase-init.js';
import { authorizeUser } from './hubspot-auth.js';

const HUBSPOT_PICTURE_KEYS = [
  'hs_avatar_filemanager_url',
  'hs_avatar_url',
  'picture',
  'profile_picture',
  'photo_url',
  'profile_photo_url',
  'avatar_url',
  'facebook_avatar',
];

function isValidUrl(s) {
  if (!s || typeof s !== 'string') return false;
  const t = s.trim();
  return t.startsWith('http://') || t.startsWith('https://');
}

function resolveAvatar(userData) {
  const direct = String(userData.profileImage || userData.avatarUrl || '').trim();
  if (direct && isValidUrl(direct)) return direct;
  const props = userData.hubspotContactProperties;
  if (props && typeof props === 'object') {
    for (const k of HUBSPOT_PICTURE_KEYS) {
      const v = String(props[k] ?? '').trim();
      if (v && isValidUrl(v)) return v;
    }
  }
  return null;
}

function generateSearchTokens(strings) {
  const tokens = new Set();
  for (const str of strings) {
    if (!str) continue;
    const words = String(str).toLowerCase().split(/\s+/);
    for (const word of words) {
      if (word.length < 2) continue;
      for (let i = 2; i <= word.length; i++) {
        tokens.add(word.substring(0, i));
      }
    }
  }
  return Array.from(tokens);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const authResult = await authorizeUser(req);
  if (!authResult.ok) {
    return res.status(authResult.status).json({ ok: false, error: authResult.error });
  }

  if (!db) {
    return res.status(503).json({ ok: false, error: 'Database not available' });
  }

  try {
    // Verify admin
    const callerSnap = await db.collection('users').doc(authResult.uid).get();
    if (!callerSnap.exists || callerSnap.data()?.role !== 'admin') {
      return res.status(403).json({ ok: false, error: 'Admin access required' });
    }

    const usersSnap = await db.collection('users').get();
    const total = usersSnap.size;
    let updated = 0;
    let errors = 0;

    // Firestore Admin SDK supports batches of up to 500 operations
    const BATCH_SIZE = 400;
    let batch = db.batch();
    let batchCount = 0;

    for (const userDoc of usersSnap.docs) {
      try {
        const uid = userDoc.id;
        const data = userDoc.data();

        const name = data.displayName || data.name || 'Unknown User';
        const work = data.work || data.title || data.bioTitle || 'Not specified';
        const profileImage = resolveAvatar(data);
        const searchTokens = generateSearchTokens([name, work]);

        const entry = {
          uid,
          name,
          work,
          position: data.position || data.title || '',
          profileImage: profileImage || null,
          discoverability: data.discoverability || data.profileVisibility || 'event_only',
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        const dirRef = db.collection('user_directory').doc(uid);
        batch.set(dirRef, entry, { merge: true });
        batchCount++;
        updated++;

        if (batchCount >= BATCH_SIZE) {
          await batch.commit();
          batch = db.batch();
          batchCount = 0;
        }
      } catch (e) {
        console.warn('[rebuild-directory] Failed for', userDoc.id, e?.message);
        errors++;
      }
    }

    if (batchCount > 0) {
      await batch.commit();
    }

    console.log(`[admin-rebuild-directory] Done: ${updated} updated, ${errors} errors out of ${total}`);
    return res.status(200).json({ ok: true, total, updated, errors });
  } catch (err) {
    console.error('[admin-rebuild-directory] Error:', err);
    return res.status(500).json({ ok: false, error: err.message || 'Rebuild failed' });
  }
}
