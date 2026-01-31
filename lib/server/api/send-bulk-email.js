// POST /api/send-bulk-email
// Send emails to an audience (group, event, chat, location, or individuals)
// Requires authentication (admin)
// Also adds each recipient to the Mailchimp audience (if configured)
import '../firebase-init.js';
import { db, auth } from '../firebase-init.js';
import admin from '../firebase-init.js';
import mailchimp from "@mailchimp/mailchimp_transactional";

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    // Verify authentication
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
      console.error('[send-bulk-email] Auth error:', authError.message);
      return res.status(401).json({ ok: false, error: 'Unauthorized: Invalid token' });
    }

    // Require admin
    if (!isAdmin) {
      return res.status(403).json({ ok: false, error: 'Forbidden: Admin access required' });
    }

    // Parse request body (individuals mode can use either ids (user IDs) or emails (email addresses))
    const { mode, ids, emails, groupId, eventId, chatId, location, subject, html, text, fromName } = req.body;

    // Validate input
    if (!subject || !subject.trim()) {
      return res.status(400).json({ ok: false, error: 'subject is required' });
    }

    if (!text && !html) {
      return res.status(400).json({ ok: false, error: 'Either text or html message body is required' });
    }

    if (!mode || !['individuals', 'group', 'event', 'chat', 'location', 'all_users'].includes(mode)) {
      return res.status(400).json({ ok: false, error: 'mode must be one of: individuals, group, event, chat, location, all_users' });
    }

    // Check Mailchimp/Mandrill API key
    const apiKey = process.env.MAILCHIMP_API_KEY || process.env.MANDRILL_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ ok: false, error: 'Missing MAILCHIMP_API_KEY or MANDRILL_API_KEY' });
    }

    // Resolve recipients by calling internal resolve function
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
            console.warn('[send-bulk-email] Mailchimp audience sync for recipient failed (non-blocking):', r.email, e?.message);
          }
        }
      }
    } catch (e) {
      console.warn('[send-bulk-email] Mailchimp audience sync skipped:', e?.message);
    }

    console.log(`[send-bulk-email] Sending to ${recipients.length} recipients (mode: ${mode})`);

    // Send emails via Mandrill
    const client = mailchimp(apiKey);
    const fromEmail = process.env.EMAIL_FROM || "Communications@almalinks.org";
    const fromNameValue = fromName || "Alma Links";

    // Mandrill supports batch sending - send all at once
    const messages = recipients.map(recipient => ({
      email: recipient.email,
      name: recipient.name,
      type: "to"
    }));

    let sendResults;
    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    try {
      // Use Mandrill's batch send
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

      // Process results
      sendResults.forEach((result, index) => {
        if (result.status === 'sent' || result.status === 'queued') {
          successCount++;
        } else {
          errorCount++;
          errors.push({
            email: recipients[index].email,
            reason: result.reject_reason || result.status || 'unknown'
          });
        }
      });

    } catch (mandrillError) {
      console.error('[send-bulk-email] Mandrill error:', mandrillError);
      // If batch fails, try individual sends with rate limiting
      console.log('[send-bulk-email] Batch send failed, falling back to individual sends');
      
      const RATE_LIMIT_DELAY = 100; // 100ms between sends
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
              to: [{ email: recipients[i].email, name: recipients[i].name, type: "to" }]
            }
          });

          if (result[0]?.status === 'sent' || result[0]?.status === 'queued') {
            successCount++;
          } else {
            errorCount++;
            errors.push({
              email: recipients[i].email,
              reason: result[0]?.reject_reason || result[0]?.status || 'unknown'
            });
          }
        } catch (individualError) {
          errorCount++;
          errors.push({
            email: recipients[i].email,
            reason: individualError.message || 'send failed'
          });
        }
      }
    }

    // Write audit record to Firestore
    const campaignData = {
      mode,
      selection: { ids, groupId, eventId, chatId, location },
      subject: subject.trim(),
      recipientCount: recipients.length,
      successCount,
      errorCount,
      errors: errors.length > 0 ? errors.slice(0, 10) : [], // Store first 10 errors
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: currentUserId,
      status: errorCount === 0 ? 'success' : errorCount === recipients.length ? 'failed' : 'partial'
    };

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
      errors: errors.slice(0, 10) // Return first 10 errors
    });

  } catch (error) {
    console.error('[send-bulk-email] Error:', error?.message || error, error?.stack);
    const message = error?.message || 'Internal server error';
    try {
      return res.status(500).json({ ok: false, error: message });
    } catch (sendErr) {
      console.error('[send-bulk-email] Failed to send error response:', sendErr?.message);
    }
  }
}

/**
 * Internal function to resolve recipients (reuses logic from resolve-email-recipients)
 */
async function resolveRecipientsInternal({ mode, ids, groupId, eventId, chatId, location }) {
  let recipients = [];

  switch (mode) {
    case 'individuals':
      // Support either emails (array of email strings) or ids (array of user IDs)
      if (emails && Array.isArray(emails) && emails.length > 0) {
        recipients = emails
          .map((e) => (typeof e === 'string' ? e.trim() : ''))
          .filter((e) => e)
          .map((email) => ({ email, name: undefined }));
      } else if (ids && Array.isArray(ids) && ids.length > 0) {
        recipients = await resolveIndividualRecipients(ids);
      } else {
        throw new Error('For individuals mode, provide either emails (array of email strings) or ids (array of user IDs)');
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
