// POST /api/send-bulk-email
// Send emails to an audience (group, event, chat, location, or individuals)
// Requires authentication (admin)
// Also adds each recipient to the Mailchimp audience (if configured)
import '../firebase-init.js';
import { db, auth } from '../firebase-init.js';
import admin from '../firebase-init.js';
import mailchimp from "@mailchimp/mailchimp_transactional";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function maskEmail(email) {
  if (!email || typeof email !== 'string') return '?';
  const parts = String(email).trim().split('@');
  if (parts.length !== 2) return '?';
  const local = parts[0];
  const masked = local.length > 1 ? local[0] + '***' + local[local.length - 1] : local[0] + '***';
  return masked + '@' + parts[1];
}

/**
 * Normalize API response to always an array of per-recipient results.
 * API can return: array, single object, or { results } / { data } wrapper.
 */
function normalizeSendResults(res) {
  if (res == null) return [];
  if (Array.isArray(res)) return res;
  if (typeof res !== 'object') return [];
  if (Array.isArray(res.results)) return res.results;
  if (Array.isArray(res.data)) return res.data;
  // Single result object (e.g. 1 recipient)
  if (typeof res.status !== 'undefined' || typeof res._id !== 'undefined' || typeof res.email !== 'undefined') {
    return [res];
  }
  return [];
}

/**
 * Recursively remove undefined values so Firestore accepts the document.
 * Leaves Firestore sentinels (e.g. FieldValue.serverTimestamp()) unchanged.
 */
