/**
 * POST /api/notify-event-registration
 * Notifies all admin emails when any user registers for an event.
 * Called from the frontend after createPending() succeeds. Non-blocking best-effort.
 *
 * Body: { eventId, eventName, userId, userName, userEmail }
 */
import '../firebase-init.js';
import { getAdminNotificationEmails } from '../admin-notification-emails.js';
import { sendTransactionalEmail } from '../transactional-email.js';
import { getAppBaseUrl } from '../email-config.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const body = typeof req.body === 'object' && req.body !== null ? req.body : {};
    const { eventId, eventName, userId, userName, userEmail } = body;

    if (!eventId || !userId) {
      return res.status(400).json({ ok: false, error: 'eventId and userId are required' });
    }

    const adminEmails = await getAdminNotificationEmails('event_registration');
    if (!adminEmails.length) {
      return res.status(200).json({ ok: true, skipped: true, reason: 'No admin emails configured' });
    }

    const base = getAppBaseUrl();
    const registrationsLink = `${base}/admin/events/${eventId}/registrations`;
    const memberName = userName || userEmail || userId;
    const subject = `New registration: ${memberName} → ${eventName || 'event'}`;
    const html = `
      <p style="margin:0 0 16px 0;font-size:16px;color:#1C1C1C;">
        <strong>${memberName}</strong>${userEmail ? ` (${userEmail})` : ''} has registered for
        <strong>${eventName || eventId}</strong> and is awaiting approval.
      </p>
      <p style="margin:0;font-size:14px;color:#6B7280;">
        <a href="${registrationsLink}" style="color:#2E7FEF;">Review registrations →</a>
      </p>`;
    const text = `${memberName}${userEmail ? ` (${userEmail})` : ''} registered for ${eventName || eventId}.\n\nReview: ${registrationsLink}`;

    let notified = 0;
    for (const adminEmail of adminEmails) {
      const result = await sendTransactionalEmail({ to: adminEmail, subject, html, text }).catch((e) => {
        console.warn('[notify-event-registration] send failed for', adminEmail, e?.message);
        return { ok: false };
      });
      if (result?.ok) notified++;
    }

    return res.status(200).json({ ok: true, notified });
  } catch (err) {
    console.error('[notify-event-registration]', err?.message || err);
    return res.status(500).json({ ok: false, error: err?.message || 'Server error' });
  }
}
