/**
 * Server-side admin check: Firebase custom claims OR Firestore users/{uid}.role === 'admin'.
 * The app grants admin via Firestore; custom claims are optional.
 */
import { db } from '../firebase-init.js';

export async function resolveIsAdmin(decoded) {
  if (!decoded) return false;
  if (decoded.role === 'admin' || decoded.admin === true) return true;

  const uid = decoded.uid || decoded.sub || null;
  if (!uid || !db) return false;

  try {
    const snap = await db.collection('users').doc(uid).get();
    if (!snap.exists) return false;
    const data = snap.data() || {};
    return data.role === 'admin' || data.admin === true;
  } catch {
    return false;
  }
}
