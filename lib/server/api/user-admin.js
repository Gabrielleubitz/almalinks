// User Admin API - Create, manage, and import users with temporary passwords
import admin from 'firebase-admin';
import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { isAdminFromUserDoc } from '../admin-auth.js';
import { upsertHubspotContact } from '../hubspot-contact-sync.js';

// Load environment variables from .env.local and .env (for local dev and vercel dev)
// This ensures GOOGLE_APPLICATION_CREDENTIALS is available when using vercel dev
// Note: In Vercel production, env vars are loaded automatically, but vercel dev may need help
// We try to load .env.local if it exists - this is safe because:
// - In Vercel production, the file won't exist, so nothing loads
// - In vercel dev, the file exists locally and should be loaded
// - In local dev, the file exists and should be loaded
try {
  // Use dynamic import for dotenv (it's in devDependencies, might not be available in production)
  const dotenvModule = await import('dotenv');
  const { fileURLToPath } = await import('url');
  const { dirname, join } = await import('path');
  
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const projectRoot = resolve(__dirname, '..');
  
  // Try .env.local first, then .env
  const envLocalPath = join(projectRoot, '.env.local');
  const envPath = join(projectRoot, '.env');
  
  if (existsSync(envLocalPath)) {
    dotenvModule.config({ path: envLocalPath });
    console.log(`📁 Loaded environment from: ${envLocalPath}`);
  } else if (existsSync(envPath)) {
    dotenvModule.config({ path: envPath });
    console.log(`📁 Loaded environment from: ${envPath}`);
  } else {
    // In production, this is expected - env vars come from platform
    if (process.env.NODE_ENV === 'development' || !process.env.VERCEL) {
      console.log('ℹ️ No .env.local or .env file found - relying on system environment variables');
    }
  }
} catch (dotenvError) {
  // dotenv might not be available (e.g., in production where it's not installed)
  // This is expected in production where env vars are set by the platform
  if (process.env.NODE_ENV === 'development' || !process.env.VERCEL) {
    console.warn('⚠️ Could not load dotenv (this is okay if env vars are set another way):', dotenvError.message);
  }
}

