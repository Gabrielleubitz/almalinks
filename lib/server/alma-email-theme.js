/**
 * Shared Alma Links email theme — consistent wrapper for all emails (Mailchimp campaigns + transactional).
 * Use for Mailjet transactional and Mailchimp campaign HTML so both share the same look.
 *
 * Brand colors (from tailwind): Alma Blue #009FE2, Alma Dark #201A5B, Alma Gold #FCAF17, Alma Light #DCE8F6.
 */

const BRAND = {
  blue: '#009FE2',
  dark: '#201A5B',
  gold: '#FCAF17',
  light: '#DCE8F6',
  blueHover: '#007AB8',
  text: '#1C1C1C',
  muted: '#6B7280',
  border: '#E5E7EB',
};

const DEFAULT_APP_URL = 'https://almalinks.org';

function getAppUrl() {
  const url = process.env.APP_URL || process.env.VERCEL_URL || DEFAULT_APP_URL;
  return url.startsWith('http') ? url.replace(/\/$/, '') : `https://${url}`;
}

/**
 * Wrap email body HTML in the Alma Links theme (header, footer, styles).
 * Safe for campaign and transactional; uses inline CSS for email clients.
 *
 * @param {string} innerHtml - Main content (body) HTML
 * @param {{ title?: string, showLogo?: boolean, appUrl?: string }} [options]
 * @returns {string} Full HTML document fragment (no doctype/html/body tags for Mailchimp; full for transactional if needed)
 */
export function wrapInAlmaTheme(innerHtml, options = {}) {
  const title = options.title != null ? String(options.title) : 'Alma Links';
  const showLogo = options.showLogo !== false;
  const baseUrl = (options.appUrl && options.appUrl.replace(/\/$/, '')) || getAppUrl();

  const headerBlock = showLogo
    ? `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BRAND.dark};">
      <tr>
        <td align="center" style="padding:24px 20px;">
          <a href="${baseUrl}" style="color:${BRAND.gold};font-family:Georgia,serif;font-size:24px;font-weight:bold;text-decoration:none;letter-spacing:0.02em;">Alma Links</a>
        </td>
      </tr>
    </table>`
    : '';

  const footerBlock = `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:32px;border-top:1px solid ${BRAND.border};">
      <tr>
        <td style="padding:20px 0;text-align:center;">
          <p style="margin:0;font-size:13px;color:${BRAND.muted};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
            You're receiving this from Alma Links.
          </p>
          <p style="margin:8px 0 0 0;font-size:12px;">
            <a href="${baseUrl}" style="color:${BRAND.blue};text-decoration:none;">Visit Alma Links</a>
          </p>
        </td>
      </tr>
    </table>`;

  const wrapped = `
  <div style="max-width:600px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:${BRAND.text};font-size:16px;line-height:1.5;">
    ${headerBlock}
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;">
      <tr>
        <td style="padding:28px 24px;">
          <div style="color:${BRAND.text};">
            ${innerHtml || ''}
          </div>
          ${footerBlock}
        </td>
      </tr>
    </table>
  </div>`;

  return wrapped.trim();
}

/**
 * Alma-themed link style (for use inside content when building HTML by hand).
 */
export function almaLinkStyle() {
  return `color:${BRAND.blue};text-decoration:none;`;
}

/**
 * Alma brand colors for use in inline styles.
 */
export { BRAND };
