/**
 * AlmaLinks master email layout — shared wrapper for Mailjet (transactional) and Mailchimp (campaigns).
 * Table-based, inline styles, 600px max-width. Logo header + footer with "Powered by igani".
 */

import { BRAND } from './email-design-system.js';
import { getAppBaseUrl } from './email-config.js';

const FONT_FAMILY = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif";

/**
 * Build header block: branded bar + logo (linked to app).
 * Logo URL: baseUrl/logo.svg (public asset).
 */
function buildHeader(baseUrl, showLogo = true) {
  if (!showLogo) return '';
  const logoUrl = `${baseUrl}/logo.svg`;
  return `
<table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="background:${BRAND.headerBg};">
  <tr>
    <td align="center" style="padding:24px 20px;">
      <a href="${baseUrl}" target="_blank" rel="noopener noreferrer" style="text-decoration:none;">
        <img src="${logoUrl}" alt="AlmaLinks" width="160" height="40" style="display:block;max-width:160px;height:auto;border:0;" />
      </a>
    </td>
  </tr>
</table>`;
}

/**
 * Build footer: AlmaLinks link, then subtle "Powered by igani" + logo.
 */
function buildFooter(baseUrl, unsubscribeUrl = null) {
  const iganiLogoUrl = `${baseUrl}/igani-logo.png`;
  const unsubscribeBlock =
    unsubscribeUrl && unsubscribeUrl.trim()
      ? `<p style="margin:12px 0 0 0;font-size:12px;color:${BRAND.muted};font-family:${FONT_FAMILY};"><a href="${unsubscribeUrl}" style="color:${BRAND.muted};text-decoration:underline;">Unsubscribe</a></p>`
      : '';
  return `
<table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="margin-top:32px;border-top:1px solid ${BRAND.border};">
  <tr>
    <td style="padding:24px 0 16px 0;text-align:center;">
      <p style="margin:0;font-size:14px;color:${BRAND.text};font-family:${FONT_FAMILY};">
        <a href="${baseUrl}" target="_blank" rel="noopener noreferrer" style="color:${BRAND.primaryLight};text-decoration:none;font-weight:500;">AlmaLinks.org</a>
      </p>
      <p style="margin:12px 0 0 0;font-size:12px;color:${BRAND.muted};font-family:${FONT_FAMILY};">
        A community of impact-driven leaders.
      </p>
      ${unsubscribeBlock}
    </td>
  </tr>
  <tr>
    <td style="padding:16px 0 24px 0;text-align:center;">
      <table align="center" cellpadding="0" cellspacing="0" border="0" role="presentation">
        <tr>
          <td style="font-size:11px;color:${BRAND.muted};font-family:${FONT_FAMILY};vertical-align:middle;">Powered by</td>
          <td style="padding-left:6px;vertical-align:middle;">
            <a href="https://www.igani.co" target="_blank" rel="noopener noreferrer" style="text-decoration:none;">
              <img src="${iganiLogoUrl}" alt="igani" width="56" height="20" style="display:block;max-width:56px;height:auto;border:0;" />
            </a>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;
}

/**
 * Wrap email body in AlmaLinks theme (header, container, footer).
 * Returns full HTML document for Mailjet/transactional; Mailchimp can use the same fragment.
 *
 * @param {string} innerHtml - Main content (body) HTML
 * @param {{ title?: string, showLogo?: boolean, appUrl?: string, unsubscribeUrl?: string }} [options]
 * @returns {string} Full HTML (with doctype for email clients)
 */
export function wrapInAlmaTheme(innerHtml, options = {}) {
  const showLogo = options.showLogo !== false;
  const baseUrl = (options.appUrl && options.appUrl.replace(/\/$/, '')) || getAppBaseUrl();
  const unsubscribeUrl = options.unsubscribeUrl || null;

  const header = buildHeader(baseUrl, showLogo);
  const footer = buildFooter(baseUrl, unsubscribeUrl);

  const wrapped = `
<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>${options.title != null ? String(options.title).replace(/</g, '&lt;') : 'AlmaLinks'}</title>
  <!--[if mso]>
  <noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:${FONT_FAMILY};font-size:16px;line-height:1.5;color:${BRAND.text};">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="background:#f3f4f6;">
    <tr>
      <td align="center" style="padding:24px 16px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="max-width:600px;background:${BRAND.background};border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.05);">
          <tr>
            <td>
              ${header}
              <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation">
                <tr>
                  <td style="padding:32px 24px;">
                    ${innerHtml || ''}
                    ${footer}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return wrapped.trim();
}

/**
 * Alma-themed link style (for inline use in content).
 */
export function almaLinkStyle() {
  return `color:${BRAND.primaryLight};text-decoration:none;font-weight:500;`;
}

export { BRAND };
