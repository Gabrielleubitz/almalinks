import mailchimp from "@mailchimp/mailchimp_transactional";

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
      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return email && emailRegex.test(email);
    });
}

/**
 * POST /api/notify-signup
 * Sends an email notification to admins when a new user signs up
 * 
 * Body: { name, email, joinRequestId }
 */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Use POST" });
  }

  try {
    const apiKey = process.env.MAILCHIMP_API_KEY || process.env.MANDRILL_API_KEY;
    if (!apiKey) {
      console.warn('⚠️ MAILCHIMP_API_KEY not configured - skipping admin notification');
      return res.status(200).json({ 
        ok: true, 
        skipped: true,
        reason: 'MAILCHIMP_API_KEY not configured' 
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

    const adminEmails = parseAdminEmails(adminEmailsEnv);
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

    // Build email content
    const subject = "New registration pending approval";
    const text = `A new user requested to join: ${name} (${email})

Join Request ID: ${joinRequestId}

Go to Admin → Pending Registrations to approve/reject.`;

    const client = mailchimp(apiKey);
    const fromEmail = process.env.EMAIL_FROM || "Communications@almalinks.org";

    // Send to all admin emails
    const emailPromises = adminEmails.map(adminEmail => 
      client.messages.send({
        message: {
          subject,
          text,
          from_email: fromEmail,
          to: [{ email: adminEmail, type: "to" }]
        }
      })
    );

    const results = await Promise.allSettled(emailPromises);
    
    // Check if any succeeded
    const succeeded = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    if (succeeded === 0) {
      // All failed
      const errors = results
        .filter(r => r.status === 'rejected')
        .map(r => r.reason?.message || String(r.reason));
      
      console.error('❌ Failed to send admin notification emails:', errors);
      return res.status(500).json({ 
        ok: false, 
        error: 'Failed to send notification emails',
        details: errors
      });
    }

    // At least one succeeded
    if (failed > 0) {
      console.warn(`⚠️ Some admin notification emails failed (${failed}/${adminEmails.length})`);
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
