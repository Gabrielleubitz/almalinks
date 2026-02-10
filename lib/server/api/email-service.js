/**
 * POST /api/email-service
 * All transactional emails via transactional-email (Mailjet if configured, else Mandrill).
 * Alma theme applied to all. Uses lib/server/transactional-email.js.
 *
 * Body: { type, email, name, ...additionalData }
 * Types: acceptance, registration, signup, reset, admin-notification, user-credentials
 */
import { getLoginLink, getEventsLink, getAppBaseUrl } from '../email-config.js';
import { sendTransactionalEmail } from '../transactional-email.js';

function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
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
        subject = 'Registration Confirmation - Alma Links';
        text = `Hi ${displayName},\n\nThank you for registering for Alma Links!\n\nEvent: ${eventName}\nDate: ${eventDate}\nLocation: ${eventLocation}\n\nLog in: ${loginUrl}\nEvents: ${eventsUrl}\n\n— Alma Links Team`;
        html = `<p>Hi ${escapeHtml(displayName)},</p><p>Thank you for registering for Alma Links!</p><p><strong>Event:</strong> ${escapeHtml(eventName)}<br/><strong>Date:</strong> ${escapeHtml(eventDate)}<br/><strong>Location:</strong> ${escapeHtml(eventLocation)}</p><p><a href="${escapeHtml(loginUrl)}">Log in</a> · <a href="${escapeHtml(eventsUrl)}">Events</a></p><p>— Alma Links Team</p>`;
        break;
      }

      case 'acceptance':
        subject = 'Welcome to Alma Links!';
        text = `Hi ${displayName},\n\nYour registration for Alma Links has been approved. Welcome!\n\nLog in: ${loginUrl}\nEvents: ${eventsUrl}\n\n— Alma Links Team`;
        html = `<p>Hi ${escapeHtml(displayName)},</p><p>Your registration for Alma Links has been approved. Welcome!</p><p><a href="${escapeHtml(loginUrl)}">Log in</a> · <a href="${escapeHtml(eventsUrl)}">Events</a></p><p>— Alma Links Team</p>`;
        break;

      case 'signup':
        subject = 'Welcome to Alma Links!';
        text = `Hi ${displayName},\n\nThanks for signing up. We're glad to have you.\n\nLog in: ${loginUrl}\nEvents: ${eventsUrl}\n\n— Alma Links Team`;
        html = `<p>Hi ${escapeHtml(displayName)},</p><p>Thanks for signing up. We're glad to have you.</p><p><a href="${escapeHtml(loginUrl)}">Log in</a> · <a href="${escapeHtml(eventsUrl)}">Events</a></p><p>— Alma Links Team</p>`;
        break;

      case 'reset': {
        const resetLink = additionalData.resetLink || loginUrl;
        subject = 'Password Reset - Alma Links';
        text = `Hi ${displayName},\n\nUse this link to reset your password: ${resetLink}\n\n— Alma Links Team`;
        html = `<p>Hi ${escapeHtml(displayName)},</p><p>Use this link to reset your password:</p><p><a href="${escapeHtml(resetLink)}">Reset password</a></p><p>— Alma Links Team</p>`;
        break;
      }

      case 'admin-notification':
        subject = additionalData.subject || 'Admin Notification - Alma Links';
        const adminVars = { ...additionalData };
        text = Object.entries(adminVars)
          .filter(([, v]) => v != null && v !== '')
          .map(([k, v]) => `${k}: ${v}`)
          .join('\n');
        html = `<p>${escapeHtml(text.replace(/\n/g, '</p><p>'))}</p>`;
        break;

      case 'user-credentials': {
        const tempPassword = additionalData.tempPassword || '';
        const loginUrlCred = additionalData.loginUrl || loginUrl;
        subject = 'Your New Account Credentials - Alma Links';
        text = `Hi ${displayName},\n\nEmail: ${email}\nTemporary password: ${tempPassword}\n\nLog in: ${loginUrlCred}\n\n— Alma Links Team`;
        html = `<p>Hi ${escapeHtml(displayName)},</p><p>Email: ${escapeHtml(email)}<br/>Temporary password: ${escapeHtml(tempPassword)}</p><p><a href="${escapeHtml(loginUrlCred)}">Log in</a></p><p>— Alma Links Team</p>`;
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

    const result = await sendTransactionalEmail({
      to: email.trim().toLowerCase(),
      subject,
      html,
      text,
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
