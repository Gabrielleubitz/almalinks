/**
 * Single entry point for transactional emails: Alma theme + Mailjet (if configured) or Mandrill.
 * All HTML is wrapped in the shared Alma Links theme before sending.
 * Successful sends are logged to Firestore (emailLog) for admin tracking.
 *
 * Env: For Mailjet: MAILJET_API_KEY + MAILJET_SECRET_KEY (or MJ_APIKEY_PUBLIC + MJ_APIKEY_PRIVATE).
 *      For Mandrill fallback: MAILCHIMP_API_KEY. From/reply: TRANSACTIONAL_FROM_EMAIL, etc.
 */

import { wrapInAlmaTheme } from './alma-email-theme.js';
import { sendMailjet, sendMailjetBulk } from './mailjet.js';
import { sendTransactionalEmail as sendMandrill } from './mandrill.js';
import { logEmailSend, logEmailSendBulk } from './email-log.js';

function isMailjetConfigured() {
  const key =
    (process.env.MAILJET_API_KEY || process.env.MJ_APIKEY_PUBLIC || '').trim();
  const secret = (
    process.env.MAILJET_SECRET_KEY ||
    process.env.MJ_APIKEY_PRIVATE ||
    ''
  ).trim();
  return Boolean(key && secret);
}

/**
 * Send one transactional email. HTML is wrapped in Alma theme; then sent via Mailjet or Mandrill.
 * @param {{
 *   to: string,
 *   subject: string,
 *   html: string,
 *   text?: string,
 *   fromEmail?: string,
 *   fromName?: string,
 *   replyTo?: string,
 *   skipTheme?: boolean,
 *   template?: string,
 *   category?: string,
 * }} opts
 * @returns {Promise<{ ok: boolean, messageId?: string, status?: string, rejectReason?: string, error?: string, details?: unknown }>}
 */
export async function sendTransactionalEmail(opts) {
  const html =
    opts.skipTheme === true
      ? (opts.html != null ? String(opts.html) : '')
      : wrapInAlmaTheme(opts.html != null ? String(opts.html) : '', {});

  const payload = {
    to: opts.to,
    subject: opts.subject,
    html,
    text: opts.text,
    fromEmail: opts.fromEmail,
    fromName: opts.fromName,
    replyTo: opts.replyTo,
  };

  const provider = isMailjetConfigured() ? 'mailjet' : 'mandrill';
  const result = provider === 'mailjet' ? await sendMailjet(payload) : await sendMandrill(payload);
  if (result.ok && opts.to) {
    logEmailSend({
      to: opts.to,
      subject: opts.subject,
      provider,
      messageId: result.messageId,
      template: opts.template,
      category: opts.category,
    }).catch(() => {});
  }
  return result;
}

/**
 * Send one message to multiple recipients. HTML is wrapped in Alma theme once; then Mailjet or Mandrill.
 * @param {{
 *   to: Array<{ email: string, name?: string }>,
 *   subject: string,
 *   html: string,
 *   text?: string,
 *   fromEmail?: string,
 *   fromName?: string,
 *   replyTo?: string,
 *   skipTheme?: boolean,
 * }} opts
 * @returns {Promise<{ ok: boolean, sent: number, failed: number, results?: Array<{ email: string, status?: string, messageId?: string, error?: string }>, error?: string, details?: unknown }>}
 */
export async function sendTransactionalEmailBulk(opts) {
  const html =
    opts.skipTheme === true
      ? (opts.html != null ? String(opts.html) : '')
      : wrapInAlmaTheme(opts.html != null ? String(opts.html) : '', {});

  const payload = {
    to: opts.to,
    subject: opts.subject,
    html,
    text: opts.text,
    fromEmail: opts.fromEmail,
    fromName: opts.fromName,
    replyTo: opts.replyTo,
  };

  const provider = isMailjetConfigured() ? 'mailjet' : 'mandrill';
  let bulkResult;
  if (provider === 'mailjet') {
    bulkResult = await sendMailjetBulk(payload);
  } else {
    const { sendTransactionalEmail: sendOne } = await import('./mandrill.js');
    const toList = Array.isArray(opts.to) ? opts.to : [];
    if (toList.length === 0) {
      return { ok: false, sent: 0, failed: 0, error: 'No recipients' };
    }
    const results = [];
    let sent = 0;
    for (const r of toList) {
      const email = (r.email || '').trim().toLowerCase();
      if (!email) continue;
      const res = await sendOne({
        to: email,
        subject: opts.subject,
        html,
        text: opts.text,
        fromEmail: opts.fromEmail,
        fromName: opts.fromName,
        replyTo: opts.replyTo,
      });
      if (res.ok) {
        sent++;
        results.push({ email, status: 'sent', messageId: res.messageId });
      } else {
        results.push({ email, status: 'failed', error: res.error });
      }
    }
    bulkResult = {
      ok: sent === toList.length,
      sent,
      failed: toList.length - sent,
      results,
    };
  }
  if (bulkResult.ok && bulkResult.sent > 0 && Array.isArray(opts.to)) {
    const emails = opts.to.map((r) => (typeof r === 'string' ? r : r?.email || '')).filter(Boolean);
    if (emails.length > 0) {
      logEmailSendBulk(emails, opts.subject, provider, { template: opts.template, category: opts.category }).catch(() => {});
    }
  }
  return bulkResult;
}

export { wrapInAlmaTheme };
