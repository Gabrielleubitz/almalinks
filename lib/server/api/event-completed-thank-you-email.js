/**
 * POST /api/event-completed-thank-you-email
 * After an event is marked completed: email all checked-in registrants with a thank-you
 * and a link to leave a public review on the event page.
 *
 * Admin only. Idempotent: if event.postCompletionThankYouSentAt is set, skips (unless forceResend in body for testing).
 *
 * Body: { eventId: string, forceResend?: boolean }
 */
import '../firebase-init.js';
import admin from '../firebase-init.js';
import { db, auth } from '../firebase-init.js';
import { sendTransactionalEmail } from '../transactional-email.js';
import { eventThankYouCheckedIn } from '../email-templates.js';
import { getAppBaseUrl, getFromEmail, getFromName } from '../email-config.js';

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
    if (!idToken) return res.status(401).json({ ok: false, error: 'Missing token' });

    if (!admin.apps.length) {
      return res.status(503).json({ ok: false, error: 'Server not configured' });
    }

    let decoded;
    try {
      decoded = await auth.verifyIdToken(idToken);
    } catch {
      return res.status(401).json({ ok: false, error: 'Invalid or expired token' });
    }

    const uid = decoded.uid;
    const userDoc = await db.collection('users').doc(uid).get();
    const isAdmin =
      userDoc.exists &&
      (userDoc.data().role === 'admin' || decoded.role === 'admin' || decoded.admin === true);
    if (!isAdmin) {
      return res.status(403).json({ ok: false, error: 'Admin required' });
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

    if (!forceResend && eventData.postCompletionThankYouSentAt) {
      return res.status(200).json({
        ok: true,
        skipped: true,
        message: 'Thank-you emails were already sent for this event.',
      });
    }

    const regsSnap = await eventRef.collection('registrations').get();
    const recipients = [];
    for (const doc of regsSnap.docs) {
      const d = doc.data() || {};
      if (d.checkedIn !== true) continue;
      const email = String(d.email || '').trim().toLowerCase();
      if (!email) continue;
      const name = String(d.name || d.displayName || '').trim() || undefined;
      recipients.push({ email, name });
    }

    if (recipients.length === 0) {
      await eventRef.update({
        postCompletionThankYouSentAt: admin.firestore.FieldValue.serverTimestamp(),
        postCompletionThankYouCheckedInCount: 0,
      });
      return res.status(200).json({
        ok: true,
        skipped: false,
        sent: 0,
        message: 'No checked-in registrants with email.',
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

    await eventRef.update({
      postCompletionThankYouSentAt: admin.firestore.FieldValue.serverTimestamp(),
      postCompletionThankYouCheckedInCount: recipients.length,
      postCompletionThankYouEmailSent: sent,
      postCompletionThankYouEmailFailed: failed,
    });

    return res.status(200).json({
      ok: true,
      sent,
      failed,
      total: recipients.length,
      errors: errors.slice(0, 10),
    });
  } catch (err) {
    console.error('[event-completed-thank-you-email]', err);
    return res.status(500).json({ ok: false, error: err?.message || 'Server error' });
  }
}
