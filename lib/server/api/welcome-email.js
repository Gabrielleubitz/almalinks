/**
 * POST /api/welcome-email
 * Send a Mailchimp Marketing welcome campaign to the authenticated user (single email).
 * Idempotent: only sends if user has no welcomeEmailSentAt; sets it after success.
 * Uses ONLY Mailchimp Marketing API (no Mandrill/Transactional).
 *
 * Auth: Bearer token (the newly signed-up user).
 * Env: MAILCHIMP_AUDIENCE_ID, MAILCHIMP_MARKETING_API_KEY, MAILCHIMP_SERVER,
 *      MAILCHIMP_REPLY_TO (required), MAILCHIMP_FROM_NAME (optional),
 *      MAILCHIMP_WELCOME_TEMPLATE_HTML (optional; use {{name}} for display name).
 */
import '../firebase-init.js';
import admin from '../firebase-init.js';
import { db, auth } from '../firebase-init.js';
import { getMailchimpAudienceConfig, addOrUpdateListMember } from '../mailchimp-audience.js';
import { sendWelcomeCampaign } from '../mailchimp-campaign.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('[welcome-email] 401 Unauthorized (no Bearer token)');
      return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }
    const idToken = authHeader.split('Bearer ')[1];
    if (!idToken) {
      console.log('[welcome-email] 401 Missing token');
      return res.status(401).json({ ok: false, error: 'Missing token' });
    }

    if (!admin.apps.length) {
      console.error('[welcome-email] Firebase Admin not initialized');
      return res.status(503).json({
        ok: false,
        error: 'Server not configured. Set FIREBASE_SERVICE_ACCOUNT_KEY in Vercel.',
      });
    }

    let decoded;
    try {
      decoded = await auth.verifyIdToken(idToken);
    } catch (authErr) {
      console.warn('[welcome-email] 401 Auth error:', authErr?.message);
      return res.status(401).json({ ok: false, error: 'Invalid or expired token' });
    }

    const uid = decoded.uid;
    const userRef = db.collection('users').doc(uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      console.log('[welcome-email] 404 User document not found:', uid);
      return res.status(404).json({ ok: false, error: 'User not found' });
    }

    const userData = userSnap.data();
    if (userData.welcomeEmailSentAt) {
      console.log('[welcome-email] Skipped (already sent), uid:', uid);
      return res.status(200).json({ ok: true, skipped: true, reason: 'Welcome email already sent' });
    }

    const email = (userData.email || decoded.email || '').trim().toLowerCase();
    if (!email) {
      console.log('[welcome-email] 400 User has no email, uid:', uid);
      return res.status(400).json({ ok: false, error: 'User has no email' });
    }

    const config = getMailchimpAudienceConfig();
    if (!config) {
      const errMsg = 'Mailchimp not configured. Set MAILCHIMP_AUDIENCE_ID and MAILCHIMP_MARKETING_API_KEY (and MAILCHIMP_SERVER).';
      console.error('[welcome-email]', errMsg);
      return res.status(503).json({ ok: false, error: errMsg });
    }
    if (!process.env.MAILCHIMP_REPLY_TO) {
      const errMsg = 'MAILCHIMP_REPLY_TO is required for campaigns.';
      console.error('[welcome-email]', errMsg);
      return res.status(503).json({ ok: false, error: errMsg });
    }

    const displayName = userData.name || userData.displayName || decoded.name || '';
    const firstName = (displayName || '').trim().split(/\s+/)[0] || '';

    // Ensure user is in Mailchimp audience so the segment has one member
    const addResult = await addOrUpdateListMember(email, { firstName });
    if (!addResult.ok) {
      console.warn('[welcome-email] Could not add contact to audience (continuing):', addResult.error);
    }

    const result = await sendWelcomeCampaign(email, displayName);
    console.log('[welcome-email] Campaign sent:', result.campaignId, 'segment:', result.segmentId, 'uid:', uid);

    await userRef.update({
      welcomeEmailSentAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.status(200).json({
      ok: true,
      campaignId: result.campaignId,
      segmentId: result.segmentId,
    });
  } catch (err) {
    const errMsg = err?.message || 'Failed to send welcome email';
    console.error('[welcome-email]', errMsg, err);
    return res.status(500).json({
      ok: false,
      error: errMsg,
    });
  }
}
