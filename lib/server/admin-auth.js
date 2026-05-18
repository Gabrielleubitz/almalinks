/**
 * Resolve whether a Firebase ID token bearer is an AlmaLinks admin.
 * Checks custom claims first, then Firestore users/{uid}.role === 'admin'.
 */
export async function resolveAdminAccess(decoded, db) {
  let isAdmin = decoded?.role === 'admin' || decoded?.admin === true;
  const callerUid = decoded?.uid || decoded?.sub || null;
  let detail = null;

  if (!isAdmin && callerUid && db) {
    try {
      const userSnap = await db.collection('users').doc(callerUid).get();
      const userDoc = userSnap.exists ? userSnap.data() : null;
      if (userDoc?.role === 'admin') {
        isAdmin = true;
      } else {
        detail =
          `User role is "${userDoc?.role || 'not set'}" — must be "admin". ` +
          'Update the user document in Firestore (users/{uid}).';
      }
    } catch (lookupErr) {
      detail = `Firestore lookup failed: ${lookupErr?.message || lookupErr}. ` +
        'Ensure FIREBASE_SERVICE_ACCOUNT_KEY is set in the deployment environment.';
    }
  } else if (!isAdmin && !db) {
    detail = 'Firebase Admin SDK not initialized. Set FIREBASE_SERVICE_ACCOUNT_KEY in Vercel.';
  } else if (!isAdmin && !callerUid) {
    detail = 'Could not determine caller UID from token.';
  }

  return { isAdmin, callerUid, detail };
}
