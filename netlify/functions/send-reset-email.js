const Mailjet = require('node-mailjet');

exports.handler = async (event, context) => {
  // Handle CORS preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
      body: JSON.stringify({ success: true })
    };
  }

  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        success: false, 
        error: 'Method not allowed' 
      })
    };
  }

  try {
    // Parse request body
    let requestBody;
    try {
      requestBody = JSON.parse(event.body);
    } catch (parseError) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          success: false, 
          error: 'Invalid JSON in request body' 
        })
      };
    }

    const { email, resetUrl } = requestBody;

    // Validate required fields
    if (!email || !resetUrl) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          success: false, 
          error: 'Missing required fields: email and resetUrl are required' 
        })
      };
    }

    // Get Mailjet credentials from environment variables
    const mailjetPublicKey = process.env.MJ_APIKEY_PUBLIC;
    const mailjetPrivateKey = process.env.MJ_APIKEY_PRIVATE;

    // Validate Mailjet credentials
    if (!mailjetPublicKey || !mailjetPrivateKey) {
      console.error('❌ Missing Mailjet credentials');
      return {
        statusCode: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          success: false, 
          error: 'Mailjet credentials not configured' 
        })
      };
    }

    // Initialize Mailjet client
    const mailjet = Mailjet.apiConnect(
      mailjetPublicKey,
      mailjetPrivateKey
    );

    console.log(`📧 Sending password reset email to ${email}`);

    // Send email via Mailjet
    const response = await mailjet.post('send', { version: 'v3.1' }).request({
      Messages: [
        {
          From: {
            Email: "info@almalinks.com",
            Name: "AlmaLinks"
          },
          To: [{ Email: email }],
          Subject: "Reset your password",
          TextPart: `
Hi there,

You requested a password reset. Click the link below to set a new password:

${resetUrl}

If you didn't request this, ignore this message.

– AlmaLinks
          `,
          HTMLPart: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
  <div style="text-align: center; margin-bottom: 20px;">
    <h1 style="color: #C8102E;">AlmaLinks</h1>
  </div>
  
  <p>Hi there,</p>
  
  <p>You requested a password reset. Click the button below to set a new password:</p>
  
  <div style="text-align: center; margin: 30px 0;">
    <a href="${resetUrl}" style="background: linear-gradient(135deg, #C8102E 0%, #0070FF 100%); color: white; padding: 12px 24px; text-decoration: none; border-radius: 50px; font-weight: bold; display: inline-block;">Reset Password</a>
  </div>
  
  <p>If you didn't request this, please ignore this message.</p>
  
  <p>– AlmaLinks Team</p>
  
  <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; text-align: center;">
    <p>If the button doesn't work, copy and paste this link into your browser:</p>
    <p style="word-break: break-all;">${resetUrl}</p>
  </div>
</div>
          `
        }
      ]
    });

    console.log('✅ Email sent successfully:', {
      to: email,
      status: response.response.status,
      timestamp: new Date().toISOString()
    });

    // Return success response
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        success: true,
        message: 'Password reset email sent successfully'
      })
    };

  } catch (error) {
    console.error('❌ Email Function Error:', {
      message: error.message,
      code: error.code,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });

    // Handle specific Mailjet errors
    let statusCode = 500;
    let errorMessage = 'Internal server error';

    if (error.statusCode) {
      statusCode = error.statusCode;
      errorMessage = error.message || 'Email sending failed';
    }

    return {
      statusCode: statusCode,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        success: false, 
        error: errorMessage,
        timestamp: new Date().toISOString()
      })
    };
  }
};