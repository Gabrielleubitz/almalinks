/**
 * Help / support form URL. Used for "Report a bug" and support links.
 * AlmaLinks-specific form with src param. Override via VITE_HELP_URL if needed.
 */
export const HELP_URL =
  (import.meta.env.VITE_HELP_URL as string | undefined)?.trim() || 'https://igani.co/help/almalinks?src=almalinks';
