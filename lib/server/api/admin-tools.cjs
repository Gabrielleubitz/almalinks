// Consolidated admin tools API - combines multiple endpoints to reduce Vercel function count
const admin = require('firebase-admin');

// Initialize Firebase Admin (reuse existing instance if available)
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = admin.firestore();

module.exports = async function handler(req, res) {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return res.status(200).json({ success: true });
  }

  const { action } = req.query;

  try {
    switch (action) {
      case 'test-registration-data':
        return await testRegistrationData(req, res);
      case 'cleanup-registration-urls':
        return await cleanupRegistrationUrls(req, res);
      default:
        return res.status(400).json({ 
          success: false, 
          error: `Unknown action: ${action}. Available actions: test-registration-data, cleanup-registration-urls` 
        });
    }
  } catch (error) {
    console.error(`❌ Admin Tools Error (${action}):`, error);
    return res.status(500).json({ 
      success: false, 
      error: error.message,
      stack: error.stack
    });
  }
};

// Test registration/connection URL data for an event
async function testRegistrationData(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed for test-registration-data' });
  }

  const { eventId } = req.query;

  if (!eventId) {
    return res.status(400).json({ error: 'Missing eventId parameter' });
  }

  console.log(`🔍 Testing registration data for event: ${eventId}`);
  
  const registrationsSnapshot = await db.collection('events').doc(eventId).collection('registrations').get();
  
  const testData = [];
  registrationsSnapshot.forEach(doc => {
    const registration = doc.data();
    const userId = doc.id;
    testData.push({
      userId,
      userName: registration.name || 'Unknown',
      hasTicketUrl: !!registration.ticket_url
    });
  });

  console.log(`📊 Registration test results:`, testData);

  return res.status(200).json({
    success: true,
    eventId,
    totalAttendees: testData.length,
    registrationData: testData,
    analysis: {
      withTicketUrl: testData.filter(item => item.hasTicketUrl).length
    }
  });
}

// Remove legacy qrCodeUrl and checkInCode from registrations (no QR connection feature)
async function cleanupRegistrationUrls(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed for cleanup-registration-urls' });
  }

  const { eventId, dryRun = true } = req.body;

  if (!eventId) {
    return res.status(400).json({ error: 'Missing eventId parameter' });
  }

  console.log(`🧹 Removing legacy qrCodeUrl/checkInCode from registrations for event: ${eventId} (dryRun: ${dryRun})`);

  const registrationsSnapshot = await db.collection('events').doc(eventId).collection('registrations').get();

  const cleanupResults = {
    totalRegistrations: registrationsSnapshot.size,
    withLegacyFields: [],
    cleaned: [],
    noLegacyFields: []
  };

  const batch = db.batch();
  let batchCount = 0;

  for (const doc of registrationsSnapshot.docs) {
    const registration = doc.data();
    const userId = doc.id;
    const userName = registration.name || 'Unknown';
    const hasLegacy = registration.qrCodeUrl !== undefined || registration.checkInCode !== undefined;

    if (hasLegacy) {
      cleanupResults.withLegacyFields.push({ userId, userName });
      if (!dryRun) {
        const docRef = db.collection('events').doc(eventId).collection('registrations').doc(userId);
        const updates = {};
        if (registration.qrCodeUrl !== undefined) updates.qrCodeUrl = admin.firestore.FieldValue.delete();
        if (registration.checkInCode !== undefined) updates.checkInCode = admin.firestore.FieldValue.delete();
        batch.update(docRef, updates);
        batchCount++;
        cleanupResults.cleaned.push({ userId, userName });
        if (batchCount >= 450) {
          await batch.commit();
          batchCount = 0;
        }
      }
    } else {
      cleanupResults.noLegacyFields.push({ userId, userName });
    }
  }

  if (!dryRun && batchCount > 0) {
    await batch.commit();
  }

  const summary = {
    success: true,
    eventId,
    dryRun,
    summary: {
      total: cleanupResults.totalRegistrations,
      withLegacyFields: cleanupResults.withLegacyFields.length,
      cleaned: cleanupResults.cleaned.length,
      noLegacyFields: cleanupResults.noLegacyFields.length
    },
    details: cleanupResults
  };

  console.log('🧹 Cleanup Summary:', summary.summary);
  if (dryRun) {
    console.log('📋 This was a dry run. No changes were made.');
    console.log('📋 To remove legacy fields, call again with dryRun: false');
  } else {
    console.log('✅ Cleanup completed!');
  }

  return res.status(200).json(summary);
}