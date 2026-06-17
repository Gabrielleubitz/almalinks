/**
 * POST /api/event-completed-thank-you-email
 * After an event is marked completed: email all checked-in registrants with a thank-you
 * and a link to leave a public review on the event page.
 *
 * Admin only. Idempotent once at least one email was sent (unless forceResend in body).
 *
 * Body: { eventId: string, forceResend?: boolean }
 */
import '../firebase-init.js';
import admin from '../firebase-init.js';
import { db } from '../firebase-init.js';
import { verifyAdminRequest } from '../admin-auth.js';
import { isTransactionalEmailConfigured, sendTransactionalEmail } from '../transactional-email.js';
import { eventThankYouCheckedIn } from '../email-templates.js';
import { getAppBaseUrl, getFromEmail, getFromName } from '../email-config.js';

function isApprovedRegistration(reg) {
  const status = String(reg?.status || 'approved').toLowerCase();
  return status !== 'rejected' && status !== 'pending';
}

async function resolveRecipientEmail(userId, regData) {
  const direct = String(regData?.email || '').trim().toLowerCase();
  if (direct) return direct;
  if (!userId || !db) return '';
  try {
    const userSnap = await db.collection('users').doc(userId).get();
    return String(userSnap.data()?.email || '').trim().toLowerCase();
  } catch {
    return '';
  }
}

async function buildCheckedInRecipients(regsSnap) {
  const recipients = [];
  const seen = new Set();

  for (const doc of regsSnap.docs) {
    const d = doc.data() || {};
    if (d.checkedIn !== true) continue;
    if (!isApprovedRegistration(d)) continue;

    const email = await resolveRecipientEmail(doc.id, d);
    if (!email || seen.has(email)) continue;
    seen.add(email);

    const name = String(d.name || d.displayName || '').trim() || undefined;
    recipients.push({ email, name, userId: doc.id });
  }

  return recipients;
}

function thankYouAlreadySent(eventData) {
  return Boolean(eventData.postCompletionThankYouSentAt) && (eventData.postCompletionThankYouEmailSent ?? 0) > 0;
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

    if (!isTransactionalEmailConfigured()) {
      return res.status(503).json({
        ok: false,
        error: 'Transactional email is not configured on the server (Mailjet or Mandrill).',
      });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const eventId = String(body.eventId || '').trim();
    const forceResend = body.forceResend === true;
    if (!eventId) {
      return res.status(400).json({ ok: false, error: 'eventId is required' });
    }

    const eventRef = db.collection('events').doc(eventId);
    const eventSnap = await eventRef.get();
    if (!eventSnap.exists) {
      return res.status(404).json({ ok: false, error: 'Event not found' });
    }

    const eventData = eventSnap.data();
    const status = String(eventData.status || '').toLowerCase();
    if (status !== 'completed') {
      return res.status(400).json({
        ok: false,
        error: 'Event must be marked completed before sending thank-you emails.',
      });
    }

    if (!forceResend && thankYouAlreadySent(eventData)) {
      return res.status(200).json({
        ok: true,
        skipped: true,
        message: 'Thank-you emails were already sent for this event.',
        sent: eventData.postCompletionThankYouEmailSent ?? 0,
      });
    }

    const regsSnap = await eventRef.collection('registrations').get();
    const recipients = await buildCheckedInRecipients(regsSnap);

    if (recipients.length === 0) {
      return res.status(200).json({
        ok: true,
        skipped: true,
        sent: 0,
        message:
          'No checked-in registrants with email found. Check attendees in, then send thank-you emails again.',
      });
    }

    const baseUrl = getAppBaseUrl();
    const slug = eventData.slug || eventId;
    const eventName = eventData.name || 'Event';
    const reviewUrl = `${baseUrl}/events/${encodeURIComponent(slug)}?review=1`;

    let sent = 0;
    let failed = 0;
    const errors = [];

    for (const r of recipients) {
      const displayName = (r.name || '').trim() || 'there';
      const html = eventThankYouCheckedIn(displayName, eventName, reviewUrl);
      const text = `Hi ${displayName},\n\nThank you for attending ${eventName}.\n\nWe would love your feedback. Leave a short review here:\n${reviewUrl}\n\n— AlmaLinks Team`;
      const subject = `Thank you for attending: ${eventName}`;

      const result = await sendTransactionalEmail({
        to: r.email,
        subject,
        html,
        text,
        fromEmail: getFromEmail(),
        fromName: getFromName(),
        replyTo: process.env.MAILCHIMP_REPLY_TO || undefined,
        template: 'event_completed_thank_you',
        category: 'event_completed_thank_you',
      });

      if (result.ok) {
        sent++;
      } else {
        failed++;
        errors.push({ email: r.email, error: result.error || 'send failed' });
      }
    }

    if (sent > 0) {
      await eventRef.update({
        postCompletionThankYouSentAt: admin.firestore.FieldValue.serverTimestamp(),
        postCompletionThankYouCheckedInCount: recipients.length,
        postCompletionThankYouEmailSent: sent,
        postCompletionThankYouEmailFailed: failed,
      });
    }

    return res.status(sent > 0 ? 200 : 502).json({
      ok: sent > 0,
      sent,
      failed,
      total: recipients.length,
      message:
        sent > 0
          ? `Sent ${sent} thank-you email${sent === 1 ? '' : 's'}.`
          : 'No thank-you emails were delivered. Check server email configuration and try again.',
      errors: errors.slice(0, 10),
    });
  } catch (err) {
    console.error('[event-completed-thank-you-email]', err);
    return res.status(500).json({ ok: false, error: err?.message || 'Server error' });
  }
}
