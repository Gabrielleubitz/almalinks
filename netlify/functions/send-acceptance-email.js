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

    const { email, name, eventDate, eventLocation } = requestBody;

    // Validate required fields
    if (!email || !name) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          success: false, 
          error: 'Missing required fields: email and name are required' 
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

    console.log(`📧 Sending acceptance email to ${email}`);

    // Default event details if not provided
    const defaultEventDate = eventDate || 'TBD - You\'ll receive details soon';
    const defaultEventLocation = eventLocation || 'Tel Aviv, Israel - Exact location will be shared';

    // Send email via Mailjet
    const response = await mailjet.post('send', { version: 'v3.1' }).request({
      Messages: [
        {
          From: {
            Email: "info@almalinks.com",
            Name: "AlmaLinks"
          },
          To: [{ Email: email }],
          Subject: "Welcome to AlmaLinks! Your Registration is Approved 🍷",
          TextPart: `
Hi ${name},

Great news! Your registration for AlmaLinks has been approved. 

Welcome to our community where bold ideas meet real conversations!

EVENT DETAILS:
Date: ${defaultEventDate}
Location: ${defaultEventLocation}

What to expect:
• Curated networking with founders, investors, and innovators
• Meaningful conversations over fine wine
• Exclusive insights from industry leaders
• A chance to shape the future through authentic connections

We'll send you detailed event information, including the exact address and schedule, closer to the event date.

If you have any questions, just reply to this email.

Looking forward to meeting you!

Cheers,
The AlmaLinks Team
          `,
          HTMLPart: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
  <div style="text-align: center; margin-bottom: 20px;">
    <h1 style="color: #C8102E;">🍷 Welcome to AlmaLinks!</h1>
  </div>
  
  <p>Hi ${name},</p>
  
  <p><strong>Great news! Your registration for AlmaLinks has been approved.</strong></p>
  
  <p>Welcome to our community where bold ideas meet real conversations!</p>
  
  <div style="background: linear-gradient(135deg, #C8102E 0%, #0070FF 100%); color: white; border-radius: 12px; padding: 20px; margin: 25px 0; text-align: center;">
    <h3 style="margin: 0 0 15px 0; color: white;">✅ YOUR SPOT IS CONFIRMED</h3>
  </div>
  
  <div style="background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 8px; padding: 20px; margin: 20px 0;">
    <h3 style="color: #C8102E; margin-top: 0;">📅 Event Details</h3>
    <table style="width: 100%;">
      <tr>
        <td style="padding: 8px 0; font-weight: bold; width: 80px;">Date:</td>
        <td style="padding: 8px 0;">${defaultEventDate}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; font-weight: bold;">Location:</td>
        <td style="padding: 8px 0;">${defaultEventLocation}</td>
      </tr>
    </table>
  </div>
  
  <h3 style="color: #C8102E;">What to expect:</h3>
  <ul style="line-height: 1.6;">
    <li>Curated networking with founders, investors, and innovators</li>
    <li>Meaningful conversations over fine wine</li>
    <li>Exclusive insights from industry leaders</li>
    <li>A chance to shape the future through authentic connections</li>
  </ul>
  
  <p>We'll send you detailed event information, including the exact address and schedule, closer to the event date.</p>
  
  <p>If you have any questions, just reply to this email.</p>
  
  <p><strong>Looking forward to meeting you!</strong></p>
  
  <p>Cheers,<br>The AlmaLinks Team</p>
  
  <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; text-align: center;">
    <p>AlmaLinks - Where Bold Ideas Meet Real Conversations</p>
    <p>Follow us: <a href="https://almalinks.com">almalinks.com</a></p>
  </div>
</div>
          `
        }
      ]
    });

    console.log('✅ Acceptance email sent successfully:', {
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
        message: 'Acceptance email sent successfully'
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