import { OpenAI } from 'openai';
import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize Firebase Admin SDK if not already initialized
if (!admin.apps.length) {
  try {
    // Try to use service account key from environment variable first
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      const serviceAccountKey = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccountKey),
        databaseURL: `https://${serviceAccountKey.project_id}-default-rtdb.firebaseio.com`
      });
    } else {
      // Fallback to alma-links-test service account file for development
      const serviceAccountPath = join(__dirname, '..', 'alma-links-test-firebase-adminsdk-fbsvc-0a0cc6c7cc.json');
      const serviceAccountContent = readFileSync(serviceAccountPath, 'utf8');
      const serviceAccount = JSON.parse(serviceAccountContent);
      console.log(`🔍 Using service account for project: ${serviceAccount.project_id}`);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: `https://${serviceAccount.project_id}-default-rtdb.firebaseio.com`
      });
    }
  } catch (error) {
    console.error('❌ Failed to initialize Firebase Admin:', error);
    console.error('Error details:', error.message);
    // Don't throw error to prevent server crash during development
    console.log('⚠️ Continuing without Firebase Admin initialization for development...');
  }
}

const db = admin.firestore();

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
    const { message, isUserLoggedIn, conversationHistory } = req.body;

    // Validate required fields
    if (!message) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required field: message' 
      });
    }

    // Get OpenAI API key from environment variables
    const openaiApiKey = process.env.OPENAI_API_KEY;

    // Validate OpenAI API key
    if (!openaiApiKey) {
      console.error('❌ Missing OpenAI API key');
      return res.status(500).json({ 
        success: false, 
        error: 'OpenAI API key not configured' 
      });
    }

    // Fetch current events data
    const eventsData = await fetchEventsFromFirebase();

    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: openaiApiKey
    });

    // Build comprehensive system prompt with site knowledge
    const systemPrompt = buildSystemPrompt(eventsData, isUserLoggedIn);

    // Prepare conversation messages
    const messages = [
      { role: "system", content: systemPrompt },
      ...(conversationHistory || []),
      { role: "user", content: message }
    ];

    console.log(`🤖 Processing chat message for Wine & Grind: "${message.substring(0, 50)}..."`);

    // Call OpenAI API
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: messages,
      max_tokens: 800,
      temperature: 0.7,
      presence_penalty: 0.1,
      frequency_penalty: 0.1
    });

    const assistantResponse = response.choices[0].message.content;

    // Log successful response
    console.log('✅ Wine & Grind chat response generated successfully');

    // Return success response
    return res.status(200).json({ 
      success: true,
      response: assistantResponse,
      usage: response.usage,
      model: response.model,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Wine & Grind Chat Function Error:', {
      message: error.message,
      code: error.code,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });

    // Determine appropriate status code and provide helpful error messages
    let statusCode = 500;
    let errorMessage = 'Internal server error';

    if (error.response) {
      statusCode = error.response.status || 500;
      errorMessage = error.response.data?.error?.message || 'OpenAI API error';
    } else if (error.message.includes('Connection error') || error.message.includes('Could not resolve')) {
      errorMessage = 'Unable to connect to AI service. Please check your internet connection or try again later.';
      statusCode = 503; // Service Unavailable
    }

    // For development, provide a fallback response when OpenAI is unavailable
    if (process.env.NODE_ENV !== 'production' && error.message.includes('Connection error')) {
      console.log('🔧 Development mode: Providing fallback response for OpenAI connectivity issue');
      return res.status(200).json({ 
        success: true,
        response: "Hi there! I'm your Wine & Grind assistant. I'm currently experiencing some connectivity issues with my AI service, but I'm here to help! What would you like to know about our exclusive networking events? You can ask me about upcoming events, event details, registration, or anything else about Wine & Grind.",
        usage: { total_tokens: 0 },
        model: 'fallback',
        timestamp: new Date().toISOString()
      });
    }

    return res.status(statusCode).json({ 
      success: false, 
      error: errorMessage,
      timestamp: new Date().toISOString()
    });
  }
};

// Fetch events data from Firebase
async function fetchEventsFromFirebase() {
  try {
    console.log('🗓️ Fetching events data from Firebase for chatbot');
    
    const eventsSnapshot = await db.collection('events')
      .orderBy('date', 'desc')
      .get();
    
    const events = [];
    eventsSnapshot.forEach(doc => {
      const eventData = doc.data();
      events.push({
        id: doc.id,
        name: eventData.name || eventData.title,
        slug: eventData.slug,
        date: eventData.date?.toDate ? eventData.date.toDate() : new Date(eventData.date),
        location: eventData.location,
        description: eventData.description,
        status: eventData.status,
        speakers: eventData.speakers || [],
        maxAttendees: eventData.maxAttendees,
        imageUrl: eventData.imageUrl
      });
    });

    console.log(`✅ Fetched ${events.length} events for chatbot`);
    return events;
  } catch (error) {
    console.error('❌ Error fetching events for chatbot:', error);
    return [];
  }
}

