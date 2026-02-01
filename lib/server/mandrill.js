/**
 * Mandrill (Mailchimp Transactional) — single module for all 1-to-1 transactional emails.
 * Uses MAILCHIMP_API_KEY (Mandrill key, e.g. md-xxx).
 * Server-only. Do not use from client.
 *
 * Env: MAILCHIMP_API_KEY (required), TRANSACTIONAL_FROM_EMAIL (required, e.g. noreply@almalinks.org),
 *      TRANSACTIONAL_FROM_NAME, TRANSACTIONAL_REPLY_TO (optional).
 */

const MANDRILL_SEND_URL = 'https://mandrillapp.com/api/1.0/messages/send.json';

function getFromEmail() {
  const email = (process.env.TRANSACTIONAL_FROM_EMAIL || process.env.EMAIL_FROM || 'noreply@almalinks.org').trim();
  return email;
}

function getFromName() {
  return (process.env.TRANSACTIONAL_FROM_NAME || process.env.MAILCHIMP_FROM_NAME || 'Alma Links').trim() || 'Alma Links';
}

function getReplyTo() {
  const r = (process.env.TRANSACTIONAL_REPLY_TO || process.env.MAILCHIMP_REPLY_TO || '').trim();
  return r || undefined;
}

/**
 * Send a single transactional email via Mandrill.
 * @param {{ to: string, subject: string, html: string, text?: string, fromEmail?: string, fromName?: string, replyTo?: string }} opts
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

  const message = {
    from_email: fromEmail,
    from_name: fromName,
    subject,
    html: html || undefined,
    text: text || undefined,
    to: [{ email: to, type: 'to' }],
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

export { getFromEmail as getMandrillFromEmail, getFromName as getMandrillFromName, getReplyTo as getMandrillReplyTo };
