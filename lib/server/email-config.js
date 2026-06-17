/**
 * Shared email configuration for all email steps (sign-up, approval, event registration, post-event).
 * APP_URL is used ONLY to build links (login, events, admin pages). It does NOT control recipients.
 * In production, emails always go to real recipients (ADMIN_NOTIFICATION_EMAILS, user email, etc.).
 *
 * Env: APP_URL (or VERCEL_URL) for links; EMAIL_FROM; TRANSACTIONAL_FROM_NAME then MAILCHIMP_FROM_NAME for display "From" name; ADMIN_NOTIFICATION_EMAILS.
 * Test overrides (TEST_EMAIL*, SIGNUP_TEST_RECIPIENT) apply ONLY when NODE_ENV !== 'production'.
 */

/** Default when no env is set; site is hosted at almalinks.vercel.app */
const DEFAULT_ORIGIN = 'https://almalinks.vercel.app';

/**
 * Base URL for the app (links in emails only). Prefer APP_URL so links use the correct domain.
 * On Vercel, VERCEL_URL is set automatically (e.g. almalinks.vercel.app).
 * @returns {string}
 */
export function getAppBaseUrl() {
  const url = process.env.APP_URL || process.env.VERCEL_URL || DEFAULT_ORIGIN;
  return url.startsWith('http') ? url.replace(/\/$/, '') : `https://${url}`;
}

/**
 * Base URL used for email image assets (logo, igani). Same as getAppBaseUrl so images load
 * from your deployment (e.g. almalinks.vercel.app). Set APP_URL or EMAIL_ASSET_BASE_URL to override.
 * @returns {string}
 */
export function getEmailAssetBaseUrl() {
  const url = process.env.APP_URL || process.env.EMAIL_ASSET_BASE_URL || process.env.VERCEL_URL || DEFAULT_ORIGIN;
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
 * Link to re-request access page (for rejected users to submit another request).
 * @returns {string}
 */
export function getReRequestLink() {
  return `${getAppBaseUrl()}/re-request-access`;
}

/** Member referral criteria (Google Drive). */
export function getMemberCriteriaUrl() {
  return (
    process.env.ALMA_MEMBER_CRITERIA_URL ||
    'https://drive.google.com/file/d/1R01pSwzHfS6RfC6k-fea-ASipdd8ix6E/view?usp=sharing'
  );
}

/** AlmaLinks vision & programming overview (DocSend). */
export function getAlmaVisionUrl() {
  return (
    process.env.ALMA_VISION_URL ||
    'https://docsend.com/view/h2ud3pab3dm8nfcr'
  );
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
 * From name for transactional emails and Mailchimp campaign defaults.
 * Primary: TRANSACTIONAL_FROM_NAME; fallback: MAILCHIMP_FROM_NAME; then AlmaLinks.
 * @returns {string}
 */
export function getFromName() {
  const n = (
    process.env.TRANSACTIONAL_FROM_NAME ||
    process.env.MAILCHIMP_FROM_NAME ||
    ''
  ).trim();
  return n || 'AlmaLinks';
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
