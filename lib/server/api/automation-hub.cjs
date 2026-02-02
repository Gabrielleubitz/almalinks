/**
 * Unified Automation Hub
 * Consolidates reminder-system, post-event-automation into one endpoint
 */
const { EventService } = require('../src/services/eventService');
const { db } = require('../src/firebase/config');
const { doc, updateDoc, getDoc, addDoc, collection, query, where, getDocs, deleteDoc } = require('firebase/firestore');
const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

// Import all the functions from the individual files
// REMINDER SYSTEM FUNCTIONS
const REMINDER_INTERVALS = {
  SEVEN_DAYS: 7 * 24 * 60 * 60 * 1000,
  TWENTY_FOUR_HOURS: 24 * 60 * 60 * 1000, 
  THREE_HOURS: 3 * 60 * 60 * 1000,
  THIRTY_MINUTES: 30 * 60 * 1000
};

const REMINDER_TEMPLATES = {
  speaker: {
    email: {
      subject: "🎤 Speaker Reminder: Alma Links Event Tomorrow",
      content: `
        Hi {name},
        
        This is your speaker brief for tomorrow's Alma Links event:
        
        📍 Location: {location}
        🕒 Time: {time}
        🎯 Your Speaking Slot: Please arrive 30 minutes early for tech check
        
        What to bring:
        - Your slides (we'll have them ready)
        - Wireless presenter remote (we have backup)
        - Water will be provided
        
        VIP entrance: Use the speaker entrance on the right side.
        
        Looking forward to your talk!
        Alma Links Team
      `
    },
    sms: "🎤 Speaker reminder: Alma Links event {time} at {location}. Arrive 30min early for tech check. Use VIP entrance. See you there!"
  },
  
  attendee: {
    email: {
      subject: "🍷 Alma Links Event Tomorrow - You're All Set!",
      content: `
        Hi {name},
        
        Get ready for an incredible Alma Links event tomorrow!
        
        📍 Location: {location}
        🕒 Time: {time}
        🎫 Your ticket is attached (also available in your dashboard)
        
        What to expect:
        - Networking with 50+ founders and investors
        - Curated conversations over wine
        - Exclusive insights from industry leaders
        
        Check in at the door when you arrive.
        
        See you there!
        Alma Links Team
      `
    },
    sms: "🍷 Alma Links event tomorrow {time} at {location}. Show your ticket for quick entry. Can't wait to see you!"
  },
  
  vip: {
    email: {
      subject: "🌟 VIP Access: Alma Links Event Tomorrow",
      content: `
        Hi {name},
        
        Your VIP experience at Alma Links starts tomorrow:
        
        📍 Location: {location}
        🕒 VIP Early Access: {vip_time} (30 minutes before general admission)
        🥂 Welcome reception with premium wine selection
        
        VIP Benefits:
        - Priority seating in the founder's lounge
        - Exclusive pre-event networking
        - Direct access to speakers during breaks
        
        Use the VIP entrance on the left side.
        
        Looking forward to hosting you!
        Alma Links Team
      `
    },
    sms: "🌟 VIP reminder: Alma Links event tomorrow. Early access {vip_time} via VIP entrance (left side). Premium experience awaits!"
  }
};

// POST-EVENT EMAIL TEMPLATES
const POST_EVENT_TEMPLATES = {
  thankYou: {
    subject: "🍷 Thank You for Joining Alma Links!",
    content: `
      Hi {name},
      
      Thank you for attending "{event_name}" - it was incredible having you there!
      
      📂 **Event Resources:**
      {slides_links}
      
      📸 **Event Photos:** Coming soon to your dashboard
      
      💡 **What's Next:**
      - Connect with attendees on LinkedIn
      - Join our community Slack: {slack_link}
      - Mark your calendar for our next event
      
      🤝 **Made New Connections?**
      Don't forget to follow up with the amazing people you met!
      
      Looking forward to seeing you at the next Alma Links event.
      
      Cheers,
      The Alma Links Team
    `
  },
  survey: {
    subject: "📋 Quick Survey: How was Alma Links?",
    content: `
      Hi {name},
      
      Hope you enjoyed "{event_name}" yesterday!
      
      We'd love to get your feedback to make our next event even better.
      
      **📊 Quick 2-minute survey:** {survey_link}
      
      Your insights help us create better experiences for our community.
      
      Thanks for being part of Alma Links!
      
      Best,
      Alma Links Team
    `
  },
  nps: {
    subject: "⭐ Would you recommend Alma Links?",
    content: `
      Hi {name},
      
      Thanks again for joining us at "{event_name}"!
      
      **Quick question:** On a scale of 0-10, how likely are you to recommend Alma Links to a friend or colleague?
      
      {nps_buttons}
      
      Your feedback helps us improve and grow our community.
      
      Cheers,
      Alma Links Team
    `
  }
};