function deepRemoveUndefined(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(deepRemoveUndefined).filter((v) => v !== undefined);
  if (Object.getPrototypeOf(obj) !== Object.prototype) return obj;
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;
    out[k] = deepRemoveUndefined(v);
  }
  return out;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ ok: false, error: 'Unauthorized: Missing or invalid token' });
    }

    const idToken = authHeader.split('Bearer ')[1];
    let currentUserId;
    let isAdmin = false;
    try {
      const decodedToken = await auth.verifyIdToken(idToken);
      currentUserId = decodedToken.uid;
      isAdmin = decodedToken.role === 'admin' || decodedToken.admin === true;
    } catch (authError) {
      console.error('[send-bulk-email] Auth error');
      return res.status(401).json({ ok: false, error: 'Unauthorized: Invalid token' });
    }

    if (!isAdmin) {
      return res.status(403).json({ ok: false, error: 'Forbidden: Admin access required' });
    }

    const body = req.body || {};
    let { mode, ids, groupId, eventId, chatId, location, subject, html, text, fromName } = body;
    // Support both emails and recipients for backward compatibility; always pass a defined array
    let emails = Array.isArray(body.emails) ? body.emails : (Array.isArray(body.recipients) ? body.recipients : []);
    emails = emails.map((e) => (typeof e === 'string' ? e.trim().toLowerCase() : '')).filter((e) => e);

    if (!subject || !subject.trim()) {
      return res.status(400).json({ ok: false, error: 'subject is required' });
    }
    if (!text && !html) {
      return res.status(400).json({ ok: false, error: 'Either text or html message body is required' });
    }
    if (!mode || !['individuals', 'group', 'event', 'chat', 'location', 'all_users'].includes(mode)) {
      return res.status(400).json({ ok: false, error: 'mode must be one of: individuals, group, event, chat, location, all_users' });
    }

    if (mode === 'individuals') {
      const hasIds = Array.isArray(ids) && ids.length > 0;
      const hasEmails = emails.length > 0;
      if (!hasIds && !hasEmails) {
        return res.status(400).json({ ok: false, error: 'For individuals mode, provide emails (or recipients) or ids array; at least one non-empty array is required' });
      }
    }

    const apiKey = process.env.MAILCHIMP_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ ok: false, error: 'Missing MAILCHIMP_API_KEY' });
    }

    const resolvePayload = { mode, ids, emails, groupId, eventId, chatId, location };
    const recipients = await resolveRecipientsInternal(resolvePayload);

    if (recipients.length === 0) {
      return res.status(400).json({ ok: false, error: 'No valid recipients found for the selected audience' });
    }

    // Add each recipient to Mailchimp audience (if configured) so the list stays in sync
    try {
      const { addOrUpdateListMember } = await import('../mailchimp-audience.js').catch(() => ({}));
      if (typeof addOrUpdateListMember === 'function') {
        for (const r of recipients) {
          try {
            await addOrUpdateListMember(r.email, { firstName: r.name?.split(' ')[0], lastName: r.name?.split(' ').slice(1).join(' ') });
          } catch (e) {
            console.warn('[send-bulk-email] Mailchimp audience sync failed (non-blocking):', maskEmail(r.email), e?.message);
          }
        }
      }
    } catch (e) {
      console.warn('[send-bulk-email] Mailchimp audience sync skipped:', e?.message);
    }

    console.log(`[send-bulk-email] Sending to ${recipients.length} recipients (mode: ${mode})`);

    // Send emails via Mailchimp Transactional API
    const client = mailchimp(apiKey);
    const fromEmail = process.env.EMAIL_FROM || "Communications@almalinks.org";
    const fromNameValue = fromName || "Alma Links";

    // Batch send (API returns array or single object for 1 recipient)
    const messages = recipients.map(recipient => ({
      email: recipient.email,
      name: recipient.name,
      type: "to"
    }));

    let sendResults;
    let successCount = 0;
    let errorCount = 0;
    const errors = [];
    const perRecipientResults = [];

    try {
      sendResults = await client.messages.send({
        message: {
          subject: subject.trim(),
          text: text || undefined,
          html: html || undefined,
          from_email: fromEmail,
          from_name: fromNameValue,
          to: messages
        }
      });

      const isArray = Array.isArray(sendResults);
      const resType = typeof sendResults;
      const keys = sendResults && typeof sendResults === 'object' && !Array.isArray(sendResults)
        ? Object.keys(sendResults).slice(0, 10)
        : null;
      console.log('[send-bulk-email] API response shape:', { isArray, type: resType, keys });

      const results = normalizeSendResults(sendResults);
      if (!Array.isArray(results) || results.length === 0) {
        throw new Error('API returned non-array or empty results');
      }

      results.forEach((result, index) => {
        const status = result?.status || 'unknown';
        const rej = result?.reject_reason;
        const email = recipients[index]?.email;
        if (result && (status === 'sent' || status === 'queued')) {
          successCount++;
          perRecipientResults.push({ emailMasked: maskEmail(email), status, id: result._id || null });
        } else {
          errorCount++;
          errors.push({ email, reason: rej || status || 'unknown' });
          perRecipientResults.push({ emailMasked: maskEmail(email), status, reject_reason: rej || status, id: result?._id || null });
        }
      });
    } catch (sendError) {
      console.error('[send-bulk-email] Send error:', sendError?.message || sendError);
      console.log('[send-bulk-email] Batch send failed, falling back to individual sends');

      const RATE_LIMIT_DELAY = 100;
      for (let i = 0; i < recipients.length; i++) {
        try {
          await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY));
          const result = await client.messages.send({
            message: {
              subject: subject.trim(),
              text: text || undefined,
              html: html || undefined,
              from_email: fromEmail,
              from_name: fromNameValue,
              to: [{ email: recipients[i].email, name: recipients[i].name, type: 'to' }]
            }
          });
          const singleResults = normalizeSendResults(result);
          const single = singleResults[0] || null;
          const status = single?.status || 'unknown';
          const rej = single?.reject_reason;
          const email = recipients[i].email;
          if (single && (status === 'sent' || status === 'queued')) {
            successCount++;
            perRecipientResults.push({ emailMasked: maskEmail(email), status, id: single._id || null });
          } else {
            errorCount++;
            errors.push({ email, reason: rej || status || 'unknown' });
            perRecipientResults.push({ emailMasked: maskEmail(email), status, reject_reason: rej || status, id: single?._id || null });
          }
        } catch (individualError) {
          errorCount++;
          const email = recipients[i].email;
          errors.push({ email, reason: individualError?.message || 'send failed' });
          perRecipientResults.push({ emailMasked: maskEmail(email), status: 'error', reject_reason: individualError?.message || 'send failed', id: null });
        }
      }
    }

    // Audit: selection with explicit defaults (no undefined); then deepRemoveUndefined for whole payload
    const selection = {
      ids: Array.isArray(ids) ? ids.filter(Boolean) : [],
      groupId: groupId ?? null,
      eventId: eventId ?? null,
      chatId: chatId ?? null,
      location: location ?? null
    };
    const rawCampaignData = {
      mode,
      selection,
      subject: subject.trim(),
      recipientCount: recipients.length,
      successCount,
      errorCount,
      errors: errors.length > 0 ? errors.slice(0, 10) : [],
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: currentUserId,
      status: errorCount === 0 ? 'success' : errorCount === recipients.length ? 'failed' : 'partial'
    };
    const campaignData = deepRemoveUndefined(rawCampaignData);

    try {
      await db.collection('emailCampaigns').add(campaignData);
      console.log('[send-bulk-email] Audit record written to emailCampaigns');
    } catch (auditError) {
      console.error('[send-bulk-email] Failed to write audit record:', auditError);
      // Don't fail the request if audit write fails
    }

    console.log(`[send-bulk-email] Completed: ${successCount} sent, ${errorCount} failed`);

    return res.status(200).json({
      ok: true,
      sent: successCount,
      failed: errorCount,
      total: recipients.length,
      errors: errors.slice(0, 10),
      results: perRecipientResults
    });

  } catch (error) {
    const message = error?.message || 'Internal server error';
    const isClientError = /required|provide|invalid|missing/i.test(message);
    const status = isClientError ? 400 : 500;
    if (status === 500) {
      console.error('[send-bulk-email] Error:', message);
    }
    try {
      return res.status(status).json({ ok: false, error: message });
    } catch (sendErr) {
      console.error('[send-bulk-email] Failed to send error response');
    }
  }
}