// Helper function to resolve credential file path with multiple fallbacks
function resolveCredentialFilePath(credentialsPath) {
  const __filename = fileURLToPath(import.meta.url);
  const __fileDir = dirname(__filename);
  const projectRootFromApi = resolve(__fileDir, '..'); // Go up from api/ to project root
  const cwd = process.cwd();
  
  const candidatePaths = [];
  
  // If absolute path, use it directly
  if (credentialsPath.startsWith('/')) {
    candidatePaths.push(credentialsPath);
  } else {
    // Try resolving from process.cwd() (current working directory)
    candidatePaths.push(resolve(cwd, credentialsPath));
    
    // Try resolving from project root (where api/ directory is)
    candidatePaths.push(resolve(projectRootFromApi, credentialsPath));
    
    // Try with __dirname fallback (from api/ directory)
    candidatePaths.push(resolve(__fileDir, '..', credentialsPath.replace(/^\.\//, '')));
  }
  
  // Additional fallback: if path ends with a directory, try common filenames
  if (credentialsPath.endsWith('/') || credentialsPath.endsWith('/secrets')) {
    const dirPath = credentialsPath.endsWith('/') ? credentialsPath.slice(0, -1) : credentialsPath;
    candidatePaths.push(resolve(cwd, dirPath, 'serviceAccount.json'));
    candidatePaths.push(resolve(projectRootFromApi, dirPath, 'serviceAccount.json'));
  }
  
  // Fallback: try secrets directory with common filename
  if (credentialsPath.includes('secrets')) {
    candidatePaths.push(resolve(projectRootFromApi, 'secrets', 'serviceAccount.json'));
    candidatePaths.push(resolve(cwd, 'secrets', 'serviceAccount.json'));
  }
  
  // Remove duplicates
  const uniquePaths = [...new Set(candidatePaths)];
  
  return uniquePaths;
}

// Helper function to find first existing credential file
function findCredentialFile(credentialsPath) {
  const candidatePaths = resolveCredentialFilePath(credentialsPath);
  const checkedPaths = [];
  
  console.log(`🔍 Searching for credential file. Candidates:`);
  
  for (const candidatePath of candidatePaths) {
    checkedPaths.push({ path: candidatePath, exists: existsSync(candidatePath) });
    console.log(`  - ${candidatePath} ${existsSync(candidatePath) ? '✅ EXISTS' : '❌ missing'}`);
    
    if (existsSync(candidatePath)) {
      // If it's a directory, try to find a JSON file in it
      try {
        const stats = statSync(candidatePath);
        if (stats.isDirectory()) {
          const files = readdirSync(candidatePath);
          const jsonFiles = files.filter(f => f.endsWith('.json') && f.includes('firebase'));
          if (jsonFiles.length > 0) {
            const foundFile = join(candidatePath, jsonFiles[0]);
            console.log(`  ✅ Found JSON file in directory: ${foundFile}`);
            return { path: foundFile, checkedPaths };
          }
        } else {
          // It's a file, return it
          console.log(`  ✅ Using credential file: ${candidatePath}`);
          return { path: candidatePath, checkedPaths };
        }
      } catch (statError) {
        // Continue to next candidate
        continue;
      }
    }
  }
  
  // If no file found, try to find any firebase admin SDK JSON file in secrets directory
  const secretsDirs = [
    resolve(process.cwd(), 'secrets'),
    resolve(dirname(fileURLToPath(import.meta.url)), '..', 'secrets')
  ];
  
  for (const secretsDir of secretsDirs) {
    if (existsSync(secretsDir)) {
      try {
        const files = readdirSync(secretsDir);
        const jsonFiles = files.filter(f => 
          f.endsWith('.json') && 
          (f.includes('firebase-adminsdk') || f === 'serviceAccount.json')
        );
        if (jsonFiles.length > 0) {
          const foundFile = join(secretsDir, jsonFiles[0]);
          console.log(`  ✅ Found Firebase credential file in secrets directory: ${foundFile}`);
          checkedPaths.push({ path: foundFile, exists: true });
          return { path: foundFile, checkedPaths };
        }
      } catch (readError) {
        // Continue
      }
    }
  }
  
  return { path: null, checkedPaths };
}

// Store credential file resolution info for diagnostics
let credentialFileInfo = {
  resolvedPath: null,
  fileExists: false,
  checkedPaths: []
};

// Initialize Firebase Admin (reuse existing instance if available)
if (!admin.apps.length) {
  try {
    // Safe logging before initialization (no secrets)
    console.log('🔍 Firebase Admin initialization check:');
    console.log(`  - FIREBASE_SERVICE_ACCOUNT_KEY set: ${!!process.env.FIREBASE_SERVICE_ACCOUNT_KEY}`);
    console.log(`  - GOOGLE_APPLICATION_CREDENTIALS set: ${!!process.env.GOOGLE_APPLICATION_CREDENTIALS}`);
    console.log(`  - Admin apps already initialized: ${admin.apps.length > 0}`);
    
    let serviceAccountKey;
    let projectId;
    let clientEmail;
    let credentialSource = 'unknown';
    let credentialFilePath = null;
    let checkedPaths = [];
    
    // Priority 1: GOOGLE_APPLICATION_CREDENTIALS (file path) - safest for local dev
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      credentialSource = 'GOOGLE_APPLICATION_CREDENTIALS (file)';
      const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
      
      console.log(`📋 Using credentials from: ${credentialSource}`);
      console.log(`📁 Original path from env: ${credentialsPath}`);
      
      // Try to find the credential file using multiple strategies
      const fileResult = findCredentialFile(credentialsPath);
      credentialFilePath = fileResult.path;
      checkedPaths = fileResult.checkedPaths;
      
      // Store for diagnostics
      credentialFileInfo.resolvedPath = credentialFilePath;
      credentialFileInfo.fileExists = !!credentialFilePath;
      credentialFileInfo.checkedPaths = checkedPaths;
      
      if (!credentialFilePath) {
        const errorMsg = `Credential file not found. Expected at: ${credentialsPath}. Please confirm the file exists.`;
        console.error(`❌ ${errorMsg}`);
        console.error(`   Checked ${checkedPaths.length} candidate paths, none exist.`);
        throw new Error(errorMsg);
      }
      
      try {
        const fileContent = readFileSync(credentialFilePath, 'utf8');
        serviceAccountKey = JSON.parse(fileContent);
        
        // Validate required fields
        if (!serviceAccountKey.project_id || !serviceAccountKey.client_email || !serviceAccountKey.private_key) {
          throw new Error(`Service account file at ${credentialFilePath} is missing required fields (project_id, client_email, or private_key)`);
        }
        
        projectId = serviceAccountKey.project_id;
        clientEmail = serviceAccountKey.client_email;
        
        console.log(`✅ Successfully loaded service account from file: ${credentialFilePath}`);
        console.log(`📋 Project ID: ${projectId}`);
        console.log(`📧 Service Account Email: ${clientEmail}`);
        
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccountKey),
        });
      } catch (fileError) {
        if (fileError.code === 'ENOENT' || fileError.message.includes('not found')) {
          console.error(`❌ Service account file not found at: ${credentialFilePath}`);
          throw new Error(`Credential file not found. Expected at: ${credentialFilePath}. Please confirm the file exists.`);
        } else if (fileError instanceof SyntaxError) {
          console.error(`❌ Service account file is not valid JSON: ${fileError.message}`);
          throw new Error(`Service account file at ${credentialFilePath} is not valid JSON: ${fileError.message}`);
        } else {
          console.error(`❌ Failed to read service account file: ${fileError.message}`);
          throw fileError; // Re-throw if it's our validation error
        }
      }
    } 
    // Priority 2: FIREBASE_SERVICE_ACCOUNT_KEY (JSON string or base64-encoded JSON)
    // Only use this if GOOGLE_APPLICATION_CREDENTIALS is not set
    else if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      credentialSource = 'FIREBASE_SERVICE_ACCOUNT_KEY (env var)';
      console.log(`📋 Using credentials from: ${credentialSource}`);
      
      const rawKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

      try {
        // Try parsing as JSON first (if it starts with {)
        if (rawKey.trim().startsWith('{')) {
          serviceAccountKey = JSON.parse(rawKey);
          console.log('✅ Parsed FIREBASE_SERVICE_ACCOUNT_KEY as JSON');
        } else {
          // Try decoding from base64
          console.log('🔍 Attempting to decode base64-encoded credentials...');
          const decodedKey = Buffer.from(rawKey, 'base64').toString('utf8');
          serviceAccountKey = JSON.parse(decodedKey);
          console.log('✅ Successfully decoded base64 credentials');
        }
        
        // Validate required fields
        if (!serviceAccountKey.project_id || !serviceAccountKey.client_email || !serviceAccountKey.private_key) {
          throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY is missing required fields (project_id, client_email, or private_key)');
        }
        
        projectId = serviceAccountKey.project_id;
        clientEmail = serviceAccountKey.client_email;

        admin.initializeApp({
          credential: admin.credential.cert(serviceAccountKey),
        });
      } catch (parseError) {
        console.error(`❌ Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY: ${parseError.message}`);
        
        // If GOOGLE_APPLICATION_CREDENTIALS is also set, suggest using it instead
        if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
          throw new Error(`FIREBASE_SERVICE_ACCOUNT_KEY is invalid (${parseError.message}). Since GOOGLE_APPLICATION_CREDENTIALS is also set, unset FIREBASE_SERVICE_ACCOUNT_KEY to use the file-based credentials.`);
        }
        
        throw new Error(`FIREBASE_SERVICE_ACCOUNT_KEY is neither valid JSON nor valid base64-encoded JSON: ${parseError.message}`);
      }
    }
    // Priority 3: Individual environment variables (fallback)
    else if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
      credentialSource = 'Individual env vars (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY)';
      console.log(`📋 Using credentials from: ${credentialSource}`);
      
      projectId = process.env.FIREBASE_PROJECT_ID;
      clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
      
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: projectId,
          clientEmail: clientEmail,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
      });
    }
    // No credentials found
    else {
      const errorMsg = 'Firebase Admin credentials not found. Set one of:\n' +
        '  - GOOGLE_APPLICATION_CREDENTIALS (path to service account JSON file) - RECOMMENDED for local dev\n' +
        '  - FIREBASE_SERVICE_ACCOUNT_KEY (JSON string or base64-encoded JSON)\n' +
        '  - FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY (individual env vars)';
      
      console.error('❌', errorMsg);
      throw new Error(errorMsg);
    }
    
    // Verify initialization succeeded
    if (!admin.apps.length) {
      throw new Error('Firebase Admin initialization appeared to succeed but no app was created');
    }
    
    // Get actual project ID from initialized app
    const actualProjectId = admin.app().options.projectId;
    
    // Log successful initialization details for debugging
    console.log('✅ Firebase Admin SDK initialized successfully');
    console.log(`📋 Credential source: ${credentialSource}`);
    console.log(`📋 Project ID: ${actualProjectId || projectId || 'NOT SET'}`);
    console.log(`📧 Service Account: ${clientEmail || 'NOT SET'}`);
  } catch (error) {
    console.error('❌ Failed to initialize Firebase Admin:', error.message);
    console.error('❌ Error details:', {
      message: error.message,
      code: error.code,
      // Don't log stack in production to avoid exposing paths
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
    // Don't throw here - let the handler catch it and return proper error response
    // This prevents the entire module from crashing
  }
}

// Initialize Firestore and Auth only if Admin SDK is initialized
let db = null;
let auth = null;

if (admin.apps.length > 0) {
  try {
    db = admin.firestore();
    auth = admin.auth();
    console.log('✅ Firestore and Auth instances initialized');
  } catch (error) {
    console.error('❌ Failed to initialize Firestore/Auth:', error.message);
  }
} else {
  console.warn('⚠️ Firebase Admin not initialized - Firestore and Auth unavailable');
}

// In-memory cache for member locations (public endpoint)
let cachedLocations = null;
let cacheTimestamp = null;
const CACHE_DURATION_MS = 10 * 60 * 1000; // 10 minutes

export default async function handler(req, res) {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return res.status(200).json({ success: true });
  }

  // Handle GET request for debugging/info (works even if Firebase Admin not initialized)
  if (req.method === 'GET') {
    // Check if this is a locations request
    if (req.url?.includes('locations') || req.query?.locations !== undefined) {
      // Locations endpoint needs Firebase Admin
      if (!admin.apps.length || !db || !auth) {
        console.error('❌ Firebase Admin not initialized - cannot fetch locations');
        return res.status(500).json({
          success: false,
          error: 'Firebase Admin SDK not initialized',
          message: 'Check server logs for credential configuration errors'
        });
      }
      return await getUserLocations(req, res);
    }
    
    // Regular GET request - return API info
    const availableActions = [
      'create-user',
      'bulk-import',
      'force-password-reset',
      'update-user',
      'get-audit-logs',
      'get-capabilities',
      'reject-and-delete-user'
    ];
    
    const isInitialized = admin.apps.length > 0 && db && auth;
    let projectId = null;
    
    if (isInitialized && admin.apps.length > 0) {
      try {
        projectId = admin.app().options.projectId;
      } catch (e) {
        console.warn('Could not get projectId from admin app:', e.message);
      }
    }
    
    // Update credential file info if GOOGLE_APPLICATION_CREDENTIALS is set but not yet resolved
    let credentialDiagnostics = {
      FIREBASE_SERVICE_ACCOUNT_KEY: !!process.env.FIREBASE_SERVICE_ACCOUNT_KEY,
      GOOGLE_APPLICATION_CREDENTIALS: process.env.GOOGLE_APPLICATION_CREDENTIALS || null,
      GOOGLE_APPLICATION_CREDENTIALS_resolvedPath: null,
      GOOGLE_APPLICATION_CREDENTIALS_fileExists: false,
      GOOGLE_APPLICATION_CREDENTIALS_checkedPaths: [],
      individualEnvVars: !!(process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY)
    };
    
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      // Use stored info if available, otherwise try to resolve now
      if (credentialFileInfo.resolvedPath !== null) {
        credentialDiagnostics.GOOGLE_APPLICATION_CREDENTIALS_resolvedPath = credentialFileInfo.resolvedPath;
        credentialDiagnostics.GOOGLE_APPLICATION_CREDENTIALS_fileExists = credentialFileInfo.fileExists;
        credentialDiagnostics.GOOGLE_APPLICATION_CREDENTIALS_checkedPaths = credentialFileInfo.checkedPaths;
      } else {
        // Try to resolve now for diagnostics (don't initialize, just check)
        const fileResult = findCredentialFile(process.env.GOOGLE_APPLICATION_CREDENTIALS);
        credentialDiagnostics.GOOGLE_APPLICATION_CREDENTIALS_resolvedPath = fileResult.path;
        credentialDiagnostics.GOOGLE_APPLICATION_CREDENTIALS_fileExists = !!fileResult.path;
        credentialDiagnostics.GOOGLE_APPLICATION_CREDENTIALS_checkedPaths = fileResult.checkedPaths;
      }
    }
    
    return res.status(200).json({
      ok: true,
      availableActions,
      firebaseAdminInitialized: isInitialized,
      projectId: projectId,
      message: isInitialized 
        ? 'User Admin API is running. Use POST with action and adminId for admin operations.'
        : 'User Admin API is running but Firebase Admin is not initialized. Check server logs for credential configuration errors.',
      credentialSources: credentialDiagnostics
    });
  }

  // For POST requests, Firebase Admin must be initialized
  if (!admin.apps.length || !db || !auth) {
    console.error('❌ Firebase Admin not initialized - cannot process request');
    console.error(`  - admin.apps.length: ${admin.apps.length}`);
    console.error(`  - db available: ${!!db}`);
    console.error(`  - auth available: ${!!auth}`);
    return res.status(500).json({
      success: false,
      error: 'Firebase Admin SDK not initialized',
      message: 'Check server logs for credential configuration errors',
      availableActions: []
    });
  }

  // Only allow POST requests for admin actions
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed',
      allowedMethods: ['GET', 'POST', 'OPTIONS']
    });
  }

  const { action, adminId } = req.body;

  // Verify admin permissions
  if (!adminId) {
    return res.status(401).json({ 
      success: false, 
      error: 'Admin ID required' 
    });
  }

  try {
    // Verify admin role
    const adminUser = await db.collection('users').doc(adminId).get();
    if (!adminUser.exists || !isAdminFromUserDoc(adminUser.data())) {
      return res.status(403).json({ 
        success: false, 
        error: 'Admin permissions required' 
      });
    }

    // Log the action being processed (for debugging)
    console.log(`🔍 Processing admin action: ${action} by admin ${adminId}`);
    
    switch (action) {
      case 'create-user':
        return await createUser(req, res, adminId);
      case 'bulk-import':
        return await bulkImport(req, res, adminId);
      case 'force-password-reset':
        return await forcePasswordReset(req, res, adminId);
      case 'generate-temp-password':
        return await generateTempPassword(req, res, adminId);
      case 'update-user':
        return await updateUser(req, res, adminId);
      case 'get-audit-logs':
        return await getAuditLogs(req, res, adminId);
      case 'get-capabilities':
        return await getCapabilities(req, res, adminId);
      case 'reject-and-delete-user':
        console.log('✅ Action "reject-and-delete-user" recognized, calling rejectAndDeleteUser function');
        return await rejectAndDeleteUser(req, res, adminId);
      default:
        console.error(`❌ Unknown action received: ${action}`);
        console.error(`❌ Available actions: create-user, bulk-import, force-password-reset, generate-temp-password, update-user, get-audit-logs, reject-and-delete-user`);
        return res.status(400).json({
          success: false,
          error: `Unknown action: ${action}. Available actions: create-user, bulk-import, force-password-reset, generate-temp-password, update-user, get-audit-logs, reject-and-delete-user`,
          receivedAction: action,
          availableActions: ['create-user', 'bulk-import', 'force-password-reset', 'generate-temp-password', 'update-user', 'get-audit-logs', 'reject-and-delete-user']
        });
    }
  } catch (error) {
    console.error(`❌ User Admin Error (${action}):`, error);
    return res.status(500).json({ 
      success: false, 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// Create a new user with temporary password
async function createUser(req, res, adminId) {
  const { 
    email, 
    name, 
    role = 'member',
    tempPassword,
    phone,
    company,
    work,
    position,
    linkedinUsername 
  } = req.body;

  if (!email || !name || !tempPassword) {
    return res.status(400).json({ 
      success: false, 
      error: 'Missing required fields: email, name, and tempPassword are required' 
    });
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ 
      success: false, 
      error: 'Invalid email format' 
    });
  }

  // Validate role
  if (!['member', 'admin'].includes(role)) {
    return res.status(400).json({ 
      success: false, 
      error: 'Invalid role. Must be: member or admin' 
    });
  }

  // Validate password strength
  if (tempPassword.length < 8) {
    return res.status(400).json({ 
      success: false, 
      error: 'Temporary password must be at least 8 characters long' 
    });
  }

  try {
    console.log(`👤 Creating new user: ${email} with role: ${role}`);

    // Create user in Firebase Auth
    const userRecord = await auth.createUser({
      email: email.toLowerCase().trim(),
      password: tempPassword,
      displayName: name.trim(),
      emailVerified: true // Admin-created users are automatically verified
    });

    console.log(`✅ Firebase Auth user created: ${userRecord.uid}`);

    // Set custom claims for role-based access
    await auth.setCustomUserClaims(userRecord.uid, {
      role: role,
      admin: role === 'admin',
    });
    console.log(`✅ Firebase Auth custom claims set for user: ${userRecord.uid} with role: ${role}`);

    // Create user profile in Firestore
    const userProfile = {
      email: email.toLowerCase().trim(),
      name: name.trim(),
      role,
      admin: role === 'admin',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: adminId,
      tempPasswordSet: true,
      mustChangePassword: true,
      status: 'approved', // Admin-created users are immediately approved
      ...(phone && { phone: phone.trim() }),
      ...(company && { company: company.trim() }),
      ...(work && { work: work.trim() }),
      ...(position && { position: position.trim() }),
      ...(linkedinUsername && { linkedinUsername: linkedinUsername.trim() })
    };

    await db.collection('users').doc(userRecord.uid).set(userProfile);
    console.log(`✅ User profile created in Firestore`);

    // Log audit trail
    await logAuditAction(adminId, 'USER_CREATED', {
      targetUserId: userRecord.uid,
      targetEmail: email,
      targetName: name,
      targetRole: role,
      tempPasswordSet: true
    });

    // Send credentials via email (using existing email service)
    try {
      // Import the email service directly instead of making HTTP request
      const emailServiceHandler = await import('./email-service.js');
      
      // Create a mock request object for the email service
      const emailReq = {
        method: 'POST',
        body: {
          type: 'user-credentials',
          email: email,
          name: name,
          tempPassword: tempPassword,
          loginUrl: `${process.env.VERCEL_URL || 'http://localhost:3000'}/login`
        }
      };
      
      const emailRes = {
        status: (code) => ({
          json: (data) => console.log('Email service response:', code, data)
        })
      };
      
      await emailServiceHandler.default(emailReq, emailRes);
      console.log('✅ Credentials email sent');
    } catch (emailError) {
      console.warn('⚠️ Failed to send credentials email:', emailError.message);
      // Don't fail the user creation if email fails
    }

    return res.status(200).json({ 
      success: true,
      user: {
        uid: userRecord.uid,
        email: userProfile.email,
        name: userProfile.name,
        role: userProfile.role,
        createdAt: new Date().toISOString(),
        mustChangePassword: true
      },
      message: 'User created successfully'
    });

  } catch (error) {
    console.error('❌ Error creating user:', error);
    
    // Handle specific Firebase Auth errors
    if (error.code === 'auth/email-already-exists') {
      return res.status(409).json({ 
        success: false, 
        error: 'A user with this email already exists' 
      });
    }
    
    if (error.code === 'auth/invalid-email') {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid email address' 
      });
    }

    throw error;
  }
}

