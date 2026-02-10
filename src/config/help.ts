/**
 * Help / support form URL. Used for "Report a bug" and support links.
 * Override via VITE_HELP_URL (e.g. in .env: VITE_HELP_URL=https://igani.co/help).
 */
export const HELP_URL =
  (import.meta.env.VITE_HELP_URL as string | undefined)?.trim() || 'https://igani.co/help';
