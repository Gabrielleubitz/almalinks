/**
 * POST /api/mailchimp-import-users
 * Sync all approved users (with email) from Firestore to the Mailchimp audience.
 * Admin only.
 */
import '../firebase-init.js';
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
    const decoded = await auth.verifyIdToken(idToken);
    const isAdmin = decoded.role === 'admin' || decoded.admin === true;
    if (!isAdmin) {
      return res.status(403).json({ ok: false, error: 'Admin required' });
    }

    if (!getMailchimpAudienceConfig()) {
      return res.status(500).json({
        ok: false,
        error: 'Mailchimp audience not configured. Set MAILCHIMP_AUDIENCE_ID and Marketing API key.'
      });
    }

    const snapshot = await db.collection('users').get();
    const toSync = [];
    snapshot.docs.forEach((doc) => {
      const d = doc.data();
      if (d.email && (d.status === 'approved' || !d.status)) {
        toSync.push({
          email: d.email,
          firstName: d.displayName?.split(' ')[0] || d.name?.split(' ')[0] || '',
          lastName: d.displayName?.split(' ').slice(1).join(' ') || d.name?.split(' ').slice(1).join(' ') || ''
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
    console.error('[mailchimp-import-users]', err?.message || err);
    return res.status(500).json({ ok: false, error: err?.message || 'Server error' });
  }
}
