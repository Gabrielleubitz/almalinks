import { initializeApp } from 'firebase/app';
import { getAuth, setPersistence, browserLocalPersistence, connectAuthEmulator } from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentSingleTabManager,
  connectFirestoreEmulator
} from 'firebase/firestore';
import { getStorage, connectStorageEmulator } from 'firebase/storage';
import { getAnalytics, isSupported } from 'firebase/analytics';

// Get Firebase config from environment variables - REQUIRED for security
// All values must be provided via environment variables in production
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Validate that all required config values are present
const requiredConfigKeys = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'];
const missingKeys = requiredConfigKeys.filter(key => !firebaseConfig[key as keyof typeof firebaseConfig]);

if (missingKeys.length > 0) {
  const errorMessage = `Missing required Firebase configuration: ${missingKeys.join(', ')}. Please set VITE_FIREBASE_${missingKeys.map(k => k.toUpperCase()).join(', VITE_FIREBASE_')} environment variables.`;
  console.error('❌ Firebase configuration error:', errorMessage);
  if (import.meta.env.PROD) {
    throw new Error(errorMessage);
  }
}

// Check if we're running in a secure context
const isSecureContext = window.isSecureContext;
const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const isHttps = window.location.protocol === 'https:';

// Log environment information (only in development)
if (import.meta.env.DEV) {
  console.log('🔐 Firebase initialization - Environment info:', {
    isSecureContext,
    isLocalhost,
    isHttps,
    hostname: window.location.hostname,
    protocol: window.location.protocol
  });
}

const app = initializeApp(firebaseConfig);

// SECURITY: Do not expose Firebase app/auth to window object in production
// This prevents unauthorized access to Firebase instances
if (import.meta.env.DEV && typeof window !== 'undefined') {
  // Only expose in development for debugging
  (window as any).__app = app;
  (window as any).__auth = getAuth(app);
}

// Initialize Firebase Authentication
export const auth = getAuth(app);

// Initialize Firestore with persistent cache (replaces deprecated enableIndexedDbPersistence)
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentSingleTabManager() }),
});

// Initialize Firebase Storage
export const storage = getStorage(app);

// Set persistence to local (stays logged in until explicitly logged out)
setPersistence(auth, browserLocalPersistence)
  .then(() => {
    if (import.meta.env.DEV) {
      console.log('✅ Firebase Auth persistence set to local storage');
    }
  })
  .catch((error) => {
    console.error('❌ Firebase Auth persistence setup failed:', error);
  });

if (import.meta.env.DEV) {
  console.log('✅ Firestore offline persistence enabled (persistentLocalCache)');
}

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
  if (import.meta.env.DEV) {
    console.log('🌐 App is back online');
  }
  isOnline = true;
});

window.addEventListener('offline', () => {
  if (import.meta.env.DEV) {
    console.log('🔌 App is offline');
  }
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
        if (import.meta.env.DEV) {
          console.log(`🔄 Network request failed, retrying (${retries}/${maxRetries})...`);
        }
        
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