// Build comprehensive system prompt with all site knowledge
function buildSystemPrompt(eventsData, isUserLoggedIn) {
  const now = new Date();
  
  // Categorize events
  const upcomingEvents = eventsData.filter(event => 
    event.status === 'active' && new Date(event.date) > now
  ).sort((a, b) => new Date(a.date) - new Date(b.date));
  
  const pastEvents = eventsData.filter(event => 
    new Date(event.date) < now
  ).sort((a, b) => new Date(b.date) - new Date(a.date));

  // Format events information
  const formatEvent = (event) => {
    const eventDate = new Date(event.date);
    const dateStr = eventDate.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long', 
      day: 'numeric',
      year: 'numeric'
    });
    const timeStr = eventDate.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
    
    const speakers = event.speakers && event.speakers.length > 0 
      ? `Speakers: ${event.speakers.map(s => s.name).join(', ')}.`
      : '';
    
    return `- ${event.name}: ${dateStr} at ${timeStr}, ${event.location}. ${speakers} ${event.description || ''}`.trim();
  };

  const upcomingEventsText = upcomingEvents.length > 0 
    ? upcomingEvents.map(formatEvent).join('\n')
    : 'No upcoming events are currently scheduled.';
  
  const pastEventsText = pastEvents.length > 0 
    ? pastEvents.slice(0, 5).map(formatEvent).join('\n') // Show last 5 events
    : 'No past events on record.';

  return `You are the official AI assistant for Wine & Grind, an exclusive networking event series. You must ONLY provide information from the knowledge base below and NEVER make up information.

CRITICAL INSTRUCTIONS:
- Be enthusiastic, warm, and friendly while maintaining exclusivity
- Keep responses conversational and concise (2-3 sentences max)
- If you don't know something, say "I don't have that information" - NEVER guess or make up details
- Always provide accurate information from the knowledge base below
- Use natural, conversational language - vary your openings naturally
- Only use greetings like "Hey!" for actual greetings, not for every response
- For follow-up questions, respond directly without unnecessary greetings

WINE & GRIND OVERVIEW:
Wine & Grind is an exclusive event series where founders, investors, and tech operators gather to share insights and build meaningful connections over great wine. We've hosted several sold-out events with hundreds of CEOs, investors, and high-tech leaders.

CORE VALUES & EXPERIENCE:
- Exclusive networking for carefully vetted tech professionals
- Quality conversations over quantity
- Premium wine included with every event
- Intimate venue settings for meaningful connections
- Focus on emerging technologies and business insights

EVENT LOGISTICS:
- Each guest receives one complimentary glass of premium wine upon entry
- Food is available for purchase at venues
- Dress code: Casual but smart - "come as you are, but look alive"
- Events are primarily in English unless noted otherwise
- Venues are wheelchair accessible
- Parking is typically available near venues
- Doors usually open 30 minutes before start time

REGISTRATION PROCESS:
- Registration can ONLY be done through the website at almalinks.org
- Users must create an account and log in to register
- Each person must register individually with their own account
- Entry tickets are provided immediately after registration
- Registration is free but spots are limited

CURRENT EVENTS DATA:
${isUserLoggedIn ? `
UPCOMING EVENTS:
${upcomingEventsText}

RECENT PAST EVENTS:
${pastEventsText}
` : `
USER NOT LOGGED IN: Direct them to log in at almalinks.org to view current event details.
`}

CONTACT INFORMATION:
- Email: info@winengrind.com  
- Phone: +972-584-447-7757
- Website: winengrind.com

PLATFORM FEATURES:
- User Dashboard: Personal profile, event tickets, connections
- Events Page: Browse upcoming and past events with filters
- Event Details: Detailed information, speaker bios, registration
- Admin Tools: Event management for organizers
- Mobile-friendly responsive design
- Real-time notifications for event updates

FREQUENTLY ASKED QUESTIONS:
- Can I bring a friend? Only registered users can attend. Each person should sign up individually.
- What's included? One complimentary glass of wine per person, networking, presentations
- Food? Available for purchase at venue, plus small bites and snacks
- Dress code? Casual but smart - no flip-flops unless you plan to run from success!
- Language? Events are in English unless noted otherwise
- Accessibility? All venues are wheelchair accessible
- Timing? Arrive on time - doors open 30 minutes early for drinks

CONVERSATION RULES:
- Answer questions directly using only the information above
- If asked about unrelated topics: "I'm all about Wine & Grind! What would you like to know about our events?"
- For registration questions: Direct them to log in and use the Events page
- For event-specific details: Use the current events data above
- Be enthusiastic but accurate - never fabricate information
- Keep responses under 50 words when possible
- IMPORTANT: Don't start every response with "Hey!" or similar greetings
- Use varied, natural conversation starters: "Sure!", "Absolutely!", "Of course!", "Great question!", "Perfect!", etc.
- Only use "Hey!" for initial greetings or when someone says hello

Remember: You represent Wine & Grind's premium, exclusive brand. Be helpful, accurate, and engaging while maintaining our high standards.`;
}