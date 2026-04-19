/**
 * POST /api/admin/test/mailjet
 * Admin-only. Send a branded test email via Mailjet using the shared Alma template.
 * Body: { "to": "email@domain.com" }
 * Returns: { provider, sentTo, ok, providerMessageId?, error? }
 */
import '../firebase-init.js';
import { auth } from '../firebase-init.js';
import { getAppBaseUrl } from '../email-config.js';
import { wrapInAlmaTheme } from '../alma-email-theme.js';
import { testEmail } from '../email-templates.js';
import { sendMailjet } from '../mailjet.js';

const SUBJECT = '✅ AlmaLinks Test Email';

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
      return res.status(401).json({ provider: 'mailjet', ok: false, error: 'Unauthorized: Missing or invalid token' });
    }
    const idToken = authHeader.replace(/^Bearer\s+/i, '').trim();
    let decoded;
    try {
      decoded = await auth.verifyIdToken(idToken);
    } catch (e) {
      return res.status(401).json({ provider: 'mailjet', ok: false, error: 'Unauthorized: Invalid token' });
    }
    const isAdmin = decoded.role === 'admin' || decoded.admin === true;
    if (!isAdmin) {
      return res.status(403).json({ provider: 'mailjet', ok: false, error: 'Forbidden: Admin required' });
    }

    const body = typeof req.body === 'object' && req.body !== null ? req.body : {};
    const toRaw = normalizeEmail(body.to);
    if (!toRaw) {
      return res.status(400).json({ provider: 'mailjet', ok: false, error: 'Missing or invalid body.to (email)' });
    }
    if (!isValidEmail(toRaw)) {
      return res.status(400).json({ provider: 'mailjet', ok: false, error: 'Invalid email format' });
    }

    const baseUrl = getAppBaseUrl();
    const recipientName = (body.name && String(body.name).trim()) || toRaw.split('@')[0] || 'admin';
    const innerHtml = testEmail(recipientName, baseUrl);
    const html = wrapInAlmaTheme(innerHtml, { title: SUBJECT, appUrl: baseUrl });
    const text = `Hey ${recipientName}! 👋\n\nThis is a test email from AlmaLinks. If you're seeing this, everything's working perfectly.\n\nVisit AlmaLinks: ${baseUrl}\n\n— AlmaLinks Team`;

    const result = await sendMailjet({
      to: toRaw,
      subject: SUBJECT,
      html,
      text,
    });

    if (result.ok) {
      return res.status(200).json({
        provider: 'mailjet',
        sentTo: toRaw,
        ok: true,
        providerMessageId: result.messageId,
      });
    }

    return res.status(500).json({
      provider: 'mailjet',
      sentTo: toRaw,
      ok: false,
      error: result.error || 'Send failed',
      providerMessageId: result.messageId,
    });
  } catch (err) {
    console.error('[admin-test-mailjet]', err?.message || err);
    return res.status(500).json({
      provider: 'mailjet',
      sentTo: '',
      ok: false,
      error: err?.message || 'Internal server error',
    });
  }
}
