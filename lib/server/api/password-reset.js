/**
 * POST /api/password-reset
 *
 * Body:
 *   { action: 'request', email }
 *   { action: 'verify', token }
 *   { action: 'confirm', token, newPassword }
 */
import '../firebase-init.js';
import { sendTransactionalEmail } from '../transactional-email.js';
import { passwordReset } from '../email-templates.js';
import {
  createPasswordResetTokenForEmail,
  verifyPasswordResetToken,
  resetPasswordWithToken,
} from '../password-reset-token.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const body = typeof req.body === 'object' && req.body !== null ? req.body : {};
    const action = String(body.action || '').trim();

    if (action === 'request') {
      const email = String(body.email || '').trim().toLowerCase();
      if (!email) {
        return res.status(400).json({ ok: false, error: 'Email is required' });
      }

      const tokenResult = await createPasswordResetTokenForEmail(email);
      if (!tokenResult.ok) {
        return res.status(500).json({ ok: false, error: tokenResult.error || 'Failed to create reset link' });
      }

      if (!tokenResult.skipped && tokenResult.resetUrl) {
        const displayName = email.split('@')[0] || 'there';
        const subject = 'Reset your password — AlmaLinks';
        const html = passwordReset(displayName, tokenResult.resetUrl);
        const text = `Hi ${displayName},\n\nUse this link to reset your password:\n${tokenResult.resetUrl}\n\n— AlmaLinks Team`;

        const sendResult = await sendTransactionalEmail({
          to: email,
          subject,
          html,
          text,
          template: 'password-reset',
          category: 'password-reset',
        });

        if (!sendResult.ok) {
          console.error('[password-reset] send failed:', sendResult.error);
          return res.status(500).json({ ok: false, error: 'Failed to send reset email' });
        }
      }

      return res.status(200).json({ ok: true });
    }

    if (action === 'verify') {
      const token = String(body.token || '').trim();
      const result = await verifyPasswordResetToken(token);
      if (!result.valid) {
        return res.status(400).json({ ok: false, error: 'Invalid or expired reset link' });
      }
      return res.status(200).json({ ok: true, email: result.email });
    }

    if (action === 'confirm') {
      const token = String(body.token || '').trim();
      const newPassword = String(body.newPassword || '');
      const result = await resetPasswordWithToken(token, newPassword);
      if (!result.ok) {
        return res.status(400).json({ ok: false, error: result.error || 'Failed to reset password' });
      }
      return res.status(200).json({ ok: true, email: result.email });
    }

    return res.status(400).json({ ok: false, error: 'Invalid action' });
  } catch (err) {
    console.error('[password-reset]', err?.message || err);
    return res.status(500).json({ ok: false, error: err?.message || 'Server error' });
  }
}
