import { getAdminPendingLink, getAppBaseUrl, getTestRecipient } from '../email-config.js';
import { sendTransactionalEmail } from '../transactional-email.js';

function maskEmail(email) {
  if (!email || typeof email !== 'string') return '***';
  const parts = email.trim().split('@');
  if (parts.length !== 2) return '***';
  const local = parts[0];
  const domain = parts[1];
  const maskedLocal = local.length <= 2 ? '**' : local.slice(0, 1) + '***' + local.slice(-1);
  return `${maskedLocal}@${domain}`;
}

function isEmailConfigured() {
  const mailjet = Boolean(
    (process.env.MAILJET_API_KEY || process.env.MJ_APIKEY_PUBLIC || '').trim() &&
    (process.env.MAILJET_SECRET_KEY || process.env.MJ_APIKEY_PRIVATE || '').trim()
  );
  const mandrill = Boolean((process.env.MAILCHIMP_API_KEY || '').trim());
  return mailjet || mandrill;
}

/**
 * Helper to parse comma-separated emails into an array
 */
function parseAdminEmails(envValue) {
  if (!envValue || typeof envValue !== 'string') {
    return [];
  }
  return envValue
    .split(',')
    .map(email => email.trim())
    .filter(email => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return email && emailRegex.test(email);
    });
}

/**
 * POST /api/notify-signup
 * Sends an email notification to admins when a new user signs up.
 * Uses shared transactional-email (Mailjet or Mandrill) with Alma theme (logos). Includes link to pending registrations.
 * Body: { name, email, joinRequestId }
 */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Use POST" });
  }

  try {
    if (!isEmailConfigured()) {
      console.warn('⚠️ Neither Mailjet nor MAILCHIMP_API_KEY (Mandrill) configured - skipping admin notification');
      return res.status(200).json({
        ok: true,
        skipped: true,
        reason: 'Email not configured (set Mailjet or MAILCHIMP_API_KEY)'
      });
    }

    const adminEmailsEnv = process.env.ADMIN_NOTIFICATION_EMAILS;
    if (!adminEmailsEnv) {
      console.warn('⚠️ ADMIN_NOTIFICATION_EMAILS not configured - skipping admin notification');
      return res.status(200).json({
        ok: true,
        skipped: true,
        reason: 'ADMIN_NOTIFICATION_EMAILS not configured'
      });
    }

    let adminEmails = parseAdminEmails(adminEmailsEnv);
    const testRecipient = getTestRecipient('signup_admin');
    if (testRecipient) {
      adminEmails = [testRecipient];
      console.log('[notify-signup] Development: sending to test recipient only (not production)');
    }
    if (adminEmails.length === 0) {
      console.warn('⚠️ No valid admin emails found in ADMIN_NOTIFICATION_EMAILS');
      return res.status(200).json({
        ok: true,
        skipped: true,
        reason: 'No valid admin emails found'
      });
    }

    const body = req.body || {};
    const { name, email, joinRequestId } = body;

    if (!name || !email || !joinRequestId) {
      return res
        .status(400)
        .json({ ok: false, error: "Missing required fields: name, email, joinRequestId" });
    }

    const baseUrl = getAppBaseUrl();
    const pendingLink = getAdminPendingLink();
    console.log('[notify-signup] Links base (APP_URL):', baseUrl);
    console.log('[notify-signup] Admin recipients:', adminEmails.length, adminEmails.map(maskEmail).join(', '));

    const subject = "New registration pending approval";
    const text = `A new user requested to join: ${name} (${email})

Join Request ID: ${joinRequestId}

Review and approve/reject: ${pendingLink}`;

    // Body HTML (wrapped in Alma theme with logos by sendTransactionalEmail)
    const bodyHtml = `
<p style="margin:0 0 16px 0; font-size:16px; line-height:1.5; color:#1C1C1C;">A new user has requested to join Alma Links.</p>
<p style="margin:0 0 16px 0; font-size:16px; line-height:1.5; color:#1C1C1C;"><strong>${escapeHtml(name)}</strong> (${escapeHtml(email)})</p>
<p style="margin:0 0 8px 0; font-size:14px; color:#6B7280;">Join Request ID: <code>${escapeHtml(joinRequestId)}</code></p>
<p style="margin:0 0 24px 0; font-size:16px; line-height:1.5; color:#1C1C1C;">Please review and approve or reject the registration.</p>
<p style="margin:0 0 8px 0;"><a href="${escapeHtml(pendingLink)}" target="_blank" rel="noopener" style="display:inline-block; background:#201A5B; color:#fff; text-decoration:none; padding:12px 24px; border-radius:8px; font-weight:600;">Open Pending Registrations</a></p>
<p style="margin:16px 0 0 0; font-size:14px; color:#6B7280;"><a href="${escapeHtml(pendingLink)}" target="_blank" rel="noopener">${escapeHtml(pendingLink)}</a></p>`;

    let succeeded = 0;
    let failed = 0;
    for (const adminEmail of adminEmails) {
      const result = await sendTransactionalEmail({
        to: adminEmail,
        subject,
        html: bodyHtml,
        text,
      });
      if (result.ok) succeeded++;
      else {
        failed++;
        console.warn('[notify-signup] Failed to send to', maskEmail(adminEmail), result.status, result.rejectReason);
      }
    }

    if (succeeded === 0) {
      console.error('[notify-signup] All admin notification emails failed');
      return res.status(500).json({
        ok: false,
        error: 'Failed to send notification emails',
      });
    }
    if (failed > 0) {
      console.warn(`[notify-signup] Some admin notification emails failed (${failed}/${adminEmails.length})`);
    }

    console.log(`✅ Admin notification sent to ${succeeded} admin(s) for join request: ${joinRequestId}`);

    return res.status(200).json({ 
      ok: true, 
      sentTo: succeeded,
      total: adminEmails.length,
      failed: failed
    });
  } catch (err) {
    console.error('❌ Error in notify-signup:', err?.message || err);
    const isDev = process.env.NODE_ENV === 'development';
    return res.status(500).json({
      ok: false,
      error: isDev ? (err?.message || String(err)) : 'Failed to send admin notification'
    });
  }
}

function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
