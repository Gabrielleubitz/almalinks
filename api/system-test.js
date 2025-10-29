const Mailjet = require('node-mailjet');
const { OpenAI } = require('openai');
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
    const { testType, ...params } = req.body;

    if (!testType) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing testType parameter' 
      });
    }

    switch (testType) {
      case 'email':
        return await testEmail(params, res);
      case 'sms':
        return await testSMS(params, res);
      case 'gpt':
        return await testGPT(params, res);
      default:
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid testType. Must be: email, sms, or gpt' 
        });
    }

  } catch (error) {
    console.error('❌ System Test Function Error:', {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });

    return res.status(500).json({ 
      success: false, 
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
};

// Email test function
async function testEmail(params, res) {
  const { recipient, subject, message } = params;

  if (!recipient || !subject || !message) {
    return res.status(400).json({ 
      success: false, 
      error: 'Missing required fields: recipient, subject, and message are required' 
    });
  }

  const mailjetApiKey = process.env.MJ_APIKEY_PUBLIC;
  const mailjetSecretKey = process.env.MJ_APIKEY_PRIVATE;

  if (!mailjetApiKey || !mailjetSecretKey) {
    console.error('❌ Missing Mailjet credentials');
    return res.status(500).json({ 
      success: false, 
      error: 'Email service credentials not configured' 
    });
  }

  const mailjet = Mailjet.apiConnect(mailjetApiKey, mailjetSecretKey);

  console.log(`📧 Sending test email to ${recipient}`);

  const result = await mailjet.post('send', { version: 'v3.1' }).request({
    Messages: [
      {
        From: {
          Email: 'noreply@almalinks.org',
          Name: 'AlmaLinks'
        },
        To: [
          {
            Email: recipient,
            Name: recipient.split('@')[0]
          }
        ],
        Subject: subject,
        TextPart: message,
        HTMLPart: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #7C3AED; margin: 0;">AlmaLinks</h1>
              <p style="color: #6B7280; margin: 5px 0;">System Test Email</p>
            </div>
            
            <div style="background: #F9FAFB; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p style="color: #374151; line-height: 1.6; margin: 0;">${message}</p>
            </div>
            
            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #E5E7EB;">
              <p style="color: #9CA3AF; font-size: 14px; margin: 0;">
                This is a test email from the AlmaLinks admin system.
              </p>
              <p style="color: #9CA3AF; font-size: 12px; margin: 5px 0 0 0;">
                Sent at ${new Date().toLocaleString()}
              </p>
            </div>
          </div>
        `
      }
    ]
  });

  console.log('✅ Test email sent successfully');

  return res.status(200).json({ 
    success: true, 
    messageId: result.body.Messages[0].To[0].MessageID,
    recipient: recipient,
    subject: subject,
    timestamp: new Date().toISOString()
  });
}

// SMS test function
async function testSMS(params, res) {
  const { to, body } = params;

  if (!to || !body) {
    return res.status(400).json({ 
      success: false, 
      error: 'Missing required fields: to and body are required' 
    });
  }

  const twilioSid = process.env.TWILIO_SID;
  const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;

  if (!twilioSid || !twilioAuthToken || !messagingServiceSid) {
    console.error('❌ Missing Twilio credentials');
    return res.status(500).json({ 
      success: false, 
      error: 'Twilio credentials not configured' 
    });
  }

  const client = twilio(twilioSid, twilioAuthToken);
  
  // Normalize phone number for Israeli format
  const normalizedPhone = normalizePhoneNumber(to);
  console.log(`📤 Sending test SMS to ${normalizedPhone} via Twilio`);

  const message = await client.messages.create({
    to: normalizedPhone,
    messagingServiceSid: messagingServiceSid,
    body: body
  });

  console.log('✅ Test SMS sent successfully');

  return res.status(200).json({ 
    success: true, 
    sid: message.sid,
    status: message.status,
    to: normalizedPhone,
    timestamp: new Date().toISOString()
  });
}

// GPT test function
async function testGPT(params, res) {
  const { prompt } = params;

  if (!prompt) {
    return res.status(400).json({ 
      success: false, 
      error: 'Missing required field: prompt' 
    });
  }

  const openaiApiKey = process.env.OPENAI_API_KEY;

  if (!openaiApiKey) {
    console.error('❌ Missing OpenAI API key');
    return res.status(500).json({ 
      success: false, 
      error: 'OpenAI API key not configured' 
    });
  }

  const openai = new OpenAI({
    apiKey: openaiApiKey
  });

  console.log(`🤖 Sending prompt to OpenAI: "${prompt.substring(0, 50)}..."`);

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: "You are a helpful assistant for AlmaLinks, a global professional network for Jewish business leaders." },
      { role: "user", content: prompt }
    ],
    max_tokens: 500
  });

  console.log('✅ OpenAI response received');

  return res.status(200).json({ 
    success: true,
    response: response.choices[0].message.content,
    usage: response.usage,
    model: response.model
  });
}

// Helper function to normalize phone numbers
function normalizePhoneNumber(phone) {
  const digits = phone.replace(/\D/g, '');
  
  if (digits.startsWith('0')) {
    return `+972${digits.substring(1)}`;
  }
  
  if (!phone.startsWith('+')) {
    return `+972${digits}`;
  }
  
  return phone;
}