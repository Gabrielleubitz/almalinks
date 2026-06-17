/**
 * POST /api/application-follow-up-email
 * Admin-only. Sends the Hadrat "intro / Zoom" email to a pending applicant.
 * CC list from env APPLICATION_FOLLOW_UP_CC (comma-separated, e.g. admin + Hadrat).
 *
 * Body: { joinRequestId: string }
 * Headers: Authorization: Bearer <Firebase ID token> (admin)
 */
import '../firebase-init.js';
import admin from '../firebase-init.js';
import { db } from '../firebase-init.js';
import { verifyAdminRequest } from '../admin-auth.js';
import { getAppBaseUrl } from '../email-config.js';
import { sendTransactionalEmail } from '../transactional-email.js';
import { applicationIntroFollowUp } from '../email-templates.js';

function htmlToPlainText(html) {
  return String(html || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    if (!admin.apps.length) {
      return res.status(503).json({ ok: false, error: 'Server not configured' });
    }

    const authResult = await verifyAdminRequest(req);
    if (!authResult.ok) {
      return res.status(authResult.status).json({ ok: false, error: authResult.error });
    }

    const body = typeof req.body === 'object' && req.body !== null ? req.body : {};
    const joinRequestId = String(body.joinRequestId || '').trim();
    if (!joinRequestId) {
      return res.status(400).json({ ok: false, error: 'joinRequestId is required' });
    }

    const ref = db.collection('joinRequests').doc(joinRequestId);
    const snap = await ref.get();
    if (!snap.exists) {
      return res.status(404).json({ ok: false, error: 'Join request not found' });
    }
    const jr = snap.data();
    if (jr.status !== 'pending') {
      return res.status(400).json({ ok: false, error: 'Only pending applications can receive this email' });
    }

    const to = String(jr.email || '').trim().toLowerCase();
    if (!to) {
      return res.status(400).json({ ok: false, error: 'Applicant has no email on file' });
    }

    const firstName = String(jr.firstName || (jr.name || '').trim().split(/\s+/)[0] || '').trim();
    const site = getAppBaseUrl();
    const html = applicationIntroFollowUp(firstName, site);
    const text = htmlToPlainText(html) || `Hi,\n\nThank you for your application to AlmaLinks.\n\n— AlmaLinks`;

    const subject = 'Thank you for your application to AlmaLinks!';
    const ccRaw = (process.env.APPLICATION_FOLLOW_UP_CC || '').trim();
    const fromEmail = (process.env.COMMUNICATIONS_FROM_EMAIL || 'communications@almalinks.org').trim();
    const fromName = (process.env.COMMUNICATIONS_FROM_NAME || 'AlmaLinks').trim();

    const result = await sendTransactionalEmail({
      to,
      subject,
      html,
      text,
      fromEmail,
      fromName,
      replyTo: fromEmail,
      cc: ccRaw || undefined,
      template: 'application-follow-up',
      category: 'admin-application-intro',
    });

    if (!result.ok) {
      console.error('[application-follow-up-email] send failed:', result.error, result.details);
      return res.status(500).json({
        ok: false,
        error: result.error || 'Failed to send email',
        details: result.details,
      });
    }

    await ref.set(
      {
        applicationFollowUpSentAt: admin.firestore.FieldValue.serverTimestamp(),
        applicationFollowUpSentBy: decoded.uid || decoded.sub || null,
      },
      { merge: true }
    );

    return res.status(200).json({ ok: true, messageId: result.messageId });
  } catch (err) {
    console.error('[application-follow-up-email]', err?.message || err);
    return res.status(500).json({
      ok: false,
      error: err?.message || 'Server error',
    });
  }
}
