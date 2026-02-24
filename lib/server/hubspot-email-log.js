/**
 * Log sent transactional emails to HubSpot as email engagements on contacts.
 * Requires HUBSPOT_ACCESS_TOKEN. If contact does not exist, creates a minimal contact by email then logs the email.
 * Non-blocking: failures are logged but do not affect the send flow.
 *
 * Env: HUBSPOT_ACCESS_TOKEN (same as sync/CRM operations).
 */

import { getHubspotToken } from './api/hubspot-auth.js';

const BASE = 'https://api.hubapi.com';
const EMAIL_TO_CONTACT_ASSOCIATION_TYPE_ID = 198;

/**
 * Find a HubSpot contact by email (search API).
 * @param {string} token
 * @param {string} email
 * @returns {Promise<string|null>} contact id or null
 */
async function findContactByEmail(token, email) {
  const url = `${BASE}/crm/v3/objects/contacts/search`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      filterGroups: [
        {
          filters: [
            { propertyName: 'email', operator: 'EQ', value: String(email).trim().toLowerCase() },
          ],
        },
      ],
      properties: ['email'],
      limit: 1,
    }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  const first = data.results?.[0];
  return first?.id ?? null;
}

/**
 * Create a minimal HubSpot contact with only email (so we can log the sent email).
 * @param {string} token
 * @param {string} email
 * @returns {Promise<string|null>} new contact id or null
 */
async function createContactWithEmail(token, email) {
  const url = `${BASE}/crm/v3/objects/contacts`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: {
        email: String(email).trim().toLowerCase(),
      },
    }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.id ?? null;
}

/**
 * Create an email engagement in HubSpot and associate it with a contact.
 * @param {string} token
 * @param {string} contactId
 * @param {{ subject: string, text?: string, html?: string, fromEmail?: string, fromName?: string }} payload
 * @returns {Promise<boolean>}
 */
async function createEmailEngagement(token, contactId, payload) {
  const text = payload.text || (payload.html ? payload.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : '');
  const props = {
    hs_timestamp: new Date().toISOString(),
    hs_email_direction: 'EMAIL',
    hs_email_status: 'SENT',
    hs_email_subject: String(payload.subject || '').trim(),
    hs_email_text: text.slice(0, 65535) || '(No body)',
  };
  const body = {
    properties: props,
    associations: [
      {
        to: { id: contactId },
        types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: EMAIL_TO_CONTACT_ASSOCIATION_TYPE_ID }],
      },
    ],
  };
  const url = `${BASE}/crm/v3/objects/emails`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  return res.ok;
}

/**
 * Log a sent email to HubSpot: find or create contact by email, then create email engagement and associate.
 * No-op if HUBSPOT_ACCESS_TOKEN is not set. Errors are logged and not thrown.
 *
 * @param {{
 *   to: string,
 *   subject: string,
 *   text?: string,
 *   html?: string,
 *   fromEmail?: string,
 *   fromName?: string,
 *   template?: string,
 * }} entry
 */
export async function logSentEmailToHubSpot(entry) {
  const tokenResult = getHubspotToken();
  if (!tokenResult.ok || !entry?.to || !entry?.subject) return;

  const token = tokenResult.token;
  const email = String(entry.to).trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;

  try {
    let contactId = await findContactByEmail(token, email);
    if (!contactId) {
      contactId = await createContactWithEmail(token, email);
    }
    if (!contactId) {
      console.warn('[hubspot-email-log] No contact found or created for', email);
      return;
    }
    const ok = await createEmailEngagement(token, contactId, {
      subject: entry.subject,
      text: entry.text,
      html: entry.html,
      fromEmail: entry.fromEmail,
      fromName: entry.fromName,
    });
    if (!ok) console.warn('[hubspot-email-log] Failed to create email engagement for', email);
  } catch (err) {
    console.warn('[hubspot-email-log] Error:', err?.message || err);
  }
}
