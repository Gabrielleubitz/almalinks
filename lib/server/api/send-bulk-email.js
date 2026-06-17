// POST /api/send-bulk-email
// Validates audience, syncs to Mailchimp audience, and sends via transactional-email (Mailjet or Mandrill) with Alma theme.
// Requires authentication (admin).
import '../firebase-init.js';
import { db } from '../firebase-init.js';
import admin from '../firebase-init.js';
import { verifyAdminRequest } from '../admin-auth.js';
import { sendTransactionalEmailBulk } from '../transactional-email.js';
import { getFromName } from '../email-config.js';

function effectiveEventAudienceIds(audience) {
  const fromArr = Array.isArray(audience?.eventIds) ? audience.eventIds.filter(Boolean) : [];
  if (fromArr.length) return [...new Set(fromArr)];
  if (audience?.eventId) return [String(audience.eventId).trim()].filter(Boolean);
  return [];
}

function effectiveChatAudienceIds(audience) {
  const fromArr = Array.isArray(audience?.chatIds) ? audience.chatIds.filter(Boolean) : [];
  if (fromArr.length) return [...new Set(fromArr)];
  if (audience?.chatId) return [String(audience.chatId).trim()].filter(Boolean);
  return [];
}

function effectiveLocationAudienceLabels(audience) {
  const fromArr = Array.isArray(audience?.locations)
    ? audience.locations.map((s) => String(s || '').trim()).filter(Boolean)
    : [];
  if (fromArr.length) return [...new Set(fromArr)];
  if (audience?.location?.trim()) return [audience.location.trim()];
  return [];
}

function maskEmail(email) {
  if (!email || typeof email !== 'string') return '?';
  const parts = String(email).trim().split('@');
  if (parts.length !== 2) return '?';
  const local = parts[0];
  const masked = local.length > 1 ? local[0] + '***' + local[local.length - 1] : local[0] + '***';
  return masked + '@' + parts[1];
}

/**
 * Normalize Transactional API response to an array of per-recipient results.
 * Success: array or single object. Error: object with message/code/config (never forEach on this).
 */
function normalizeSendResults(res) {
  if (res == null) return { results: [], errorMessage: null };
  if (Array.isArray(res)) return { results: res, errorMessage: null };
  if (typeof res !== 'object') return { results: [], errorMessage: String(res) };
  if (res.message && (res.code != null || res.status != null || res.config)) {
    const msg = res.message || res.response?.data?.message || res.response?.data?.detail || res.response?.data?.title || 'Send failed';
    return { results: [], errorMessage: typeof msg === 'string' ? msg : String(msg) };
  }
  if (Array.isArray(res.results)) return { results: res.results, errorMessage: null };
  if (Array.isArray(res.data)) return { results: res.data, errorMessage: null };
  if (typeof res.status !== 'undefined' || typeof res._id !== 'undefined') {
    return { results: [res], errorMessage: null };
  }
  return { results: [], errorMessage: res.message || 'Unexpected API response' };
}

