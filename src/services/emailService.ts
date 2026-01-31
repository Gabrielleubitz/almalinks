/**
 * Email Service - Admin Email Functionality
 *
 * Sends admin emails via the backend /api/send-bulk-email endpoint (Mailchimp/Mandrill).
 * Requires admin authentication; the API validates the Bearer token.
 */

import { apiRequest } from '../utils/apiClient';

export interface AdminEmailPayload {
  to: string | string[]; // Email address(es) - can be comma-separated string or array
  subject: string;
  message: string;
  fromName?: string; // Optional sender name
  replyTo?: string; // Optional reply-to address
  eventId?: string; // Optional event ID for context
}

export interface AdminEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  details?: {
    sent?: number;
    failed?: number;
    total?: number;
    errors?: Array<{ email: string; reason: string }>;
  };
}

/**
 * Send admin email to one or more recipients.
 * Calls /api/send-bulk-email with mode 'individuals' and an emails array.
 * Requires the current user to be authenticated as admin.
 *
 * @param payload Email payload with to, subject, message, etc.
 * @returns Promise with email result (success, sent count, or error)
 */
export async function sendAdminEmail(payload: AdminEmailPayload): Promise<AdminEmailResult> {
  try {
    // Validate required fields
    if (!payload.to) {
      return {
        success: false,
        error: 'Recipient email(s) are required'
      };
    }

    if (!payload.subject || !payload.subject.trim()) {
      return {
        success: false,
        error: 'Subject is required'
      };
    }

    if (!payload.message || !payload.message.trim()) {
      return {
        success: false,
        error: 'Message body is required'
      };
    }

    // Normalize 'to' field - handle both string and array
    const recipients = Array.isArray(payload.to)
      ? payload.to
      : payload.to.split(',').map((email) => email.trim()).filter((email) => email);

    if (recipients.length === 0) {
      return {
        success: false,
        error: 'At least one valid recipient email is required'
      };
    }

    // Validate email format (basic validation)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalidEmails = recipients.filter((email) => !emailRegex.test(email));

    if (invalidEmails.length > 0) {
      return {
        success: false,
        error: `Invalid email format: ${invalidEmails.join(', ')}`
      };
    }

    const response = await apiRequest('/api/send-bulk-email', {
      method: 'POST',
      body: JSON.stringify({
        mode: 'individuals',
        emails: recipients,
        subject: payload.subject.trim(),
        text: payload.message.trim(),
        fromName: payload.fromName?.trim() || undefined
      })
    });

    let data: { ok?: boolean; error?: string; sent?: number; failed?: number; total?: number; errors?: unknown[] } = {};
    try {
      const text = await response.text();
      if (text) {
        data = JSON.parse(text);
      }
    } catch {
      return {
        success: false,
        error: response.ok ? 'Failed to send email' : `Server error (${response.status}). Try again or check Vercel logs.`
      };
    }

    if (!response.ok) {
      return {
        success: false,
        error: (data && typeof data.error === 'string') ? data.error : 'Failed to send email'
      };
    }

    if (!data.ok) {
      return {
        success: false,
        error: data.error || 'Failed to send email',
        details: data.errors ? { errors: data.errors } : undefined
      };
    }

    const sent = data.sent ?? 0;
    const failed = data.failed ?? 0;
    const total = data.total ?? recipients.length;

    if (sent === 0 && total > 0) {
      return {
        success: false,
        error: data.error || 'No emails were sent',
        details: { sent, failed, total, errors: data.errors }
      };
    }

    return {
      success: true,
      messageId: `bulk-${sent}-${Date.now()}`,
      details: { sent, failed, total, errors: data.errors }
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to send email';
    console.error('❌ Error in sendAdminEmail:', error);
    return {
      success: false,
      error: message
    };
  }
}
