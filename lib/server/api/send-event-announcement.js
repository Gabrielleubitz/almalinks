/**
 * POST /api/send-event-announcement
 * Send a new-event announcement to approved users who have signed in at least once.
 * Admin only.
 *
 * Body: { eventId: string }
 * Env: EMAIL_FROM; from display name via getFromName() (TRANSACTIONAL_FROM_NAME → MAILCHIMP_FROM_NAME); MAILCHIMP_REPLY_TO.
 */
import '../firebase-init.js';
import admin from '../firebase-init.js';
import { db, auth } from '../firebase-init.js';
import { eventAnnouncement } from '../email-templates.js';
import { getAppBaseUrl, getFromEmail, getFromName } from '../email-config.js';
import { sendTransactionalEmailBulk } from '../transactional-email.js';

async function resolveUsersByAudience(audience) {
  const mode = String(audience?.mode || 'all_users');
  if (mode === 'all_users') {
    const snap = await db.collection('users').where('status', '==', 'approved').get();
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));
  }

  if (mode === 'individuals') {
    const ids = Array.isArray(audience?.ids) ? audience.ids.filter(Boolean) : [];
    if (!ids.length) return [];
    const docs = await Promise.all(ids.map((uid) => db.collection('users').doc(uid).get()));
    return docs.filter((d) => d.exists).map((d) => ({ id: d.id, ...(d.data() || {}) }));
  }

  if (mode === 'event') {
    const srcEventId = String(audience?.eventId || '').trim();
    if (!srcEventId) return [];
    const regsSnap = await db.collection('events').doc(srcEventId).collection('registrations').get();
    const userIds = regsSnap.docs.map((d) => d.id).filter(Boolean);
    if (!userIds.length) return [];
    const docs = await Promise.all(userIds.map((uid) => db.collection('users').doc(uid).get()));
    return docs.filter((d) => d.exists).map((d) => ({ id: d.id, ...(d.data() || {}) }));
  }

  if (mode === 'chat') {
    const chatId = String(audience?.chatId || '').trim();
    if (!chatId) return [];
    const membersSnap = await db.collection('chat_members').where('chatId', '==', chatId).get();
    const userIds = membersSnap.docs.map((d) => String(d.data()?.userId || '')).filter(Boolean);
    if (!userIds.length) return [];
    const docs = await Promise.all(userIds.map((uid) => db.collection('users').doc(uid).get()));
    return docs.filter((d) => d.exists).map((d) => ({ id: d.id, ...(d.data() || {}) }));
  }

  if (mode === 'location') {
    const location = String(audience?.location || '').trim();
    if (!location) return [];
    const [citySnap, countrySnap] = await Promise.all([
      db.collection('users').where('city', '==', location).where('status', '==', 'approved').get(),
      db.collection('users').where('country', '==', location).where('status', '==', 'approved').get(),
    ]);
    const map = new Map();
    [...citySnap.docs, ...countrySnap.docs].forEach((d) => map.set(d.id, { id: d.id, ...(d.data() || {}) }));
    return [...map.values()];
  }

  return [];
}

