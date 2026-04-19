/**
 * Mailchimp Marketing API - Campaign create, set content, send.
 * Uses ONLY Marketing API (no Mandrill/Transactional). Campaign HTML is wrapped in shared AlmaLinks theme.
 *
 * Env: MAILCHIMP_AUDIENCE_ID, MAILCHIMP_MARKETING_API_KEY (or MAILCHIMP_API_KEY),
 *      MAILCHIMP_SERVER. Optional: TRANSACTIONAL_FROM_NAME / MAILCHIMP_FROM_NAME, MAILCHIMP_REPLY_TO for campaign settings.
 */

import { getMailchimpAudienceConfig } from './mailchimp-audience.js';
import { getAppBaseUrl, getFromName } from './email-config.js';
import { wrapInAlmaTheme } from './alma-email-theme.js';
import { eventAnnouncement, welcomeSignup } from './email-templates.js';
import { escapeHtml } from './email-design-system.js';

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
    const e = new Error(msg);
    e.mailchimpResponse = data;
    throw e;
  }
  return data;
}

/**
 * Create a saved segment on the list (e.g. match single email for welcome campaign).
 * POST /lists/{list_id}/segments
 * Body: name, options: { match: "all" }, conditions: [{ condition_type, field, op, value }]
 * @param {string} listId
 * @param {string} name - Segment name
 * @param {Array<{ condition_type: string, field?: string, op: string, value?: string }>} conditions
 * @returns {Promise<{ id: number, [key: string]: unknown }>}
 */
