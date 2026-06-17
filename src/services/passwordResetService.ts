/**
 * Client-side password reset — delegates to /api/password-reset (server tokens, valid until used).
 */
export class PasswordResetService {
  static async createResetToken(_email: string): Promise<string | null> {
    // Legacy no-op: request flow sends email server-side.
    return null;
  }

  static async sendResetEmail(email: string): Promise<boolean> {
    try {
      const response = await fetch('/api/password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'request', email }),
      });
      return response.ok;
    } catch (error) {
      console.error('❌ Error sending reset email:', error);
      return false;
    }
  }

  static async verifyToken(token: string): Promise<{ valid: boolean; email?: string }> {
    try {
      const response = await fetch('/api/password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify', token }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) return { valid: false };
      return { valid: true, email: data.email };
    } catch (error) {
      console.error('❌ Error verifying token:', error);
      return { valid: false };
    }
  }

  static async resetPassword(token: string, newPassword: string): Promise<boolean> {
    try {
      const response = await fetch('/api/password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'confirm', token, newPassword }),
      });
      const data = await response.json().catch(() => ({}));
      return response.ok && !!data.ok;
    } catch (error) {
      console.error('❌ Error resetting password:', error);
      return false;
    }
  }
}
