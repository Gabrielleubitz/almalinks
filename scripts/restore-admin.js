/**
 * Restore admin access after accidental deletion (e.g. by Remove HubSpot users).
 *
 * Usage:
 *   ADMIN_EMAIL=your@email.com ADMIN_PASSWORD=newpassword node scripts/restore-admin.js
 *
 * If the Auth user exists: sets custom claims to admin and ensures users/{uid} has role: 'admin'.
 * If the Auth user does not exist: creates Auth user with ADMIN_PASSWORD, sets claims, creates users doc.
 *
 * Requires: FIREBASE_SERVICE_ACCOUNT_KEY (JSON string in env) or a service account JSON file at
 *   lib/alma-links-test-firebase-adminsdk-fbsvc-0a0cc6c7cc.json (or set FIREBASE_SERVICE_ACCOUNT_PATH).
 */

import admin from 'firebase-admin';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function getServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch (e) {
      try {
        return JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
      } catch (e2) {
        throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY is not valid JSON');
      }
    }
  }
  const path = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || join(__dirname, '..', 'alma-links-test-firebase-adminsdk-fbsvc-0a0cc6c7cc.json');
  if (!existsSync(path)) {
    throw new Error('Set FIREBASE_SERVICE_ACCOUNT_KEY or FIREBASE_SERVICE_ACCOUNT_PATH to a valid JSON file');
  }
  return JSON.parse(readFileSync(path, 'utf8'));
}

async function main() {
  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || '';

  if (!email) {
    console.error('Set ADMIN_EMAIL=your@email.com');
    process.exit(1);
  }

  if (!admin.apps.length) {
    const cred = getServiceAccount();
    admin.initializeApp({ credential: admin.credential.cert(cred) });
  }

  const auth = admin.auth();
  const db = admin.firestore();
  let uid;

  try {
    const userRecord = await auth.getUserByEmail(email);
    uid = userRecord.uid;
    console.log('Found existing Auth user:', uid);
  } catch (e) {
    if (e.code !== 'auth/user-not-found') {
      console.error('Error looking up user:', e.message);
      process.exit(1);
    }
    if (!password || password.length < 6) {
      console.error('Auth user not found. Set ADMIN_PASSWORD (min 6 chars) to create a new account.');
      process.exit(1);
    }
    const newUser = await auth.createUser({
      email,
      password,
      emailVerified: false,
    });
    uid = newUser.uid;
    console.log('Created new Auth user:', uid);
  }

  await auth.setCustomUserClaims(uid, { role: 'admin', admin: true });
  console.log('Set custom claims: role=admin');

  const userRef = db.collection('users').doc(uid);
  const snap = await userRef.get();
  const now = admin.firestore.FieldValue.serverTimestamp();

  if (snap.exists) {
    await userRef.set(
      { role: 'admin', status: 'approved', updatedAt: now },
      { merge: true }
    );
    console.log('Updated users doc: role=admin, status=approved');
  } else {
    await userRef.set({
      uid,
      email,
      name: email.split('@')[0],
      displayName: email.split('@')[0],
      role: 'admin',
      status: 'approved',
      profileVisibility: 'public',
      createdAt: now,
      updatedAt: now,
      joinedAt: now,
    });
    console.log('Created users doc with role=admin');
  }

  console.log('\nDone. Sign in with', email, '(and the password you set, if you created a new account).');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
