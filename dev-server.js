// Load .env FIRST (ESM hoists imports, so this must be a separate module imported before firebase-init)
import './lib/server/load-env.js';

import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Initialize Firebase Admin ONCE before importing API handlers
import './lib/server/firebase-init.js';

import userAdminHandler from './lib/server/api/user-admin.js';
import activityAdminHandler from './lib/server/api/activity-admin.js';
import emailServiceHandler from './lib/server/api/email-service.js';
import deleteUserHandler from './lib/server/api/delete-user.js';
import sendEventAnnouncementHandler from './lib/server/api/send-event-announcement.js';
import welcomeEmailHandler from './lib/server/api/welcome-email.js';
import applicationFollowUpEmailHandler from './lib/server/api/application-follow-up-email.js';
import passwordResetHandler from './lib/server/api/password-reset.js';
import deleteHubspotApplicantHandler from './lib/server/api/delete-hubspot-applicant.js';
import syncEventToHubspotHandler from './lib/server/api/sync-event-to-hubspot.js';
import syncAllEventsToHubspotHandler from './lib/server/api/sync-all-events-to-hubspot.js';
import deleteEventFromHubspotHandler from './lib/server/api/delete-event-from-hubspot.js';
import updateEventPrivateDetailsHandler from './lib/server/api/update-event-private-details.js';

// CJS handler (kept as CommonJS)
import adminChatsHandler from './lib/server/api/admin/chats.js';
// Temporarily disabled problematic imports
// import systemTestHandler from './api/system-test.js';
// import adminToolsHandler from './api/admin-tools.js';
// import automationHubHandler from './api/automation-hub.js';
// import sendSmsHandler from './api/send-sms.js';
// import chatApiHandler from './api/chat-api.js';

const app = express();
const PORT = 3001;

// SECURITY: Enable CORS with origin validation
const allowedOrigins = [
  'https://almalinks.com',
  'https://www.almalinks.com',
  'https://alma-links-test.web.app',
  'https://alma-links-test.firebaseapp.com',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:3001'
];

