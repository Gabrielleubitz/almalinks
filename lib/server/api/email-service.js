import Mailjet from 'node-mailjet';

export default async function handler(req, res) {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).json({ success: true });
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      error: 'Method not allowed' 
    });
  }

  try {
    const { type, email, name, ...additionalData } = req.body;

    // Validate required fields
    if (!email || !type) {
      return res.status(400).json({
        success: false,
        error: 'Email and type are required'
      });
    }

    // Initialize Mailjet
    const mailjet = new Mailjet({
      apiKey: process.env.MAILJET_API_KEY,
      apiSecret: process.env.MAILJET_SECRET_KEY
    });

    let templateId, variables, subject;

    // Configure email based on type
    switch (type) {
      case 'registration':
        templateId = process.env.MAILJET_REGISTRATION_TEMPLATE_ID;
        subject = 'Registration Confirmation - Alma Links';
        variables = {
          name: name || 'Valued Member',
          eventDetails: additionalData.eventDetails || {}
        };
        break;

      case 'acceptance':
        templateId = process.env.MAILJET_ACCEPTANCE_TEMPLATE_ID;
        subject = 'Welcome to Alma Links!';
        variables = {
          name: name || 'Valued Member'
        };
        break;

      case 'signup':
        templateId = process.env.MAILJET_SIGNUP_TEMPLATE_ID;
        subject = 'Welcome to Alma Links!';
        variables = {
          name: name || 'New Member'
        };
        break;

      case 'reset':
        templateId = process.env.MAILJET_RESET_TEMPLATE_ID;
        subject = 'Password Reset - Alma Links';
        variables = {
          name: name || 'User',
          resetLink: additionalData.resetLink || ''
        };
        break;

      case 'admin-notification':
        templateId = process.env.MAILJET_ADMIN_NOTIFICATION_TEMPLATE_ID;
        subject = additionalData.subject || 'Admin Notification - Alma Links';
        variables = {
          ...additionalData
        };
        break;

      case 'user-credentials':
        templateId = process.env.MAILJET_USER_CREDENTIALS_TEMPLATE_ID;
        subject = 'Your New Account Credentials - AlmaLinks';
        variables = {
          name: name || 'User',
          email: email,
          tempPassword: additionalData.tempPassword,
          loginUrl: additionalData.loginUrl || `${process.env.VERCEL_URL || 'http://localhost:3000'}/login`
        };
        break;

      default:
        return res.status(400).json({
          success: false,
          error: 'Invalid email type'
        });
    }

    // Send email
    const request = mailjet
      .post('send', { version: 'v3.1' })
      .request({
        Messages: [
          {
            From: {
              Email: process.env.FROM_EMAIL || 'noreply@wineandgrind.com',
              Name: process.env.FROM_NAME || 'Alma Links'
            },
            To: [
              {
                Email: email,
                Name: name || 'User'
              }
            ],
            TemplateID: parseInt(templateId),
            TemplateLanguage: true,
            Subject: subject,
            Variables: variables
          }
        ]
      });

    const result = await request;

    console.log('📧 Email sent successfully:', {
      type,
      email,
      messageId: result.body?.Messages?.[0]?.To?.[0]?.MessageID
    });

    res.status(200).json({
      success: true,
      message: 'Email sent successfully',
      messageId: result.body?.Messages?.[0]?.To?.[0]?.MessageID
    });

  } catch (error) {
    console.error('❌ Email error:', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to send email',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};