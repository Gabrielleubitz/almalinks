/**
 * POST /api/test-mandrill
 * Send a single test transactional email via Mandrill to verify configuration.
 * Server-only. No Mailchimp Marketing APIs. Uses Mandrill (MAILCHIMP_API_KEY) only.
 *
 * Body (optional): { "to": "email@example.com" }
 * If "to" is missing, uses process.env.TEST_MANDRILL_EMAIL or returns 400.
 * If TEST_MANDRILL_SECRET is set, requires header: x-test-secret: <value> (401 if missing/wrong).
 */
import { sendTransactionalEmail } from '../mandrill.js';

const SUBJECT = 'Mandrill Test Email ✅';
const HTML = '<h1>Mandrill is working 🎉</h1><p>This is a test email.</p>';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const secret = process.env.TEST_MANDRILL_SECRET;
  if (secret) {
    const provided = (req.headers['x-test-secret'] || '').trim();
    if (provided !== secret) {
      console.log('[test-mandrill] 401 Missing or invalid x-test-secret');
      return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }
  }

  let body = {};
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
  } catch {
    return res.status(400).json({ ok: false, error: 'Invalid JSON body' });
  }

  const toRaw = (body.to != null ? String(body.to) : '').trim().toLowerCase() || (process.env.TEST_MANDRILL_EMAIL || '').trim().toLowerCase();
  if (!toRaw) {
    return res.status(400).json({
      ok: false,
      error: 'Missing recipient: provide body.to or set TEST_MANDRILL_EMAIL',
    });
  }
  const to = toRaw;

  console.log('[test-mandrill] Sending test email — recipient:', to, 'subject:', SUBJECT);

  const result = await sendTransactionalEmail({
    to,
    subject: SUBJECT,
    html: HTML,
    text: 'Mandrill is working. This is a test email.',
  });

  if (result.ok) {
    console.log('[test-mandrill] Mandrill response: status =', result.status);
    return res.status(200).json({
      ok: true,
      mandrillStatus: result.status,
      to,
    });
  }

  console.error('[test-mandrill] Mandrill send failed — full response:', JSON.stringify(result.details ?? result));
  return res.status(500).json({
    ok: false,
    error: 'MANDRILL_SEND_FAILED',
    details: result.details ?? { message: result.error, rejectReason: result.rejectReason },
  });
}
