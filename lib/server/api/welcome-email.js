/**
 * POST /api/welcome-email
 * Send a Mailchimp Marketing welcome campaign to a new signup (single email).
 * Idempotent: store welcomeEmailSentAt on joinRequest (or welcomeEmailSent collection).
 * Uses ONLY Mailchimp Marketing API (no Mandrill/Transactional).
 *
 * No auth required. Call after creating a joinRequest in Firestore.
 * Body: { joinRequestId?, email?, displayName?, firstName? }
 * - If joinRequestId: fetch joinRequest, use its email/name, idempotency on joinRequest.welcomeEmailSentAt.
 * - If no joinRequestId: email required in body; idempotency via welcomeEmailSent collection.
 *
 * Env: MAILCHIMP_AUDIENCE_ID, MAILCHIMP_MARKETING_API_KEY, MAILCHIMP_SERVER,
 *      MAILCHIMP_REPLY_TO (required), MAILCHIMP_FROM_NAME (optional),
 *      MAILCHIMP_WELCOME_TEMPLATE_HTML (optional; use {{name}} for display name).
 */
import '../firebase-init.js';
import admin from '../firebase-init.js';
import { db } from '../firebase-init.js';
import { getMailchimpAudienceConfig, addOrUpdateListMember } from '../mailchimp-audience.js';
import { sendWelcomeCampaign } from '../mailchimp-campaign.js';

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

    const finalDisplayName = displayName || firstName || '';
    const finalFirstName = firstName || finalDisplayName.split(/\s+/)[0] || '';

    const addResult = await addOrUpdateListMember(email, { firstName: finalFirstName });
    if (!addResult.ok) {
      console.warn('[welcome-email] Could not add contact to audience (continuing):', addResult.error);
    }

    const result = await sendWelcomeCampaign(email, finalDisplayName);
    console.log('[welcome-email] Campaign sent:', result.campaignId, 'segment:', result.segmentId, 'joinRequestId:', joinRequestId || '-');

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

    return res.status(200).json({
      ok: true,
      campaignId: result.campaignId,
      segmentId: result.segmentId,
    });
  } catch (err) {
    const responseBody = err?.response?.body ?? err?.response?.data ?? err?.mailchimpResponse;
    const errMsg = err?.message || 'Failed to send welcome email';
    console.error('[welcome-email] Mailchimp welcome email error:', err?.response?.body ?? err?.response?.data ?? err?.mailchimpResponse ?? err);
    console.error('[welcome-email]', errMsg, responseBody != null ? JSON.stringify(responseBody) : '');

    // Do not fail signup: return 200 so client gets clean success; Mailchimp errors are server-log only.
    const body = typeof req.body === 'object' && req.body !== null ? req.body : {};
    const joinRequestIdOut = (body.joinRequestId || '').trim() || null;
    return res.status(200).json({
      ok: true,
      joinRequestId: joinRequestIdOut || undefined,
      welcomeEmailSent: false,
    });
  }
}
