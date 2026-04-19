/**
 * Mailjet — transactional email sender.
 * Uses MAILJET_API_KEY + MAILJET_SECRET_KEY or MJ_APIKEY_PUBLIC + MJ_APIKEY_PRIVATE.
 * Server-only.
 *
 * Env: MAILJET_API_KEY / MAILJET_SECRET_KEY (or MJ_APIKEY_PUBLIC / MJ_APIKEY_PRIVATE),
 *      TRANSACTIONAL_FROM_EMAIL (or EMAIL_FROM), TRANSACTIONAL_FROM_NAME, TRANSACTIONAL_REPLY_TO.
 *      From display name: use getFromName() from email-config.js (TRANSACTIONAL_FROM_NAME → MAILCHIMP_FROM_NAME).
 */

import { getFromName } from './email-config.js';

function getFromEmail() {
  return (
    (process.env.TRANSACTIONAL_FROM_EMAIL || process.env.EMAIL_FROM || 'noreply@almalinks.org')
  ).trim();
}

function getReplyTo() {
  const r = (
    process.env.TRANSACTIONAL_REPLY_TO ||
    process.env.MAILCHIMP_REPLY_TO ||
    ''
  ).trim();
  return r || undefined;
}

function getCredentials() {
  const apiKey =
    (process.env.MAILJET_API_KEY || process.env.MJ_APIKEY_PUBLIC || '').trim();
  const secretKey = (
    process.env.MAILJET_SECRET_KEY ||
    process.env.MJ_APIKEY_PRIVATE ||
    ''
  ).trim();
  return { apiKey, secretKey };
}

/**
 * Send a single transactional email via Mailjet.
 * @param {{
 *   to: string,
 *   subject: string,
 *   html: string,
 *   text?: string,
 *   fromEmail?: string,
 *   fromName?: string,
 *   replyTo?: string,
 * }} opts
 * @returns {Promise<{ ok: boolean, messageId?: string, error?: string, details?: unknown }>}
 */
export async function sendMailjet(opts) {
  const { apiKey, secretKey } = getCredentials();
  if (!apiKey || !secretKey) {
    console.error('[mailjet] MAILJET_API_KEY / MAILJET_SECRET_KEY (or MJ_APIKEY_*) not set');
    return { ok: false, error: 'Mailjet not configured' };
  }

  const to = (opts.to || '').trim().toLowerCase();
  if (!to) {
    console.error('[mailjet] Missing recipient (to)');
    return { ok: false, error: 'Missing recipient' };
  }

  const fromEmail = (opts.fromEmail || getFromEmail()).trim();
  const fromName = (opts.fromName || getFromName()).trim();
  const subject = (opts.subject || '').trim() || '(No subject)';
  const html = opts.html != null ? String(opts.html) : '';
  const text =
    opts.text != null
      ? String(opts.text)
      : html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const replyTo = (opts.replyTo || getReplyTo()) || undefined;

  let Mailjet;
  try {
    Mailjet = (await import('node-mailjet')).default;
  } catch (e) {
    console.error('[mailjet] node-mailjet import failed:', e?.message || e);
    return { ok: false, error: 'Mailjet client unavailable', details: e };
  }

  const mailjet = Mailjet.apiConnect(apiKey, secretKey);
  const message = {
    From: { Email: fromEmail, Name: fromName },
    To: [{ Email: to, Name: to.split('@')[0] }],
    Subject: subject,
    TextPart: text || undefined,
    HTMLPart: html || undefined,
    ...(replyTo && { ReplyTo: { Email: replyTo, Name: fromName } }),
  };

  try {
    const result = await mailjet.post('send', { version: 'v3.1' }).request({
      Messages: [message],
    });

    const body = result?.body;
    const messages = body?.Messages;
    const first = Array.isArray(messages) ? messages[0] : null;
    const messageId = first?.To?.[0]?.MessageID ?? first?.MessageID ?? body?.MessageID;

    console.log('[mailjet] sent:', {
      to: to.slice(0, 3) + '***',
      subject: subject.slice(0, 40),
      messageId: messageId || '-',
    });
    return { ok: true, messageId };
  } catch (err) {
    const statusCode = err?.statusCode ?? err?.response?.status;
    const errBody = err?.response?.body ?? err?.body;
    console.error('[mailjet] send error:', statusCode, err?.message || err, errBody ?? '');
    return {
      ok: false,
      error: err?.message || errBody?.ErrorMessage || 'Send failed',
      details: errBody ?? err?.response,
    };
  }
}

