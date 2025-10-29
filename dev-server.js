import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { config } from 'dotenv';
import chatHandler from './api/chat.js';
import adminChatsHandler from './api/admin/chats.js';

// Load environment variables from .env file
config();

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

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Development API server running' });
});

app.listen(PORT, () => {
  console.log(`🚀 Development API server running on http://localhost:${PORT}`);
  console.log('Available endpoints:');
  console.log('  - POST http://localhost:3001/api/chat');
  console.log('  - POST http://localhost:3001/api/admin/chats');
  console.log('  - GET  http://localhost:3001/api/health');
});