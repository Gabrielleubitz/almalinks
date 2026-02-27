/**
 * AlmaLinks email content templates (body HTML only).
 * All content is wrapped by wrapInAlmaTheme() before sending.
 * Shared across Mailjet and Mailchimp for consistency.
 */

import {
  escapeHtml,
  buildCtaButton,
  buildSecondaryLink,
  buildDateLocationBlock,
  buildHeadline,
  buildSubheadline,
  buildParagraph,
  buildSignature,
  formatEmailDate,
} from './email-design-system.js';

/**
 * 1. New Event Created (promotional) — hero image, title, date/location, description, CTA.
 */
export function eventAnnouncement(event, eventUrl) {
  const name = event.name || 'Event';
  const dateText = formatEmailDate(event.date);
  const location = event.location || '';
  const description = (event.description || '').trim().replace(/\n/g, '<br/>');
  const imageUrl = (event.imageUrl || '').trim();

  const imageBlock = imageUrl
    ? `
<table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="margin-bottom:20px;border-radius:8px;overflow:hidden;">
  <tr>
    <td>
      <a href="${escapeHtml(eventUrl)}" target="_blank" rel="noopener noreferrer">
        <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(name)}" width="552" style="display:block;max-width:100%;height:auto;" />
      </a>
    </td>
  </tr>
</table>`
    : '';

  return `
${imageBlock}
${buildHeadline(name)}
${buildDateLocationBlock(dateText, location)}
${description ? buildParagraph(description, { marginBottom: 24 }) : ''}
${buildCtaButton(eventUrl, 'View event & register')}
${buildParagraph(`Can't make it? <a href="${escapeHtml(eventUrl)}" style="color:#2E7FEF;text-decoration:none;">View all events</a> on AlmaLinks.`, { marginBottom: 0 })}
${buildSignature()}
`;
}

/**
 * 2. Event Registration Confirmation (transactional).
 */
export function registrationConfirmation(displayName, eventName, eventDate, eventLocation, loginLink, eventsLink) {
  const greeting = displayName ? `Hi ${escapeHtml(displayName)},` : 'Hi there,';
  const dateStr = eventDate ? formatEmailDate(eventDate) : (eventDate || 'TBD');
  return `
${buildParagraph(greeting, { marginBottom: 16 })}
${buildParagraph("You're registered. We're looking forward to seeing you.", { marginBottom: 16 })}
${buildDateLocationBlock(dateStr, eventLocation || '')}
${buildParagraph(`<strong>Event:</strong> ${escapeHtml(eventName || 'Event')}`, { marginBottom: 24 })}
${buildCtaButton(loginLink, 'Go to dashboard')}
${buildParagraph(`${buildSecondaryLink(eventsLink, 'Browse events')}`, { marginBottom: 0 })}
${buildSignature()}
`;
}

/**
 * 3. Event Reminder.
 */
export function eventReminder(displayName, eventName, eventDate, eventLocation, eventUrl) {
  const greeting = displayName ? `Hi ${escapeHtml(displayName)},` : 'Hi there,';
  const dateStr = eventDate ? formatEmailDate(eventDate) : (eventDate || '');
  return `
${buildParagraph(greeting, { marginBottom: 16 })}
${buildParagraph('A quick reminder about your upcoming event.', { marginBottom: 16 })}
${buildHeadline(eventName || 'Event')}
${buildDateLocationBlock(dateStr, eventLocation || '')}
${buildCtaButton(eventUrl, 'View event details')}
${buildSignature()}
`;
}

/**
 * 4. Password Reset.
 */
export function passwordReset(displayName, resetLink) {
  const greeting = displayName ? `Hi ${escapeHtml(displayName)},` : 'Hi there,';
  return `
${buildParagraph(greeting, { marginBottom: 16 })}
${buildParagraph('We received a request to reset your password. Use the button below to set a new one.', { marginBottom: 24 })}
${buildCtaButton(resetLink, 'Reset password')}
${buildParagraph('If you didn\'t request this, you can ignore this email. The link will expire for security.', { marginBottom: 0 })}
${buildSignature()}
`;
}

/**
 * 5. Welcome (signup received, pending approval).
 */
export function welcomeSignup(firstName, loginLink, eventsLink) {
  const greeting = firstName ? `Hi ${escapeHtml(firstName)},` : 'Hi there,';
  return `
${buildParagraph(greeting, { marginBottom: 16 })}
${buildParagraph('Thanks for signing up to AlmaLinks. Your request has been received and is pending approval. We\'ll review your application and notify you once it\'s processed.', { marginBottom: 16 })}
${buildParagraph('Once approved, you\'ll receive another email and can log in to access the platform.', { marginBottom: 24 })}
${buildCtaButton(loginLink, 'Check status')}
${buildParagraph(`${buildSecondaryLink(eventsLink, 'Browse events')}`, { marginBottom: 0 })}
${buildParagraph('If you have any questions, reach out anytime.', { marginBottom: 0 })}
${buildSignature()}
`;
}

/**
 * 6. Welcome / Approval (registration approved).
 */
export function welcomeApproved(displayName, loginLink, eventsLink) {
  const greeting = displayName ? `Hi ${escapeHtml(displayName)},` : 'Hi there,';
  return `
${buildParagraph(greeting, { marginBottom: 16 })}
${buildParagraph('Your registration for AlmaLinks has been approved. Welcome to the community.', { marginBottom: 24 })}
${buildCtaButton(loginLink, 'Log in')}
${buildParagraph(`${buildSecondaryLink(eventsLink, 'View events')}`, { marginBottom: 0 })}
${buildSignature()}
`;
}

/**
 * 7. User credentials (temp password).
 */
export function userCredentials(displayName, email, tempPassword, loginUrl) {
  const greeting = displayName ? `Hi ${escapeHtml(displayName)},` : 'Hi there,';
  return `
${buildParagraph(greeting, { marginBottom: 16 })}
${buildParagraph('Your AlmaLinks account is ready. Use the credentials below to log in. We recommend changing your password after first login.', { marginBottom: 16 })}
<table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="background:#f3f4f6;border-radius:8px;margin:16px 0;">
  <tr>
    <td style="padding:16px 20px;">
      <p style="margin:0 0 8px 0;font-size:13px;color:#6B7280;">Email</p>
      <p style="margin:0 0 16px 0;font-size:16px;color:#1C1C1C;">${escapeHtml(email)}</p>
      <p style="margin:0 0 8px 0;font-size:13px;color:#6B7280;">Temporary password</p>
      <p style="margin:0;font-size:16px;color:#1C1C1C;">${escapeHtml(tempPassword)}</p>
    </td>
  </tr>
</table>
${buildCtaButton(loginUrl, 'Log in')}
${buildSignature()}
`;
}

/**
 * 8. Application rejected — user can re-request access.
 */
export function applicationRejected(displayName, reRequestLink, contactEmail, contactLabel) {
  const greeting = displayName ? `Hi ${escapeHtml(displayName)},` : 'Hi there,';
  const contact = contactEmail || 'communications@almalinks.org';
  const label = contactLabel || 'Alma Links';
  return `
${buildParagraph(greeting, { marginBottom: 16 })}
${buildParagraph('Thank you for your interest in Alma Links. After reviewing your application, we are unable to approve your request at this time.', { marginBottom: 16 })}
${buildParagraph('You may submit a new request at any time. If your situation or profile has changed, we encourage you to try again.', { marginBottom: 24 })}
${buildCtaButton(reRequestLink, 'Submit another request')}
${buildParagraph(`Use the link above to sign in and submit a new application. We’ll review it and get back to you.`, { marginBottom: 24 })}
${buildParagraph('If you have questions or would like to discuss your application, please contact us:', { marginBottom: 8 })}
${buildParagraph(`<strong>${escapeHtml(label)}</strong><br/><a href="mailto:${escapeHtml(contact)}" style="color:#2E7FEF;text-decoration:none;">${escapeHtml(contact)}</a>`, { marginBottom: 0 })}
${buildSignature()}
`;
}

/**
 * 8b. Event registration approved — confirmation with location, meeting link, calendar link, optional resource link.
 */
export function eventRegistrationApproved(displayName, eventName, eventDate, eventLocation, meetingUrl, resourceLinkUrl, resourceLinkLabel, calendarUrl, eventsLink) {
  const greeting = displayName ? `Hi ${escapeHtml(displayName)},` : 'Hi there,';
  const dateStr = eventDate ? formatEmailDate(eventDate) : (eventDate || 'TBD');
  const locationBlock = buildDateLocationBlock(dateStr, eventLocation || '');
  const meetingBlock = meetingUrl
    ? buildParagraph(`<strong>Meeting link:</strong> <a href="${escapeHtml(meetingUrl)}" style="color:#2E7FEF;text-decoration:none;">${escapeHtml(meetingUrl)}</a>`, { marginBottom: 16 })
    : '';
  const resourceBlock = resourceLinkUrl
    ? buildParagraph(`<strong>${escapeHtml(resourceLinkLabel || 'Resource')}:</strong> <a href="${escapeHtml(resourceLinkUrl)}" style="color:#2E7FEF;text-decoration:none;">${escapeHtml(resourceLinkUrl)}</a>`, { marginBottom: 24 })
    : '';
  return `
${buildParagraph(greeting, { marginBottom: 16 })}
${buildParagraph("You're confirmed for this event. Here are the details.", { marginBottom: 16 })}
${buildHeadline(eventName || 'Event')}
${locationBlock}
${meetingBlock}
${resourceBlock}
${buildCtaButton(calendarUrl || eventsLink, 'Add to Google Calendar')}
${buildParagraph(`${buildSecondaryLink(eventsLink, 'View event')}`, { marginBottom: 0 })}
${buildSignature()}
`;
}

/**
 * 9. Admin test email — branded preview for Mailjet/Mailchimp tests.
 * Subject: "✅ AlmaLinks Test Email". Headline: "Hey {name or admin}! 👋"
 * CTA: "Visit AlmaLinks" (siteUrl). Footer comes from wrapInAlmaTheme.
 */
export function testEmail(recipientName, siteUrl) {
  const name = (recipientName && String(recipientName).trim()) || 'admin';
  const site = (siteUrl && String(siteUrl).replace(/\/$/, '')) || 'https://almalinks.org';
  return `
${buildHeadline(`Hey ${name}! 👋`)}
${buildParagraph('This is a test email from AlmaLinks. If you\'re seeing this, everything\'s working perfectly.', { marginBottom: 24 })}
${buildCtaButton(site, 'Visit AlmaLinks')}
${buildSignature()}
`;
}
