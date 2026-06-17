/**
 * Shared admin verification for API routes.
 * Accepts admin role from Firebase custom claims OR Firestore users/{uid}.role === 'admin'.
 */
import './firebase-init.js';
import { auth, db } from './firebase-init.js';

export function isAdminFromClaims(decoded) {
  if (!decoded) return false;
  return decoded.role === 'admin' || decoded.admin === true;
}

export function isAdminFromUserDoc(userData) {
  if (!userData || typeof userData !== 'object') return false;
  return userData.role === 'admin' || userData.admin === true;
}

export async function isAdminUser(uid, decoded = null) {
  if (isAdminFromClaims(decoded)) return true;
  if (!uid || !db) return false;
  try {
    const snap = await db.collection('users').doc(uid).get();
    return snap.exists && isAdminFromUserDoc(snap.data());
  } catch (err) {
    console.warn('[admin-auth] Firestore admin lookup failed:', err?.message || err);
    return false;
  }
}

/** Alias used by hubspot-auth and legacy routes. */
export async function resolveIsAdmin(decoded) {
  const uid = decoded?.uid || decoded?.sub || null;
  return isAdminUser(uid, decoded);
}

/**
 * Detailed admin resolution (for error messages in admin UI).
 * @returns {{ isAdmin: boolean, callerUid: string|null, detail: string|null }}
 */
export async function resolveAdminAccess(decoded, firestoreDb = db) {
  let isAdmin = isAdminFromClaims(decoded);
  const callerUid = decoded?.uid || decoded?.sub || null;
  let detail = null;

  if (!isAdmin && callerUid && firestoreDb) {
    try {
      const userSnap = await firestoreDb.collection('users').doc(callerUid).get();
      const userDoc = userSnap.exists ? userSnap.data() : null;
      if (isAdminFromUserDoc(userDoc)) {
        isAdmin = true;
      } else {
        detail =
          `User role is "${userDoc?.role || 'not set'}" — must be "admin". ` +
          'Update the user document in Firestore (users/{uid}).';
      }
    } catch (lookupErr) {
      detail =
        `Firestore lookup failed: ${lookupErr?.message || lookupErr}. ` +
        'Ensure FIREBASE_SERVICE_ACCOUNT_KEY is set in the deployment environment.';
    }
  } else if (!isAdmin && !firestoreDb) {
    detail = 'Firebase Admin SDK not initialized. Set FIREBASE_SERVICE_ACCOUNT_KEY in Vercel.';
  } else if (!isAdmin && !callerUid) {
    detail = 'Could not determine caller UID from token.';
  }

  return { isAdmin, callerUid, detail };
}

/**
 * @returns {Promise<{ ok: true, decoded: object, uid: string } | { ok: false, status: number, error: string }>}
 */
export async function verifyAdminRequest(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { ok: false, status: 401, error: 'Unauthorized' };
  }
  const idToken = authHeader.replace(/^Bearer\s+/i, '').trim();
  let decoded;
  try {
    decoded = await auth.verifyIdToken(idToken);
  } catch {
    return { ok: false, status: 401, error: 'Invalid token' };
  }
  const uid = decoded.uid || decoded.sub;
  const isAdmin = await isAdminUser(uid, decoded);
  if (!isAdmin) {
    return { ok: false, status: 403, error: 'Forbidden: Admin required' };
  }
  return { ok: true, decoded, uid };
}

/** Returns decoded token or null after sending error response. */
export async function requireAdminOrRespond(req, res) {
  const result = await verifyAdminRequest(req);
  if (!result.ok) {
    res.status(result.status).json({ ok: false, error: result.error });
    return null;
  }
  return result.decoded;
}
