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
import {
  registrationConfirmation,
  welcomeApproved,
  welcomeSignup,
  passwordReset,
  userCredentials,
  applicationRejected,
} from '../email-templates.js';

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
        text = `Hi ${displayName},\n\nThank you for registering!\n\nEvent: ${eventName}\nDate: ${eventDate}\nLocation: ${eventLocation}\n\nLog in: ${loginUrl}\nEvents: ${eventsUrl}\n\n— Alma Links Team`;
        html = registrationConfirmation(displayName, eventName, eventDate, eventLocation, loginUrl, eventsUrl);
        break;
      }

      case 'acceptance':
        subject = 'Welcome to Alma Links!';
        text = `Hi ${displayName},\n\nYour registration for Alma Links has been approved. Welcome!\n\nLog in: ${loginUrl}\nEvents: ${eventsUrl}\n\n— Alma Links Team`;
        html = welcomeApproved(displayName, loginUrl, eventsUrl);
        break;

      case 'signup':
        subject = 'Welcome to Alma Links!';
        text = `Hi ${displayName},\n\nThanks for signing up. We're glad to have you.\n\nLog in: ${loginUrl}\nEvents: ${eventsUrl}\n\n— Alma Links Team`;
        html = welcomeSignup(displayName, loginUrl, eventsUrl);
        break;

      case 'reset': {
        const resetLink = additionalData.resetLink || loginUrl;
        subject = 'Password Reset - Alma Links';
        text = `Hi ${displayName},\n\nUse this link to reset your password: ${resetLink}\n\n— Alma Links Team`;
        html = passwordReset(displayName, resetLink);
        break;
      }

      case 'admin-notification':
        subject = additionalData.subject || 'Admin Notification - Alma Links';
        const adminVars = { ...additionalData };
        text = Object.entries(adminVars)
          .filter(([, v]) => v != null && v !== '')
          .map(([k, v]) => `${k}: ${v}`)
          .join('\n');
        html = `<p style="margin:0 0 16px 0;font-size:16px;line-height:1.5;color:#1C1C1C;">${escapeHtml(text.replace(/\n/g, '</p><p style="margin:0 0 16px 0;font-size:16px;line-height:1.5;color:#1C1C1C;">'))}</p>`;
        break;

      case 'user-credentials': {
        const tempPassword = additionalData.tempPassword || '';
        const loginUrlCred = additionalData.loginUrl || loginUrl;
        subject = 'Your New Account Credentials - Alma Links';
        text = `Hi ${displayName},\n\nEmail: ${email}\nTemporary password: ${tempPassword}\n\nLog in: ${loginUrlCred}\n\n— Alma Links Team`;
        html = userCredentials(displayName, email, tempPassword, loginUrlCred);
        break;
      }

      case 'rejection': {
        const reRequestLink = additionalData.reRequestLink || getReRequestLink();
        const contactEmail = additionalData.contactEmail || process.env.ALMA_CONTACT_EMAIL || 'communications@almalinks.org';
        const contactLabel = additionalData.contactLabel || 'Alma Links';
        subject = 'Your Alma Links Application';
        text = `Hi ${displayName},\n\nThank you for your interest in Alma Links. After reviewing your application, we are unable to approve your request at this time.\n\nYou may submit a new request at any time. Use this link to sign in and submit a new application:\n${reRequestLink}\n\nIf you have questions, contact us: ${contactEmail}\n\n— Alma Links Team`;
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
