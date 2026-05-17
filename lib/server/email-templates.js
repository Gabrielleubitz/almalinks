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
import { getAppBaseUrl } from './email-config.js';

function membershipCriteriaHtml() {
  return `
${buildParagraph('If you are interested in recommending a prospective AlmaLinks member, please note the following criteria we look for in our members:', { marginBottom: 12 })}
<ul style="margin:0 0 20px 20px; padding:0; color:#1C1C1C; font-size:15px; line-height:1.7;">
  <li>Founder of a successful firm or start-up with a proven track record</li>
  <li>Executive at a multinational corporation</li>
  <li>Partner/decision-maker at a professional services firm (such as management consulting, law, or accounting)</li>
  <li>Partner at a venture capital fund or family office</li>
  <li>Exceptional academic achievements</li>
</ul>`;
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
${membershipCriteriaHtml()}
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
export function welcomeApproved(displayName, loginLink, eventsLink, setupLink) {
  const base = getAppBaseUrl();
  const criteriaUrl = `${base}/help`;
  const visionUrl = `${base}/terms`;
  const secureHref = setupLink || loginLink;
  const ctaLabel = setupLink ? 'Log in & set your password' : 'Log in to the portal';

  return `
${buildParagraph('We are delighted to officially welcome you to AlmaLinks.', { marginBottom: 16 })}
${buildParagraph('As a next step in your onboarding, please log in to our portal and take a moment to review and update your details. This will ensure you stay up to date with upcoming events, members, and ongoing conversations within the community and a final step to finalize your membership with us.', { marginBottom: 20 })}
${buildOrangeCtaButton(secureHref, ctaLabel)}
${setupLink ? buildParagraph('This secure link expires in <strong>1 hour</strong>. After setting your password, you can log in anytime at almalinks.org.', { marginBottom: 20 }) : ''}
${buildParagraph("AlmaLinks' key principle is supporting fellow members. In practical terms, here is a brief summary of what we expect from members of our community:", { marginBottom: 12 })}
${buildParagraph('<strong>Time Commitment</strong> - There is no specific commitment, and the time you are expected to devote is limited. However, members are expected to address requests from other members in a timely manner (requests may include making an introduction on behalf of a member, having a brief conversation with a member who has a question about a relevant professional topic, etc.).', { marginBottom: 12 })}
${buildParagraph('<strong>Support the Growth of the Organization</strong> - Suggest speakers and venues for events, interview candidates, and introduce high-quality prospective members to the organization.', { marginBottom: 12 })}
${buildParagraph('<strong>Financial Contribution</strong> - AlmaLinks does not charge a set fee to members. However, members are encouraged to consider an annual financial contribution.', { marginBottom: 12 })}
${buildParagraph("<strong>Event Participation</strong> - We understand members' schedules are demanding, but we recommend attending at least two events annually to gain more connections and establish relationships with like-minded individuals.", { marginBottom: 16 })}
${buildParagraph('Most importantly, members must embrace the AlmaLinks value system:', { marginBottom: 12 })}
${buildParagraph('<strong>Intellectual generosity</strong> - When successful people share work and experiences in the right context, everyone benefits.', { marginBottom: 8 })}
${buildParagraph('<strong>A culture of curiosity</strong> - Every member should want to learn and be willing to share their knowledge.', { marginBottom: 8 })}
${buildParagraph('<strong>Mutual respect</strong> - Our network is non-hierarchical. Everyone is seen, heard and valued.', { marginBottom: 8 })}
${buildParagraph('<strong>Openness</strong> - Our members meet one another with no pre-conditions or specific expectations. The intention is to explore the connection and see the potential.', { marginBottom: 16 })}
${buildParagraph("<strong>Peer-to-Peer Conduct to insure we maintain our community's safe environment:</strong>", { marginBottom: 8 })}
${buildParagraph('<strong>No Solicitations:</strong> Members must engage with one another in a spirit of collegiality and mutual respect. Unsolicited messages, particularly those of a commercial nature such as investment solicitations or &ldquo;invest in me / work with me&rdquo; requests, are strictly prohibited. Our network thrives on trust and generous knowledge exchange, not commercial pressures.', { marginBottom: 8 })}
${buildParagraph('<strong>Non-Political and Non-Religious:</strong> AlmaLinks is a non-political and non-religious organization. Members should refrain from initiating discussions or activities centered on political or religious advocacy to maintain the inclusivity and focus of our community.', { marginBottom: 16 })}
${buildParagraph(`If you are interested in recommending a prospective AlmaLinks member, please ${buildSecondaryLink(criteriaUrl, 'click here')} to learn more about the criteria we look for in our members.`, { marginBottom: 12 })}
${buildParagraph(`${buildSecondaryLink(visionUrl, 'Click here')} to learn more about AlmaLinks' vision and programming.`, { marginBottom: 16 })}
${buildParagraph('Please reach out to me with any questions.', { marginBottom: 12 })}
${buildParagraph('We hope you find your experience with AlmaLinks to be rewarding and fulfilling.', { marginBottom: 16 })}
${buildParagraph('Best,<br/>The AlmaLinks team', { marginBottom: 0 })}
`;
}

/**
 * Admin-triggered: introductory Zoom / next-step email to an applicant (Hadrat template).
 */
export function applicationIntroFollowUp(firstName, websiteUrl) {
  const site = (websiteUrl || getAppBaseUrl()).replace(/\/$/, '');
  const who = firstName ? escapeHtml(firstName) : '';
  const greeting = who ? `Hi ${who},` : 'Hi,';
  return `
${buildParagraph(greeting, { marginBottom: 16 })}
${buildParagraph('We were happy to receive your application. Thank you so much for your interest in AlmaLinks!', { marginBottom: 16 })}
${buildParagraph('I\'m Hadrat, Executive Director here at AlmaLinks — it\'s a pleasure to e-meet you.', { marginBottom: 16 })}
${buildParagraph('I\'d love to set up a quick introductory Zoom call so we can get to know each other better. It will be a great chance to hear more about you and share a bit about our values, goals, and programming.', { marginBottom: 16 })}
${buildParagraph('Let me know what time works best for you and we will schedule accordingly. I\'m based in Israel.', { marginBottom: 16 })}
${buildParagraph(`Below is a summary of ${buildSecondaryLink(site, 'what we look for in members')} (also on our website).`, { marginBottom: 12 })}
${membershipCriteriaHtml()}
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
${membershipCriteriaHtml()}
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
