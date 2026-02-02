/**
 * Remove all HubSpot-synced users (doc id starts with "hubspot_") and optionally hubspotContacts.
 * Run from project root: node scripts/remove-hubspot-users.js [--contacts]
 *
 * Requires: FIREBASE_SERVICE_ACCOUNT_KEY in .env (or .env.local), or a service account key file.
 */
import { config } from 'dotenv';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
config({ path: join(projectRoot, '.env.local') });
config({ path: join(projectRoot, '.env') });

const removeContacts = process.argv.includes('--contacts');
const USERS_PREFIX = 'hubspot_';
const BATCH_SIZE = 500;

async function main() {
  const { default: init } = await import('../lib/server/firebase-init.js');
  const { db } = await import('../lib/server/firebase-init.js');
  if (!db) {
    console.error('Firestore not available. Set FIREBASE_SERVICE_ACCOUNT_KEY in .env');
    process.exit(1);
  }
  const usersRef = db.collection('users');
  const snapshot = await usersRef.get();
  const hubspotIds = snapshot.docs.filter((d) => d.id.startsWith(USERS_PREFIX)).map((d) => d.id);
  let deletedUsers = 0;
  for (let i = 0; i < hubspotIds.length; i += BATCH_SIZE) {
    const batch = db.batch();
    hubspotIds.slice(i, i + BATCH_SIZE).forEach((id) => {
      batch.delete(usersRef.doc(id));
      deletedUsers += 1;
    });
    await batch.commit();
  }
  console.log(`Removed ${deletedUsers} HubSpot users (hubspot_*) from Firestore.`);
  let deletedContacts = 0;
  if (removeContacts) {
    const contactsRef = db.collection('hubspotContacts');
    const contactsSnap = await contactsRef.get();
    for (let i = 0; i < contactsSnap.docs.length; i += BATCH_SIZE) {
      const batch = db.batch();
      contactsSnap.docs.slice(i, i + BATCH_SIZE).forEach((d) => {
        batch.delete(d.ref);
        deletedContacts += 1;
      });
      await batch.commit();
    }
    console.log(`Removed ${deletedContacts} docs from hubspotContacts.`);
  }
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
