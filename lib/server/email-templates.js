/**
 * AlmaLinks email content templates (body HTML only).
 * All content is wrapped by wrapInAlmaTheme() before sending.
 * Shared across Mailjet and Mailchimp for consistency.
 */

import {
  escapeHtml,
  buildCtaButton,
  buildOrangeCtaButton,
  buildSecondaryLink,
  buildDateLocationBlock,
  buildHeadline,
  buildSubheadline,
  buildParagraph,
  buildSignature,
  formatEmailDate,
} from './email-design-system.js';
import { getMemberCriteriaUrl, getAlmaVisionUrl } from './email-config.js';

function memberReferralAndVisionLinksHtml() {
  const criteriaUrl = getMemberCriteriaUrl();
  const visionUrl = getAlmaVisionUrl();
  return `
${buildParagraph(`If you are interested in recommending a prospective AlmaLinks member, please ${buildSecondaryLink(criteriaUrl, 'click here')} to learn more about the criteria we look for in our members.`, { marginBottom: 12 })}
${buildParagraph(`${buildSecondaryLink(visionUrl, 'Click here')} to learn more about AlmaLinks&rsquo; vision and programming.`, { marginBottom: 16 })}
`;
}

export function memberReferralAndVisionLinksPlainText() {
  const criteriaUrl = getMemberCriteriaUrl();
  const visionUrl = getAlmaVisionUrl();
  return `If you are interested in recommending a prospective AlmaLinks member, please click here to learn more about the criteria we look for in our members:
${criteriaUrl}

Click here to learn more about AlmaLinks' vision and programming:
${visionUrl}`;
}

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
${buildParagraph('If you didn\'t request this, you can ignore this email. The link stays valid until you use it.', { marginBottom: 0 })}
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
${buildParagraph('Thank you for applying to AlmaLinks. We received your application and our team will review it.', { marginBottom: 16 })}
${buildParagraph('Once approved, you\'ll receive another email and can log in to access the platform.', { marginBottom: 24 })}
${buildCtaButton(loginLink, 'Check status')}
${buildParagraph(`${buildSecondaryLink(eventsLink, 'Browse events')}`, { marginBottom: 0 })}
${buildParagraph('If you have any questions, reach out anytime.', { marginBottom: 0 })}
${buildSignature()}
`;
}

/**
 * 6. Welcome / Approval (member approved — full onboarding letter).
 * @param {string} displayName
 * @param {string} loginLink
 * @param {string} eventsLink
 * @param {string|null} [setupLink] - Firebase password-reset/setup link generated server-side.
 *   When provided, a prominent "Set your password" CTA is shown above the login button.
 */
export function welcomeApproved(displayName, loginLink, eventsLink, setupPasswordLink) {
  const signInHelp = setupPasswordLink
    ? '<strong>How to sign in:</strong> Use the same email you applied with. First, set your portal password using the button below, then log in at almalinks.org.'
    : '<strong>How to sign in:</strong> Use the same email you applied with and your AlmaLinks password. If you need a new password, use &ldquo;Forgot password&rdquo; on the login page.';

  const expectationsHtml = `
${buildSubheadline('What we expect from members')}
<ul style="margin:0 0 20px 20px;padding:0;color:#1C1C1C;font-size:15px;line-height:1.65;">
<li><strong>Time commitment</strong> — There is no fixed quota, but members are expected to respond to reasonable requests from fellow members in a timely way (for example brief introductions or short conversations on topics where you can help).</li>
<li><strong>Support the growth of the organization</strong> — Suggest speakers and venues, interview candidates when asked, and introduce high-quality prospective members.</li>
<li><strong>Financial contribution</strong> — AlmaLinks does not charge a set fee; members are nonetheless encouraged to consider an annual contribution that supports programming.</li>
<li><strong>Event participation</strong> — We know schedules are demanding; we recommend attending at least two events per year to build relationships across the community.</li>
</ul>`;

  const valuesHtml = `
${buildSubheadline('Our value system')}
<ul style="margin:0 0 20px 20px;padding:0;color:#1C1C1C;font-size:15px;line-height:1.65;">
<li><strong>Intellectual generosity</strong> — When successful people share experience in the right context, everyone benefits.</li>
<li><strong>A culture of curiosity</strong> — Every member should want to learn and be willing to share knowledge.</li>
<li><strong>Mutual respect</strong> — Our network is non-hierarchical; everyone is seen, heard, and valued.</li>
<li><strong>Openness</strong> — Members meet without pre-conditions; the intention is to explore the connection and its potential.</li>
</ul>`;

  const conductHtml = `
${buildSubheadline('Peer-to-peer conduct (community safety)')}
<ul style="margin:0 0 20px 20px;padding:0;color:#1C1C1C;font-size:15px;line-height:1.65;">
<li><strong>No solicitations</strong> — Engage in a spirit of collegiality. Unsolicited commercial messages (including investment or &ldquo;work with me&rdquo; pitches) are not permitted; the network is built on trust and generous exchange, not commercial pressure.</li>
<li><strong>Non-political and non-religious</strong> — AlmaLinks is non-political and non-religious; please avoid advocacy threads that would divide the community.</li>
</ul>`;

  return `
