/**
 * POST /api/mailchimp-import-users
 * Sync all approved users (with email) from Firestore to the Mailchimp audience.
 * Admin only. Validates emails before calling Mailchimp; invalid/fake emails are marked failed and do not break the import.
 */
import '../firebase-init.js';
import admin from '../firebase-init.js';
import { db, auth } from '../firebase-init.js';
import { addOrUpdateListMember, getMailchimpAudienceConfig } from '../mailchimp-audience.js';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const FAKE_DOMAINS = ['example.com', 'example.org', 'example.net', 'test.com', 'fake.com'];

function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const trimmed = email.trim().toLowerCase();
  if (!EMAIL_REGEX.test(trimmed)) return false;
  const domain = trimmed.split('@')[1] || '';
  if (FAKE_DOMAINS.includes(domain)) return false;
  return true;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }
    const idToken = authHeader.split('Bearer ')[1];
    if (!idToken) {
      return res.status(401).json({ ok: false, error: 'Missing token' });
    }

    if (!admin.apps.length) {
      console.error('[mailchimp-import-users] Firebase Admin not initialized');
      return res.status(503).json({
        ok: false,
        error: 'Server not configured. Set FIREBASE_SERVICE_ACCOUNT_KEY in Vercel.'
      });
    }

    let decoded;
    try {
      decoded = await auth.verifyIdToken(idToken);
    } catch (authErr) {
      console.warn('[mailchimp-import-users] Auth error');
      return res.status(401).json({ ok: false, error: 'Invalid or expired token' });
    }
    const isAdmin = decoded.role === 'admin' || decoded.admin === true;
    if (!isAdmin) {
      return res.status(403).json({ ok: false, error: 'Admin required' });
    }

    const config = getMailchimpAudienceConfig();
    if (!config) {
      return res.status(503).json({
        ok: false,
        error: 'Mailchimp audience not configured. In Vercel, set MAILCHIMP_AUDIENCE_ID and MAILCHIMP_MARKETING_API_KEY (or MAILCHIMP_API_KEY with MAILCHIMP_SERVER, e.g. us19).'
      });
    }

    let snapshot;
    try {
      snapshot = await db.collection('users').get();
    } catch (dbErr) {
      console.error('[mailchimp-import-users] Firestore error');
      return res.status(503).json({ ok: false, error: 'Database error: ' + (dbErr?.message || 'failed to load users') });
    }

    const raw = [];
    snapshot.docs.forEach((doc) => {
      const d = doc.data() || {};
      if (d.email && (d.status === 'approved' || !d.status)) {
        raw.push({
          email: (d.email || '').trim().toLowerCase(),
          firstName: (d.displayName || d.name || '').toString().split(' ')[0] || '',
          lastName: (d.displayName || d.name || '').toString().split(' ').slice(1).join(' ') || ''
        });
      }
    });

    const failed = [];
    const toSync = [];
    for (const u of raw) {
      if (!isValidEmail(u.email)) {
        failed.push({ email: u.email, reason: 'invalid_email', statusCode: 0, detail: 'Fake or invalid email' });
      } else {
        toSync.push(u);
      }
    }

    let added = 0;
    let updated = 0;

    for (const u of toSync) {
      const result = await addOrUpdateListMember(u.email, {
        firstName: u.firstName || undefined,
        lastName: u.lastName || undefined
      });
      if (result.ok) {
        if (result.added) added++;
        else updated++;
      } else {
        failed.push({
          email: u.email,
          reason: 'mailchimp_error',
          statusCode: result.statusCode || 400,
          detail: result.error || 'Request failed'
        });
      }
    }

    const audienceIdMask = config.audienceId ? `…${config.audienceId.slice(-4)}` : '?';
    console.log('[mailchimp-import-users] audience:', audienceIdMask, 'total:', raw.length, 'added:', added, 'updated:', updated, 'failed:', failed.length);

    return res.status(200).json({
      ok: true,
      total: raw.length,
      added,
      updated,
      failed: failed.length,
      errors: failed.slice(0, 50),
      audienceIdHint: audienceIdMask
    });
  } catch (err) {
    console.error('[mailchimp-import-users]', err?.message || 'Server error');
    return res.status(500).json({
      ok: false,
      error: err?.message || 'Server error'
    });
  }
}
