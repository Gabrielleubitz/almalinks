/**
 * Grant Alma app admin to a user by email (Firestore + Firebase Auth custom claims).
 *
 * Usage:
 *   ADMIN_EMAIL=hadratp@almalinks.org node scripts/set-admin-by-email.js
 *
 * Requires FIREBASE_SERVICE_ACCOUNT_KEY or FIREBASE_SERVICE_ACCOUNT_PATH (see restore-admin.js).
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
    } catch {
      return JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
    }
  }
  const path =
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
    join(__dirname, '..', 'alma-links-test-firebase-adminsdk-fbsvc-0a0cc6c7cc.json');
  if (!existsSync(path)) {
    throw new Error('Set FIREBASE_SERVICE_ACCOUNT_KEY or FIREBASE_SERVICE_ACCOUNT_PATH');
  }
  return JSON.parse(readFileSync(path, 'utf8'));
}

async function main() {
  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  if (!email) {
    console.error('Set ADMIN_EMAIL=user@example.com');
    process.exit(1);
  }

  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(getServiceAccount()) });
  }

  const auth = admin.auth();
  const db = admin.firestore();

  let userRecord;
  try {
    userRecord = await auth.getUserByEmail(email);
  } catch (err) {
    console.error(`No Firebase Auth user for ${email}:`, err?.message || err);
    process.exit(1);
  }

  const uid = userRecord.uid;
  const userRef = db.collection('users').doc(uid);
  const snap = await userRef.get();

  const patch = {
    role: 'admin',
    admin: true,
    email,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  if (snap.exists) {
    await userRef.set(patch, { merge: true });
    console.log(`✅ Updated Firestore users/${uid} → role=admin, admin=true`);
  } else {
    await userRef.set({
      ...patch,
      status: 'approved',
      name: userRecord.displayName || email.split('@')[0],
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log(`✅ Created Firestore users/${uid} with admin role`);
  }

  await auth.setCustomUserClaims(uid, { role: 'admin', admin: true });
  console.log(`✅ Set custom claims for ${email} (${uid})`);

  console.log('\nUser must sign out and sign back in for the client to pick up admin access.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
