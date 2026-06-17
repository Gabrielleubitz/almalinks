/**
 * POST /api/email-service
 * All transactional emails via transactional-email (Mailjet if configured, else Mandrill).
 * Alma theme applied to all. Uses lib/server/transactional-email.js.
 *
 * Body: { type, email, name, ...additionalData }
 * Types: acceptance, registration, signup, reset, admin-notification, user-credentials, rejection
 */
import '../firebase-init.js';
import { db } from '../firebase-init.js';
import { getLoginLink, getEventsLink, getAppBaseUrl, getReRequestLink } from '../email-config.js';
import { sendTransactionalEmail } from '../transactional-email.js';
import { upsertHubspotContact } from '../hubspot-contact-sync.js';
import { createPasswordResetTokenForEmail } from '../password-reset-token.js';
import {
  registrationConfirmation,
  welcomeApproved,
  welcomeSignup,
  passwordReset,
  userCredentials,
  applicationRejected,
  memberReferralAndVisionLinksPlainText,
} from '../email-templates.js';

function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function htmlToPlainAcceptance(displayName, loginUrl, eventsUrl, setupPasswordLink) {
  const name = (displayName || 'there').trim();
  const passwordLine = setupPasswordLink
    ? `\nSet your password (link stays valid until you use it):\n${setupPasswordLink}\n`
    : '';
  return `Hi ${name},

We are delighted to officially welcome you to AlmaLinks.
${passwordLine}
Please log in to our portal to review and update your details:
${loginUrl}

Browse events: ${eventsUrl}

Save our AlmaLinks WhatsApp number: +972 55-269-3563

${memberReferralAndVisionLinksPlainText()}

Best,
The AlmaLinks team`;
}

function formatAdminFieldLabel(key) {
  return String(key)
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}

