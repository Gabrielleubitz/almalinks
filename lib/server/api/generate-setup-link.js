/**
 * POST /api/generate-setup-link
 * Admin-only. Uses Firebase Admin SDK to generate a one-time password-reset /
 * account-setup link for the given email address. The link is returned to the
 * caller so it can be embedded in the welcome email or shared securely.
 *
 * Body:   { targetEmail: string }
 * Headers: Authorization: Bearer <Firebase ID token> (admin)
 * Returns: { ok: true, setupLink: string | null }
 */
import '../firebase-init.js';
import admin from '../firebase-init.js';
import { auth, db } from '../firebase-init.js';
import { getAppBaseUrl } from '../email-config.js';

async function resolveIsAdmin(decoded, callerUid) {
  if (decoded.role === 'admin' || decoded.admin === true) return true;
  if (!callerUid || !db) return false;
  try {
    const snap = await db.collection('users').doc(callerUid).get();
    return snap.exists && snap.data()?.role === 'admin';
  } catch (_) {
    return false;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  if (!admin.apps.length) {
    return res.status(503).json({ ok: false, error: 'Server not configured' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }

  let decoded;
  try {
    decoded = await auth.verifyIdToken(authHeader.split('Bearer ')[1]);
  } catch {
    return res.status(401).json({ ok: false, error: 'Invalid token' });
  }

  const callerUid = decoded.uid || decoded.sub || null;
  const isAdmin = await resolveIsAdmin(decoded, callerUid);
  if (!isAdmin) {
    return res.status(403).json({ ok: false, error: 'Admin required' });
  }

  const body = typeof req.body === 'object' && req.body !== null ? req.body : {};
  const targetEmail = String(body.targetEmail || '').trim().toLowerCase();
  if (!targetEmail) {
    return res.status(400).json({ ok: false, error: 'targetEmail is required' });
  }

  const base = getAppBaseUrl();
  const continueUrl = `${base}/login`;

  try {
    const link = await auth.generatePasswordResetLink(targetEmail, {
      url: continueUrl,
      handleCodeInApp: false,
    });
    console.log('[generate-setup-link] Link generated for', targetEmail, 'by admin', callerUid);
    return res.status(200).json({ ok: true, setupLink: link });
  } catch (err) {
    // User doesn't exist in Firebase Auth yet — not a hard error, just skip the link
    if (err?.errorInfo?.code === 'auth/user-not-found') {
      console.warn('[generate-setup-link] No Firebase Auth user for', targetEmail, '— link skipped');
      return res.status(200).json({ ok: true, setupLink: null, warn: 'No Firebase Auth user found for this email' });
    }
    console.error('[generate-setup-link] Error:', err?.message || err);
    return res.status(500).json({ ok: false, error: err?.message || 'Failed to generate setup link' });
  }
}
