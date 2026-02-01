/**
 * POST /api/send-event-announcement
 * Create and send a Mailchimp Marketing campaign to the entire audience announcing a new event.
 * Admin only. Uses ONLY Mailchimp Marketing API (no Mandrill/Transactional).
 *
 * Body: { eventId: string }
 * Env: MAILCHIMP_AUDIENCE_ID, MAILCHIMP_MARKETING_API_KEY, MAILCHIMP_SERVER,
 *      MAILCHIMP_FROM_NAME (optional), MAILCHIMP_REPLY_TO (required for campaigns).
 */
import '../firebase-init.js';
import admin from '../firebase-init.js';
import { db, auth } from '../firebase-init.js';
import { getMailchimpAudienceConfig } from '../mailchimp-audience.js';
import { createAndSendEventCampaign } from '../mailchimp-campaign.js';

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

    const config = getMailchimpAudienceConfig();
    if (!config) {
      const errMsg = 'Mailchimp not configured. Set MAILCHIMP_AUDIENCE_ID and MAILCHIMP_MARKETING_API_KEY (and MAILCHIMP_SERVER).';
      console.error('[send-event-announcement]', errMsg);
      return res.status(503).json({ ok: false, error: errMsg });
    }
    if (!process.env.MAILCHIMP_REPLY_TO) {
      const errMsg = 'MAILCHIMP_REPLY_TO is required for campaigns (verified email on your Mailchimp domain).';
      console.error('[send-event-announcement]', errMsg);
      return res.status(503).json({ ok: false, error: errMsg });
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
    };

    const result = await createAndSendEventCampaign(event);
    console.log('[send-event-announcement] Campaign sent:', result.campaignId, result.subject_line);
    console.log('[send-event-announcement] Recipients = entire Mailchimp audience. Your email must be in that audience to receive the email (run Import users to Mailchimp or add it in Mailchimp).');
    return res.status(200).json({
      ok: true,
      campaignId: result.campaignId,
      subject_line: result.subject_line,
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
