/**
 * AlmaLinks email design system.
 * Shared tokens and layout primitives for Mailjet + Mailchimp.
 *
 * Design decisions:
 * - BRAND: Matches site (index.css): primary #0B2B6B, primaryLight #2E7FEF, muted #6B7280, etc.
 * - Layout: ~600px max-width, 8pt grid (padding 16/24/32px). Table-based + inline styles for Outlook/Gmail.
 * - Typography: headline 24px/700, subhead 18px/600, body 16px, CTA 16px/600. Safe stack: -apple-system, Segoe UI, Roboto.
 * - CTAs: Single primary button (dark blue); secondary links use primaryLight. Date/location in a subtle card block.
 * - Mailjet and Mailchimp both use wrapInAlmaTheme() + these helpers so all emails share the same header, footer, and component styles.
 */

// From site: --brand-blue-dark, --brand-blue-light, --brand-mid, --text, --muted, --border
export const BRAND = {
  primary: '#0B2B6B',
  primaryLight: '#2E7FEF',
  primaryMid: '#1E56B3',
  text: '#1C1C1C',
  muted: '#6B7280',
  border: '#E5E7EB',
  background: '#FFFFFF',
  headerBg: '#0B2B6B',
};

const FONT_FAMILY = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif";

function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Primary CTA button (table-based for email clients).
 */
export function buildCtaButton(href, label) {
  const url = escapeHtml(href);
  const text = escapeHtml(label);
  return `
<table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation">
  <tr>
    <td align="center" style="padding:24px 0 8px 0;">
      <a href="${url}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:14px 32px;background:${BRAND.primary};color:#ffffff !important;font-family:${FONT_FAMILY};font-size:16px;font-weight:600;text-decoration:none;border-radius:8px;">${text}</a>
    </td>
  </tr>
</table>`;
}

/**
 * Secondary text link (no button).
 */
export function buildSecondaryLink(href, label) {
  const url = escapeHtml(href);
  const text = escapeHtml(label);
  return `<a href="${url}" target="_blank" rel="noopener noreferrer" style="color:${BRAND.primaryLight};text-decoration:none;font-weight:500;">${text}</a>`;
}

/**
 * Styled date + location block for events.
 */
export function buildDateLocationBlock(dateText, locationText) {
  const date = escapeHtml(dateText || '');
  const loc = escapeHtml(locationText || '');
  return `
<table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="background:${BRAND.border};border-radius:8px;margin:16px 0;">
  <tr>
    <td style="padding:16px 20px;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        ${date ? `<tr><td style="font-size:13px;color:${BRAND.muted};font-family:${FONT_FAMILY};padding-bottom:4px;">Date</td></tr><tr><td style="font-size:16px;color:${BRAND.text};font-weight:600;">${date}</td></tr>` : ''}
        ${loc ? `<tr><td style="padding-top:12px;font-size:13px;color:${BRAND.muted};font-family:${FONT_FAMILY};padding-bottom:4px;">Location</td></tr><tr><td style="font-size:16px;color:${BRAND.text};font-weight:500;">${loc}</td></tr>` : ''}
      </table>
    </td>
  </tr>
</table>`;
}

/**
 * Headline (h1) style for email body.
 */
export function buildHeadline(text) {
  return `<h1 style="margin:0 0 8px 0;font-family:${FONT_FAMILY};font-size:24px;font-weight:700;color:${BRAND.text};line-height:1.3;">${escapeHtml(text)}</h1>`;
}

/**
 * Subheadline style.
 */
export function buildSubheadline(text) {
  return `<p style="margin:0 0 16px 0;font-family:${FONT_FAMILY};font-size:18px;font-weight:600;color:${BRAND.text};">${escapeHtml(text)}</p>`;
}

/**
 * Body paragraph.
 */
export function buildParagraph(htmlOrText, options = {}) {
  const style = `margin:0 0 ${options.marginBottom !== undefined ? options.marginBottom : 16}px 0;font-family:${FONT_FAMILY};font-size:16px;line-height:1.5;color:${BRAND.text};`;
  const content = htmlOrText && htmlOrText.includes('<') ? htmlOrText : escapeHtml(htmlOrText || '');
  return `<p style="${style}">${content}</p>`;
}

/**
 * Signature line (e.g. "— Alma Links Team").
 */
export function buildSignature(text = '— Alma Links Team') {
  return `<p style="margin:24px 0 0 0;font-family:${FONT_FAMILY};font-size:15px;color:${BRAND.muted};">${escapeHtml(text)}</p>`;
}

/**
 * Format ISO date for display in emails.
 */
export function formatEmailDate(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  } catch {
    return String(iso);
  }
}

export { escapeHtml };
