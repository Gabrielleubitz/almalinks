/**
 * Email Service - Admin Email Functionality
 * 
 * This service provides admin email functionality.
 * Currently implemented as a stub (for future Mailchimp integration).
 */

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
  details?: any;
}

/**
 * Send admin email (stub implementation)
 * 
 * Currently validates fields and logs payload in dev mode.
 * Returns success response as placeholder for future Mailchimp integration.
 * 
 * @param payload Email payload with to, subject, message, etc.
 * @returns Promise with email result
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
      : payload.to.split(',').map(email => email.trim()).filter(email => email);

    if (recipients.length === 0) {
      return {
        success: false,
        error: 'At least one valid recipient email is required'
      };
    }

    // Validate email format (basic validation)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalidEmails = recipients.filter(email => !emailRegex.test(email));
    
    if (invalidEmails.length > 0) {
      return {
        success: false,
        error: `Invalid email format: ${invalidEmails.join(', ')}`
      };
    }

    // Log payload in development mode only
    if (process.env.NODE_ENV === 'development') {
      console.log('[EmailService] sendAdminEmail called with payload:', {
        to: recipients,
        subject: payload.subject,
        messageLength: payload.message.length,
        fromName: payload.fromName,
        replyTo: payload.replyTo,
        eventId: payload.eventId
      });
    }

    // TODO: Replace this with actual Mailchimp API call
    // For now, return success response
    return {
      success: true,
      messageId: `stub-${Date.now()}`,
      details: {
        recipients: recipients.length,
        mode: 'stub',
        message: 'Email workflow coming soon. Mailchimp integration pending.'
      }
    };

  } catch (error: any) {
    console.error('❌ Error in sendAdminEmail:', error);
    return {
      success: false,
      error: error.message || 'Failed to send email'
    };
  }
}