app.use((req, res, next) => {
  const origin = req.headers.origin;
  const isAllowedOrigin = origin && allowedOrigins.includes(origin);
  
  // Set CORS headers with origin validation
  res.header('Access-Control-Allow-Origin', isAllowedOrigin ? origin : allowedOrigins[0]);
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  // Security headers
  res.header('X-Content-Type-Options', 'nosniff');
  res.header('X-Frame-Options', 'DENY');
  res.header('X-XSS-Protection', '1; mode=block');
  res.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Parse JSON bodies
app.use(express.json());

// Log every request so you can see if the app is talking to this server
app.use((req, res, next) => {
  console.log(`[dev-server] ${req.method} ${req.path}`);
  next();
});

app.post('/api/admin/chats', (req, res) => {
  console.log('Admin Chat Creation API called:', req.body);
  adminChatsHandler(req, res);
});

// User Admin API - Comprehensive user management (handles POST and GET)
// GET requests with ?locations query param route to member locations
app.all('/api/user-admin', (req, res) => {
  const action = req.method === 'GET' ? 'getUserLocations' : req.body?.action;
  console.log(`User Admin API called: ${req.method} ${action || ''}`);
  userAdminHandler(req, res);
});

// Activity Admin API - User activity tracking and analytics
app.post('/api/activity-admin', (req, res) => {
  console.log('Activity Admin API called:', req.body?.action);
  activityAdminHandler(req, res);
});

// Email Service API - Consolidated email handling
app.all('/api/email-service', (req, res) => {
  console.log('Email Service API called:', req.body?.type);
  emailServiceHandler(req, res);
});

// Delete User API
app.post('/api/delete-user', (req, res) => {
  console.log('Delete User API called:', req.body);
  deleteUserHandler(req, res);
});

// Mailchimp Marketing: send event announcement campaign to audience
app.post('/api/send-event-announcement', (req, res) => {
  console.log('Send Event Announcement API called:', req.body?.eventId);
  sendEventAnnouncementHandler(req, res);
});

app.post('/api/welcome-email', (req, res) => {
  console.log('Welcome Email API called');
  welcomeEmailHandler(req, res);
});

app.post('/api/application-follow-up-email', (req, res) => {
  console.log('Application follow-up email API called');
  applicationFollowUpEmailHandler(req, res);
});

app.post('/api/password-reset', (req, res) => {
  passwordResetHandler(req, res);
});

app.post('/api/delete-hubspot-applicant', (req, res) => {
  deleteHubspotApplicantHandler(req, res);
});

// HubSpot: sync event to Deal (create/update)
app.post('/api/sync-event-to-hubspot', (req, res) => {
  console.log('Sync Event to HubSpot API called:', req.body?.eventId);
  syncEventToHubspotHandler(req, res);
});

// HubSpot: sync all events without hubspotDealId to Deals (backfill)
app.post('/api/sync-all-events-to-hubspot', (req, res) => {
  console.log('Sync All Events to HubSpot API called');
  syncAllEventsToHubspotHandler(req, res);
});

// HubSpot: delete Deal when event is deleted
app.post('/api/delete-event-from-hubspot', (req, res) => {
  console.log('Delete Event from HubSpot API called:', req.body?.eventId, req.body?.hubspotDealId);
  deleteEventFromHubspotHandler(req, res);
});

// Event private details: server-side write (bypasses client Firestore rules)
app.post('/api/update-event-private-details', (req, res) => {
  console.log('Update Event Private Details API called:', req.body?.eventId);
  updateEventPrivateDetailsHandler(req, res);
});

// Temporarily disabled APIs due to import issues
// // System Test API
// app.all('/api/system-test', (req, res) => {
//   console.log('System Test API called:', req.body?.testType);
//   systemTestHandler(req, res);
// });

// // Admin Tools API
// app.all('/api/admin-tools', (req, res) => {
//   console.log('Admin Tools API called:', req.query?.action);
//   adminToolsHandler(req, res);
// });

// // Automation Hub API
// app.post('/api/automation-hub', (req, res) => {
//   console.log('Automation Hub API called:', req.body);
//   automationHubHandler(req, res);
// });

// // Send SMS API
// app.post('/api/send-sms', (req, res) => {
//   console.log('Send SMS API called:', req.body);
//   sendSmsHandler(req, res);
// });

// // Chat API
// app.all('/api/chat-api', (req, res) => {
//   console.log('Chat API called:', req.body);
//   chatApiHandler(req, res);
// });

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Development API server running' });
});

app.listen(PORT, () => {
  console.log(`🚀 Development API server running on http://localhost:${PORT}`);
  console.log('Available endpoints:');
  console.log('  - POST http://localhost:3001/api/admin/chats');
  console.log('  - ALL  http://localhost:3001/api/user-admin          User management (POST) & locations (GET)');
  console.log('  - POST http://localhost:3001/api/activity-admin      Activity tracking');
  console.log('  - ALL  http://localhost:3001/api/email-service       Consolidated email');
  console.log('  - POST http://localhost:3001/api/delete-user         Delete users');
  console.log('  - POST http://localhost:3001/api/send-event-announcement  Mailchimp event campaign');
  console.log('  - POST http://localhost:3001/api/welcome-email            Mailchimp welcome (signup)');
  console.log('  - POST http://localhost:3001/api/sync-event-to-hubspot     HubSpot deal sync (event create/update)');
  console.log('  - POST http://localhost:3001/api/delete-event-from-hubspot  HubSpot deal delete (event deletion)');
  console.log('  - GET  http://localhost:3001/api/health              Health check');
  console.log('');
  console.log('Note: Some APIs temporarily disabled due to import issues');
  console.log('Note: Functions consolidated to stay within Vercel Hobby limit (12 functions)');
});