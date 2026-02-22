/**
 * AlmaLinks master email layout — shared wrapper for Mailjet (transactional) and Mailchimp (campaigns).
 * Full HTML template: Inter font, 700px, table-based. Alma logo header, dynamic body, "Thanks from our team", footer with Igani.
 *
 * Image URLs use getEmailAssetBaseUrl(); set EMAIL_LOGO_URL / EMAIL_IGANI_LOGO_URL for full URLs (PNG recommended).
 */

import { BRAND } from './email-design-system.js';
import { getAppBaseUrl, getEmailAssetBaseUrl } from './email-config.js';

function attr(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Build the full Alma Links email document (Inter, 700px, MSO-friendly).
 * Structure: View in browser → Alma logo → main content (innerHtml) → Thanks + logo → Footer (AlmaLinks.org, unsubscribe, Igani).
 *
 * @param {string} innerHtml - Main body HTML (heading, paragraphs, CTA, etc.)
 * @param {{ title?: string, showLogo?: boolean, appUrl?: string, unsubscribeUrl?: string }} [options]
 * @returns {string} Full HTML document
 */
export function wrapInAlmaTheme(innerHtml, options = {}) {
  const showLogo = options.showLogo !== false;
  const baseUrl = (options.appUrl && options.appUrl.replace(/\/$/, '')) || getAppBaseUrl();
  const unsubscribeUrl = options.unsubscribeUrl || null;
  const title = options.title != null ? String(options.title) : 'AlmaLinks';

  const assetBase = getEmailAssetBaseUrl().replace(/\/$/, '');
  const logoUrl =
    (process.env.EMAIL_LOGO_URL && process.env.EMAIL_LOGO_URL.trim()) ||
    `${assetBase}/logo.svg`;
  const iganiLogoUrl =
    (process.env.EMAIL_IGANI_LOGO_URL && process.env.EMAIL_IGANI_LOGO_URL.trim()) ||
    `${assetBase}/igani-logo-placeholder.svg`;

  const viewInBrowserUrl = baseUrl;
  const managePrefsUrl = baseUrl;

  const footerUnsubscribeBlock =
    unsubscribeUrl && unsubscribeUrl.trim()
      ? `To update your communication settings or to unsubscribe, use the links below.<br><strong><a href="${attr(managePrefsUrl)}" target="_blank" style="text-decoration: none; color: #4a4f5f;" rel="noopener">Manage Preferences</a> | <a href="${attr(unsubscribeUrl)}" target="_blank" style="text-decoration: none; color: #4a4f5f;" rel="noopener">Unsubscribe</a></strong><br><br>`
      : '';

  const logoBlock = showLogo
    ? `
					<table class="row row-2" align="center" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
						<tbody>
							<tr>
								<td>
									<table class="row-content stack" align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; border-radius: 0; color: #000000; width: 700px; margin: 0 auto;" width="700">
										<tbody>
											<tr>
												<td class="column column-1" width="100%" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; font-weight: 400; text-align: left; padding-bottom: 32px; padding-top: 24px; vertical-align: top;">
													<table class="image_block block-1" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
														<tr>
															<td class="pad" style="width:100%;">
																<div class="alignment" align="center">
																	<a href="${attr(viewInBrowserUrl)}" target="_blank" rel="noopener noreferrer"><img src="${attr(logoUrl)}" alt="AlmaLinks" style="display: block; height: auto; border: 0; max-width: 200px;" width="200" height="auto"></a>
																</div>
															</td>
														</tr>
													</table>
												</td>
											</tr>
										</tbody>
									</table>
								</td>
							</tr>
						</tbody>
					</table>`
    : '';

  return `<!DOCTYPE html>
<html xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office" lang="en">
<head>
	<title>${attr(title)}</title>
	<meta http-equiv="Content-Type" content="text/html; charset=utf-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<!--[if mso]>
	<xml><w:WordDocument xmlns:w="urn:schemas-microsoft-com:office:word"><w:DontUseAdvancedTypographyReadingMail/></w:WordDocument>
	<o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch><o:AllowPNG/></o:OfficeDocumentSettings></xml>
	<![endif]-->
	<!--[if !mso]><!-->
	<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&display=swap" rel="stylesheet" type="text/css">
	<!--<![endif]-->
	<style>
		* { box-sizing: border-box; }
		body { margin: 0; padding: 0; }
		a[x-apple-data-detectors] { color: inherit !important; text-decoration: inherit !important; }
		#MessageViewBody a { color: inherit; text-decoration: none; }
		p { line-height: inherit; }
		@media (max-width:720px) {
			.row-content { width: 100% !important; }
			.stack .column { width: 100%; display: block; }
			.mobile_hide { min-height: 0; max-height: 0; max-width: 0; overflow: hidden; font-size: 0px; display: none; }
		}
	</style>
</head>
<body class="body" style="background-color: #ffffff; margin: 0; padding: 0; -webkit-text-size-adjust: none; text-size-adjust: none;">
	<table class="nl-container" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; background-color: #ffffff;">
		<tbody>
			<tr>
				<td>
					<!-- View in browser -->
					<table class="row row-1" align="center" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
						<tbody>
							<tr>
								<td>
									<table class="row-content stack" align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; color: #000000; width: 700px; margin: 0 auto;" width="700">
										<tbody>
											<tr>
												<td class="column column-1" width="100%" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; font-weight: 400; text-align: left; background-color: #f9f9fb; vertical-align: top; border-radius: 8px;">
													<table class="paragraph_block block-1" width="100%" border="0" cellpadding="10" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; word-break: break-word;">
														<tr>
															<td class="pad">
																<div style="color:#040b22;direction:ltr;font-family:'Inter','Helvetica',sans-serif;font-size:14px;font-weight:400;letter-spacing:0px;line-height:1.2;text-align:center;">
																	<p style="margin: 0;"><a href="${attr(viewInBrowserUrl)}" target="_blank" rel="noopener" style="color:#040b22;text-decoration:underline;">View this email in your browser</a></p>
																</div>
															</td>
														</tr>
													</table>
												</td>
											</tr>
										</tbody>
									</table>
								</td>
							</tr>
						</tbody>
					</table>
					${logoBlock}
					<!-- Main content -->
					<table class="row row-3" align="center" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
						<tbody>
							<tr>
								<td>
									<table class="row-content stack" align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; border-radius: 0; color: #000000; width: 700px; margin: 0 auto;" width="700">
										<tbody>
											<tr>
												<td class="column column-1" width="16.666666666666668%" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; font-weight: 400; text-align: left; vertical-align: top;">
													<div class="spacer_block block-1 mobile_hide" style="height:60px;line-height:60px;font-size:1px;">&#8202;</div>
												</td>
												<td class="column column-2" width="66.66666666666667%" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; font-weight: 400; text-align: left; padding: 8px 32px 48px; vertical-align: top;">
													<div style="color:#040b22;direction:ltr;font-family:'Inter','Helvetica',sans-serif;font-size:16px;font-weight:400;line-height:1.5;">
														${innerHtml || ''}
													</div>
												</td>
												<td class="column column-3" width="16.666666666666668%" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; font-weight: 400; text-align: left; vertical-align: top;">
													<div class="spacer_block block-1 mobile_hide" style="height:60px;line-height:60px;font-size:1px;">&#8202;</div>
												</td>
											</tr>
										</tbody>
									</table>
								</td>
							</tr>
						</tbody>
					</table>
					<!-- Spacer -->
					<table class="row row-6" align="center" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
						<tbody>
							<tr>
								<td>
									<table class="row-content stack" align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; border-radius: 0; color: #000000; width: 700px; margin: 0 auto;" width="700">
										<tbody>
											<tr>
												<td class="column column-1" width="100%" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; font-weight: 400; text-align: left; vertical-align: top;">
													<div class="spacer_block block-1 mobile_hide" style="height:48px;line-height:48px;font-size:1px;">&#8202;</div>
												</td>
											</tr>
										</tbody>
									</table>
								</td>
							</tr>
						</tbody>
					</table>
					<!-- Thanks from our team + Alma logo -->
					<table class="row row-7" align="center" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
						<tbody>
							<tr>
								<td>
									<table class="row-content stack" align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; border-radius: 0; color: #000000; width: 700px; margin: 0 auto;" width="700">
										<tbody>
											<tr>
												<td class="column column-1" width="8.333333333333334%" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; font-weight: 400; text-align: left; vertical-align: top;">&#8202;</td>
												<td class="column column-2" width="83.33333333333333%" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; font-weight: 400; text-align: left; background-color: #f5f5f7; padding: 42px; vertical-align: top; border-radius: 24px;">
													<table class="heading_block block-1" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
														<tr>
															<td class="pad" style="padding-bottom:8px;padding-top:12px;text-align:center;width:100%;">
																<h2 style="margin: 0; color: #040b22; direction: ltr; font-family: 'Inter','Helvetica',sans-serif; font-size: 20px; font-weight: 300; letter-spacing: -1px; line-height: 1.2; text-align: center;">Thanks from our team</h2>
															</td>
														</tr>
													</table>
													<table class="image_block block-2" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
														<tr>
															<td class="pad" style="width:100%;">
																<div class="alignment" align="center">
																	<a href="${attr(viewInBrowserUrl)}" target="_blank" rel="noopener noreferrer"><img src="${attr(logoUrl)}" alt="AlmaLinks" style="display: block; height: auto; border: 0; max-width: 160px;" width="160" height="auto"></a>
																</div>
															</td>
														</tr>
													</table>
												</td>
												<td class="column column-3" width="8.333333333333334%" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; font-weight: 400; text-align: left; vertical-align: top;">&#8202;</td>
											</tr>
										</tbody>
									</table>
								</td>
							</tr>
						</tbody>
					</table>
					<!-- Spacer -->
					<table class="row row-8" align="center" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
						<tbody>
							<tr>
								<td>
									<table class="row-content stack" align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; border-radius: 0; color: #000000; width: 700px; margin: 0 auto;" width="700">
										<tbody>
											<tr>
												<td class="column column-1" width="100%" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; font-weight: 400; text-align: left; vertical-align: top;">
													<div class="spacer_block block-1 mobile_hide" style="height:72px;line-height:72px;font-size:1px;">&#8202;</div>
												</td>
											</tr>
										</tbody>
									</table>
								</td>
							</tr>
						</tbody>
					</table>
					<!-- Footer: AlmaLinks.org, tagline, unsubscribe, copyright, Igani -->
					<table class="row row-9" align="center" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
						<tbody>
							<tr>
								<td>
									<table class="row-content stack" align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; background-color: #f5f5f7; border-radius: 24px 24px 0 0; color: #000000; width: 700px; margin: 0 auto;" width="700">
										<tbody>
											<tr>
												<td class="column column-1" width="100%" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; font-weight: 400; text-align: left; vertical-align: top;">
													<table class="paragraph_block block-1" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; word-break: break-word;">
														<tr>
															<td class="pad" style="padding: 44px 24px 24px;">
																<div style="color:#4a4f5f;direction:ltr;font-family:'Inter','Helvetica',sans-serif;font-size:14px;font-weight:400;letter-spacing:0px;line-height:1.6;text-align:center;">
																	<p style="margin: 0 0 8px 0;">You received this email because you have an account or subscribed to updates from Alma Links.</p>
																	<p style="margin: 0 0 8px 0;"><a href="${attr(viewInBrowserUrl)}" target="_blank" style="text-decoration: none; color: #1e40ff;" rel="noopener">AlmaLinks.org</a></p>
																	<p style="margin: 0 0 8px 0;">A community of impact-driven leaders.</p>
																	<p style="margin: 16px 0 0 0;">${footerUnsubscribeBlock}© ${new Date().getFullYear()} Alma Links. All rights reserved.</p>
																</div>
															</td>
														</tr>
													</table>
													<table class="image_block block-2" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
														<tr>
															<td class="pad" style="width:100%;padding-bottom: 32px;">
																<div class="alignment" align="center">
																	<a href="https://www.igani.co" target="_blank" rel="noopener noreferrer"><img src="${attr(iganiLogoUrl)}" alt="Powered by igani" style="display: block; height: auto; border: 0; max-width: 80px;" width="80" height="auto"></a>
																</div>
															</td>
														</tr>
													</table>
												</td>
											</tr>
										</tbody>
									</table>
								</td>
							</tr>
						</tbody>
					</table>
				</td>
			</tr>
		</tbody>
	</table>
</body>
</html>`;
}

/**
 * Alma-themed link style (for inline use in content).
 */
export function almaLinkStyle() {
  return `color:${BRAND.primaryLight};text-decoration:none;font-weight:500;`;
}

export { BRAND };
