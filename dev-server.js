import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { config } from 'dotenv';

// Load environment variables FIRST before any imports that use them
config();

// Initialize Firebase Admin ONCE before importing API handlers
import './api/firebase-init.js';

import chatHandler from './api/chat.js';
import adminChatsHandler from './api/admin/chats.js';
import userAdminHandler from './api/user-admin.js';
import activityAdminHandler from './api/activity-admin.js';
import emailServiceHandler from './api/email-service.js';
import deleteUserHandler from './api/delete-user.js';
// Temporarily disabled problematic imports
// import systemTestHandler from './api/system-test.js';
// import adminToolsHandler from './api/admin-tools.js';
// import automationHubHandler from './api/automation-hub.js';
// import sendSmsHandler from './api/send-sms.js';
// import chatApiHandler from './api/chat-api.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = 3001;

// Enable CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Parse JSON bodies
app.use(express.json());

// API routes
app.post('/api/chat', (req, res) => {
  console.log('Chat API called:', req.body);
  chatHandler(req, res);
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
  console.log('  - POST http://localhost:3001/api/chat');
  console.log('  - POST http://localhost:3001/api/admin/chats');
  console.log('  - ALL  http://localhost:3001/api/user-admin          User management (POST) & locations (GET)');
  console.log('  - POST http://localhost:3001/api/activity-admin      Activity tracking');
  console.log('  - ALL  http://localhost:3001/api/email-service       Consolidated email');
  console.log('  - POST http://localhost:3001/api/delete-user         Delete users');
  console.log('  - GET  http://localhost:3001/api/health              Health check');
  console.log('');
  console.log('Note: Some APIs temporarily disabled due to import issues');
  console.log('Note: Functions consolidated to stay within Vercel Hobby limit (12 functions)');
});