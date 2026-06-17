/**
 * Resolve all admin notification recipients: env list + communications inbox + every Firestore admin user.
 */
import { db } from './firebase-init.js';
import { getTestRecipient } from './email-config.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseEnvEmails(envValue) {
  if (!envValue || typeof envValue !== 'string') return [];
  return envValue
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter((email) => email && EMAIL_RE.test(email));
}

let cachedEmails = null;
let cacheExpiry = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * @param {string} [step] - getTestRecipient step key (e.g. signup_admin)
 * @returns {Promise<string[]>}
 */
export async function getAdminNotificationEmails(step = 'signup_admin') {
  const testRecipient = getTestRecipient(step);
  if (testRecipient) {
    return [testRecipient.trim().toLowerCase()];
  }

  const now = Date.now();
  if (cachedEmails && now < cacheExpiry) {
    return [...cachedEmails];
  }

  const emails = new Set(parseEnvEmails(process.env.ADMIN_NOTIFICATION_EMAILS || ''));

  const comms = (process.env.COMMUNICATIONS_NOTIFICATION_EMAIL || 'communications@almalinks.org')
    .trim()
    .toLowerCase();
  if (comms && EMAIL_RE.test(comms)) {
    emails.add(comms);
  }

  if (db) {
    try {
      const snap = await db.collection('users').where('role', '==', 'admin').get();
      for (const doc of snap.docs) {
        const email = String(doc.data()?.email || '').trim().toLowerCase();
        if (EMAIL_RE.test(email)) {
          emails.add(email);
        }
      }
    } catch (err) {
      console.warn('[admin-notification-emails] Firestore lookup failed:', err?.message || err);
    }
  }

  cachedEmails = [...emails];
  cacheExpiry = now + CACHE_TTL_MS;
  return cachedEmails;
}
