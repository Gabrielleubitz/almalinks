/**
 * Mailchimp Marketing API - Audience (List) helpers
 *
 * Adds or updates contacts in a Mailchimp audience (list).
 * Uses Mailchimp Marketing API 3.0: https://{dc}.api.mailchimp.com/3.0
 *
 * Env: MAILCHIMP_AUDIENCE_ID, MAILCHIMP_SERVER (or extract from key),
 *      MAILCHIMP_MARKETING_API_KEY or MAILCHIMP_API_KEY (Marketing API key, not Mandrill)
 */

import crypto from 'crypto';

/**
 * Get Marketing API config from env.
 * Returns { apiKey, server, audienceId } or null if not configured.
 */
export function getMailchimpAudienceConfig() {
  const audienceId = process.env.MAILCHIMP_AUDIENCE_ID;
  const apiKey = process.env.MAILCHIMP_MARKETING_API_KEY || process.env.MAILCHIMP_API_KEY;
  let server = process.env.MAILCHIMP_SERVER;
  if (!server && apiKey && apiKey.includes('-')) {
    server = apiKey.split('-')[1];
  }
  if (!audienceId || !apiKey || !server) return null;
  return { apiKey, server, audienceId };
}

/**
 * MD5 hash of lowercase email (Mailchimp subscriber_hash)
 */
function subscriberHash(email) {
  const lower = (email || '').trim().toLowerCase();
  return crypto.createHash('md5').update(lower).digest('hex');
}

/**
 * Add or update a contact in the Mailchimp audience.
 * Uses PUT /lists/{list_id}/members/{subscriber_hash}.
 *
 * @param {string} email - Contact email
 * @param {{ firstName?: string, lastName?: string }} [mergeFields] - Optional merge fields
 * @returns {{ ok: boolean, added?: boolean, error?: string }}
 */
export async function addOrUpdateListMember(email, mergeFields = {}) {
  const config = getMailchimpAudienceConfig();
  if (!config) {
    return { ok: false, error: 'Mailchimp audience not configured (MAILCHIMP_AUDIENCE_ID and Marketing API key)' };
  }

  const { apiKey, server, audienceId } = config;
  const trimmedEmail = (email || '').trim().toLowerCase();
  if (!trimmedEmail) {
    return { ok: false, error: 'Email is required' };
  }

  const hash = subscriberHash(trimmedEmail);
  const url = `https://${server}.api.mailchimp.com/3.0/lists/${audienceId}/members/${hash}`;

  const body = {
    email_address: trimmedEmail,
    status: 'subscribed',
    status_if_new: 'subscribed',
    merge_fields: {}
  };
  if (mergeFields.firstName) body.merge_fields.FNAME = mergeFields.firstName;
  if (mergeFields.lastName) body.merge_fields.LNAME = mergeFields.lastName;

  try {
    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(body)
    });

    const data = await res.json().catch(() => ({}));

    if (res.status === 200) {
      return { ok: true, added: data.was_subscribed === false };
    }

    const message = data.detail || data.title || data.status || res.statusText;
    const safeReason = (typeof message === 'string' && (message.includes('fake') || message.includes('invalid'))) ? 'invalid_email' : String(message || res.status).slice(0, 80);
    console.warn('[mailchimp-audience] addOrUpdateListMember failed:', res.status, safeReason);
    return { ok: false, error: message, statusCode: res.status };
  } catch (err) {
    console.error('[mailchimp-audience] addOrUpdateListMember error:', err?.message || err);
    return { ok: false, error: err?.message || 'Request failed' };
  }
}
