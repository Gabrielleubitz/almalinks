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

    const { recipient, subject, message } = requestBody;

    // Validate required fields
    if (!recipient || !subject || !message) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          success: false, 
          error: 'Missing required fields: recipient, subject, and message are required' 
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

    console.log(`📧 Sending test email to ${recipient}`);

    // Send email via Mailjet
    const response = await mailjet.post('send', { version: 'v3.1' }).request({
      Messages: [
        {
          From: {
            Email: "info@almalinks.com",
            Name: "AlmaLinks"
          },
          To: [{ Email: recipient }],
          Subject: subject,
          TextPart: message,
          HTMLPart: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
  <div style="text-align: center; margin-bottom: 20px;">
    <h1 style="color: #C8102E;">AlmaLinks</h1>
  </div>
  
  <p>${message.replace(/\n/g, '<br>')}</p>
  
  <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; text-align: center;">
    <p>This is a test email from the AlmaLinks admin panel.</p>
    <p>Timestamp: ${new Date().toISOString()}</p>
  </div>
</div>
          `
        }
      ]
    });

    console.log('✅ Test email sent successfully:', {
      to: recipient,
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
        message: 'Test email sent successfully',
        details: {
          recipient,
          subject,
          timestamp: new Date().toISOString()
        }
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