// Bulk import users from CSV data
async function bulkImport(req, res, adminId) {
  const { users, defaultTempPassword } = req.body;

  if (!users || !Array.isArray(users) || users.length === 0) {
    return res.status(400).json({ 
      success: false, 
      error: 'Users array is required and cannot be empty' 
    });
  }

  if (!defaultTempPassword || defaultTempPassword.length < 8) {
    return res.status(400).json({ 
      success: false, 
      error: 'Default temporary password must be at least 8 characters long' 
    });
  }

  const results = {
    total: users.length,
    successful: [],
    failed: [],
    duplicates: []
  };

  console.log(`📦 Starting bulk import of ${users.length} users`);

  // Process users in batches to avoid timeout
  const batchSize = 10;
  for (let i = 0; i < users.length; i += batchSize) {
    const batch = users.slice(i, i + batchSize);
    
    await Promise.allSettled(batch.map(async (userData, index) => {
      try {
        const { email, name, role = 'member', phone, company, work, position, linkedinUsername } = userData;

        if (!email || !name) {
          throw new Error('Missing required fields: email and name');
        }

        const emailNormalized = email.toLowerCase().trim();
        const actualIndex = i + index + 1; // 1-based index for user reference

        console.log(`👤 Processing user ${actualIndex}/${users.length}: ${emailNormalized}`);

        // Check for existing user
        try {
          await auth.getUserByEmail(emailNormalized);
          results.duplicates.push({
            rowIndex: actualIndex,
            email: emailNormalized,
            name: name.trim(),
            error: 'User already exists'
          });
          return;
        } catch (notFoundError) {
          // User doesn't exist, continue with creation
        }

        // Create user in Firebase Auth
        const userRecord = await auth.createUser({
          email: emailNormalized,
          password: defaultTempPassword,
          displayName: name.trim(),
          emailVerified: true
        });

        // Set custom claims for role-based access
        await auth.setCustomUserClaims(userRecord.uid, {
          role: role,
          admin: role === 'admin',
        });

        // Create user profile in Firestore
        const userProfile = {
          email: emailNormalized,
          name: name.trim(),
          role,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          createdBy: adminId,
          tempPasswordSet: true,
          mustChangePassword: true,
          status: 'approved', // Bulk imported users are immediately approved
          importedAt: admin.firestore.FieldValue.serverTimestamp(),
          ...(phone && { phone: phone.trim() }),
          ...(company && { company: company.trim() }),
          ...(work && { work: work.trim() }),
          ...(position && { position: position.trim() }),
          ...(linkedinUsername && { linkedinUsername: linkedinUsername.trim() })
        };

        await db.collection('users').doc(userRecord.uid).set(userProfile);

        results.successful.push({
          rowIndex: actualIndex,
          uid: userRecord.uid,
          email: emailNormalized,
          name: name.trim(),
          role
        });

        console.log(`✅ User ${actualIndex} created successfully`);

      } catch (error) {
        console.error(`❌ Failed to create user ${i + index + 1}:`, error);
        results.failed.push({
          rowIndex: i + index + 1,
          email: userData.email,
          name: userData.name,
          error: error.message
        });
      }
    }));
  }

  // Log bulk import audit trail
  await logAuditAction(adminId, 'BULK_IMPORT', {
    totalUsers: results.total,
    successful: results.successful.length,
    failed: results.failed.length,
    duplicates: results.duplicates.length
  });

  console.log(`📦 Bulk import completed:`, {
    total: results.total,
    successful: results.successful.length,
    failed: results.failed.length,
    duplicates: results.duplicates.length
  });

  return res.status(200).json({ 
    success: true,
    results,
    message: `Bulk import completed. ${results.successful.length}/${results.total} users created successfully.`
  });
}

