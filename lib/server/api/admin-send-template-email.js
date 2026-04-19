/**
 * POST /api/admin/test/send-template-email
 * Admin-only. Send a test email using one of the Alma email templates (with sample data).
 * Body: { "to": "email@domain.com", "template": "welcome" | "test" | "welcome-approved" | "rejection" | "event-announcement" | ... }
 * Uses Mailjet or Mandrill (same as other transactional emails).
 */
import '../firebase-init.js';
import { auth } from '../firebase-init.js';
import { getAppBaseUrl, getLoginLink, getEventsLink, getReRequestLink } from '../email-config.js';
import { wrapInAlmaTheme } from '../alma-email-theme.js';
import {
  testEmail,
  welcomeSignup,
  welcomeApproved,
  applicationRejected,
  eventAnnouncement,
  registrationConfirmation,
  eventReminder,
  passwordReset,
  userCredentials,
} from '../email-templates.js';
import { sendTransactionalEmail } from '../transactional-email.js';

const TEMPLATES = {
  test: {
    subject: '✅ AlmaLinks Test Email',
    buildHtml: (baseUrl, to, _) => testEmail((to && to.split('@')[0]) || 'Test', baseUrl),
  },
  welcome: {
    subject: 'We received your signup',
    buildHtml: (baseUrl, to) => {
      const firstName = (to && to.split('@')[0]) || 'there';
      return welcomeSignup(firstName, getLoginLink(), getEventsLink());
    },
  },
  'welcome-approved': {
    subject: 'Welcome to AlmaLinks!',
    buildHtml: (baseUrl, to) => {
      const name = (to && to.split('@')[0]) || 'there';
      return welcomeApproved(name, getLoginLink(), getEventsLink());
    },
  },
  rejection: {
    subject: 'Your AlmaLinks Application',
    buildHtml: (baseUrl, to) => {
      const name = (to && to.split('@')[0]) || 'there';
      const reRequestLink = getReRequestLink();
      const contactEmail = process.env.ALMA_CONTACT_EMAIL || 'communications@almalinks.org';
      const contactLabel = 'AlmaLinks';
      return applicationRejected(name, reRequestLink, contactEmail, contactLabel);
    },
  },
  'event-announcement': {
    subject: 'New Event: Sample Event',
    buildHtml: (baseUrl) => {
      const event = {
        name: 'Sample Event',
        date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        location: 'Online',
        description: 'This is a sample event for testing the email template.',
      };
      const eventUrl = `${baseUrl}/events/sample`;
      return eventAnnouncement(event, eventUrl);
    },
  },
  'registration-confirmation': {
    subject: "You're registered — Sample Event",
    buildHtml: (baseUrl, to) => {
      const name = (to && to.split('@')[0]) || 'there';
      const eventDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      return registrationConfirmation(name, 'Sample Event', eventDate, 'Online', getLoginLink(), getEventsLink());
    },
  },
  'event-reminder': {
    subject: 'Reminder: Sample Event',
    buildHtml: (baseUrl, to) => {
      const name = (to && to.split('@')[0]) || 'there';
      const eventDate = new Date(Date.now() + 1 * 24 * 60 * 60 * 1000);
      const eventUrl = `${baseUrl}/events/sample`;
      return eventReminder(name, 'Sample Event', eventDate, 'Online', eventUrl);
    },
  },
  'password-reset': {
    subject: 'Reset your password',
    buildHtml: (baseUrl, to) => {
      const name = (to && to.split('@')[0]) || 'there';
      const resetLink = `${baseUrl}/reset-password?token=sample-token`;
      return passwordReset(name, resetLink);
    },
  },
  'user-credentials': {
    subject: 'Your AlmaLinks account is ready',
    buildHtml: (baseUrl, to) => {
      const name = (to && to.split('@')[0]) || 'there';
      const email = to || 'user@example.com';
      return userCredentials(name, email, 'TempPass123!', getLoginLink());
    },
  },
};

function normalizeEmail(email) {
  return (email && String(email).trim().toLowerCase()) || '';
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ ok: false, error: 'Unauthorized: Missing or invalid token' });
    }
    const idToken = authHeader.replace(/^Bearer\s+/i, '').trim();
    let decoded;
    try {
      decoded = await auth.verifyIdToken(idToken);
    } catch (e) {
      return res.status(401).json({ ok: false, error: 'Unauthorized: Invalid token' });
    }
    const isAdmin = decoded.role === 'admin' || decoded.admin === true;
    if (!isAdmin) {
      return res.status(403).json({ ok: false, error: 'Forbidden: Admin required' });
    }

    const body = typeof req.body === 'object' && req.body !== null ? req.body : {};
    const toRaw = normalizeEmail(body.to);
    const templateKey = (body.template && String(body.template).trim()) || '';

    if (!toRaw) {
      return res.status(400).json({ ok: false, error: 'Missing or invalid body.to (email)' });
    }
    if (!isValidEmail(toRaw)) {
      return res.status(400).json({ ok: false, error: 'Invalid email format' });
    }
    const template = TEMPLATES[templateKey];
    if (!template) {
      return res.status(400).json({
        ok: false,
        error: `Invalid template. Use one of: ${Object.keys(TEMPLATES).join(', ')}`,
      });
    }

    const baseUrl = getAppBaseUrl();
    const innerHtml = template.buildHtml(baseUrl, toRaw, body);
    const html = wrapInAlmaTheme(innerHtml, { title: template.subject, appUrl: baseUrl });

    const result = await sendTransactionalEmail({
      to: toRaw,
      subject: template.subject,
      html,
      skipTheme: true,
      template: templateKey,
    });

    if (result.ok) {
      return res.status(200).json({
        ok: true,
        sentTo: toRaw,
        template: templateKey,
        subject: template.subject,
        messageId: result.messageId,
      });
    }

    return res.status(500).json({
      ok: false,
      sentTo: toRaw,
      template: templateKey,
      error: result.error || 'Send failed',
      messageId: result.messageId,
    });
  } catch (err) {
    console.error('[admin-send-template-email]', err?.message || err);
    return res.status(500).json({
      ok: false,
      error: err?.message || 'Internal server error',
    });
  }
}