export async function createSegment(listId, name, conditions) {
  const base = getBaseUrl();
  if (!base) throw new Error('MAILCHIMP_SERVER or API key suffix required');
  const payload = { name, options: { match: 'all' }, conditions };
  console.log('[mailchimp-campaign] createSegment request:', JSON.stringify({ listId, name, conditions }));
  const res = await fetch(`${base}/lists/${listId}/segments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuth() },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = mailchimpErrorMsg(data, res.status, 'Create segment');
    console.error('[mailchimp-campaign] createSegment failed:', res.status, JSON.stringify(data));
    const e = new Error(msg);
    e.mailchimpResponse = data;
    throw e;
  }
  return data;
}

/**
 * Create a regular campaign targeted to a segment (single recipient when segment = one email).
 * All required fields must be non-empty strings; reply_to must be verified in Mailchimp.
 */
export async function createCampaignWithSegment(options) {
  const base = getBaseUrl();
  if (!base) throw new Error('MAILCHIMP_SERVER or API key suffix required');
  const { listId, segmentId, subjectLine, fromName, replyTo } = options;
  const subject = (subjectLine && String(subjectLine).trim()) || 'Welcome to AlmaLinks!';
  const from = (fromName && String(fromName).trim()) || getFromName();
  const reply = replyTo && String(replyTo).trim();
  if (!reply) throw new Error('MAILCHIMP_REPLY_TO is required for campaigns');
  const body = {
    type: 'regular',
    recipients: {
      list_id: listId,
      segment_opts: { saved_segment_id: segmentId },
    },
    settings: {
      subject_line: subject,
      title: subject.slice(0, 100),
      from_name: from,
      reply_to: reply,
    },
  };
  console.log('[mailchimp-campaign] createCampaignWithSegment:', JSON.stringify({ listId, segmentId, subject_line: subject }));
  const res = await fetch(`${base}/campaigns`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuth() },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = mailchimpErrorMsg(data, res.status, 'Create campaign with segment');
    console.error('[mailchimp-campaign] createCampaignWithSegment failed:', res.status, JSON.stringify(data));
    const e = new Error(msg);
    e.mailchimpResponse = data;
    throw e;
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
    const e = new Error(msg);
    e.mailchimpResponse = data;
    throw e;
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
  const e = new Error(msg);
  e.mailchimpResponse = data;
  throw e;
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

/**
 * Full flow: create campaign → set content → send.
 * Uses MAILCHIMP_AUDIENCE_ID, getFromName() (env), MAILCHIMP_REPLY_TO from env if not passed.
 *
 * @param {{ id?: string, name: string, slug?: string, date?: string, location?: string, description?: string, imageUrl?: string }} event
 * @param {string} [fromName] - Defaults to getFromName() (TRANSACTIONAL_FROM_NAME → MAILCHIMP_FROM_NAME)
 * @param {string} [replyTo] - Defaults to MAILCHIMP_REPLY_TO (must be verified in Mailchimp)
 * @param {string} [listId] - Defaults to MAILCHIMP_AUDIENCE_ID
 * @returns {Promise<{ campaignId: string, subject_line: string }>}
 */
export async function createAndSendEventCampaign(event, fromName, replyTo, listId) {
  const config = getMailchimpAudienceConfig();
  if (!config) throw new Error('Mailchimp not configured (MAILCHIMP_AUDIENCE_ID and MAILCHIMP_MARKETING_API_KEY)');

  const list_id = listId || config.audienceId;
  const from_name = (fromName && String(fromName).trim()) || getFromName();
  const reply_to = replyTo || process.env.MAILCHIMP_REPLY_TO;
  if (!reply_to) throw new Error('Reply-to email required (set MAILCHIMP_REPLY_TO or pass replyTo)');

  const subjectLine = `New Event: ${event.name || 'Event'}`;
  const baseUrl = getAppBaseUrl();
  const eventUrl = `${baseUrl}/events/${event.slug || event.id || ''}`;
  const innerHtml = eventAnnouncement(event, eventUrl);
  const html = wrapInAlmaTheme(innerHtml, { title: subjectLine, appUrl: baseUrl });

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

/**
 * Send a welcome campaign to a single email (segment = that email, then create/send campaign).
 * Segment: condition_type EmailAddress, field EMAIL, op is, value userEmail.
 * Uses MAILCHIMP_WELCOME_TEMPLATE_HTML or fallback HTML with APP_URL login link.
 * @param {string} email - Recipient email (must be in audience)
 * @param {string} [displayName] - Optional name for personalization
 * @param {string} [joinRequestId] - Optional; used for segment name welcome-<joinRequestId>
 * @returns {Promise<{ campaignId: string, segmentId: number }>}
 */
export async function sendWelcomeCampaign(email, displayName, joinRequestId) {
  const config = getMailchimpAudienceConfig();
  if (!config) throw new Error('Mailchimp not configured (MAILCHIMP_AUDIENCE_ID and MAILCHIMP_MARKETING_API_KEY)');
  const replyTo = (process.env.MAILCHIMP_REPLY_TO || '').trim();
  if (!replyTo) throw new Error('MAILCHIMP_REPLY_TO is required (verified sender in Mailchimp)');
  const fromName = getFromName();
  const listId = config.audienceId;
  const userEmail = (email || '').trim().toLowerCase();
  if (!userEmail) throw new Error('email is required for welcome campaign');

  // Segment: target only this email. Mailchimp: condition_type EmailAddress, field EMAIL, op is, value.
  const segmentName = joinRequestId
    ? `welcome-${String(joinRequestId).slice(0, 50)}`
    : `welcome-${userEmail.replace(/[^a-z0-9]/g, '-').slice(0, 40)}-${Date.now()}`;
  const conditions = [
    { condition_type: 'EmailAddress', field: 'EMAIL', op: 'is', value: userEmail },
  ];
  const segment = await createSegment(listId, segmentName, conditions);
  const segmentId = segment.id;
  console.log('[mailchimp-campaign] Created segment for welcome:', segmentId, segmentName);

  const subjectLine = 'Welcome to AlmaLinks!';
  const campaign = await createCampaignWithSegment({
    listId,
    segmentId,
    subjectLine,
    fromName,
    replyTo,
  });
  console.log('[mailchimp-campaign] Created welcome campaign:', campaign.id);

  // Set content BEFORE sending. Use shared welcome template or env override.
  const baseUrl = getAppBaseUrl();
  const loginLink = `${baseUrl}/login`;
  const eventsLink = `${baseUrl}/events`;
  const rawHtml = (process.env.MAILCHIMP_WELCOME_TEMPLATE_HTML || '').trim();
  const firstName = (displayName || '').trim() || '';
  const innerHtml = rawHtml
    ? rawHtml.replace(/\{\{\s*name\s*\}\}/g, escapeHtml(firstName || 'there'))
    : welcomeSignup(firstName || null, loginLink, eventsLink);
  const html = wrapInAlmaTheme(innerHtml, { title: 'Welcome to AlmaLinks!', appUrl: baseUrl });

  await setCampaignContent(campaign.id, html);
  console.log('[mailchimp-campaign] Welcome content set');

  await sendCampaign(campaign.id);
  console.log('[mailchimp-campaign] Welcome campaign sent');

  return { campaignId: campaign.id, segmentId };
}
