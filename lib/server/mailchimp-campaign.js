/**
 * Mailchimp Marketing API - Campaign create, set content, send.
 * Uses ONLY Marketing API (no Mandrill/Transactional).
 *
 * Env: MAILCHIMP_AUDIENCE_ID, MAILCHIMP_MARKETING_API_KEY (or MAILCHIMP_API_KEY),
 *      MAILCHIMP_SERVER. Optional: MAILCHIMP_FROM_NAME, MAILCHIMP_REPLY_TO for campaign settings.
 */

import { getMailchimpAudienceConfig } from './mailchimp-audience.js';

/** Normalize Mailchimp API error (detail can be string or object). */
function mailchimpErrorMsg(data, status, prefix) {
  const d = data?.detail;
  if (typeof d === 'string') return d;
  if (d && typeof d === 'object') return d.message || d.msg || d.detail || JSON.stringify(d);
  return data?.title || data?.status || `${prefix} failed ${status}`;
}

function getBaseUrl() {
  const config = getMailchimpAudienceConfig();
  if (!config) return null;
  let server = process.env.MAILCHIMP_SERVER || (config.apiKey && config.apiKey.includes('-') ? config.apiKey.split('-')[1] : null);
  if (!server) return null;
  return `https://${server}.api.mailchimp.com/3.0`;
}

function getAuth() {
  const config = getMailchimpAudienceConfig();
  if (!config) throw new Error('Mailchimp not configured (MAILCHIMP_AUDIENCE_ID and MAILCHIMP_MARKETING_API_KEY)');
  return { Authorization: `Bearer ${config.apiKey}` };
}

/**
 * 1) Create a regular campaign to the audience.
 * @param {{ listId: string, subjectLine: string, fromName: string, replyTo: string }} options
 * @returns {Promise<{ id: string, [key: string]: unknown }>}
 */
export async function createCampaign(options) {
  const base = getBaseUrl();
  if (!base) throw new Error('MAILCHIMP_SERVER or API key suffix required');
  const { listId, subjectLine, fromName, replyTo } = options;
  const res = await fetch(`${base}/campaigns`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuth() },
    body: JSON.stringify({
      type: 'regular',
      recipients: { list_id: listId },
      settings: {
        subject_line: subjectLine,
        from_name: fromName,
        reply_to: replyTo,
      },
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = mailchimpErrorMsg(data, res.status, 'Create campaign');
    console.error('[mailchimp-campaign] createCampaign failed:', res.status, JSON.stringify(data));
    throw new Error(msg);
  }
  return data;
}

/**
 * 2) Set campaign content (HTML).
 * @param {string} campaignId
 * @param {string} html
 */
export async function setCampaignContent(campaignId, html) {
  const base = getBaseUrl();
  if (!base) throw new Error('MAILCHIMP_SERVER or API key suffix required');
  const plainText = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const res = await fetch(`${base}/campaigns/${campaignId}/content`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...getAuth() },
    body: JSON.stringify({ html, plain_text: plainText }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = mailchimpErrorMsg(data, res.status, 'Set content');
    console.error('[mailchimp-campaign] setCampaignContent failed:', res.status, JSON.stringify(data));
    throw new Error(msg);
  }
  return data;
}

/**
 * 3) Send the campaign.
 * @param {string} campaignId
 */
export async function sendCampaign(campaignId) {
  const base = getBaseUrl();
  if (!base) throw new Error('MAILCHIMP_SERVER or API key suffix required');
  const res = await fetch(`${base}/campaigns/${campaignId}/actions/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuth() },
    body: JSON.stringify({}),
  });
  if (res.status === 204) return { ok: true };
  const data = await res.json().catch(() => ({}));
  const msg = mailchimpErrorMsg(data, res.status, 'Send campaign');
  console.error('[mailchimp-campaign] sendCampaign failed:', res.status, JSON.stringify(data));
  throw new Error(msg);
}

/**
 * Send a test email for a campaign to specific addresses (does not send to audience).
 * POST /campaigns/{campaign_id}/actions/test
 * @param {string} campaignId
 * @param {string[]} testEmails - e.g. ['test@example.com']
 */
export async function sendCampaignTest(campaignId, testEmails) {
  const base = getBaseUrl();
  if (!base) throw new Error('MAILCHIMP_SERVER or API key suffix required');
  if (!Array.isArray(testEmails) || testEmails.length === 0) {
    throw new Error('testEmails must be a non-empty array');
  }
  const res = await fetch(`${base}/campaigns/${campaignId}/actions/test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuth() },
    body: JSON.stringify({ test_emails: testEmails, send_type: 'html' }),
  });
  if (res.status === 204) return { ok: true };
  const data = await res.json().catch(() => ({}));
  const msg = mailchimpErrorMsg(data, res.status, 'Send test');
  console.error('[mailchimp-campaign] sendCampaignTest failed:', res.status, JSON.stringify(data));
  throw new Error(msg);
}

function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return String(iso);
  }
}

/**
 * Full flow: create campaign → set content → send.
 * Uses MAILCHIMP_AUDIENCE_ID, MAILCHIMP_FROM_NAME, MAILCHIMP_REPLY_TO from env if not passed.
 *
 * @param {{ id?: string, name: string, slug?: string, date?: string, location?: string, description?: string, imageUrl?: string }} event
 * @param {string} [fromName] - Defaults to MAILCHIMP_FROM_NAME or "Alma Links"
 * @param {string} [replyTo] - Defaults to MAILCHIMP_REPLY_TO (must be verified in Mailchimp)
 * @param {string} [listId] - Defaults to MAILCHIMP_AUDIENCE_ID
 * @returns {Promise<{ campaignId: string, subject_line: string }>}
 */
export async function createAndSendEventCampaign(event, fromName, replyTo, listId) {
  const config = getMailchimpAudienceConfig();
  if (!config) throw new Error('Mailchimp not configured (MAILCHIMP_AUDIENCE_ID and MAILCHIMP_MARKETING_API_KEY)');

  const list_id = listId || config.audienceId;
  const from_name = fromName || process.env.MAILCHIMP_FROM_NAME || 'Alma Links';
  const reply_to = replyTo || process.env.MAILCHIMP_REPLY_TO;
  if (!reply_to) throw new Error('Reply-to email required (set MAILCHIMP_REPLY_TO or pass replyTo)');

  const subjectLine = `New Event: ${event.name || 'Event'}`;
  const eventUrl = `https://almalinks.org/events/${event.slug || event.id || ''}`;
  const html = `
    <h1>New Event: ${escapeHtml(event.name)}</h1>
    <p><strong>Date:</strong> ${escapeHtml(formatDate(event.date))}</p>
    <p><strong>Location:</strong> ${escapeHtml(event.location || '')}</p>
    <p>${escapeHtml(event.description || '').replace(/\n/g, '<br>')}</p>
    ${event.imageUrl ? `<p><img src="${escapeHtml(event.imageUrl)}" alt="Event" style="max-width:100%;" /></p>` : ''}
    <p><a href="${escapeHtml(eventUrl)}">View event and register</a></p>
  `;

  const campaign = await createCampaign({
    listId: list_id,
    subjectLine,
    fromName: from_name,
    replyTo: reply_to,
  });
  console.log('[mailchimp-campaign] Created campaign', campaign.id);

  await setCampaignContent(campaign.id, html);
  console.log('[mailchimp-campaign] Content set');

  await sendCampaign(campaign.id);
  console.log('[mailchimp-campaign] Sent');

  return { campaignId: campaign.id, subject_line: subjectLine };
}