// Update user profile and role
async function updateUser(req, res, adminId) {
  const { targetUserId, updateData } = req.body;

  console.log('🔄 updateUser called with:');
  console.log('📋 targetUserId:', targetUserId);
  console.log('📋 updateData:', JSON.stringify(updateData, null, 2));
  console.log('📋 adminId:', adminId);

  if (!targetUserId) {
    return res.status(400).json({ 
      success: false, 
      error: 'Target user ID is required' 
    });
  }

  if (!updateData || typeof updateData !== 'object') {
    return res.status(400).json({ 
      success: false, 
      error: 'Update data is required' 
    });
  }

  try {
    console.log(`👤 Updating user: ${targetUserId}`);

    // Get current user data for audit log
    const userRef = db.collection('users').doc(targetUserId);
    const userDoc = await userRef.get();
    
    if (!userDoc.exists) {
      return res.status(404).json({ 
        success: false, 
        error: 'User not found' 
      });
    }

    const currentData = userDoc.data();
    const oldRole = currentData.role;
    const newRole = updateData.role !== undefined ? updateData.role : oldRole;
    const roleChanged = newRole !== oldRole;

    // Keep admin boolean in sync with role when role is updated.
    if (updateData.role !== undefined) {
      updateData.admin = newRole === 'admin';
    }

    // Compute which fields actually changed (so audit log only shows real changes)
    const metaKeys = ['updatedAt', 'updatedBy'];
    const actuallyChangedFields = Object.keys(updateData).filter((key) => {
      if (metaKeys.includes(key)) return false;
      const oldVal = currentData[key];
      const newVal = updateData[key];
      if (oldVal === newVal) return false;
      if (oldVal == null && newVal == null) return false;
      if (typeof oldVal === 'object' && oldVal && typeof oldVal.toDate === 'function') {
        const oldMs = oldVal.toDate ? oldVal.toDate().getTime() : NaN;
        const newMs = typeof newVal === 'object' && newVal && typeof newVal.toDate === 'function'
          ? newVal.toDate().getTime()
          : (typeof newVal === 'string' || typeof newVal === 'number') ? new Date(newVal).getTime() : NaN;
        return oldMs !== newMs && !Number.isNaN(newMs);
      }
      if (typeof newVal === 'object' && newVal && typeof newVal.toDate === 'function') {
        return true;
      }
      return String(oldVal) !== String(newVal);
    });

    // Prepare update data with timestamp
    const updatePayload = {
      ...updateData,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: adminId
    };

    // Update user profile in Firestore
    await userRef.update(updatePayload);

    // If role changed, also update Firebase Auth custom claims
    if (roleChanged) {
      try {
        const isAdminRole = newRole === 'admin';
        await auth.setCustomUserClaims(targetUserId, {
          role: newRole,
          admin: isAdminRole,
        });
        console.log(`✅ Updated Firebase Auth claims for user: ${targetUserId}`);
      } catch (authError) {
        console.warn('⚠️ Failed to update Firebase Auth claims:', authError.message);
        // Don't fail the entire operation if claims update fails
      }
    }

    // Log audit trail only when something meaningful changed
    const hasAnyChange = roleChanged || actuallyChangedFields.length > 0;
    if (hasAnyChange) {
      const auditDetails = {
        targetUserId: targetUserId,
        targetEmail: currentData.email,
        targetName: currentData.name || currentData.displayName,
        changedFields: actuallyChangedFields
      };
      if (roleChanged) {
        auditDetails.oldRole = oldRole;
        auditDetails.newRole = newRole;
      }
      await logAuditAction(adminId, roleChanged ? 'ROLE_CHANGED' : 'USER_UPDATED', auditDetails);
    }

    console.log(`✅ User ${targetUserId} updated successfully`);

    // Auto-sync the edited profile to HubSpot (same behavior as member self-edits).
    // Best-effort: a HubSpot failure must not fail the admin save.
    let hubspotSync = null;
    try {
      const mergedData = { ...currentData, ...updatePayload };
      const syncResult = await syncAdminEditedUserToHubspot(targetUserId, mergedData);
      hubspotSync = syncResult?.ok ? true : (syncResult?.skipped ? 'skipped' : false);
      if (syncResult?.ok) {
        console.log(`✅ Admin edit synced to HubSpot for ${targetUserId}`);
      } else if (syncResult?.skipped) {
        console.log(`ℹ️ HubSpot sync skipped for ${targetUserId}: ${syncResult.reason}`);
      } else {
        console.warn(`⚠️ HubSpot sync failed for ${targetUserId}: ${syncResult?.error}`);
      }
    } catch (syncErr) {
      console.warn('⚠️ HubSpot sync threw (non-blocking):', syncErr?.message || syncErr);
    }

    return res.status(200).json({ 
      success: true,
      message: 'User updated successfully',
      changedFields: actuallyChangedFields.length > 0 ? actuallyChangedFields : (roleChanged ? ['role'] : []),
      hubspotSync
    });

  } catch (error) {
    console.error('❌ Error updating user:', error);
    throw error;
  }
}