/**
 * Send one message to multiple recipients (e.g. bulk). Same subject/html/text for all.
 * @param {{
 *   to: Array<{ email: string, name?: string }>,
 *   subject: string,
 *   html: string,
 *   text?: string,
 *   fromEmail?: string,
 *   fromName?: string,
 *   replyTo?: string,
 * }} opts
 * @returns {Promise<{ ok: boolean, sent: number, failed: number, results?: Array<{ email: string, status?: string, messageId?: string, error?: string }>, error?: string }>}
 */
export async function sendMailjetBulk(opts) {
  const { apiKey, secretKey } = getCredentials();
  if (!apiKey || !secretKey) {
    return { ok: false, sent: 0, failed: (opts.to || []).length, error: 'Mailjet not configured' };
  }

  const toList = Array.isArray(opts.to) ? opts.to : [];
  if (toList.length === 0) {
    return { ok: false, sent: 0, failed: 0, error: 'No recipients' };
  }

  const fromEmail = (opts.fromEmail || getFromEmail()).trim();
  const fromName = (opts.fromName || getFromName()).trim();
  const subject = (opts.subject || '').trim() || '(No subject)';
  const html = opts.html != null ? String(opts.html) : '';
  const text =
    opts.text != null
      ? String(opts.text)
      : html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const replyTo = (opts.replyTo || getReplyTo()) || undefined;

  let Mailjet;
  try {
    Mailjet = (await import('node-mailjet')).default;
  } catch (e) {
    return {
      ok: false,
      sent: 0,
      failed: toList.length,
      error: 'Mailjet client unavailable',
      details: e,
    };
  }

  const mailjet = Mailjet.apiConnect(apiKey, secretKey);
  const message = {
    From: { Email: fromEmail, Name: fromName },
    To: toList.map((r) => ({
      Email: (r.email || '').trim().toLowerCase(),
      Name: (r.name || (r.email || '').split('@')[0] || ''),
    })),
    Subject: subject,
    TextPart: text || undefined,
    HTMLPart: html || undefined,
    ...(replyTo && { ReplyTo: { Email: replyTo, Name: fromName } }),
  };

  try {
    const result = await mailjet.post('send', { version: 'v3.1' }).request({
      Messages: [message],
    });
    const body = result?.body;
    const messages = body?.Messages;
    const first = Array.isArray(messages) ? messages[0] : null;
    const toResults = first?.To || [];
    let sent = 0;
    const results = toList.map((r, i) => {
      const tr = toResults[i] || {};
      const status = tr.MessageID ? 'sent' : tr.Status || 'unknown';
      if (tr.MessageID) sent++;
      return {
        email: (r.email || '').trim().toLowerCase(),
        status,
        messageId: tr.MessageID,
        error: tr.MessageID ? undefined : (tr.Status || 'failed'),
      };
    });
    const failed = toList.length - sent;
    console.log('[mailjet] bulk sent:', sent, 'failed:', failed);
    return { ok: failed === 0, sent, failed, results };
  } catch (err) {
    const errBody = err?.response?.body ?? err?.body;
    const errMsg = err?.message || errBody?.ErrorMessage || 'Send failed';
    console.error('[mailjet] bulk error:', err?.message || err, errBody ?? '');
    return {
      ok: false,
      sent: 0,
      failed: toList.length,
      error: errMsg,
      details: errBody ?? err?.response,
    };
  }
}

export { getFromEmail as getMailjetFromEmail, getFromName as getMailjetFromName, getReplyTo as getMailjetReplyTo };
