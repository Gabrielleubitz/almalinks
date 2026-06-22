/**
 * POST /api/send-rsvp-reminder
 * Admin-only. Sends a reminder email to all approved registrants for an event,
 * asking them to confirm attendance or let the team know if they can no longer make it.
 * Idempotent per day (unless forceResend is true).
 *
 * Body: { eventId: string, forceResend?: boolean }
 */
import '../firebase-init.js';
import admin from '../firebase-init.js';
import { db } from '../firebase-init.js';
import { verifyAdminRequest } from '../admin-auth.js';
import { isTransactionalEmailConfigured, sendTransactionalEmail } from '../transactional-email.js';
import { getAppBaseUrl } from '../email-config.js';

function formatEventDate(dateStr) {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const authResult = await verifyAdminRequest(req);
  if (!authResult.ok) {
    return res.status(authResult.status).json({ ok: false, error: authResult.error });
  }

  try {
    const body = typeof req.body === 'object' && req.body !== null ? req.body : {};
    const { eventId, forceResend = false } = body;

    if (!eventId) {
      return res.status(400).json({ ok: false, error: 'eventId is required' });
    }

    if (!isTransactionalEmailConfigured()) {
      return res.status(200).json({ ok: true, skipped: true, reason: 'Email not configured' });
    }

    // Load event details
    const eventSnap = await db.collection('events').doc(eventId).get();
    if (!eventSnap.exists) {
      return res.status(404).json({ ok: false, error: 'Event not found' });
    }
    const event = eventSnap.data() || {};

    // Idempotency: don't resend if already sent today
    const todayKey = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    if (!forceResend && event.rsvpReminderSentDate === todayKey) {
      return res.status(200).json({ ok: true, skipped: true, reason: 'RSVP reminder already sent today. Use forceResend to override.' });
    }

    // Collect approved registrants
    const regsSnap = await db.collection('events').doc(eventId).collection('registrations').get();
    const recipients = [];

    for (const regDoc of regsSnap.docs) {
      const d = regDoc.data() || {};
      const status = String(d.status || 'approved').toLowerCase();
      if (status === 'rejected' || status === 'pending') continue;

      let email = String(d.email || '').trim().toLowerCase();
      let name = d.name || '';

      if (!email) {
        try {
          const uSnap = await db.collection('users').doc(regDoc.id).get();
          email = String(uSnap.data()?.email || '').trim().toLowerCase();
          name = name || uSnap.data()?.displayName || '';
        } catch { /* skip */ }
      }
      if (email) recipients.push({ email, name });
    }

    if (!recipients.length) {
      return res.status(200).json({ ok: true, skipped: true, reason: 'No approved registrants to remind' });
    }

    const base = getAppBaseUrl();
    const eventLink = `${base}/events/${eventId}`;
    const eventName = event.name || eventId;
    const eventDate = formatEventDate(event.date);
    const eventLocation = event.location || '';

    const subject = `Reminder: ${eventName} is coming up — please confirm your attendance`;
    const html = `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
  <p style="margin:0 0 16px 0;font-size:16px;color:#1C1C1C;">Hi there,</p>
  <p style="margin:0 0 16px 0;font-size:16px;color:#1C1C1C;">
    This is a friendly reminder that you are registered for <strong>${eventName}</strong>.
  </p>
  ${eventDate ? `<p style="margin:0 0 8px 0;font-size:14px;color:#374151;"><strong>📅 Date:</strong> ${eventDate}</p>` : ''}
  ${eventLocation ? `<p style="margin:0 0 16px 0;font-size:14px;color:#374151;"><strong>📍 Location:</strong> ${eventLocation}</p>` : ''}
  <p style="margin:0 0 16px 0;font-size:15px;color:#1C1C1C;">
    <strong>Please confirm you will be attending.</strong> If your plans have changed and you can no longer make it,
    let us know as soon as possible so we can offer your spot to other members.
  </p>
  <div style="margin:0 0 20px 0;">
    <a href="${eventLink}" style="display:inline-block;padding:12px 24px;background:#2E7FEF;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">View Event & Update RSVP</a>
  </div>
  <p style="margin:0;font-size:13px;color:#9CA3AF;">
    You are receiving this because you registered for this AlmaLinks event.
  </p>
</div>`;
    const text = `Reminder: ${eventName}\n${eventDate ? `Date: ${eventDate}\n` : ''}${eventLocation ? `Location: ${eventLocation}\n` : ''}\nPlease confirm your attendance. If you can no longer make it, let us know.\n\nUpdate your RSVP: ${eventLink}`;

    let sent = 0;
    let errors = 0;
    for (const r of recipients) {
      const result = await sendTransactionalEmail({ to: r.email, subject, html, text }).catch((e) => {
        console.warn('[send-rsvp-reminder] send failed for', r.email, e?.message);
        return { ok: false };
      });
      if (result?.ok !== false) sent++;
      else errors++;
    }

    // Mark reminder sent date on the event so we don't double-send today
    await db.collection('events').doc(eventId).update({
      rsvpReminderSentDate: todayKey,
      rsvpReminderSentAt: admin.firestore.FieldValue.serverTimestamp(),
    }).catch(() => {});

    console.log('[send-rsvp-reminder] Sent', sent, 'of', recipients.length, 'for event', eventId);
    return res.status(200).json({ ok: true, sent, errors, total: recipients.length });
  } catch (err) {
    console.error('[send-rsvp-reminder]', err?.message || err);
    return res.status(500).json({ ok: false, error: err?.message || 'Server error' });
  }
}
