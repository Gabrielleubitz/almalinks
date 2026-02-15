/**
 * POST /api/welcome-email
 * Send signup confirmation / "We received your signup" email via transactional-email (Mailjet or Mandrill) with Alma theme.
 * Idempotent: store welcomeEmailSentAt on joinRequest.
 * No Mailchimp Marketing (no campaigns/segments).
 *
 * Body: { joinRequestId?, email?, displayName?, firstName? }
 * If joinRequestId: fetch joinRequest, use its email/name, idempotency on welcomeEmailSentAt.
 *
 * Env: MAILJET_API_KEY + MAILJET_SECRET_KEY (or MAILCHIMP_API_KEY for Mandrill), TRANSACTIONAL_FROM_EMAIL,
 *      TRANSACTIONAL_FROM_NAME, TRANSACTIONAL_REPLY_TO. APP_URL for links.
 */
import '../firebase-init.js';
import admin from '../firebase-init.js';
import { db } from '../firebase-init.js';
import { getLoginLink, getEventsLink, getAppBaseUrl } from '../email-config.js';
import { sendTransactionalEmail } from '../transactional-email.js';
import { welcomeSignup } from '../email-templates.js';

function safeEmailKey(email) {
  if (!email || typeof email !== 'string') return null;
  return email.toLowerCase().trim().replace(/[^a-z0-9._-]/g, '_').slice(0, 150);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    if (!admin.apps.length) {
      console.error('[welcome-email] Firebase Admin not initialized');
      return res.status(503).json({
        ok: false,
        error: 'Server not configured. Set FIREBASE_SERVICE_ACCOUNT_KEY in Vercel.',
      });
    }

    const body = typeof req.body === 'object' && req.body !== null ? req.body : {};
    const joinRequestId = (body.joinRequestId || '').trim() || null;
    let email = (body.email || '').trim().toLowerCase();
    let displayName = (body.displayName || body.firstName || body.name || '').trim();
    let firstName = (body.firstName || body.name || displayName || '').trim().split(/\s+/)[0] || '';

    let joinRequestRef = null;
    let idempotencyOnJoinRequest = false;

    if (joinRequestId) {
      joinRequestRef = db.collection('joinRequests').doc(joinRequestId);
      const joinSnap = await joinRequestRef.get();
      if (!joinSnap.exists) {
        console.log('[welcome-email] 404 Join request not found:', joinRequestId);
        return res.status(404).json({ ok: false, error: 'Join request not found' });
      }
      const joinData = joinSnap.data();
      if (joinData.welcomeEmailSentAt) {
        console.log('[welcome-email] Skipped (already sent), joinRequestId:', joinRequestId);
        return res.status(200).json({ ok: true, skipped: true, reason: 'Welcome email already sent' });
      }
      email = (joinData.email || '').trim().toLowerCase();
      if (!email) {
        console.log('[welcome-email] 400 Join request has no email:', joinRequestId);
        return res.status(400).json({ ok: false, error: 'Join request has no email' });
      }
      idempotencyOnJoinRequest = true;
      const jrName = (joinData.name || joinData.displayName || '').trim();
      if (jrName) {
        displayName = jrName;
        firstName = jrName.split(/\s+/)[0] || '';
      }
    } else {
      if (!email) {
        console.log('[welcome-email] 400 Missing email (and no joinRequestId)');
        return res.status(400).json({ ok: false, error: 'email is required when joinRequestId is not provided' });
      }
      const emailKey = safeEmailKey(email);
      if (emailKey) {
        const sentRef = db.collection('welcomeEmailSent').doc(emailKey);
        const sentSnap = await sentRef.get();
        if (sentSnap.exists && sentSnap.data().sentAt) {
          console.log('[welcome-email] Skipped (already sent for email), emailKey:', emailKey);
          return res.status(200).json({ ok: true, skipped: true, reason: 'Welcome email already sent for this email' });
        }
      }
    }

    const loginLink = getLoginLink();
    const eventsLink = getEventsLink();
    const greeting = firstName ? `Hi ${firstName},` : 'Hi there,';
    const subject = 'We received your signup';
    const text = `${greeting}

Thanks for signing up to Alma Links!

Your request has been received and is currently pending admin approval. We'll review your application and notify you once it's been processed.

Once approved, you'll receive another email and can log in to access the platform.

Log in or check status: ${loginLink}
Events: ${eventsLink}

If you have any questions, feel free to reach out to us.

— Alma Links Team`;

    const html = welcomeSignup(firstName || null, loginLink, eventsLink);

    const result = await sendTransactionalEmail({
      to: email,
      subject,
      html,
      text,
    });

    if (!result.ok) {
      console.error('[welcome-email] Mandrill send failed:', result.status, result.rejectReason, result.error, result.details);
      return res.status(500).json({
        ok: false,
        error: result.error || 'Failed to send welcome email',
        details: result.details,
      });
    }

    if (idempotencyOnJoinRequest && joinRequestRef) {
      await joinRequestRef.update({
        welcomeEmailSentAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } else {
      const emailKey = safeEmailKey(email);
      if (emailKey) {
        await db.collection('welcomeEmailSent').doc(emailKey).set({
          sentAt: admin.firestore.FieldValue.serverTimestamp(),
          email,
        }, { merge: true });
      }
    }

    console.log('[welcome-email] Sent via Mandrill:', result.messageId, 'joinRequestId:', joinRequestId || '-');
    return res.status(200).json({
      ok: true,
      messageId: result.messageId,
    });
  } catch (err) {
    const errMsg = err?.message || 'Failed to send welcome email';
    console.error('[welcome-email] Error:', errMsg, err);
    return res.status(500).json({
      ok: false,
      error: errMsg,
      details: process.env.NODE_ENV === 'development' ? (err?.stack || undefined) : undefined,
    });
  }
}