/**
 * Recursively remove undefined values so Firestore accepts the document.
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
    const authResult = await verifyAdminRequest(req);
    if (!authResult.ok) {
      return res.status(authResult.status).json({ ok: false, error: authResult.error });
    }
    const currentUserId = authResult.uid;

    const body = req.body || {};
    let { mode, ids, groupId, eventId, eventIds, chatId, chatIds, location, locations, subject, html, text, fromName } = body;
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

    const resolvePayload = { mode, ids, emails, groupId, eventId, eventIds, chatId, chatIds, location, locations };
    const recipients = await resolveRecipientsInternal(resolvePayload);

    if (recipients.length === 0) {
      return res.status(400).json({ ok: false, error: 'No valid recipients found for the selected audience' });
    }

    // Optional: sync recipients to Mailchimp audience (Marketing API)
    try {
      const { addOrUpdateListMember } = await import('../mailchimp-audience.js').catch(() => ({}));
      if (typeof addOrUpdateListMember === 'function') {
        for (const r of recipients) {
          try {
            await addOrUpdateListMember(r.email, { firstName: r.name?.split(' ')[0], lastName: r.name?.split(' ').slice(1).join(' ') });
          } catch (e) {
            console.warn('[send-bulk-email] Audience sync failed (non-blocking):', maskEmail(r.email), e?.message);
          }
        }
      }
    } catch (e) {
      console.warn('[send-bulk-email] Audience sync skipped:', e?.message);
    }

    // Send via transactional-email (Mailjet or Mandrill); Alma theme applied automatically
    const fromEmail = process.env.EMAIL_FROM || 'Communications@almalinks.org';
    const fromNameValue = (fromName && String(fromName).trim()) || getFromName();
    const toList = recipients.map((r) => ({ email: r.email, name: r.name }));

    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    try {
      const bulkResult = await sendTransactionalEmailBulk({
        to: toList,
        subject: subject.trim(),
        html: html || (text ? `<p>${text.replace(/\n/g, '</p><p>')}</p>` : ''),
        text: text || undefined,
        fromEmail,
        fromName: fromNameValue,
      });

      successCount = bulkResult.sent ?? 0;
      errorCount = bulkResult.failed ?? 0;

      if (bulkResult.error && errorCount > 0) {
        recipients.forEach((r) => errors.push({ email: r.email, reason: bulkResult.error }));
      } else if (Array.isArray(bulkResult.results)) {
        bulkResult.results.forEach((r, i) => {
          if (r.status !== 'sent' && r.messageId == null) {
            errors.push({ email: r.email || recipients[i]?.email, reason: r.error || 'failed' });
          }
        });
      }
    } catch (sendErr) {
      console.error('[send-bulk-email] Send error:', sendErr?.message || sendErr);
      errorCount = recipients.length;
      recipients.forEach((r) => errors.push({ email: r.email, reason: sendErr?.message || 'Send failed' }));
    }

    console.log('[send-bulk-email] Completed:', successCount, 'sent,', errorCount, 'failed');

    // Audit: selection with explicit defaults (no undefined)
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
      errors: errors.slice(0, 10),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: currentUserId,
      status: errorCount === 0 ? 'success' : errorCount === recipients.length ? 'failed' : 'partial'
    };
    const campaignData = deepRemoveUndefined(rawCampaignData);

    try {
      await db.collection('emailCampaigns').add(campaignData);
    } catch (auditError) {
      console.error('[send-bulk-email] Failed to write audit record:', auditError);
    }

    const payload = {
      ok: true,
      sent: successCount,
      failed: errorCount,
      total: recipients.length,
      errors: errors.slice(0, 10)
    };
    if (errorCount > 0 && errors[0]?.reason) {
      payload.errorDetail = errors[0].reason;
    }
    return res.status(200).json(payload);

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
async function resolveRecipientsInternal({
  mode,
  ids,
  emails = [],
  groupId,
  eventId,
  eventIds,
  chatId,
  chatIds,
  location,
  locations,
}) {
  let recipients = [];
  const emailArr = Array.isArray(emails) ? emails : [];
  const audienceLike = { eventId, eventIds, chatId, chatIds, location, locations };

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

    case 'event': {
      const evIds = effectiveEventAudienceIds(audienceLike);
      if (!evIds.length) {
        throw new Error('Select at least one event for event mode');
      }
      const mapEv = new Map();
      for (const eid of evIds) {
        const batch = await resolveEventRecipients(eid);
        batch.forEach((r) => mapEv.set(r.userId || r.email, r));
      }
      recipients = [...mapEv.values()];
      break;
    }

    case 'chat': {
      const cIds = effectiveChatAudienceIds(audienceLike);
      if (!cIds.length) {
        throw new Error('Select at least one chat for chat mode');
      }
      const mapCh = new Map();
      for (const cid of cIds) {
        const batch = await resolveChatRecipients(cid);
        batch.forEach((r) => mapCh.set(r.userId || r.email, r));
      }
      recipients = [...mapCh.values()];
      break;
    }

    case 'location': {
      const locs = effectiveLocationAudienceLabels(audienceLike);
      if (!locs.length) {
        throw new Error('Select at least one location for location mode');
      }
      const mapLoc = new Map();
      for (const loc of locs) {
        const batch = await resolveLocationRecipients(loc);
        batch.forEach((r) => mapLoc.set(r.userId || r.email, r));
      }
      recipients = [...mapLoc.values()];
      break;
    }

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
