/**
 * POST /api/mailchimp-sync-contact
 * Add or update a single contact in the Mailchimp audience.
 * Requires admin auth when called from frontend.
 * Body: { email, firstName?, lastName? }
 */
import '../firebase-init.js';
import { auth } from '../firebase-init.js';
import { addOrUpdateListMember } from '../mailchimp-audience.js';

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

    const { email, firstName, lastName } = req.body || {};
    if (!email || typeof email !== 'string' || !email.trim()) {
      return res.status(400).json({ ok: false, error: 'email is required' });
    }

    const result = await addOrUpdateListMember(email.trim(), {
      firstName: typeof firstName === 'string' ? firstName.trim() : undefined,
      lastName: typeof lastName === 'string' ? lastName.trim() : undefined
    });

    if (!result.ok) {
      return res.status(400).json({ ok: false, error: result.error });
    }
    return res.status(200).json({ ok: true, added: result.added });
  } catch (err) {
    console.error('[mailchimp-sync-contact]', err?.message || err);
    return res.status(500).json({ ok: false, error: err?.message || 'Server error' });
  }
}
