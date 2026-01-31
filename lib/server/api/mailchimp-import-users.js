/**
 * POST /api/mailchimp-import-users
 * Sync all approved users (with email) from Firestore to the Mailchimp audience.
 * Admin only.
 */
import '../firebase-init.js';
import admin from '../firebase-init.js';
import { db, auth } from '../firebase-init.js';
import { addOrUpdateListMember, getMailchimpAudienceConfig } from '../mailchimp-audience.js';

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
      console.warn('[mailchimp-import-users] Auth error:', authErr?.message);
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
      console.error('[mailchimp-import-users] Firestore error:', dbErr?.message);
      return res.status(503).json({ ok: false, error: 'Database error: ' + (dbErr?.message || 'failed to load users') });
    }

    const toSync = [];
    snapshot.docs.forEach((doc) => {
      const d = doc.data() || {};
      if (d.email && (d.status === 'approved' || !d.status)) {
        toSync.push({
          email: d.email,
          firstName: (d.displayName || d.name || '').toString().split(' ')[0] || '',
          lastName: (d.displayName || d.name || '').toString().split(' ').slice(1).join(' ') || ''
        });
      }
    });

    let added = 0;
    let updated = 0;
    const errors = [];

    for (const u of toSync) {
      const result = await addOrUpdateListMember(u.email, {
        firstName: u.firstName || undefined,
        lastName: u.lastName || undefined
      });
      if (result.ok) {
        if (result.added) added++;
        else updated++;
      } else {
        errors.push({ email: u.email, error: result.error });
      }
    }

    return res.status(200).json({
      ok: true,
      total: toSync.length,
      added,
      updated,
      failed: errors.length,
      errors: errors.slice(0, 20)
    });
  } catch (err) {
    console.error('[mailchimp-import-users]', err?.message || err, err?.stack);
    return res.status(500).json({
      ok: false,
      error: err?.message || 'Server error'
    });
  }
}
