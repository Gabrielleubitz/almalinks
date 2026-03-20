/**
 * Remove existing HubSpot-imported users (Firebase + /users docs) and re-sync all HubSpot contacts.
 *
 * Usage:
 *   node scripts/reimport-hubspot-users.js
 *
 * Requires:
 * - FIREBASE_SERVICE_ACCOUNT_KEY in .env/.env.local
 * - HUBSPOT_ACCESS_TOKEN for HubSpot API
 */
import { config } from 'dotenv';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { getHubspotToken } from '../lib/server/api/hubspot-auth.js';
import { syncHubspotContactsToFirestore } from '../lib/server/api/sync-hubspot-contacts.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
config({ path: join(projectRoot, '.env.local') });
config({ path: join(projectRoot, '.env') });

async function main() {
  const tokenResult = getHubspotToken();
  if (!tokenResult.ok) {
    console.error('Missing/invalid HUBSPOT_ACCESS_TOKEN:', tokenResult.error);
    process.exit(1);
  }

  const result = await syncHubspotContactsToFirestore({
    token: tokenResult.token,
    fullResync: true,
    dedupeByEmail: true,
    callerUid: null,
  });

  console.log('HubSpot user reimport finished:', {
    ok: result.ok,
    deletedUsers: result.deletedUsers,
    totalUpserted: result.totalUpserted,
  });
}

main().catch((err) => {
  console.error('Reimport failed:', err);
  process.exit(1);
});