/**
 * Internal function to resolve recipients (reuses logic from resolve-email-recipients).
 * emails is defaulted to [] so it is never undefined (fixes ReferenceError on Vercel).
 */
async function resolveRecipientsInternal({ mode, ids, emails = [], groupId, eventId, chatId, location }) {
  let recipients = [];
  const emailArr = Array.isArray(emails) ? emails : [];

  switch (mode) {
    case 'individuals':
      if (emailArr.length > 0) {
        const trimmed = emailArr
          .map((e) => (typeof e === 'string' ? e.trim().toLowerCase() : ''))
          .filter((e) => e);
        const seen = new Set();
        const deduped = trimmed.filter((e) => {
          if (seen.has(e)) return false;
          seen.add(e);
          return true;
        });
        recipients = deduped.map((email) => ({ email, name: undefined }));
      } else if (ids && Array.isArray(ids) && ids.length > 0) {
        recipients = await resolveIndividualRecipients(ids);
      } else {
        throw new Error('For individuals mode, provide emails (or recipients) or ids array');
      }
      break;

    case 'group':
      if (!groupId) {
        throw new Error('groupId is required for group mode');
      }
      recipients = await resolveGroupRecipients(groupId);
      break;

    case 'event':
      if (!eventId) {
        throw new Error('eventId is required for event mode');
      }
      recipients = await resolveEventRecipients(eventId);
      break;

    case 'chat':
      if (!chatId) {
        throw new Error('chatId is required for chat mode');
      }
      recipients = await resolveChatRecipients(chatId);
      break;

    case 'location':
      if (!location) {
        throw new Error('location is required for location mode');
      }
      recipients = await resolveLocationRecipients(location);
      break;

    case 'all_users':
      recipients = await resolveAllUsersRecipients();
      break;
  }

  // Deduplicate and filter
  const uniqueRecipients = deduplicateRecipients(recipients);
  const validRecipients = uniqueRecipients.filter(r => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return r.email && emailRegex.test(r.email);
  });

  return validRecipients;
}