${buildParagraph('We are delighted to officially welcome you to AlmaLinks.', { marginBottom: 16 })}
${buildParagraph('As a next step in your onboarding, please log in to our portal and take a moment to review and update your details. This will help you stay up to date with upcoming events, members, and ongoing conversations within the community.', { marginBottom: 16 })}
${buildParagraph(signInHelp, { marginBottom: 16 })}
${setupPasswordLink ? `${buildCtaButton(setupPasswordLink, 'Set your password')}${buildParagraph('', { marginBottom: 16 })}` : ''}
${buildParagraph('You will also receive a message from our AlmaLinks number inviting you to join the WhatsApp group — please save it: <strong>+972 55-269-3563</strong>.', { marginBottom: 16 })}
${buildParagraph('Additionally, you will be added to our mailing list so you stay connected with updates.', { marginBottom: 20 })}
${buildCtaButton(loginLink, 'Log in to the portal')}
${buildParagraph(`${buildSecondaryLink(eventsLink, 'Browse events')}`, { marginBottom: 24 })}
${expectationsHtml}
${valuesHtml}
${conductHtml}
${memberReferralAndVisionLinksHtml()}
${buildParagraph('Please reach out with any questions. We hope your experience with AlmaLinks is rewarding and fulfilling.', { marginBottom: 0 })}
${buildParagraph('Best,<br/>The AlmaLinks team', { marginBottom: 0 })}
`;
}

/**
 * Admin-triggered: introductory Zoom / next-step email to an applicant (Hadrat template).
 */
export function applicationIntroFollowUp(firstName, _websiteUrl) {
  const who = firstName ? escapeHtml(firstName) : '';
  const greeting = who ? `Hi ${who},` : 'Hi,';
  return `
${buildParagraph(greeting, { marginBottom: 16 })}
${buildParagraph('We were happy to receive your application. Thank you so much for your interest in AlmaLinks!', { marginBottom: 16 })}
${buildParagraph('I\'m Hadrat, Executive Director here at AlmaLinks — it\'s a pleasure to e-meet you.', { marginBottom: 16 })}
${buildParagraph('I\'d love to set up a quick introductory Zoom call so we can get to know each other better. It will be a great chance to hear more about you and share a bit about our values, goals, and programming.', { marginBottom: 16 })}
${buildParagraph('Let me know what time works best for you and we will schedule accordingly. I\'m based in Israel.', { marginBottom: 16 })}
${memberReferralAndVisionLinksHtml()}
${buildParagraph('Looking forward to connecting,<br/>Hadrat', { marginBottom: 0 })}
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
${memberReferralAndVisionLinksHtml()}
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
  const label = contactLabel || 'AlmaLinks';
  return `
${buildParagraph(greeting, { marginBottom: 16 })}
${buildParagraph('Thank you for your interest in AlmaLinks. After reviewing your application, we are unable to approve your request at this time.', { marginBottom: 16 })}
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
/**
 * Post-event thank you for checked-in attendees; includes link to leave a review on the event page.
 */
export function eventThankYouCheckedIn(displayName, eventName, reviewUrl) {
  const greeting = displayName ? `Hi ${escapeHtml(displayName)},` : 'Hi there,';
  const name = eventName || 'the event';
  return `
${buildParagraph(greeting, { marginBottom: 16 })}
${buildParagraph(`Thank you for attending <strong>${escapeHtml(name)}</strong>. We hope you had a great experience.`, { marginBottom: 16 })}
${buildParagraph('Your feedback helps us improve future events and helps other members discover what to expect.', { marginBottom: 24 })}
${buildCtaButton(reviewUrl, 'Add your review')}
${buildParagraph(`${buildSecondaryLink(reviewUrl, 'Open review link')}`, { marginBottom: 0 })}
${buildSignature()}
`;
}

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
 * 9b. Profile completion reminder (sent ~48 h after approval if profile is incomplete).
 * @param {string|null} firstName
 * @param {string} profileUrl - Full URL to the complete-profile page.
 */
export function profileReminderEmail(firstName, profileUrl) {
  const greeting = firstName ? `Hi ${escapeHtml(firstName)},` : 'Hi there,';
  return `
${buildParagraph(greeting, { marginBottom: 16 })}
${buildParagraph('Welcome to the AlmaLinks community! We noticed your profile still has a few fields missing.', { marginBottom: 16 })}
${buildParagraph('A complete profile helps other members find you, understand your background, and reach out for the right conversations. It only takes a few minutes.', { marginBottom: 24 })}
${buildCtaButton(profileUrl, 'Complete my profile')}
${buildParagraph('Fields that make the biggest difference: your bio, current role, company, phone, and LinkedIn profile.', { marginBottom: 16 })}
${buildParagraph('If you have any questions, just reply to this email.', { marginBottom: 0 })}
${buildSignature()}
`;
}

/**
 * 10. Admin test email — branded preview for Mailjet/Mailchimp tests.
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
