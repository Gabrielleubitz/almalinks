/**
 * POST /api/event-registration-approved-email
 * Send approval email to a registrant (event location, meeting link, calendar link).
 * Admin only. Idempotent: if emailSentAt already set, does not resend.
 *
 * Body: { eventId: string, userId: string }
 */
import '../firebase-init.js';
import admin from '../firebase-init.js';
import { db, auth } from '../firebase-init.js';
import { sendTransactionalEmail } from '../transactional-email.js';
import { eventRegistrationApproved } from '../email-templates.js';
import { getEventsLink } from '../email-config.js';

function toGoogleCalendarDates(dateIso, durationMinutes = 60, timezone = 'America/New_York') {
  const start = new Date(dateIso);
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
  const fmt = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  return { start: fmt(start), end: fmt(end) };
}

function buildGoogleCalendarUrl(eventName, dateIso, description, location, meetingUrl, resourceLinkUrl, timezone) {
  const { start, end } = toGoogleCalendarDates(dateIso, 60, timezone);
  const details = [description || ''];
  if (meetingUrl) details.push(`Meeting: ${meetingUrl}`);
  if (location) details.push(`Location: ${location}`);
  if (resourceLinkUrl) details.push(`Link: ${resourceLinkUrl}`);
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: eventName || 'Event',
    dates: `${start}Z/${end}Z`,
    details: details.join('\n\n'),
    location: location || '',
    ctz: timezone || 'America/New_York',
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

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
    const isAdmin = userDoc.exists && (userDoc.data().role === 'admin' || decoded.role === 'admin' || decoded.admin === true);
    if (!isAdmin) {
      return res.status(403).json({ ok: false, error: 'Admin required' });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const { eventId, userId } = body;
    if (!eventId || !userId) {
      return res.status(400).json({ ok: false, error: 'eventId and userId are required' });
    }

    const regRef = db.collection('events').doc(eventId).collection('registrations').doc(userId);
    const regSnap = await regRef.get();
    if (!regSnap.exists) {
      return res.status(404).json({ ok: false, error: 'Registration not found' });
    }

    const regData = regSnap.data();
    if (regData.emailSentAt) {
      return res.status(200).json({ ok: true, skipped: true, message: 'Email already sent' });
    }

    if ((regData.status || 'approved') !== 'approved') {
      return res.status(400).json({ ok: false, error: 'Registration is not approved' });
    }

    const eventSnap = await db.collection('events').doc(eventId).get();
    if (!eventSnap.exists) {
      return res.status(404).json({ ok: false, error: 'Event not found' });
    }
    const eventData = eventSnap.data();

    const privateSnap = await db.collection('events').doc(eventId).collection('privateDetails').doc('details').get();
    const privateData = privateSnap.exists ? privateSnap.data() : {};
    const venue = (privateData.venueAddress || '').toString().trim();
    const baseLoc = (privateData.locationText || eventData.location || 'TBD').toString().trim();
    const locationText = venue ? `${venue}\n${baseLoc}` : baseLoc;
    const calendarLocation = venue && baseLoc && baseLoc !== 'TBD' ? `${venue}, ${baseLoc}` : venue || baseLoc || 'TBD';
    const meetingUrl = privateData.meetingUrl || null;
    const resourceLinkUrl = privateData.resourceLinkUrl || null;
    const resourceLinkLabel = privateData.resourceLinkLabel || null;

    const eventName = eventData.name || 'Event';
    const eventDate = eventData.date;
    const eventDescription = eventData.description || '';
    const timezone = eventData.timezone || 'America/New_York';

    const calendarUrl = buildGoogleCalendarUrl(
      eventName,
      eventDate,
      eventDescription,
      calendarLocation,
      meetingUrl,
      resourceLinkUrl,
      timezone
    );

    const eventsLink = getEventsLink();
    const displayName = (regData.name || '').trim() || 'there';
    const toEmail = (regData.email || '').trim().toLowerCase();
    if (!toEmail) {
      return res.status(400).json({ ok: false, error: 'Registrant has no email' });
    }

    const html = eventRegistrationApproved(
      displayName,
      eventName,
      eventDate,
      locationText,
      meetingUrl,
      resourceLinkUrl,
      resourceLinkLabel,
      calendarUrl,
      eventsLink
    );

    const subject = `You're confirmed: ${eventName}`;
    const text = `Hi ${displayName},\n\nYou're confirmed for ${eventName}.\n\nDate: ${eventDate}\nLocation: ${locationText}\n${meetingUrl ? `Meeting link: ${meetingUrl}\n` : ''}${resourceLinkUrl ? `Resource: ${resourceLinkUrl}\n` : ''}\nAdd to calendar: ${calendarUrl}\n\nView event: ${eventsLink}\n\n— AlmaLinks Team`;

    const result = await sendTransactionalEmail({
      to: toEmail,
      subject,
      html,
      text,
    });

    if (!result.ok) {
      console.error('[event-registration-approved-email] Send failed:', result.error);
      return res.status(500).json({ ok: false, error: result.error || 'Failed to send email' });
    }

    await regRef.update({
      emailSentAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.status(200).json({ ok: true, message: 'Approval email sent' });
  } catch (err) {
    console.error('[event-registration-approved-email]', err);
    return res.status(500).json({ ok: false, error: err?.message || 'Server error' });
  }
}
