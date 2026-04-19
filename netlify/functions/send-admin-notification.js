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

    const { name, email, phone, work } = requestBody;

    // Validate required fields
    if (!name || !email || !phone || !work) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          success: false, 
          error: 'Missing required fields: name, email, phone, and work are required' 
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

    console.log(`📧 Sending admin notification for new registration: ${name} (${email})`);

    // Admin email addresses
    const adminEmails = [
      'admin@almalinks.com',
      'gabriel@almalinks.com', 
      'info@almalinks.com'
    ];

    // Send email via Mailjet
    const response = await mailjet.post('send', { version: 'v3.1' }).request({
      Messages: [
        {
          From: {
            Email: "info@almalinks.com",
            Name: "AlmaLinks System"
          },
          To: adminEmails.map(adminEmail => ({ Email: adminEmail })),
          Subject: "New Registration Pending Approval - AlmaLinks",
          TextPart: `
🔔 New Registration Pending Approval

A new user has registered for AlmaLinks and needs approval:

Name: ${name}
Email: ${email}
Phone: ${phone}
Work: ${work}

Please review and approve/reject this registration in the admin panel:
https://almalinks.com/admin

Time: ${new Date().toLocaleString()}

– AlmaLinks System
          `,
          HTMLPart: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
  <div style="text-align: center; margin-bottom: 20px;">
    <h1 style="color: #C8102E;">🔔 New Registration Pending</h1>
  </div>
  
  <p><strong>A new user has registered for AlmaLinks and needs approval:</strong></p>
  
  <div style="background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 8px; padding: 20px; margin: 20px 0;">
    <table style="width: 100%;">
      <tr>
        <td style="padding: 5px 0; font-weight: bold; width: 80px;">Name:</td>
        <td style="padding: 5px 0;">${name}</td>
      </tr>
      <tr>
        <td style="padding: 5px 0; font-weight: bold;">Email:</td>
        <td style="padding: 5px 0;"><a href="mailto:${email}">${email}</a></td>
      </tr>
      <tr>
        <td style="padding: 5px 0; font-weight: bold;">Phone:</td>
        <td style="padding: 5px 0;">${phone}</td>
      </tr>
      <tr>
        <td style="padding: 5px 0; font-weight: bold; vertical-align: top;">Work:</td>
        <td style="padding: 5px 0;">${work}</td>
      </tr>
    </table>
  </div>
  
  <div style="text-align: center; margin: 30px 0;">
    <a href="https://almalinks.com/admin" style="background: linear-gradient(135deg, #C8102E 0%, #0070FF 100%); color: white; padding: 12px 24px; text-decoration: none; border-radius: 50px; font-weight: bold; display: inline-block;">Review in Admin Panel</a>
  </div>
  
  <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; text-align: center;">
    <p>Registration Time: ${new Date().toLocaleString()}</p>
    <p>AlmaLinks Admin Notification System</p>
  </div>
</div>
          `
        }
      ]
    });

    console.log('✅ Admin notification email sent successfully:', {
      for: `${name} (${email})`,
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
        message: 'Admin notification email sent successfully'
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