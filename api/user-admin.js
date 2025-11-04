// User Admin API - Create, manage, and import users with temporary passwords
import admin from 'firebase-admin';

// Initialize Firebase Admin (reuse existing instance if available)
if (!admin.apps.length) {
  try {
    // Try to use service account key from environment variable (Vercel production)
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      // Check if it's base64 encoded (more reliable for Vercel)
      let serviceAccountKey;
      try {
        // Try base64 decode first
        const decoded = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_KEY, 'base64').toString('utf8');
        serviceAccountKey = JSON.parse(decoded);
      } catch {
        // If base64 decode fails, try parsing as JSON directly
        serviceAccountKey = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
      }
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccountKey),
      });
    } else {
      // Fallback to individual environment variables (local development)
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
      });
    }
  } catch (error) {
    console.error('Failed to initialize Firebase Admin:', error);
    throw error;
  }
}

const db = admin.firestore();
const auth = admin.auth();

// In-memory cache for member locations (public endpoint)
let cachedLocations = null;
let cacheTimestamp = null;
const CACHE_DURATION_MS = 10 * 60 * 1000; // 10 minutes

export default async function handler(req, res) {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return res.status(200).json({ success: true });
  }

  // Handle GET request for member locations (public endpoint, no auth required)
  // Check both req.url (for dev-server) and req.query (for Vercel)
  if (req.method === 'GET' && (req.url?.includes('locations') || req.query?.locations !== undefined)) {
    return await getUserLocations(req, res);
  }

  // Only allow POST requests for admin actions
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
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
    if (!adminUser.exists || adminUser.data()?.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        error: 'Admin permissions required' 
      });
    }

    switch (action) {
      case 'create-user':
        return await createUser(req, res, adminId);
      case 'bulk-import':
        return await bulkImport(req, res, adminId);
      case 'force-password-reset':
        return await forcePasswordReset(req, res, adminId);
      case 'update-user':
        return await updateUser(req, res, adminId);
      case 'get-audit-logs':
        return await getAuditLogs(req, res, adminId);
      default:
        return res.status(400).json({ 
          success: false, 
          error: `Unknown action: ${action}. Available actions: create-user, bulk-import, force-password-reset, update-user, get-audit-logs` 
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
  if (!['member', 'admin', 'speaker'].includes(role)) {
    return res.status(400).json({ 
      success: false, 
      error: 'Invalid role. Must be: member, admin, or speaker' 
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
      role: role
    });
    console.log(`✅ Firebase Auth custom claims set for user: ${userRecord.uid} with role: ${role}`);

    // Create user profile in Firestore
    const userProfile = {
      email: email.toLowerCase().trim(),
      name: name.trim(),
      role,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: adminId,
      tempPasswordSet: true,
      mustChangePassword: true,
      status: 'active',
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
          role: role
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
          status: 'active',
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
    
    // Prepare update data with timestamp
    const updatePayload = {
      ...updateData,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: adminId
    };

    // Update user profile in Firestore
    await userRef.update(updatePayload);

    // If role changed, also update Firebase Auth custom claims
    if (updateData.role && updateData.role !== oldRole) {
      try {
        await auth.setCustomUserClaims(targetUserId, {
          role: updateData.role
        });
        console.log(`✅ Updated Firebase Auth claims for user: ${targetUserId}`);
      } catch (authError) {
        console.warn('⚠️ Failed to update Firebase Auth claims:', authError.message);
        // Don't fail the entire operation if claims update fails
      }
    }

    // Log audit trail
    const auditDetails = {
      targetUserId: targetUserId,
      targetEmail: currentData.email,
      targetName: currentData.name || currentData.displayName,
      changedFields: Object.keys(updateData),
      oldRole: oldRole,
      newRole: updateData.role || oldRole
    };

    if (updateData.role && updateData.role !== oldRole) {
      await logAuditAction(adminId, 'ROLE_CHANGED', auditDetails);
    } else {
      await logAuditAction(adminId, 'USER_UPDATED', auditDetails);
    }

    console.log(`✅ User ${targetUserId} updated successfully`);

    return res.status(200).json({ 
      success: true,
      message: 'User updated successfully',
      changedFields: Object.keys(updateData)
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
    // Update user profile to require password change
    await db.collection('users').doc(targetUserId).update({
      mustChangePassword: true,
      passwordResetForcedAt: admin.firestore.FieldValue.serverTimestamp(),
      passwordResetForcedBy: adminId
    });

    // Get user info for audit log
    const userDoc = await db.collection('users').doc(targetUserId).get();
    const userData = userDoc.data();

    // Log audit trail
    await logAuditAction(adminId, 'FORCE_PASSWORD_RESET', {
      targetUserId: targetUserId,
      targetEmail: userData?.email,
      targetName: userData?.name
    });

    console.log(`🔐 Forced password reset for user: ${targetUserId}`);

    return res.status(200).json({ 
      success: true,
      message: 'User will be required to change password on next login'
    });

  } catch (error) {
    console.error('❌ Error forcing password reset:', error);
    throw error;
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