// UTILITY FUNCTIONS
function getUserRole(registration) {
  if (registration.badgeRole) {
    return {
      role: registration.badgeRole.toLowerCase(),
      display: registration.badgeRole,
      color: getRoleColor(registration.badgeRole.toLowerCase())
    };
  }
  
  if (registration.ticket_type?.toLowerCase().includes('vip')) {
    return {
      role: 'vip',
      display: 'VIP',
      color: '#F59E0B'
    };
  }
  
  if (registration.role) {
    const role = registration.role.toLowerCase();
    return {
      role: role,
      display: registration.role,
      color: getRoleColor(role)
    };
  }
  
  return {
    role: 'attendee',
    display: 'Attendee',
    color: '#6B7280'
  };
}

function getRoleColor(role) {
  const colors = {
    'admin': '#DC2626',
    'vip': '#F59E0B',
    'sponsor': '#059669',
    'investor': '#0EA5E9',
    'founder': '#EA580C',
    'attendee': '#6B7280'
  };
  
  return colors[role.toLowerCase()] || '#6B7280';
}

function generateContent(template, registration, event, role) {
  const eventDate = new Date(event.date);
  const vipTime = new Date(eventDate.getTime() - (30 * 60 * 1000));
  
  const replacements = {
    '{name}': registration.name || 'there',
    '{location}': event.location,
    '{time}': eventDate.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    }),
    '{vip_time}': vipTime.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    }),
    '{event_name}': event.name || event.title
  };
  
  let content = template;
  Object.entries(replacements).forEach(([key, value]) => {
    content = content.replace(new RegExp(key, 'g'), value);
  });
  
  return content;
}