// Force password reset for a user
async function forcePasswordReset(req, res, adminId) {
  const { targetUserId } = req.body;

  if (!targetUserId) {
    return res.status(400).json({ 
      success: false, 
      error: 'Target user ID is required' 
    });
  }

  try {
    // Get user info first
    const userDoc = await db.collection('users').doc(targetUserId).get();
    
    if (!userDoc.exists) {
      return res.status(404).json({ 
        success: false, 
        error: 'User not found' 
      });
    }

    const userData = userDoc.data();
    const userEmail = userData?.email;

    if (!userEmail) {
      return res.status(400).json({ 
        success: false, 
        error: 'User email not found' 
      });
    }

    // Default temporary password (same as bulk import)
    const defaultTempPassword = '12345678';

    // Reset password in Firebase Auth to default temporary password
    try {
      // Get the user by email to get their UID in Firebase Auth
      let firebaseAuthUser;
      try {
        firebaseAuthUser = await auth.getUserByEmail(userEmail);
      } catch (authError) {
        // If user doesn't exist in Firebase Auth, try using targetUserId directly
        try {
          firebaseAuthUser = await auth.getUser(targetUserId);
        } catch (uidError) {
          console.error('❌ User not found in Firebase Auth:', authError.message);
          return res.status(404).json({ 
            success: false, 
            error: 'User not found in Firebase Auth. Please ensure the user exists.' 
          });
        }
      }

      // Update the password in Firebase Auth
      await auth.updateUser(firebaseAuthUser.uid, {
        password: defaultTempPassword
      });

      console.log(`✅ Password reset in Firebase Auth for user: ${firebaseAuthUser.uid}`);
    } catch (authError) {
      console.error('❌ Error resetting password in Firebase Auth:', authError);
      // Continue with Firestore update even if Auth update fails
      // This ensures the flag is set so user knows they need to change password
    }

    // Update user profile to require password change
    await db.collection('users').doc(targetUserId).update({
      mustChangePassword: true,
      tempPasswordSet: true, // Mark as temporary password
      passwordResetForcedAt: admin.firestore.FieldValue.serverTimestamp(),
      passwordResetForcedBy: adminId
    });

    // Log audit trail
    await logAuditAction(adminId, 'FORCE_PASSWORD_RESET', {
      targetUserId: targetUserId,
      targetEmail: userData?.email,
      targetName: userData?.name,
      passwordReset: true
    });

    console.log(`🔐 Forced password reset for user: ${targetUserId} (password set to default)`);

    return res.status(200).json({ 
      success: true,
      message: 'Password has been reset to default temporary password. User will be required to change it on next login.'
    });

  } catch (error) {
    console.error('❌ Error forcing password reset:', error);
    throw error;
  }
}

// Admin tool: generate a one-time strong temporary password for a member,
// set it on their Firebase Auth account, flag them as mustChangePassword,
// and return the plaintext to the admin EXACTLY once. The password is
// never stored in Firestore in plaintext (only the boolean flags).
async function generateTempPassword(req, res, adminId) {
  const { targetUserId } = req.body;

  if (!targetUserId) {
    return res.status(400).json({
      success: false,
      error: 'Target user ID is required'
    });
  }

  function randomTempPassword() {
    // 14-char password from an unambiguous alphabet (no 0/O/1/l/I to make it copyable).
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
    const buf = require('crypto').randomBytes(14);
    let out = '';
    for (let i = 0; i < buf.length; i++) {
      out += chars[buf[i] % chars.length];
    }
    // Ensure at least one digit and one letter for downstream policy.
    if (!/\d/.test(out)) out = out.slice(0, -1) + '7';
    if (!/[A-Za-z]/.test(out)) out = 'A' + out.slice(1);
    return out;
  }

  try {
    const userDoc = await db.collection('users').doc(targetUserId).get();
    if (!userDoc.exists) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    const userData = userDoc.data();
    const userEmail = userData?.email;
    if (!userEmail) {
      return res.status(400).json({ success: false, error: 'User has no email on file' });
    }

    let firebaseAuthUser;
    try {
      firebaseAuthUser = await auth.getUser(targetUserId);
    } catch (_) {
      try {
        firebaseAuthUser = await auth.getUserByEmail(userEmail);
      } catch (lookupErr) {
        console.error('❌ generate-temp-password: user not in Firebase Auth', lookupErr?.message);
        return res.status(404).json({
          success: false,
          error: 'User not found in Firebase Auth.'
        });
      }
    }

    const tempPassword = randomTempPassword();
    await auth.updateUser(firebaseAuthUser.uid, { password: tempPassword });

    await db.collection('users').doc(targetUserId).update({
      mustChangePassword: true,
      tempPasswordSet: true,
      tempPasswordIssuedAt: admin.firestore.FieldValue.serverTimestamp(),
      tempPasswordIssuedBy: adminId
    });

    await logAuditAction(adminId, 'GENERATE_TEMP_PASSWORD', {
      targetUserId,
      targetEmail: userEmail,
      targetName: userData?.name,
    });

    console.log(`🔐 Generated one-time temp password for user ${targetUserId} by admin ${adminId}`);

    return res.status(200).json({
      success: true,
      tempPassword,
      message: 'Temporary password generated. Share it with the member through a secure channel; they will be required to change it on next login.'
    });
  } catch (error) {
    console.error('❌ Error generating temporary password:', error);
    return res.status(500).json({
      success: false,
      error: error?.message || 'Failed to generate temporary password'
    });
  }
}

