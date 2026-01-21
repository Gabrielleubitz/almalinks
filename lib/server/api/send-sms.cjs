const twilio = require('twilio');

module.exports = async function handler(req, res) {
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
    const { to, body } = req.body;

    // Validate required fields
    if (!to || !body) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: to and body are required' 
      });
    }

    // Get Twilio credentials from environment variables
    const twilioSid = process.env.TWILIO_SID;
    const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
    const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;

    // Validate Twilio credentials
    if (!twilioSid || !twilioAuthToken || !messagingServiceSid) {
      console.error('❌ Missing Twilio credentials');
      return res.status(500).json({ 
        success: false, 
        error: 'Twilio credentials not configured' 
      });
    }

    // Initialize Twilio client
    const client = twilio(twilioSid, twilioAuthToken);

    // Normalize phone number for Israeli format
    const normalizedPhone = normalizePhoneNumber(to);
    console.log(`📤 Sending SMS to ${normalizedPhone} via Twilio`);

    // Send SMS via Twilio
    const message = await client.messages.create({
      to: normalizedPhone,
      messagingServiceSid: messagingServiceSid,
      body: body
    });

    console.log('✅ SMS sent successfully:', {
      sid: message.sid,
      to: normalizedPhone,
      status: message.status,
      timestamp: new Date().toISOString()
    });

    // Return success response
    return res.status(200).json({ 
      success: true, 
      sid: message.sid,
      status: message.status,
      to: normalizedPhone,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ SMS Function Error:', {
      message: error.message,
      code: error.code,
      moreInfo: error.moreInfo,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });

    // Handle specific Twilio errors
    let statusCode = 500;
    let errorMessage = 'Internal server error';

    if (error.code) {
      // Twilio-specific errors
      switch (error.code) {
        case 21211:
          statusCode = 400;
          errorMessage = 'Invalid phone number format';
          break;
        case 21408:
          statusCode = 400;
          errorMessage = 'Permission to send SMS has not been enabled for the region';
          break;
        case 21614:
          statusCode = 400;
          errorMessage = 'Phone number is not a valid mobile number';
          break;
        case 20003:
          statusCode = 401;
          errorMessage = 'Authentication failed - check Twilio credentials';
          break;
        case 20404:
          statusCode = 404;
          errorMessage = 'Messaging Service SID not found';
          break;
        default:
          errorMessage = error.message || 'Twilio API error';
      }
    }

    return res.status(statusCode).json({ 
      success: false, 
      error: errorMessage,
      code: error.code,
      details: error.moreInfo,
      timestamp: new Date().toISOString()
    });
  }
};

// Helper function to normalize phone numbers
function normalizePhoneNumber(phone) {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');
  
  // If it starts with 0 (Israeli format), replace with +972
  if (digits.startsWith('0')) {
    return `+972${digits.substring(1)}`;
  }
  
  // If it doesn't start with +, assume it needs +972
  if (!phone.startsWith('+')) {
    return `+972${digits}`;
  }
  
  return phone;
}