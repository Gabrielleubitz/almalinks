/**
 * Load .env from project root before any code that reads process.env (e.g. firebase-init).
 * Import this first in dev-server.js so FIREBASE_SERVICE_ACCOUNT_KEY etc. are available.
 */
import { config } from 'dotenv';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
// project root = two levels up from lib/server
const projectRoot = join(__dirname, '..', '..');
config({ path: join(projectRoot, '.env.local') });
config({ path: join(projectRoot, '.env') });
