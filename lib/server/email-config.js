/**
 * Shared email configuration for all email steps (sign-up, approval, event registration, post-event).
 * APP_URL is used ONLY to build links (login, events, admin pages). It does NOT control recipients.
 * In production, emails always go to real recipients (ADMIN_NOTIFICATION_EMAILS, user email, etc.).
 *
 * Env: APP_URL (or VERCEL_URL) for links; EMAIL_FROM, MAILCHIMP_FROM_NAME; ADMIN_NOTIFICATION_EMAILS.
 * Test overrides (TEST_EMAIL*, SIGNUP_TEST_RECIPIENT) apply ONLY when NODE_ENV !== 'production'.
 */

/**
 * Base URL for the app (links in emails only). Prefer APP_URL so links use the correct domain.
 * @returns {string}
 */
export function getAppBaseUrl() {
  const url = process.env.APP_URL || process.env.VERCEL_URL || 'https://almalinks.org';
  return url.startsWith('http') ? url.replace(/\/$/, '') : `https://${url}`;
}

/**
 * Link to admin pending registrations (for admin notification emails).
 * @returns {string}
 */
export function getAdminPendingLink() {
  return `${getAppBaseUrl()}/admin/pending-registrations`;
}

/**
 * Link to login page (for user emails: signup confirmation, acceptance).
 * @returns {string}
 */
export function getLoginLink() {
  return `${getAppBaseUrl()}/login`;
}

/**
 * Link to events page (for post-signup / acceptance).
 * @returns {string}
 */
export function getEventsLink() {
  return `${getAppBaseUrl()}/events`;
}

/**
 * From email for transactional emails. Same logic across notify-signup, notify-user-signup, etc.
 * @returns {string}
 */
export function getFromEmail() {
  return (
    process.env.EMAIL_FROM ||
    process.env.MAILCHIMP_REPLY_TO ||
    'Communications@almalinks.org'
  );
}

/**
 * From name for transactional emails.
 * @returns {string}
 */
export function getFromName() {
  return process.env.MAILCHIMP_FROM_NAME || 'Alma Links';
}

/**
 * Test override: ONLY when NODE_ENV !== 'production'. In production always returns null.
 * When in development, can redirect to a test address instead of the real recipient.
 * @param {string} step - One of 'signup_user' | 'signup_admin' | 'acceptance' | 'registration' | 'post_event'
 * @returns {string|null} - Override email or null (always null in production)
 */
export function getTestRecipient(step) {
  if (process.env.NODE_ENV === 'production') {
    return null;
  }
  const key = `TEST_EMAIL_${step.toUpperCase().replace(/-/g, '_')}`;
  if (process.env[key]) return process.env[key].trim();
  if (process.env.TEST_EMAIL) return process.env.TEST_EMAIL.trim();
  if (step === 'signup_user' && process.env.SIGNUP_TEST_RECIPIENT) {
    return process.env.SIGNUP_TEST_RECIPIENT.trim();
  }
  return null;
}
