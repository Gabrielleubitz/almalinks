import { initializeApp } from 'firebase/app';
import { getAuth, setPersistence, browserLocalPersistence, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, enableIndexedDbPersistence, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage, connectStorageEmulator } from 'firebase/storage';
import { getAnalytics, isSupported } from 'firebase/analytics';

// Get Firebase config from environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyC6cvhqnPB04oiCnfI2eYRfZ8Wsdxojcb4",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "alma-links-test.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "alma-links-test",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "alma-links-test.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "993488312241",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:993488312241:web:7fc18f59d3ec9457afcf90",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-CBHYZHPBSC"
};

// Check if we're running in a secure context
const isSecureContext = window.isSecureContext;
const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const isHttps = window.location.protocol === 'https:';

// Log environment information
console.log('🔐 Firebase initialization - Environment info:', {
  isSecureContext,
  isLocalhost,
  isHttps,
  hostname: window.location.hostname,
  protocol: window.location.protocol
});

// Initialize Firebase
console.log('🔥 Initializing Firebase with config:', {
  apiKey: firebaseConfig.apiKey,
  authDomain: firebaseConfig.authDomain,
  projectId: firebaseConfig.projectId,
  storageBucket: firebaseConfig.storageBucket
});

const app = initializeApp(firebaseConfig);

// Expose Firebase app and auth to window for debugging
if (typeof window !== 'undefined') {
  (window as any).__app = app;
  (window as any).__auth = getAuth(app);
}

// Initialize Firebase Authentication
export const auth = getAuth(app);

// Initialize Firestore with offline persistence
export const db = getFirestore(app);

// Initialize Firebase Storage
export const storage = getStorage(app);

// Set persistence to local (stays logged in until explicitly logged out)
setPersistence(auth, browserLocalPersistence)
  .then(() => {
    console.log('✅ Firebase Auth persistence set to local storage');
  })
  .catch((error) => {
    console.error('❌ Firebase Auth persistence setup failed:', error);
  });

// Enable Firestore offline persistence
enableIndexedDbPersistence(db)
  .then(() => {
    console.log('✅ Firestore offline persistence enabled');
  })
  .catch((error) => {
    if (error.code === 'failed-precondition') {
      console.warn('⚠️ Firestore persistence failed: Multiple tabs open');
    } else if (error.code === 'unimplemented') {
      console.warn('⚠️ Firestore persistence failed: Browser not supported');
    } else {
      console.error('❌ Firestore persistence error:', error);
    }
  });

// Use emulators in development if configured
if (import.meta.env.DEV && import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true') {
  console.log('🧪 Using Firebase emulators for development');
  connectAuthEmulator(auth, 'http://localhost:9099');
  connectFirestoreEmulator(db, 'localhost', 8080);
  connectStorageEmulator(storage, 'localhost', 9199);
}

// Initialize Analytics (only in production and if supported)
export const analytics = typeof window !== 'undefined' ? isSupported().then(yes => yes ? getAnalytics(app) : null) : null;

// Network status monitoring
let isOnline = navigator.onLine;
window.addEventListener('online', () => {
  console.log('🌐 App is back online');
  isOnline = true;
});

window.addEventListener('offline', () => {
  console.log('🔌 App is offline');
  isOnline = false;
});

// Export network status checker
export const getNetworkStatus = () => isOnline;

// Export retry function for network requests
export const retryOnNetworkFailure = async (fn: () => Promise<any>, maxRetries = 3, delay = 1000) => {
  let retries = 0;
  
  while (retries < maxRetries) {
    try {
      return await fn();
    } catch (error: any) {
      if (error.code === 'auth/network-request-failed' || error.code === 'unavailable') {
        retries++;
        console.log(`🔄 Network request failed, retrying (${retries}/${maxRetries})...`);
        
        if (retries >= maxRetries) {
          throw error;
        }
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, delay * retries));
      } else {
        throw error;
      }
    }
  }
};

export default app;