function buildAdminNotificationHtml(vars) {
  const rows = Object.entries(vars)
    .filter(([, v]) => v != null && v !== '')
    .map(([k, v]) => {
      const label = formatAdminFieldLabel(k);
      const value = String(v);
      return `<tr>
  <td style="padding:8px 12px;font-size:13px;color:#6B7280;vertical-align:top;white-space:nowrap;">${escapeHtml(label)}</td>
  <td style="padding:8px 12px;font-size:15px;color:#1C1C1C;vertical-align:top;">${escapeHtml(value)}</td>
</tr>`;
    })
    .join('');

  return `<table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="border-collapse:collapse;">
<tbody>
${rows}
</tbody>
</table>`;
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(200).json({ success: true });
  }
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed',
    });
  }

  try {
    const { type, email, name, ...additionalData } = req.body;

    if (!email || !type) {
      return res.status(400).json({
        success: false,
        error: 'Email and type are required',
      });
    }

    const loginUrl = getLoginLink();
    const eventsUrl = getEventsLink();
    const baseUrl = getAppBaseUrl();
    const displayName = (name || 'Valued Member').trim();

    let subject;
    let html;
    let text;

    switch (type) {
      case 'registration': {
        const eventDetails = additionalData.eventDetails || {};
        const eventName = eventDetails.name || 'Event';
        const eventDate = eventDetails.date || 'TBD';
        const eventLocation = eventDetails.location || 'TBD';
        subject = 'Registration Confirmation - AlmaLinks';
        text = `Hi ${displayName},\n\nThank you for registering!\n\nEvent: ${eventName}\nDate: ${eventDate}\nLocation: ${eventLocation}\n\nLog in: ${loginUrl}\nEvents: ${eventsUrl}\n\n— AlmaLinks Team`;
        html = registrationConfirmation(displayName, eventName, eventDate, eventLocation, loginUrl, eventsUrl);
        break;
      }

      case 'acceptance': {
        const setupLink = additionalData.setupLink || null;
        subject = 'Welcome to AlmaLinks';
        let setupPasswordLink = additionalData.setupLink || null;
        if (!setupPasswordLink) {
          try {
            const tokenResult = await createPasswordResetTokenForEmail(email);
            if (tokenResult.ok && tokenResult.resetUrl) {
              setupPasswordLink = tokenResult.resetUrl;
            }
          } catch (tokenErr) {
            console.warn('[email-service] password setup link generation failed (non-blocking):', tokenErr?.message || tokenErr);
          }
        }
        html = welcomeApproved(displayName, loginUrl, eventsUrl, setupPasswordLink);
        text = htmlToPlainAcceptance(displayName, loginUrl, eventsUrl, setupPasswordLink);
        break;
      }

      case 'signup':
        subject = 'Welcome to AlmaLinks!';
        text = `Hi ${displayName},\n\nThank you for applying to AlmaLinks. We received your application and our team will review it.\n\nOnce approved, you'll receive another email and can log in to access the platform.\n\nLog in: ${loginUrl}\nEvents: ${eventsUrl}\n\n— AlmaLinks Team`;
        html = welcomeSignup(displayName, loginUrl, eventsUrl);
        break;

      case 'reset': {
        const resetLink = additionalData.resetLink || additionalData.resetUrl || loginUrl;
        subject = 'Password Reset - AlmaLinks';
        text = `Hi ${displayName},\n\nUse this link to reset your password: ${resetLink}\n\n— AlmaLinks Team`;
        html = passwordReset(displayName, resetLink);
        break;
      }

      case 'admin-notification':
        subject = additionalData.subject || 'Admin Notification - AlmaLinks';
        {
          const adminVars = { ...additionalData };
          delete adminVars.subject;
          delete adminVars.type;
          delete adminVars.email;
          delete adminVars.name;
          text = Object.entries(adminVars)
            .filter(([, v]) => v != null && v !== '')
            .map(([k, v]) => `${formatAdminFieldLabel(k)}: ${v}`)
            .join('\n');
          html = buildAdminNotificationHtml(adminVars);
        }
        break;

      case 'user-credentials': {
        const tempPassword = additionalData.tempPassword || '';
        const loginUrlCred = additionalData.loginUrl || loginUrl;
        subject = 'Your New Account Credentials - AlmaLinks';
        text = `Hi ${displayName},\n\nEmail: ${email}\nTemporary password: ${tempPassword}\n\n${memberReferralAndVisionLinksPlainText()}\n\nLog in: ${loginUrlCred}\n\n— AlmaLinks Team`;
        html = userCredentials(displayName, email, tempPassword, loginUrlCred);
        break;
      }

      case 'rejection': {
        const reRequestLink = additionalData.reRequestLink || getReRequestLink();
        const contactEmail = additionalData.contactEmail || process.env.ALMA_CONTACT_EMAIL || 'communications@almalinks.org';
        const contactLabel = additionalData.contactLabel || 'AlmaLinks';
        subject = 'Your AlmaLinks Application';
        text = `Hi ${displayName},\n\nThank you for your interest in AlmaLinks. After reviewing your application, we are unable to approve your request at this time.\n\nYou may submit a new request at any time. Use this link to sign in and submit a new application:\n${reRequestLink}\n\nIf you have questions, contact us: ${contactEmail}\n\n— AlmaLinks Team`;
        html = applicationRejected(displayName, reRequestLink, contactEmail, contactLabel);
        break;
      }

      default:
        return res.status(400).json({
          success: false,
          error: 'Invalid email type',
        });
    }

    if (type === 'acceptance' || type === 'registration') {
      console.log('[email-service] Mandrill send, type:', type, 'base:', baseUrl);
    }

    // For acceptance emails: ensure HubSpot contact exists before send so logSentEmailToHubSpot can attach the engagement
    if (type === 'acceptance' && db) {
      const normEmail = String(email).trim().toLowerCase();
      try {
        const snap = await db.collection('users').where('email', '==', normEmail).limit(1).get();
        if (!snap.empty) {
          const doc = snap.docs[0];
          const data = doc.data();
          const profileForHubSpot = {
            ...data,
            email: data.email || normEmail,
            _lookupEmail: normEmail,
            hubspotContactId: data.hubspotContactId || null,
          };
          const syncResult = await upsertHubspotContact(profileForHubSpot);
          if (syncResult.ok) {
            console.log('[email-service] HubSpot contact synced before acceptance email', { email: normEmail, hubspotContactId: syncResult.hubspotContactId });
          } else {
            console.warn('[email-service] HubSpot sync before acceptance email failed (non-blocking)', { email: normEmail, error: syncResult.error });
          }
        }
      } catch (syncErr) {
        console.warn('[email-service] HubSpot sync before acceptance email error (non-blocking):', syncErr?.message || syncErr);
      }
    }

    const fromCommunications =
      (process.env.COMMUNICATIONS_FROM_EMAIL || 'communications@almalinks.org').trim();
    const fromNameCommunications =
      (process.env.COMMUNICATIONS_FROM_NAME || 'AlmaLinks').trim();

    const result = await sendTransactionalEmail({
      to: email.trim().toLowerCase(),
      subject,
      html,
      text,
      ...(type === 'acceptance' && {
        fromEmail: fromCommunications,
        fromName: fromNameCommunications,
        replyTo: fromCommunications,
      }),
    });

    if (!result.ok) {
      console.error('[email-service] Mandrill failed:', type, result.status, result.rejectReason, result.error);
      return res.status(500).json({
        success: false,
        error: result.error || 'Failed to send email',
        details: result.details,
      });
    }

    console.log('[email-service] Sent:', type, result.messageId);
    return res.status(200).json({
      success: true,
      message: 'Email sent successfully',
      messageId: result.messageId,
    });
  } catch (error) {
    console.error('[email-service] Error:', error?.message || error);
    return res.status(500).json({
      success: false,
      error: 'Failed to send email',
      details: process.env.NODE_ENV === 'development' ? error?.message : undefined,
    });
  }
}
