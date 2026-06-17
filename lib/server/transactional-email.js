/**
 * Single entry point for transactional emails: Alma theme + Mailjet (if configured) or Mandrill.
 * All HTML is wrapped in the shared AlmaLinks theme before sending.
 * Successful sends are logged to Firestore (emailLog) for admin tracking.
 *
 * Env: For Mailjet: MAILJET_API_KEY + MAILJET_SECRET_KEY (or MJ_APIKEY_PUBLIC + MJ_APIKEY_PRIVATE).
 *      For Mandrill fallback: MAILCHIMP_API_KEY. From/reply: TRANSACTIONAL_FROM_EMAIL, etc.
 */

import { wrapInAlmaTheme } from './alma-email-theme.js';
import { sendMailjet, sendMailjetBulk } from './mailjet.js';
import { sendTransactionalEmail as sendMandrill, sendMandrillBulk } from './mandrill.js';
import { logEmailSend, logEmailSendBulk } from './email-log.js';
import { logSentEmailToHubSpot } from './hubspot-email-log.js';

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

function isMandrillConfigured() {
  return Boolean((process.env.MAILCHIMP_API_KEY || '').trim());
}

/** True when Mailjet or Mandrill env vars are set on the server. */
export function isTransactionalEmailConfigured() {
  return isMailjetConfigured() || isMandrillConfigured();
}

function transactionalEmailConfigHint() {
  return isMailjetConfigured()
    ? 'Mailjet is configured.'
    : isMandrillConfigured()
      ? 'Mandrill (MAILCHIMP_API_KEY) is configured.'
      : 'Set MAILJET_API_KEY + MAILJET_SECRET_KEY or MAILCHIMP_API_KEY in Vercel → Environment Variables, then redeploy.';
}

async function sendMandrillBulkSequential(payload, toList) {
  const { sendTransactionalEmail: sendOne } = await import('./mandrill.js');
  const results = [];
  let sent = 0;
  for (const r of toList) {
    const email = (r.email || '').trim().toLowerCase();
    if (!email) continue;
    const res = await sendOne({
      to: email,
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
      fromEmail: payload.fromEmail,
      fromName: payload.fromName,
      replyTo: payload.replyTo,
    });
    if (res.ok) {
      sent++;
      results.push({ email, status: 'sent', messageId: res.messageId });
    } else {
      results.push({ email, status: 'failed', error: res.error });
    }
  }
  return {
    ok: sent === toList.length,
    sent,
    failed: toList.length - sent,
    results,
    ...(sent === 0 && results[0]?.error ? { error: results[0].error } : {}),
  };
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
 *   cc?: string|string[],
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
    cc: opts.cc,
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

    logSentEmailToHubSpot({
      to: opts.to,
      subject: opts.subject,
      text: opts.text,
      html: opts.html,
      fromEmail: opts.fromEmail,
      fromName: opts.fromName,
      template: opts.template,
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
  const toList = Array.isArray(opts.to) ? opts.to : [];
  if (toList.length === 0) {
    return { ok: false, sent: 0, failed: 0, error: 'No recipients' };
  }
  if (!isTransactionalEmailConfigured()) {
    return {
      ok: false,
      sent: 0,
      failed: toList.length,
      error: 'Transactional email is not configured on the server.',
      hint: transactionalEmailConfigHint(),
    };
  }

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
    if (!bulkResult.ok && (bulkResult.sent || 0) === 0) {
      console.warn('[transactional-email] Mailjet bulk failed; falling back to per-recipient sends');
      bulkResult = await sendMandrillBulkSequential(payload, toList);
    }
  } else {
    bulkResult = await sendMandrillBulk(payload);
    if (!bulkResult.ok && (bulkResult.sent || 0) === 0) {
      console.warn('[transactional-email] Mandrill bulk failed; falling back to per-recipient sends');
      bulkResult = await sendMandrillBulkSequential(payload, toList);
    }
  }
  if (bulkResult.ok && bulkResult.sent > 0 && Array.isArray(opts.to)) {
    const emails = opts.to.map((r) => (typeof r === 'string' ? r : r?.email || '')).filter(Boolean);
    if (emails.length > 0) {
      logEmailSendBulk(emails, opts.subject, provider, { template: opts.template, category: opts.category }).catch(() => {});

      for (const email of emails) {
        logSentEmailToHubSpot({
          to: email,
          subject: opts.subject,
          text: opts.text,
          html: opts.html,
          fromEmail: opts.fromEmail,
          fromName: opts.fromName,
          template: opts.template,
        }).catch(() => {});
      }
    }
  }
  return bulkResult;
}

export { wrapInAlmaTheme };