// Get audit logs for admin actions
async function getAuditLogs(req, res, adminId) {
  const { limit = 100, startAfter } = req.body;

  try {
    let query = db.collection('audit_logs')
      .orderBy('timestamp', 'desc')
      .limit(parseInt(limit));

    if (startAfter) {
      const startAfterDoc = await db.collection('audit_logs').doc(startAfter).get();
      query = query.startAfter(startAfterDoc);
    }

    const snapshot = await query.get();
    const logs = [];

    snapshot.forEach(doc => {
      logs.push({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate?.()?.toISOString() || doc.data().timestamp
      });
    });

    return res.status(200).json({ 
      success: true,
      logs,
      hasMore: snapshot.size === parseInt(limit),
      lastDoc: snapshot.size > 0 ? snapshot.docs[snapshot.size - 1].id : null
    });

  } catch (error) {
    console.error('❌ Error fetching audit logs:', error);
    throw error;
  }
}

// Get server capabilities and version info
async function getCapabilities(req, res, adminId) {
  try {
    const projectId = admin.apps.length > 0 ? admin.app().options.projectId : 'NOT SET';
    const serviceAccountEmail = process.env.FIREBASE_CLIENT_EMAIL || 
                               (admin.apps.length > 0 && typeof admin.app().options.credential === 'object'
                                 ? 'Service account from credential' 
                                 : 'NOT SET');
    
    // Get file modification time as a simple version indicator
    // In production, this will be the deployment time
    const buildTime = process.env.VERCEL ? new Date().toISOString() : 
                     (process.env.BUILD_TIME || new Date().toISOString());
    
    const availableActions = [
      'create-user',
      'bulk-import',
      'force-password-reset',
      'update-user',
      'get-audit-logs',
      'get-capabilities',
      'reject-and-delete-user'
    ];

    return res.status(200).json({
      success: true,
      capabilities: {
        version: buildTime,
        projectId: projectId,
        serviceAccount: serviceAccountEmail,
        availableActions: availableActions,
        firebaseAdminInitialized: admin.apps.length > 0,
        authAvailable: !!auth,
        firestoreAvailable: !!db
      },
      serverInfo: {
        environment: process.env.NODE_ENV || 'unknown',
        platform: process.env.VERCEL ? 'Vercel' : 
                  (process.env.NETLIFY ? 'Netlify' : 'Unknown'),
        region: process.env.VERCEL_REGION || process.env.AWS_REGION || 'unknown'
      }
    });
  } catch (error) {
    console.error('❌ Error getting capabilities:', error);
    throw error;
  }
}

/**
 * Push an admin-edited user's profile to HubSpot, mirroring the member self-edit flow
 * in update-profile.js. Only approved members are synced. Best-effort: never throws.
 * Returns { ok, hubspotContactId?, error? }.
 */
async function syncAdminEditedUserToHubspot(targetUserId, mergedData) {
  try {
    // Only approved members should appear in HubSpot
    if (mergedData.status && mergedData.status !== 'approved') {
      return { ok: false, skipped: true, reason: `status is "${mergedData.status}"` };
    }

    // Normalize aliases so HubSpot receives canonical values (same rules as update-profile.js)
    const merged = { ...mergedData };
    if (merged.fullName !== undefined) {
      merged.name = merged.fullName;
      merged.displayName = merged.fullName;
    }
    if (merged.company !== undefined) merged.organization = merged.company;
    else if (merged.organization !== undefined) merged.company = merged.organization;
    if (merged.work !== undefined && merged.title === undefined) merged.title = merged.title || merged.work;
    else if (merged.title !== undefined && merged.work === undefined) merged.work = merged.work || merged.title;
    if (merged.bioShort !== undefined) merged.bioTitle = merged.bioShort;
    if (merged.bioLong !== undefined) merged.bio = merged.bioLong;
    if (merged.linkedinUrl !== undefined) merged.linkedin = merged.linkedinUrl;

    const canonicalEmail = (merged.email || '').toString().trim().toLowerCase() || null;
    if (!canonicalEmail) {
      return { ok: false, skipped: true, reason: 'no email on profile' };
    }

    const profileForHubSpot = {
      ...merged,
      email: merged.email,
      hubspotContactId: merged.hubspotContactId || null,
      _lookupEmail: canonicalEmail,
    };

    const syncResult = await upsertHubspotContact(profileForHubSpot);

    // Record sync status back on the user doc
    const hubspotUpdate = {
      hubspotLastSyncedAt: admin.firestore.FieldValue.serverTimestamp(),
      hubspotSyncStatus: syncResult.ok ? 'ok' : 'error',
      ...(syncResult.hubspotContactId && { hubspotContactId: syncResult.hubspotContactId }),
      ...(syncResult.ok ? {} : { hubspotSyncError: syncResult.error || 'Sync failed' }),
    };
    await db.collection('users').doc(targetUserId).set(hubspotUpdate, { merge: true });

    return syncResult;
  } catch (err) {
    console.warn('[user-admin] HubSpot sync after admin edit failed (non-blocking):', err?.message || err);
    return { ok: false, error: err?.message || 'HubSpot sync error' };
  }
}

// Helper function to log audit actions
async function logAuditAction(adminId, action, details = {}) {
  try {
    const logEntry = {
      adminId,
      action,
      details,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      userAgent: details.userAgent || 'API',
      ipAddress: details.ipAddress || 'unknown'
    };

    await db.collection('audit_logs').add(logEntry);
    console.log(`📝 Audit log created: ${action}`);
  } catch (error) {
    console.error('❌ Failed to create audit log:', error);
    // Don't throw error to avoid blocking main operation
  }
}

