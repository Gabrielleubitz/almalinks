/**
 * POST /api/notify-user-signup
 *
 * Sends a confirmation email to the user after they sign up (join request created).
 * In production, email always goes to the actual user's email (from join request).
 * Test recipient overrides apply only when NODE_ENV !== 'production'.
 *
 * 1. Looks up joinRequest in Firestore by joinRequestId
 * 2. Sends transactional email via Mailchimp Transactional API
 * 3. Writes evidence to Firestore emailAttempts collection
 *
 * Body: { joinRequestId: string }
 * Env: MAILCHIMP_API_KEY (required), EMAIL_FROM or MAILCHIMP_REPLY_TO, APP_URL for links.
 */

import mailchimp from "@mailchimp/mailchimp_transactional";
import '../firebase-init.js';
import { db } from '../firebase-init.js';
import admin from '../firebase-init.js';
import { addOrUpdateListMember } from '../mailchimp-audience.js';
import { getFromEmail, getLoginLink, getEventsLink, getAppBaseUrl, getTestRecipient } from '../email-config.js';

function maskEmail(email) {
  if (!email || typeof email !== 'string') return '***';
  const parts = email.trim().split('@');
  if (parts.length !== 2) return '***';
  const local = parts[0];
  const maskedLocal = local.length <= 2 ? '**' : local.slice(0, 1) + '***' + local.slice(-1);
  return `${maskedLocal}@${parts[1]}`;
}

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== "POST") {
    return res.status(405).json({ 
      ok: false, 
      error: "Method not allowed. Use POST." 
    });
  }

  const startTime = Date.now();
  const body = req.body || {};
  const { joinRequestId } = body;

  // Safety check: joinRequestId required
  if (!joinRequestId || typeof joinRequestId !== 'string' || joinRequestId.trim() === '') {
    console.error('[notify-user-signup] Missing or invalid joinRequestId');
    return res.status(400).json({ 
      ok: false, 
      error: "Missing required field: joinRequestId" 
    });
  }

  console.log('[notify-user-signup] fired', { 
    joinRequestId, 
    timestamp: new Date().toISOString() 
  });

  try {
    // Look up joinRequest document in Firestore
    const joinRequestRef = db.collection('joinRequests').doc(joinRequestId);
    const joinRequestDoc = await joinRequestRef.get();

    // Safety check: joinRequest must exist
    if (!joinRequestDoc.exists) {
      console.error('[notify-user-signup] Join request not found:', joinRequestId);
      return res.status(404).json({ 
        ok: false, 
        error: `Join request not found: ${joinRequestId}` 
      });
    }

    const joinRequestData = joinRequestDoc.data();
    const email = joinRequestData.email;
    const firstName = joinRequestData.firstName || joinRequestData.name?.split(' ')[0] || null;
    const createdAt = joinRequestData.createdAt;
    const status = joinRequestData.status || 'pending';

    // Safety check: email required
    if (!email || typeof email !== 'string' || email.trim() === '') {
      console.error('[notify-user-signup] Email missing in joinRequest:', joinRequestId);
      return res.status(422).json({ 
        ok: false, 
        error: "Email missing in join request" 
      });
    }

    // Recipient: real user email in production; test override only when NODE_ENV !== 'production'
    const recipient = getTestRecipient('signup_user') || email.trim();
    const fromEmail = getFromEmail();
    const baseUrl = getAppBaseUrl();

    console.log('[notify-user-signup] Links base (APP_URL):', baseUrl);
    console.log('[notify-user-signup] Recipient:', maskEmail(recipient), recipient !== email.trim() ? '(dev override)' : '');
    console.log('[notify-user-signup] Preparing email', { joinRequestId, firstName: firstName || 'not provided', status });

    const loginLink = getLoginLink();
    const eventsLink = getEventsLink();
    const subject = "Thanks for signing up — pending approval";
    const greeting = firstName ? `Hi ${firstName},` : "Hi there,";
    const text = `${greeting}

Thanks for signing up to Alma Links!

Your request has been received and is currently pending admin approval. We'll review your application and notify you once it's been processed.

Once approved, you'll receive another email and can log in to access the platform.

Log in or check status: ${loginLink}
Events: ${eventsLink}

If you have any questions, feel free to reach out to us.

— Alma Links Team`;

    // Add signup to Mailchimp audience BEFORE sending email (so the email can be sent to a known contact)
    try {
      const lastName = joinRequestData.lastName || joinRequestData.name?.split(' ').slice(1).join(' ') || '';
      const mcResult = await addOrUpdateListMember(email.trim(), {
        firstName: firstName || undefined,
        lastName: lastName || undefined
      });
      if (mcResult.ok) {
        console.log('[notify-user-signup] Added to Mailchimp audience (before email)', { email: email.trim(), added: mcResult.added });
      } else {
        console.warn('[notify-user-signup] Mailchimp audience sync skipped or failed (continuing with email):', mcResult.error);
      }
    } catch (mcErr) {
      console.warn('[notify-user-signup] Mailchimp audience sync error (non-blocking, continuing with email):', mcErr?.message || mcErr);
    }

    // Get Mailchimp API key
    const apiKey = process.env.MAILCHIMP_API_KEY;
    if (!apiKey) {
      const errorMsg = 'MAILCHIMP_API_KEY not configured';
      console.error(`[notify-user-signup] ${errorMsg}`);
      
      // Write evidence record even on configuration error
      await writeEmailAttempt({
        type: 'signup',
        joinRequestId,
        to: recipient,
        status: 'error',
        errorMessage: errorMsg,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      return res.status(500).json({ 
        ok: false, 
        error: errorMsg 
      });
    }

    // Send email via Mailchimp Transactional API
    let sendResult = null;
    let messageId = null;
    let sendStatus = null;
    let emailStatus = 'error';
    let errorMessage = null;

    try {
      const client = mailchimp(apiKey);
      const html = `<p>${escapeHtml(greeting)}</p>
<p>Thanks for signing up to Alma Links!</p>
<p>Your request has been received and is currently pending admin approval. We'll review your application and notify you once it's been processed.</p>
<p>Once approved, you'll receive another email and can log in to access the platform.</p>
<p><a href="${escapeHtml(loginLink)}">Log in or check status</a> &middot; <a href="${escapeHtml(eventsLink)}">Events</a></p>
<p>If you have any questions, feel free to reach out to us.</p>
<p>— Alma Links Team</p>`;
      sendResult = await client.messages.send({
        message: {
          subject,
          text,
          html,
          from_email: fromEmail,
          from_name: process.env.MAILCHIMP_FROM_NAME || 'Alma Links',
          to: [{ email: recipient, type: "to" }]
        }
      });

      // API can return array or single object for 1 recipient
      const resultsArray = Array.isArray(sendResult) ? sendResult : (sendResult != null ? [sendResult] : []);
      const emailResult = resultsArray[0] || null;

      if (emailResult) {
        messageId = emailResult._id || null;
        sendStatus = emailResult.status || null;

        if (sendStatus === 'sent' || sendStatus === 'queued') {
          emailStatus = 'success';
        } else if (sendStatus === 'rejected') {
          emailStatus = 'error';
          errorMessage = `Rejected: ${emailResult.reject_reason || 'unknown reason'}`;
        } else {
          emailStatus = 'error';
          errorMessage = `Status: ${sendStatus}`;
        }
      } else {
        emailStatus = 'error';
        errorMessage = 'Unexpected API response format';
      }

      console.log('[notify-user-signup] Send result', { joinRequestId, sendStatus, messageId, emailStatus });
    } catch (sendError) {
      errorMessage = sendError?.message || String(sendError);
      sendStatus = 'error';
      console.error('[notify-user-signup] Send error', { joinRequestId, error: errorMessage });
    }

    // Write evidence record to Firestore (always, even on errors)
    try {
      await writeEmailAttempt({
        type: 'signup',
        joinRequestId,
        to: recipient,
        status: emailStatus,
        messageId,
        sendStatus,
        errorMessage,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log('[notify-user-signup] Evidence record written to emailAttempts');
    } catch (firestoreError) {
      console.error('[notify-user-signup] Failed to write evidence record', { error: firestoreError?.message });
    }

    const duration = Date.now() - startTime;
    console.log('[notify-user-signup] completed', { joinRequestId, emailStatus, duration: `${duration}ms` });

    return res.status(200).json({
      ok: true,
      joinRequestId,
      recipient,
      emailStatus,
      sendStatus,
      messageId
    });

  } catch (err) {
    const duration = Date.now() - startTime;
    console.error('[notify-user-signup] Unexpected error', {
      joinRequestId,
      error: err.message,
      stack: err.stack,
      duration: `${duration}ms`
    });

    // Try to write error evidence record
    try {
      await writeEmailAttempt({
        type: 'signup',
        joinRequestId,
        to: 'unknown',
        status: 'error',
        errorMessage: err.message || String(err),
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
    } catch (firestoreError) {
      console.error('[notify-user-signup] Failed to write error evidence record', firestoreError);
    }

    const isDev = process.env.NODE_ENV === 'development';
    return res.status(500).json({ 
      ok: false, 
      error: isDev ? (err?.message || String(err)) : 'Failed to send signup confirmation' 
    });
  }
}

function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Helper function to write email attempt evidence to Firestore
 */
async function writeEmailAttempt(data) {
  try {
    const attemptsRef = db.collection('emailAttempts');
    const attemptData = {
      type: data.type,
      joinRequestId: data.joinRequestId,
      to: data.to,
      status: data.status,
      messageId: data.messageId ?? data.mandrillMessageId ?? null,
      sendStatus: data.sendStatus ?? data.mandrillStatus ?? null,
      errorMessage: data.errorMessage ?? null
    };
    
    // Add timestamp if provided, otherwise use serverTimestamp
    if (data.createdAt) {
      attemptData.createdAt = data.createdAt;
    } else {
      attemptData.createdAt = admin.firestore.FieldValue.serverTimestamp();
    }
    
    await attemptsRef.add(attemptData);
  } catch (error) {
    // Re-throw to let caller handle
    throw error;
  }
}