// MAIN AUTOMATION FUNCTIONS
async function processReminders(intervalMs, reminderType) {
  try {
    console.log(`🔔 Processing ${reminderType} reminders...`);
    
    const events = await EventService.getAllEvents();
    const now = new Date();
    
    const eventsNeedingReminders = events.filter(event => {
      const eventDate = new Date(event.date);
      const timeDiff = eventDate.getTime() - now.getTime();
      const windowSize = 12 * 60 * 60 * 1000; // 12 hours
      return Math.abs(timeDiff - intervalMs) <= windowSize;
    });
    
    console.log(`📅 Found ${eventsNeedingReminders.length} events needing ${reminderType} reminders`);
    
    let totalSent = 0;
    let totalErrors = 0;
    
    for (const event of eventsNeedingReminders) {
      try {
        const registrations = await EventService.getEventRegistrations(event.id);
        const confirmedRegistrations = registrations.filter(reg => 
          reg.status === 'confirmed' && !reg.checkedIn
        );
        
        for (const registration of confirmedRegistrations) {
          const role = getUserRole(registration);
          const template = REMINDER_TEMPLATES[role.role]?.email;
          
          if (template) {
            const subject = generateContent(template.subject, registration, event, role);
            const content = generateContent(template.content, registration, event, role);
            
            try {
              await resend.emails.send({
                from: 'Alma Links <events@wineandgrind.com>',
                to: registration.email,
                subject: subject,
                html: content.replace(/\n/g, '<br>'),
                text: content,
                tags: [{
                  name: 'reminder_type',
                  value: reminderType
                }]
              });
              totalSent++;
            } catch (error) {
              totalErrors++;
              console.error(`❌ Email reminder failed for ${registration.email}:`, error);
            }
          }
          
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
      } catch (error) {
        console.error(`❌ Error processing reminders for event ${event.id}:`, error);
        totalErrors++;
      }
    }
    
    return { sent: totalSent, errors: totalErrors };
    
  } catch (error) {
    console.error(`❌ Error in processReminders for ${reminderType}:`, error);
    throw error;
  }
}

async function processAllReminders() {
  console.log('🚀 Starting automated reminder system...');
  
  const results = {};
  
  try {
    results['7d'] = await processReminders(REMINDER_INTERVALS.SEVEN_DAYS, '7d');
    results['24h'] = await processReminders(REMINDER_INTERVALS.TWENTY_FOUR_HOURS, '24h');
    results['3h'] = await processReminders(REMINDER_INTERVALS.THREE_HOURS, '3h');
    results['30min'] = await processReminders(REMINDER_INTERVALS.THIRTY_MINUTES, '30min');
    
    return { success: true, results };
    
  } catch (error) {
    console.error('❌ Error in reminder system:', error);
    return { success: false, error: error.message };
  }
}

async function processPostEventAutomation() {
  try {
    console.log('🚀 Starting post-event automation...');
    
    const events = await EventService.getAllEvents();
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    const recentlyEndedEvents = events.filter(event => {
      const eventDate = new Date(event.date);
      const eventEndTime = new Date(eventDate.getTime() + 4 * 60 * 60 * 1000);
      return eventEndTime > yesterday && eventEndTime <= now;
    });
    
    console.log(`📅 Found ${recentlyEndedEvents.length} recently ended events`);
    
    const results = {};
    
    for (const event of recentlyEndedEvents) {
      try {
        const registrations = await EventService.getEventRegistrations(event.id);
        const checkedInAttendees = registrations.filter(reg => reg.checkedIn);
        
        // Send thank you emails
        let successCount = 0;
        for (const registration of checkedInAttendees) {
          try {
            const template = POST_EVENT_TEMPLATES.thankYou;
            const content = template.content
              .replace(/{name}/g, registration.name)
              .replace(/{event_name}/g, event.name)
              .replace(/{slides_links}/g, event.slidesLinks || 'Available in your dashboard')
              .replace(/{slack_link}/g, process.env.SLACK_INVITE_URL || '#');
            
            await resend.emails.send({
              from: 'Alma Links <events@wineandgrind.com>',
              to: registration.email,
              subject: template.subject.replace(/{event_name}/g, event.name),
              html: content.replace(/\n/g, '<br>'),
              text: content,
              tags: [{ name: 'type', value: 'thank-you' }]
            });
            
            successCount++;
          } catch (error) {
            console.error(`❌ Failed to send thank you email to ${registration.email}:`, error);
          }
        }
        
        results[event.id] = {
          eventName: event.name,
          thankYou: { sent: successCount, errors: checkedInAttendees.length - successCount },
          success: true
        };
        
      } catch (error) {
        console.error(`❌ Error processing post-event for ${event.id}:`, error);
        results[event.id] = {
          eventName: event.name,
          success: false,
          error: error.message
        };
      }
    }
    
    return {
      success: true,
      eventsProcessed: recentlyEndedEvents.length,
      results
    };
    
  } catch (error) {
    console.error('❌ Error in post-event automation:', error);
    throw error;
  }
}

// API handler
module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(200).json({ success: true });
  }
  
  try {
    const { action } = req.body || req.query;
    
    switch (action) {
      case 'process-reminders':
        const reminderResult = await processAllReminders();
        return res.status(200).json(reminderResult);
        
      case 'post-event-automation':
        const postEventResult = await processPostEventAutomation();
        return res.status(200).json(postEventResult);
        
      default:
        // For cron calls without action parameter
        if (req.method === 'GET') {
          const allResults = await Promise.all([
            processAllReminders(),
            processPostEventAutomation()
          ]);
          
          return res.status(200).json({
            success: true,
            reminders: allResults[0],
            postEvent: allResults[1]
          });
        }
        
        return res.status(400).json({
          success: false,
          error: 'Invalid action. Supported: process-reminders, post-event-automation'
        });
    }
    
  } catch (error) {
    console.error('❌ Automation hub error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};