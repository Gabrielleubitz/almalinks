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
import { db } from '../firebase-init.js';
import { verifyAdminRequest } from '../admin-auth.js';
import { eventAnnouncement, normalizeEventForEmail } from '../email-templates.js';
import { getAppBaseUrl, getFromEmail, getFromName } from '../email-config.js';
import { isTransactionalEmailConfigured, sendTransactionalEmailBulk } from '../transactional-email.js';

function effectiveEventAudienceIds(audience) {
  const fromArr = Array.isArray(audience?.eventIds) ? audience.eventIds.filter(Boolean) : [];
  if (fromArr.length) return [...new Set(fromArr)];
  if (audience?.eventId) return [String(audience.eventId).trim()].filter(Boolean);
  return [];
}

function effectiveChatAudienceIds(audience) {
  const fromArr = Array.isArray(audience?.chatIds) ? audience.chatIds.filter(Boolean) : [];
  if (fromArr.length) return [...new Set(fromArr)];
  if (audience?.chatId) return [String(audience.chatId).trim()].filter(Boolean);
  return [];
}

function effectiveLocationAudienceLabels(audience) {
  const fromArr = Array.isArray(audience?.locations)
    ? audience.locations.map((s) => String(s || '').trim()).filter(Boolean)
    : [];
  if (fromArr.length) return [...new Set(fromArr)];
  if (audience?.location?.trim()) return [audience.location.trim()];
  return [];
}

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
    const eventIds = effectiveEventAudienceIds(audience);
    if (!eventIds.length) return [];
    const map = new Map();
    for (const srcEventId of eventIds) {
      const regsSnap = await db.collection('events').doc(srcEventId).collection('registrations').get();
      const userIds = regsSnap.docs.map((d) => d.id).filter(Boolean);
      const docs = await Promise.all(userIds.map((uid) => db.collection('users').doc(uid).get()));
      docs.filter((d) => d.exists).forEach((d) => map.set(d.id, { id: d.id, ...(d.data() || {}) }));
    }
    return [...map.values()];
  }

  if (mode === 'chat') {
    const chatIds = effectiveChatAudienceIds(audience);
    if (!chatIds.length) return [];
    const map = new Map();
    for (const chatId of chatIds) {
      const membersSnap = await db.collection('chat_members').where('chatId', '==', chatId).get();
      const userIds = membersSnap.docs.map((d) => String(d.data()?.userId || '')).filter(Boolean);
      const docs = await Promise.all(userIds.map((uid) => db.collection('users').doc(uid).get()));
      docs.filter((d) => d.exists).forEach((d) => map.set(d.id, { id: d.id, ...(d.data() || {}) }));
    }
    return [...map.values()];
  }

  if (mode === 'location') {
    const locations = effectiveLocationAudienceLabels(audience);
    if (!locations.length) return [];
    const map = new Map();
    for (const location of locations) {
      const [citySnap, countrySnap] = await Promise.all([
        db.collection('users').where('city', '==', location).where('status', '==', 'approved').get(),
        db.collection('users').where('country', '==', location).where('status', '==', 'approved').get(),
      ]);
      [...citySnap.docs, ...countrySnap.docs].forEach((d) =>
        map.set(d.id, { id: d.id, ...(d.data() || {}) })
      );
    }
    return [...map.values()];
  }

  if (mode === 'chapter') {
    const chapters = Array.isArray(audience?.chapters)
      ? audience.chapters.map((s) => String(s || '').trim()).filter(Boolean)
      : (audience?.chapter ? [String(audience.chapter).trim()] : []);
    if (!chapters.length) return [];
    const map = new Map();
    for (const chapter of chapters) {
      // Case-insensitive match: query exact value first, then try lowercase variant
      const snap = await db.collection('users').where('chapter', '==', chapter).where('status', '==', 'approved').get();
      snap.docs.forEach((d) => map.set(d.id, { id: d.id, ...(d.data() || {}) }));
    }
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
    if (!admin.apps.length) {
      console.error('[send-event-announcement] Firebase Admin not initialized');
      return res.status(503).json({
        ok: false,
        error: 'Server not configured. Set FIREBASE_SERVICE_ACCOUNT_KEY in Vercel.',
      });
    }

    const authResult = await verifyAdminRequest(req);
    if (!authResult.ok) {
      console.warn('[send-event-announcement]', authResult.status, authResult.error);
      return res.status(authResult.status).json({ ok: false, error: authResult.error });
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
    const event = normalizeEventForEmail({
      id: eventSnap.id,
      name: eventData.name,
      slug: eventData.slug,
      date: eventData.date,
      location: eventData.location,
      description: eventData.description,
      imageUrl: eventData.imageUrl,
      status: eventData.status,
      eventAudience: eventData.eventAudience || null,
    });

    if (!isTransactionalEmailConfigured()) {
      return res.status(503).json({
        ok: false,
        error: 'Transactional email is not configured on the server.',
        hint: 'Set MAILJET_API_KEY + MAILJET_SECRET_KEY or MAILCHIMP_API_KEY in Vercel → Environment Variables, then redeploy.',
      });
    }

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

    // Users in the event audience who are approved and have email.
    // For targeted audiences (not all_users), include members who have not signed in yet so invites reach the full list.
    const audienceMode = String(event.eventAudience?.mode || 'all_users');
    const requireLastLogin = audienceMode === 'all_users';
    const audienceUsers = await resolveUsersByAudience(event.eventAudience || { mode: 'all_users' });
    const recipients = audienceUsers
      .filter((u) => u.email && u.status === 'approved' && (!requireLastLogin || u.lastLogin))
      .map((u) => ({
        email: String(u.email).trim().toLowerCase(),
        name: u.displayName || u.name || undefined,
      }));

    if (recipients.length === 0) {
      console.log('[send-event-announcement] Skip: no eligible recipients');
      return res.status(200).json({
        ok: true,
        skipped: true,
        reason: requireLastLogin
          ? 'No approved recipients with email who have signed in at least once.'
          : 'No approved recipients with email in this event audience.',
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
      const status = sendResult.error?.includes('not configured') ? 503 : 502;
      return res.status(status).json({
        ok: false,
        error: sendResult.error || 'Failed to send event announcement',
        hint:
          sendResult.hint ||
          'Verify Mailjet or Mandrill credentials and sender domain in Vercel env vars.',
        detail: sendResult.details ? String(sendResult.details).slice(0, 500) : undefined,
      });
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
