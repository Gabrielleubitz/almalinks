// Shared Firebase Admin initialization
// This file ensures Firebase Admin is initialized only once across all API files
import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize Firebase Admin SDK only once
if (!admin.apps.length) {
  try {
    // Try to use service account key from environment variable first
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      const serviceAccountKey = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
      console.log(`🔍 Using service account for project: ${serviceAccountKey.project_id}`);
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
    console.log(`✅ Firebase Admin SDK initialized successfully`);
    console.log(`🔍 Project ID: ${admin.app().options.projectId}`);
  } catch (error) {
    console.error('❌ Failed to initialize Firebase Admin:', error.message);
    // Don't throw - allow server to start even if Firebase init fails
  }
}

// Export the initialized admin instance and commonly used services
export default admin;
export const db = admin.firestore();
export const auth = admin.auth();
