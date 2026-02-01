// Shared Firebase Admin initialization
// This file ensures Firebase Admin is initialized only once across all API files
import admin from 'firebase-admin';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let db = null;
let auth = null;

// Initialize Firebase Admin SDK only once
if (!admin.apps.length) {
  try {
    // Try to use service account key from environment variable first
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      let serviceAccountKey;
      const rawKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

      try {
        // Try parsing as JSON first
        serviceAccountKey = JSON.parse(rawKey);
      } catch (jsonError) {
        // If JSON parse fails, try decoding from base64
        try {
          console.log('🔍 Attempting to decode base64-encoded credentials...');
          const decodedKey = Buffer.from(rawKey, 'base64').toString('utf8');
          serviceAccountKey = JSON.parse(decodedKey);
          console.log('✅ Successfully decoded base64 credentials');
        } catch (base64Error) {
          throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY is neither valid JSON nor valid base64-encoded JSON');
        }
      }

      console.log(`🔍 Using service account for project: ${serviceAccountKey.project_id}`);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccountKey),
        databaseURL: `https://${serviceAccountKey.project_id}-default-rtdb.firebaseio.com`
      });
    } else {
      // Fallback to service account file for development (only if file exists)
      const serviceAccountPath = join(__dirname, '..', 'alma-links-test-firebase-adminsdk-fbsvc-0a0cc6c7cc.json');
      if (existsSync(serviceAccountPath)) {
        const serviceAccountContent = readFileSync(serviceAccountPath, 'utf8');
        const serviceAccount = JSON.parse(serviceAccountContent);
        console.log(`🔍 Using service account for project: ${serviceAccount.project_id}`);
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          databaseURL: `https://${serviceAccount.project_id}-default-rtdb.firebaseio.com`
        });
      } else {
        console.warn('⚠️ Firebase Admin not initialized: no credentials.');
        console.warn('   Set FIREBASE_SERVICE_ACCOUNT_KEY in .env (JSON string or base64), or add a service account key file.');
        console.warn('   API routes that need Firebase (e.g. /api/send-event-announcement) will return 503 until then.');
      }
    }
    if (admin.apps.length) {
      console.log(`✅ Firebase Admin SDK initialized successfully`);
      console.log(`🔍 Project ID: ${admin.app().options.projectId}`);
      db = admin.firestore();
      auth = admin.auth();
    }
  } catch (error) {
    console.error('❌ Failed to initialize Firebase Admin:', error.message);
    // Don't throw - allow server to start; API routes will return 503 when they need Firebase
  }
} else {
  db = admin.firestore();
  auth = admin.auth();
}

// Export the initialized admin instance and commonly used services (null if init failed)
export default admin;
export { db, auth };
