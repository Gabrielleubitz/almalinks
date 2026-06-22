/**
 * POST /api/notify-event-change
 * Admin-only. Emails all approved registrants when an event's key details change.
 *
 * Body: {
 *   eventId: string,
 *   eventName: string,
 *   changes: Record<string, { from: string, to: string }>  // only the changed fields
 * }
 */
import '../firebase-init.js';
import admin from '../firebase-init.js';
import { db } from '../firebase-init.js';
import { verifyAdminRequest } from '../admin-auth.js';
import { isTransactionalEmailConfigured, sendTransactionalEmail } from '../transactional-email.js';
import { getAppBaseUrl } from '../email-config.js';

const FIELD_LABELS = {
  date: 'Date & Time',
  location: 'Location',
  name: 'Event Name',
  meetingUrl: 'Meeting Link',
  venueAddress: 'Venue Address',
  eventFormat: 'Format',
};

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
    const { eventId, eventName, changes } = body;

    if (!eventId) {
      return res.status(400).json({ ok: false, error: 'eventId is required' });
    }

    const changeEntries = Object.entries(changes || {}).filter(([, v]) => v && v.to);
    if (!changeEntries.length) {
      return res.status(200).json({ ok: true, skipped: true, reason: 'No significant changes' });
    }

    if (!isTransactionalEmailConfigured()) {
      return res.status(200).json({ ok: true, skipped: true, reason: 'Email not configured' });
    }

    // Collect all approved / confirmed registrants
    const regsSnap = await db.collection('events').doc(eventId).collection('registrations').get();
    const recipientMap = new Map(); // email -> name

    for (const regDoc of regsSnap.docs) {
      const d = regDoc.data() || {};
      const status = String(d.status || 'approved').toLowerCase();
      if (status === 'rejected' || status === 'pending') continue;

      let email = String(d.email || '').trim().toLowerCase();
      const name = d.name || '';

      if (!email) {
        try {
          const uSnap = await db.collection('users').doc(regDoc.id).get();
          email = String(uSnap.data()?.email || '').trim().toLowerCase();
          if (email) recipientMap.set(email, uSnap.data()?.displayName || name);
        } catch { /* skip */ }
        continue;
      }
      recipientMap.set(email, name);
    }

    if (!recipientMap.size) {
      return res.status(200).json({ ok: true, skipped: true, reason: 'No approved registrants' });
    }

    const base = getAppBaseUrl();
    const eventLink = `${base}/events/${eventId}`;
    const displayName = eventName || eventId;

    const changeHtml = changeEntries.map(([field, { to }]) => {
      const label = FIELD_LABELS[field] || field;
      return `<li style="margin:4px 0;color:#374151;"><strong>${label}:</strong> ${String(to).replace(/</g, '&lt;')}</li>`;
    }).join('');

    const changeText = changeEntries.map(([field, { to }]) => `• ${FIELD_LABELS[field] || field}: ${to}`).join('\n');

    const subject = `Update: "${displayName}" has changed`;
    const html = `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
  <p style="margin:0 0 12px 0;font-size:16px;color:#1C1C1C;">An event you registered for has been updated:</p>
  <p style="margin:0 0 16px 0;font-size:18px;font-weight:700;color:#1C1C1C;">${displayName}</p>
  <ul style="margin:0 0 20px 0;padding-left:20px;">${changeHtml}</ul>
  <p style="margin:0 0 16px 0;font-size:14px;color:#6B7280;">
    If this change affects your availability, please update your registration.
  </p>
  <a href="${eventLink}" style="display:inline-block;padding:10px 20px;background:#2E7FEF;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">View Event Details</a>
</div>`;
    const text = `"${displayName}" has been updated:\n${changeText}\n\nIf this affects your availability, update your registration: ${eventLink}`;

    let sent = 0;
    let errors = 0;
    for (const [email, name] of recipientMap) {
      const result = await sendTransactionalEmail({ to: email, subject, html, text }).catch((e) => {
        console.warn('[notify-event-change] send failed for', email, e?.message);
        return { ok: false };
      });
      if (result?.ok !== false) sent++;
      else errors++;
    }

    console.log('[notify-event-change] Sent', sent, 'of', recipientMap.size, 'for event', eventId);
    return res.status(200).json({ ok: true, sent, errors, total: recipientMap.size });
  } catch (err) {
    console.error('[notify-event-change]', err?.message || err);
    return res.status(500).json({ ok: false, error: err?.message || 'Server error' });
  }
}