/**
 * Resolve recipients from individual user IDs
 */
async function resolveIndividualRecipients(userIds) {
  const recipients = [];
  const BATCH_SIZE = 10;
  
  for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
    const batch = userIds.slice(i, i + BATCH_SIZE);
    const userDocs = await Promise.all(
      batch.map(uid => db.collection('users').doc(uid).get())
    );
    
    userDocs.forEach((userDoc, index) => {
      if (userDoc.exists) {
        const userData = userDoc.data();
        recipients.push({
          userId: batch[index],
          email: userData.email,
          name: userData.displayName || userData.name || undefined
        });
      }
    });
  }
  
  return recipients;
}

/**
 * Resolve recipients from a group
 */
async function resolveGroupRecipients(groupId) {
  // TODO: Implement when groups collection is available
  console.warn('[send-bulk-email] Groups not yet implemented');
  return [];
}

/**
 * Resolve recipients from an event
 */
async function resolveEventRecipients(eventId) {
  const recipients = [];
  const registrationsSnapshot = await db.collection('events').doc(eventId)
    .collection('registrations').get();
  
  if (registrationsSnapshot.empty) {
    return [];
  }
  
  const userIds = registrationsSnapshot.docs.map(doc => doc.id);
  return resolveIndividualRecipients(userIds);
}

/**
 * Resolve recipients from a chat
 */
async function resolveChatRecipients(chatId) {
  const membersSnapshot = await db.collection('chat_members')
    .where('chatId', '==', chatId)
    .get();
  
  if (membersSnapshot.empty) {
    return [];
  }
  
  const userIds = membersSnapshot.docs.map(doc => doc.data().userId).filter(Boolean);
  return resolveIndividualRecipients(userIds);
}

/**
 * Resolve recipients from all users (every user with an email)
 */
async function resolveAllUsersRecipients() {
  const recipients = [];
  const usersSnapshot = await db.collection('users').get();

  usersSnapshot.docs.forEach(doc => {
    const userData = doc.data();
    if (userData.email) {
      recipients.push({
        userId: doc.id,
        email: userData.email,
        name: userData.displayName || userData.name || undefined
      });
    }
  });

  return recipients;
}

/**
 * Resolve recipients by location
 */
async function resolveLocationRecipients(location) {
  const recipients = [];
  
  const cityQuery = db.collection('users')
    .where('city', '==', location)
    .where('status', '==', 'approved');
  
  const countryQuery = db.collection('users')
    .where('country', '==', location)
    .where('status', '==', 'approved');
  
  const [citySnapshot, countrySnapshot] = await Promise.all([
    cityQuery.get(),
    countryQuery.get()
  ]);
  
  const allUserDocs = [
    ...citySnapshot.docs,
    ...countrySnapshot.docs
  ];
  
  const uniqueUserDocs = Array.from(
    new Map(allUserDocs.map(doc => [doc.id, doc])).values()
  );
  
  uniqueUserDocs.forEach(doc => {
    const userData = doc.data();
    if (userData.email) {
      recipients.push({
        userId: doc.id,
        email: userData.email,
        name: userData.displayName || userData.name || undefined
      });
    }
  });
  
  return recipients;
}

/**
 * Deduplicate recipients
 */
function deduplicateRecipients(recipients) {
  const seen = new Map();
  recipients.forEach(recipient => {
    const key = recipient.email?.toLowerCase() || recipient.userId;
    if (key && !seen.has(key)) {
      seen.set(key, recipient);
    }
  });
  return Array.from(seen.values());
}