// Get user locations for Member Map (public endpoint, no auth required)
async function getUserLocations(req, res) {
  try {
    // Check if we have valid cached data
    const now = Date.now();
    if (cachedLocations && cacheTimestamp && (now - cacheTimestamp < CACHE_DURATION_MS)) {
      console.log(`✅ Serving ${cachedLocations.length} cached user locations (${Math.floor((now - cacheTimestamp) / 1000)}s old)`);
      return res.status(200).json(cachedLocations);
    }

    console.log('🗺️  Fetching users with location data from Firestore...');

    // EFFICIENT QUERY: Only fetch users who have BOTH city AND country
    // This dramatically reduces the number of documents we need to read
    // Note: Using '>' instead of '!=' because Firestore only allows one != operator per query
    const usersSnapshot = await db.collection('users')
      .where('city', '>', '')
      .where('country', '>', '')
      .limit(1000) // Reasonable limit for most use cases
      .get();

    const usersWithLocations = [];

    usersSnapshot.forEach(doc => {
      const userData = doc.data();

      // Double-check both fields exist (Firestore != null can be quirky)
      if (userData.city && userData.country) {
        // Construct profile URL
        const profileUrl = `/profile/${doc.id}`;

        // Use displayName, or construct from firstName/lastName, or use email
        const username = userData.displayName ||
                        `${userData.firstName || ''} ${userData.lastName || ''}`.trim() ||
                        userData.email ||
                        'Unknown User';

        usersWithLocations.push({
          username,
          city: userData.city,
          country: userData.country,
          profileUrl
        });
      }
    });

    // Cache the results
    cachedLocations = usersWithLocations;
    cacheTimestamp = now;

    console.log(`✅ Found and cached ${usersWithLocations.length} users with location data (${usersSnapshot.size} documents read)`);

    return res.status(200).json(usersWithLocations);

  } catch (error) {
    console.error('❌ Error fetching users with locations:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      stack: error.stack
    });
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch users with locations',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

/**
 * Reject a join request and delete the user completely from the system
 * 
 * IMPORTANT: This MUST be done server-side using Firebase Admin SDK because:
 * 1. Client-side code cannot delete Firebase Auth users (security restriction)
 * 2. Only Admin SDK has the permissions to delete Auth accounts
 * 3. This is the ONLY way to free the email for re-signup
 * 
 * This function performs a complete purge:
 * 1. Deletes joinRequests/{uid} document
 * 2. Deletes users/{uid} document (if exists)
 * 3. Deletes registrations/{uid} document (if exists)
 * 4. Deletes all event registrations (if any)
 * 5. Deletes Firebase Auth user account (CRITICAL - frees email)
 * 
 * After this operation, the user can sign up again with the same email.
 * 
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {string} adminId - Admin user ID
 */
async function rejectAndDeleteUser(req, res, adminId) {
  // Extract and validate uid from request body
  const { uid } = req.body;

  console.log('🔍 rejectAndDeleteUser function called');
  console.log('🔍 Request body keys:', Object.keys(req.body));
  console.log('🔍 Request body:', { uid, adminId, action: req.body.action });
  console.log('🔍 Admin ID:', adminId);
  console.log('🔍 User UID to delete:', uid);

  // Validate uid is provided
  if (!uid) {
    console.error('❌ Missing UID in request body');
    console.error('❌ Full request body:', req.body);
    return res.status(400).json({
      success: false,
      error: 'User UID is required',
      receivedBody: req.body
    });
  }

  // Validate uid is a string
  if (typeof uid !== 'string' || uid.trim() === '') {
    console.error('❌ Invalid UID format:', typeof uid, uid);
    return res.status(400).json({
      success: false,
      error: 'User UID must be a non-empty string',
      receivedUid: uid,
      uidType: typeof uid
    });
  }

  try {
    console.log(`🗑️ Admin ${adminId} rejecting and purging user ${uid}`);
    console.log(`🔍 Starting comprehensive user purge...`);

    // Get user email from Auth before deletion (for logging and potential email-based cleanup)
    let userEmail = null;
    try {
      const authUser = await auth.getUser(uid);
      userEmail = authUser.email;
      console.log(`📧 User email: ${userEmail}`);
    } catch (getUserError) {
      console.warn(`⚠️ Could not fetch Auth user (may not exist): ${getUserError.message}`);
    }

    const deletionResults = {
      joinRequestDeleted: false,
      userDocDeleted: false,
      registrationsDeleted: false,
      eventRegistrationsDeleted: 0,
      chatMembersRemoved: 0,
      authUserDeleted: false,
      errors: [],
      deletedCollections: []
    };

    // Step 1: Delete join request document
    // NOTE: We delete directly (don't update to rejected first) since we're doing a full purge
    try {
      const joinRequestRef = db.collection('joinRequests').doc(uid);
      const joinRequestDoc = await joinRequestRef.get();
      
      if (joinRequestDoc.exists) {
        // Delete directly - full purge, no need to mark as rejected
        await joinRequestRef.delete();
        deletionResults.joinRequestDeleted = true;
        deletionResults.deletedCollections.push('joinRequests');
        console.log('✅ Join request deleted from Firestore');
      } else {
        console.log('ℹ️ Join request document not found (may have been deleted already)');
      }
    } catch (joinRequestError) {
      const errorMsg = `Failed to delete join request: ${joinRequestError.message}`;
      console.error('❌', errorMsg);
      console.error('❌ Join request deletion error details:', {
        code: joinRequestError.code,
        message: joinRequestError.message,
        stack: joinRequestError.stack
      });
      deletionResults.errors.push(errorMsg);
    }

    // Step 2: Delete user document (if exists)
    try {
      const userRef = db.collection('users').doc(uid);
      const userDoc = await userRef.get();
      
      if (userDoc.exists) {
        await userRef.delete();
        deletionResults.userDocDeleted = true;
        deletionResults.deletedCollections.push('users');
        console.log('✅ User document deleted from Firestore');
      } else {
        console.log('ℹ️ User document not found (expected for pending requests)');
      }
    } catch (userDocError) {
      const errorMsg = `Failed to delete user document: ${userDocError.message}`;
      console.error('❌', errorMsg);
      deletionResults.errors.push(errorMsg);
    }

    // Step 2b: Delete from registrations collection (if exists)
    // This collection stores event registrations at the root level
    try {
      const registrationRef = db.collection('registrations').doc(uid);
      const registrationDoc = await registrationRef.get();
      
      if (registrationDoc.exists) {
        await registrationRef.delete();
        deletionResults.registrationsDeleted = true;
        deletionResults.deletedCollections.push('registrations');
        console.log('✅ Registration document deleted from Firestore');
      }
    } catch (registrationError) {
      const errorMsg = `Failed to delete registration: ${registrationError.message}`;
      console.error('❌', errorMsg);
      deletionResults.errors.push(errorMsg);
    }

    // Step 2c: Delete from all event registrations subcollections
    // events/{eventId}/registrations/{uid}
    try {
      const eventsSnapshot = await db.collection('events').get();
      let eventRegistrationsDeleted = 0;
      
      for (const eventDoc of eventsSnapshot.docs) {
        const eventId = eventDoc.id;
        const eventRegRef = db.collection('events').doc(eventId).collection('registrations').doc(uid);
        const eventRegDoc = await eventRegRef.get();
        
        if (eventRegDoc.exists) {
          await eventRegRef.delete();
          eventRegistrationsDeleted++;
          console.log(`✅ Deleted registration from event: ${eventId}`);
        }
      }
      
      if (eventRegistrationsDeleted > 0) {
        deletionResults.eventRegistrationsDeleted = eventRegistrationsDeleted;
        deletionResults.deletedCollections.push(`events/*/registrations (${eventRegistrationsDeleted} events)`);
        console.log(`✅ Deleted ${eventRegistrationsDeleted} event registration(s)`);
      }
    } catch (eventRegError) {
      const errorMsg = `Failed to delete event registrations: ${eventRegError.message}`;
      console.error('❌', errorMsg);
      deletionResults.errors.push(errorMsg);
    }

    // Step 2d: Remove user from all group chats (chat_members where userId == uid)
    try {
      const chatMembersSnapshot = await db.collection('chat_members')
        .where('userId', '==', uid)
        .get();

      if (!chatMembersSnapshot.empty) {
        const BATCH_SIZE = 500;
        let totalRemoved = 0;
        const memberDocs = chatMembersSnapshot.docs;

        for (let i = 0; i < memberDocs.length; i += BATCH_SIZE) {
          const batch = db.batch();
          const chunk = memberDocs.slice(i, i + BATCH_SIZE);
          chunk.forEach((docSnap) => {
            batch.delete(docSnap.ref);
          });
          await batch.commit();
          totalRemoved += chunk.length;
        }

        deletionResults.chatMembersRemoved = totalRemoved;
        deletionResults.deletedCollections.push(`chat_members (${totalRemoved} removed)`);
        console.log(`✅ Removed user from ${totalRemoved} chat(s)`);
      } else {
        console.log('ℹ️ User was not a member of any chats');
      }
    } catch (chatMembersError) {
      const errorMsg = `Failed to remove user from chats: ${chatMembersError.message}`;
      console.error('❌', errorMsg);
      deletionResults.errors.push(errorMsg);
    }

    // Step 3: Delete Firebase Auth user (most important - allows re-signup)
    // This is the CRITICAL step - without this, the email remains "taken" in Firebase Auth
    try {
      const currentProjectId = admin.apps.length > 0 ? admin.app().options.projectId : 'NOT SET';
      const serviceAccountEmail = admin.apps.length > 0 && admin.app().options.credential 
        ? (typeof admin.app().options.credential === 'object' && 'getAccessToken' in admin.app().options.credential
            ? 'Service account from credential' 
            : 'Unknown')
        : 'NOT SET';
      
      console.log(`🔍 Attempting to delete Firebase Auth user: ${uid}`);
      console.log(`🔍 Auth instance available: ${auth ? 'yes' : 'no'}`);
      console.log(`🔍 Admin app initialized: ${admin.apps.length > 0 ? 'yes' : 'no'}`);
      console.log(`🔍 Admin app project ID: ${currentProjectId}`);
      console.log(`🔍 Environment GCLOUD_PROJECT: ${process.env.GCLOUD_PROJECT || 'NOT SET'}`);
      console.log(`🔍 Environment FIREBASE_PROJECT_ID: ${process.env.FIREBASE_PROJECT_ID || 'NOT SET'}`);
      console.log(`🔍 Service account: ${serviceAccountEmail}`);
      
      if (!auth) {
        throw new Error('Firebase Auth instance is not available. Check Admin SDK initialization.');
      }
      
      // If projectId cannot be detected from admin.app().options, log a warning but still proceed.
      // The Admin SDK can still resolve the project from service account / env; we don't want
      // this guard to block deletion when everything else is configured correctly.
      if (currentProjectId === 'NOT SET' || !currentProjectId) {
        console.warn('⚠️ Firebase project ID not detected from admin.app().options.projectId; proceeding with Auth deletion based on service account / environment.');
      }
      
      // Verify user exists before deletion (for better error messages)
      try {
        const verifyUser = await auth.getUser(uid);
        console.log(`🔍 Auth user exists: ${verifyUser.email}`);
      } catch (verifyError) {
        if (verifyError.code === 'auth/user-not-found') {
          console.log('ℹ️ Auth user not found (may have been deleted already)');
          deletionResults.authUserDeleted = true; // Consider it successful
          // Skip deletion, user already gone
        } else {
          throw verifyError;
        }
      }
      
      // Only delete if user exists
      if (!deletionResults.authUserDeleted) {
        await auth.deleteUser(uid);
        deletionResults.authUserDeleted = true;
        console.log('✅ User deleted from Firebase Auth successfully');
        
        // Verify deletion succeeded
        try {
          await auth.getUser(uid);
          // If we get here, deletion failed (user still exists)
          throw new Error('Auth user still exists after deletion attempt');
        } catch (verifyDeleteError) {
          if (verifyDeleteError.code === 'auth/user-not-found') {
            console.log('✅ Verified: Auth user successfully deleted (user-not-found as expected)');
            console.log(`✅ Email ${userEmail || '(unknown)'} should now be available for re-signup`);
          } else {
            console.warn('⚠️ Could not verify Auth deletion:', verifyDeleteError.message);
          }
        }
      }
    } catch (authError) {
      const errorMsg = `Failed to delete Auth user: ${authError.message}`;
      const currentProjectId = admin.apps.length > 0 ? admin.app().options.projectId : 'NOT SET';
      
      console.error('❌ Auth deletion error:', {
        code: authError.code,
        message: authError.message,
        stack: authError.stack,
        projectId: currentProjectId,
        uid: uid
      });
      deletionResults.errors.push(errorMsg);

      // If Auth deletion fails, this is critical - user cannot re-signup
      if (authError.code === 'auth/user-not-found') {
        console.log('ℹ️ Auth user not found (may have been deleted already)');
        deletionResults.authUserDeleted = true; // Consider it successful if already gone
      } else if (authError.code === 'auth/insufficient-permission' || 
                 authError.message?.includes('permission') ||
                 authError.message?.includes('Permission denied')) {
        // Permission error - provide clear guidance
        const serviceAccountEmail = process.env.FIREBASE_CLIENT_EMAIL || 
                                   (admin.apps.length > 0 && typeof admin.app().options.credential === 'object' 
                                     ? 'Check service account in FIREBASE_SERVICE_ACCOUNT_KEY' 
                                     : 'NOT SET');
        
        console.error('🚫 PERMISSION ERROR: Service account lacks permission to delete Auth users');
        console.error('🚫 Service account:', serviceAccountEmail);
        console.error('🚫 Project ID:', currentProjectId);
        console.error('🚫 Required role: Firebase Authentication Admin');
        console.error('🚫 How to fix: Grant "Firebase Authentication Admin" role to service account in IAM');
        
        return res.status(403).json({
          success: false,
          error: 'Backend lacks permission to delete Firebase Auth users. Service account needs "Firebase Authentication Admin" role.',
          details: deletionResults,
          permissionError: true,
          serviceAccount: serviceAccountEmail,
          projectId: currentProjectId,
          requiredRole: 'Firebase Authentication Admin',
          fixInstructions: 'Grant "Firebase Authentication Admin" role to the service account in Google Cloud IAM',
          authErrorCode: authError.code,
          authErrorMessage: authError.message
        });
      } else {
        // For other errors, return error with detailed information
        console.error('🚫 CRITICAL: Auth deletion failed. User cannot re-signup with same email.');
        console.error('🚫 Error details:', {
          code: authError.code,
          message: authError.message,
          uid: uid,
          projectId: currentProjectId
        });
        
        return res.status(500).json({
          success: false,
          error: `Failed to delete Firebase Auth user: ${authError.message}. User may not be able to re-signup with the same email. Please check server logs.`,
          details: deletionResults,
          partialSuccess: deletionResults.joinRequestDeleted || deletionResults.userDocDeleted,
          authErrorCode: authError.code,
          authErrorMessage: authError.message,
          projectId: currentProjectId
        });
      }
    }

    // If we got here, at least Auth deletion succeeded (or user was already gone)
    if (deletionResults.errors.length > 0) {
      // Some Firestore deletions may have failed, but Auth deletion succeeded
      return res.status(200).json({
        success: true,
        message: 'User rejected and deleted. Some cleanup operations had warnings.',
        details: deletionResults,
        warnings: deletionResults.errors
      });
    }

    // Final summary
    const deletedCount = [
      deletionResults.joinRequestDeleted,
      deletionResults.userDocDeleted,
      deletionResults.registrationsDeleted,
      deletionResults.eventRegistrationsDeleted > 0,
      deletionResults.authUserDeleted
    ].filter(Boolean).length;

    console.log(`✅ Purge complete. Deleted from ${deletedCount} location(s):`, deletionResults.deletedCollections);
    console.log(`✅ Auth user deleted: ${deletionResults.authUserDeleted ? 'YES' : 'NO'}`);
    if (userEmail) {
      console.log(`✅ Email ${userEmail} should now be available for re-signup`);
    }

    return res.status(200).json({
      ok: true,
      success: true,
      message: 'User rejected and completely purged from the system. They can now re-apply with the same email.',
      details: deletionResults,
      email: userEmail, // Include email for admin reference
      deletedFrom: deletionResults.deletedCollections
    });

  } catch (error) {
    console.error('❌ Error rejecting and purging user:', error);
    console.error('❌ Error stack:', error.stack);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}