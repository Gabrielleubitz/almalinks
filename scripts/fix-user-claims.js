// Utility script to set Firebase custom claims for existing users
// Run this once to fix users created before custom claims were implemented

import admin from 'firebase-admin';
import { readFileSync } from 'fs';

// Initialize Firebase Admin
const serviceAccount = JSON.parse(
  readFileSync('./alma-links-test-firebase-adminsdk-fbsvc-0a0cc6c7cc.json', 'utf8')
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const auth = admin.auth();

async function fixUserClaims() {
  try {
    console.log('🔧 Starting to fix user custom claims...\n');

    // Get all users from Firestore
    const usersSnapshot = await db.collection('users').get();

    let updated = 0;
    let skipped = 0;
    let errors = 0;

    for (const doc of usersSnapshot.docs) {
      const userData = doc.data();
      const userId = doc.id;
      const role = userData.role || 'member';

      try {
        // Set custom claims
        await auth.setCustomUserClaims(userId, {
          role: role
        });

        console.log(`✅ Updated claims for ${userData.email} (${role})`);
        updated++;
      } catch (error) {
        if (error.code === 'auth/user-not-found') {
          console.log(`⚠️  Skipped ${userData.email} (not found in Auth)`);
          skipped++;
        } else {
          console.error(`❌ Error updating ${userData.email}:`, error.message);
          errors++;
        }
      }
    }

    console.log(`\n📊 Summary:`);
    console.log(`   Updated: ${updated}`);
    console.log(`   Skipped: ${skipped}`);
    console.log(`   Errors: ${errors}`);
    console.log(`\n✅ Done! Users need to sign out and sign back in for changes to take effect.`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

fixUserClaims();
