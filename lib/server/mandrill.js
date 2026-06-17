/**
 * Mandrill (Mailchimp Transactional) — single module for all 1-to-1 transactional emails.
 * Uses MAILCHIMP_API_KEY (Mandrill key, e.g. md-xxx).
 * Server-only. Do not use from client.
 *
 * Env: MAILCHIMP_API_KEY (required), TRANSACTIONAL_FROM_EMAIL (required, e.g. noreply@almalinks.org),
 *      TRANSACTIONAL_FROM_NAME, TRANSACTIONAL_REPLY_TO (optional).
 *      From display name: email-config getFromName() (TRANSACTIONAL_FROM_NAME → MAILCHIMP_FROM_NAME).
 */

import { getFromName } from './email-config.js';

const MANDRILL_SEND_URL = 'https://mandrillapp.com/api/1.0/messages/send.json';

function getFromEmail() {
  const email = (process.env.TRANSACTIONAL_FROM_EMAIL || process.env.EMAIL_FROM || 'noreply@almalinks.org').trim();
  return email;
}

function getReplyTo() {
  const r = (process.env.TRANSACTIONAL_REPLY_TO || process.env.MAILCHIMP_REPLY_TO || '').trim();
  return r || undefined;
}

function parseExtraRecipients(cc) {
  if (!cc) return [];
  const raw = Array.isArray(cc) ? cc : String(cc).split(/[,;]+/);
  const out = [];
  for (const s of raw) {
    const e = String(s || '').trim().toLowerCase();
    if (e && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) out.push(e);
  }
  return [...new Set(out)];
}

/**
 * Send a single transactional email via Mandrill.
 * @param {{ to: string, subject: string, html: string, text?: string, fromEmail?: string, fromName?: string, replyTo?: string, cc?: string|string[] }} opts
 * @returns {Promise<{ ok: boolean, messageId?: string, status?: string, rejectReason?: string, error?: string, details?: any }>}
 */
export async function sendTransactionalEmail(opts) {
  const key = (process.env.MAILCHIMP_API_KEY || '').trim();
  if (!key) {
    console.error('[mandrill] MAILCHIMP_API_KEY not set');
    return { ok: false, error: 'MAILCHIMP_API_KEY not configured' };
  }

  const to = (opts.to || '').trim().toLowerCase();
  if (!to) {
    console.error('[mandrill] Missing recipient (to)');
    return { ok: false, error: 'Missing recipient' };
  }

  const fromEmail = (opts.fromEmail || getFromEmail()).trim();
  const fromName = (opts.fromName || getFromName()).trim();
  const subject = (opts.subject || '').trim() || '(No subject)';
  const html = opts.html != null ? String(opts.html) : '';
  const text = opts.text != null ? String(opts.text) : (html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
  const replyTo = (opts.replyTo || getReplyTo()) || undefined;

  const toList = [{ email: to, type: 'to' }];
  const ccList = parseExtraRecipients(opts.cc);
  for (const email of ccList) {
    toList.push({ email, type: 'cc' });
  }

  const message = {
    from_email: fromEmail,
    from_name: fromName,
    subject,
    html: html || undefined,
    text: text || undefined,
    to: toList,
    ...(replyTo && { headers: { 'Reply-To': replyTo } }),
  };

  const payload = { key, message };

  try {
    const res = await fetch(MANDRILL_SEND_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      console.error('[mandrill] API error:', res.status, JSON.stringify(data));
      return {
        ok: false,
        error: data.message || data.name || `HTTP ${res.status}`,
        details: data,
      };
    }

    // Mandrill returns array of per-recipient results
    const result = Array.isArray(data) ? data[0] : data;
    const status = result?.status;
    const messageId = result?._id;
    const rejectReason = result?.reject_reason;

    console.log('[mandrill] sent:', { to: to.slice(0, 3) + '***', subject: subject.slice(0, 40), status, messageId, rejectReason: rejectReason || '-' });

    if (status === 'rejected' || status === 'invalid') {
      console.error('[mandrill] rejected:', { to, subject, rejectReason, result });
      return {
        ok: false,
        status,
        messageId,
        rejectReason: rejectReason || status,
        error: rejectReason || status,
      };
    }

    return { ok: true, messageId, status };
  } catch (err) {
    console.error('[mandrill] send error:', err?.message || err, err?.response?.body ?? err?.response?.data ?? '');
    return {
      ok: false,
      error: err?.message || 'Send failed',
      details: err?.response?.body ?? err?.response?.data,
    };
  }
}

/**
 * Send one message to multiple recipients in a single Mandrill API call.
 * Each recipient receives an individual copy (preserve_recipients defaults to false).
 */
export async function sendMandrillBulk(opts) {
  const key = (process.env.MAILCHIMP_API_KEY || '').trim();
  if (!key) {
    return { ok: false, sent: 0, failed: (opts.to || []).length, error: 'MAILCHIMP_API_KEY not configured' };
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
    opts.text != null ? String(opts.text) : html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const replyTo = (opts.replyTo || getReplyTo()) || undefined;

  const mandrillTo = toList
    .map((r) => ({
      email: (r.email || '').trim().toLowerCase(),
      name: (r.name || (r.email || '').split('@')[0] || '').trim(),
      type: 'to',
    }))
    .filter((r) => r.email);

  if (mandrillTo.length === 0) {
    return { ok: false, sent: 0, failed: 0, error: 'No valid recipients' };
  }

  const message = {
    from_email: fromEmail,
    from_name: fromName,
    subject,
    html: html || undefined,
    text: text || undefined,
    to: mandrillTo,
    ...(replyTo && { headers: { 'Reply-To': replyTo } }),
  };

  try {
    const res = await fetch(MANDRILL_SEND_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, message }),
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      console.error('[mandrill] bulk API error:', res.status, JSON.stringify(data));
      return {
        ok: false,
        sent: 0,
        failed: mandrillTo.length,
        error: data.message || data.name || `HTTP ${res.status}`,
        details: data,
      };
    }

    const rows = Array.isArray(data) ? data : [];
    let sent = 0;
    const results = mandrillTo.map((r, i) => {
      const row = rows[i] || {};
      const status = row.status;
      const ok = status !== 'rejected' && status !== 'invalid';
      if (ok) sent++;
      return {
        email: r.email,
        status: ok ? 'sent' : 'failed',
        messageId: row._id,
        error: ok ? undefined : row.reject_reason || status || 'failed',
      };
    });
    const failed = mandrillTo.length - sent;
    console.log('[mandrill] bulk sent:', sent, 'failed:', failed);
    return {
      ok: failed === 0,
      sent,
      failed,
      results,
      ...(sent === 0 && results[0]?.error ? { error: results[0].error } : {}),
    };
  } catch (err) {
    console.error('[mandrill] bulk send error:', err?.message || err);
    return {
      ok: false,
      sent: 0,
      failed: mandrillTo.length,
      error: err?.message || 'Send failed',
      details: err?.response?.body ?? err?.response?.data,
    };
  }
}

export { getFromEmail as getMandrillFromEmail, getFromName as getMandrillFromName, getReplyTo as getMandrillReplyTo };
