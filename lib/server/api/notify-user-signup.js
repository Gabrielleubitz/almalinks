/**
 * POST /api/notify-user-signup
 * 
 * Sends a confirmation email to a user after they sign up (join request created).
 * 
 * This endpoint:
 * 1. Looks up the joinRequest document in Firestore by joinRequestId
 * 2. Composes and sends a transactional email via Mandrill
 * 3. Writes an evidence record to Firestore emailAttempts collection
 * 
 * Body: { joinRequestId: string }
 * 
 * Verification Steps:
 * 1. Run `vercel dev`
 * 2. Create a joinRequest through the normal signup flow
 * 3. Check terminal logs for "[notify-user-signup] fired" messages
 * 4. Check Firestore `emailAttempts` collection for a new record with type: "signup"
 * 5. Check Mandrill Outbound dashboard for the email attempt
 * 6. If Gmail blocks the email, set SIGNUP_TEST_RECIPIENT env var to an @almalinks.org address
 *    to prove delivery works
 * 
 * Environment Variables:
 * - MANDRILL_API_KEY: Required - Mandrill API key for sending emails
 * - SIGNUP_TEST_RECIPIENT: Optional - Override recipient email for testing (e.g., test@almalinks.org)
 * - EMAIL_FROM: Optional - From email address (defaults to Communications@almalinks.org)
 */

import mailchimp from "@mailchimp/mailchimp_transactional";
import './firebase-init.js';
import { db } from './firebase-init.js';
import admin from './firebase-init.js';

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

    // Determine recipient (allow override via env var for testing)
    const recipient = process.env.SIGNUP_TEST_RECIPIENT || email.trim();
    const fromEmail = process.env.EMAIL_FROM || "Communications@almalinks.org";

    console.log('[notify-user-signup] Preparing email', {
      joinRequestId,
      recipient: recipient === email ? email : `${email} (overridden to ${recipient})`,
      firstName: firstName || 'not provided',
      status
    });

    // Compose email
    const subject = "Thanks for signing up — pending approval";
    const greeting = firstName ? `Hi ${firstName},` : "Hi there,";
    const text = `${greeting}

Thanks for signing up to Alma Links!

Your request has been received and is currently pending admin approval. We'll review your application and notify you once it's been processed.

Once approved, you'll receive another email and can log in to access the platform.

If you have any questions, feel free to reach out to us.

— Alma Links Team`;

    // Get Mandrill API key
    const apiKey = process.env.MANDRILL_API_KEY;
    if (!apiKey) {
      const errorMsg = 'MANDRILL_API_KEY not configured';
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

    // Send email via Mandrill
    let mandrillResult = null;
    let mandrillMessageId = null;
    let mandrillStatus = null;
    let emailStatus = 'error';
    let errorMessage = null;

    try {
      const client = mailchimp(apiKey);
      
      mandrillResult = await client.messages.send({
        message: {
          subject,
          text,
          from_email: fromEmail,
          to: [{ email: recipient, type: "to" }]
        }
      });

      // Extract Mandrill response details
      if (mandrillResult && mandrillResult.length > 0) {
        const emailResult = mandrillResult[0];
        mandrillMessageId = emailResult._id || null;
        mandrillStatus = emailResult.status || null;
        
        // Consider it successful if status is "sent" or "queued"
        if (mandrillStatus === 'sent' || mandrillStatus === 'queued') {
          emailStatus = 'success';
        } else if (mandrillStatus === 'rejected') {
          emailStatus = 'error';
          errorMessage = `Mandrill rejected: ${emailResult.reject_reason || 'unknown reason'}`;
        } else {
          emailStatus = 'error';
          errorMessage = `Mandrill returned status: ${mandrillStatus}`;
        }
      } else {
        emailStatus = 'error';
        errorMessage = 'Unexpected Mandrill response format';
      }

      console.log('[notify-user-signup] Mandrill result', {
        joinRequestId,
        recipient,
        mandrillStatus,
        mandrillMessageId,
        emailStatus
      });

    } catch (mandrillError) {
      // Mandrill API error
      errorMessage = mandrillError.message || String(mandrillError);
      mandrillStatus = 'error';
      
      console.error('[notify-user-signup] Mandrill API error', {
        joinRequestId,
        recipient,
        error: errorMessage,
        stack: mandrillError.stack
      });
    }

    // Write evidence record to Firestore (always, even on errors)
    try {
      await writeEmailAttempt({
        type: 'signup',
        joinRequestId,
        to: recipient,
        status: emailStatus,
        mandrillMessageId,
        mandrillStatus,
        errorMessage,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log('[notify-user-signup] Evidence record written to emailAttempts');
    } catch (firestoreError) {
      // Log but don't fail the request if evidence write fails
      console.error('[notify-user-signup] Failed to write evidence record', {
        error: firestoreError.message,
        stack: firestoreError.stack
      });
    }

    const duration = Date.now() - startTime;
    console.log('[notify-user-signup] completed', {
      joinRequestId,
      recipient,
      emailStatus,
      duration: `${duration}ms`
    });

    // Return success even if Mandrill rejected (we still logged the attempt)
    return res.status(200).json({ 
      ok: true,
      joinRequestId,
      recipient,
      emailStatus,
      mandrillStatus,
      mandrillMessageId
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

    return res.status(500).json({ 
      ok: false, 
      error: err?.message || String(err) 
    });
  }
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
      mandrillMessageId: data.mandrillMessageId || null,
      mandrillStatus: data.mandrillStatus || null,
      errorMessage: data.errorMessage || null
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