export default async function handler(req, res) {
  const eventIdFromBody = typeof req.body === 'object' && req.body?.eventId ? req.body.eventId : (typeof req.body === 'string' ? (() => { try { return JSON.parse(req.body)?.eventId; } catch { return null; } })() : null);
  console.log('[send-event-announcement] Request received, eventId:', eventIdFromBody || '(none)');

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('[send-event-announcement] 401 Unauthorized (no Bearer token)');
      return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }
    const idToken = authHeader.split('Bearer ')[1];
    if (!idToken) {
      console.log('[send-event-announcement] 401 Missing token');
      return res.status(401).json({ ok: false, error: 'Missing token' });
    }

    if (!admin.apps.length) {
      console.error('[send-event-announcement] Firebase Admin not initialized');
      return res.status(503).json({
        ok: false,
        error: 'Server not configured. Set FIREBASE_SERVICE_ACCOUNT_KEY in Vercel.',
      });
    }

    let decoded;
    try {
      decoded = await auth.verifyIdToken(idToken);
    } catch (authErr) {
      console.warn('[send-event-announcement] 401 Auth error:', authErr?.message);
      return res.status(401).json({ ok: false, error: 'Invalid or expired token' });
    }
    const isAdmin = decoded.role === 'admin' || decoded.admin === true;
    if (!isAdmin) {
      console.log('[send-event-announcement] 403 Admin required (uid:', decoded?.uid, ')');
      return res.status(403).json({ ok: false, error: 'Admin required' });
    }

    let body;
    try {
      body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    } catch {
      return res.status(400).json({ ok: false, error: 'Invalid JSON body' });
    }
    const eventId = body.eventId;
    if (!eventId || typeof eventId !== 'string') {
      return res.status(400).json({ ok: false, error: 'eventId is required' });
    }

    const eventRef = db.collection('events').doc(eventId);
    const eventSnap = await eventRef.get();
    if (!eventSnap.exists) {
      console.log('[send-event-announcement] 404 Event not found:', eventId);
      return res.status(404).json({ ok: false, error: 'Event not found' });
    }
    const eventData = eventSnap.data();
    const event = {
      id: eventSnap.id,
      name: eventData.name,
      slug: eventData.slug,
      date: eventData.date,
      location: eventData.location,
      description: eventData.description,
      imageUrl: eventData.imageUrl,
      status: eventData.status,
      eventAudience: eventData.eventAudience || null,
    };

    // Only active events should send announcement emails.
    const normalizedStatus = String(event.status || '').trim().toLowerCase();
    const isActiveEvent = normalizedStatus === 'active' || normalizedStatus === 'public';
    if (!isActiveEvent) {
      console.log('[send-event-announcement] Skip: event is not active', { eventId, status: event.status });
      return res.status(200).json({
        ok: true,
        skipped: true,
        reason: 'Announcements are sent only for active events.',
      });
    }

    // Only users in the selected event audience, approved, and signed in at least once.
    const audienceUsers = await resolveUsersByAudience(event.eventAudience || { mode: 'all_users' });
    const recipients = audienceUsers
      .filter((u) => u.email && u.lastLogin && u.status === 'approved')
      .map((u) => ({
        email: String(u.email).trim().toLowerCase(),
        name: u.displayName || u.name || undefined,
      }));

    if (recipients.length === 0) {
      console.log('[send-event-announcement] Skip: no active signed-in recipients');
      return res.status(200).json({
        ok: true,
        skipped: true,
        reason: 'No active recipients (signed in at least once).',
      });
    }

    const baseUrl = getAppBaseUrl();
    const eventUrl = `${baseUrl}/events/${event.slug || event.id || ''}`;
    const subjectLine = `New Event: ${event.name || 'Event'}`;
    const html = eventAnnouncement(event, eventUrl);
    const sendResult = await sendTransactionalEmailBulk({
      to: recipients,
      subject: subjectLine,
      html,
      fromEmail: getFromEmail(),
      fromName: getFromName(),
      replyTo: process.env.MAILCHIMP_REPLY_TO || undefined,
      template: 'event_announcement',
      category: 'event_announcement',
    });

    if (!sendResult.ok && (sendResult.sent || 0) === 0) {
      throw new Error(sendResult.error || 'Failed to send event announcement');
    }

    console.log('[send-event-announcement] Sent event announcement:', {
      eventId,
      sent: sendResult.sent || 0,
      failed: sendResult.failed || 0,
      recipients: recipients.length,
    });
    return res.status(200).json({
      ok: true,
      sent: sendResult.sent || 0,
      failed: sendResult.failed || 0,
      total: recipients.length,
      subject_line: subjectLine,
    });
  } catch (err) {
    const errMsg = err?.message || 'Failed to create or send campaign';
    console.error('[send-event-announcement]', errMsg, err);
    return res.status(500).json({
      ok: false,
      error: errMsg,
    });
  }
}
