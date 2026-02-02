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
    const connectionUrl = registration.qrCodeUrl || `https://almalinks.org/connect?to=${userId}&event=${eventId}`;
    
    testData.push({
      userId: userId,
      userName: registration.name || 'Unknown',
      hasExistingConnectionUrl: !!registration.qrCodeUrl,
      hasTicketUrl: !!registration.ticket_url,
      generatedConnectionUrl: connectionUrl,
      isTemplateGenerated: !registration.qrCodeUrl && !registration.ticket_url
    });
  });

  console.log(`📊 Registration test results:`, testData);

  return res.status(200).json({
    success: true,
    eventId: eventId,
    totalAttendees: testData.length,
    registrationData: testData,
    analysis: {
      withExistingConnectionUrl: testData.filter(item => item.hasExistingConnectionUrl).length,
      withTicketUrl: testData.filter(item => item.hasTicketUrl).length,
      generatedFromTemplate: testData.filter(item => item.isTemplateGenerated).length
    }
  });
}

// Clean up corrupted connection URLs in registrations
async function cleanupRegistrationUrls(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed for cleanup-registration-urls' });
  }

  const { eventId, dryRun = true } = req.body;

  if (!eventId) {
    return res.status(400).json({ error: 'Missing eventId parameter' });
  }

  console.log(`🧹 Starting registration URL cleanup for event: ${eventId} (dryRun: ${dryRun})`);
  
  const registrationsSnapshot = await db.collection('events').doc(eventId).collection('registrations').get();
  
  const cleanupResults = {
    totalRegistrations: registrationsSnapshot.size,
    corrupted: [],
    cleaned: [],
    alreadyCorrect: []
  };

  const batch = db.batch();
  let batchCount = 0;

  for (const doc of registrationsSnapshot.docs) {
    const registration = doc.data();
    const userId = doc.id;
    const userName = registration.name || 'Unknown';
    
    const currentUrl = registration.qrCodeUrl;
    const expectedUrl = `https://almalinks.org/connect?to=${userId}&event=${eventId}`;
    
    console.log(`🔍 Checking ${userName} (${userId}):`);
    console.log(`   Current: ${currentUrl}`);
    console.log(`   Expected: ${expectedUrl}`);
    
    const isCorrupted = !currentUrl || 
                       currentUrl.includes('sk-') || 
                       currentUrl.includes('API_KEY') || 
                       !currentUrl.startsWith('https://almalinks.org/connect');
    
    if (isCorrupted) {
      console.log(`   ❌ CORRUPTED: Will fix`);
      cleanupResults.corrupted.push({
        userId,
        userName,
        currentUrl: currentUrl || 'null',
        expectedUrl
      });
      
      if (!dryRun) {
        const docRef = db.collection('events').doc(eventId).collection('registrations').doc(userId);
        batch.update(docRef, {
          qrCodeUrl: expectedUrl,
          checkInCode: `${eventId}-${userId}`,
          connectionUrlFixedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        batchCount++;
        cleanupResults.cleaned.push({ userId, userName });
        
        if (batchCount >= 450) {
          await batch.commit();
          batchCount = 0;
        }
      }
    } else if (currentUrl === expectedUrl) {
      console.log(`   ✅ CORRECT: No changes needed`);
      cleanupResults.alreadyCorrect.push({ userId, userName });
    } else {
      console.log(`   ⚠️  DIFFERENT: ${currentUrl}`);
      cleanupResults.corrupted.push({
        userId,
        userName,
        currentUrl,
        expectedUrl,
        note: 'Different format but not API key'
      });
      
      if (!dryRun) {
        const docRef = db.collection('events').doc(eventId).collection('registrations').doc(userId);
        batch.update(docRef, {
          qrCodeUrl: expectedUrl,
          checkInCode: `${eventId}-${userId}`,
          connectionUrlFixedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        batchCount++;
        cleanupResults.cleaned.push({ userId, userName });
        
        if (batchCount >= 450) {
          await batch.commit();
          batchCount = 0;
        }
      }
    }
  }
  
  // Commit any remaining batch operations
  if (!dryRun && batchCount > 0) {
    await batch.commit();
  }

  const summary = {
    success: true,
    eventId,
    dryRun,
    summary: {
      total: cleanupResults.totalRegistrations,
      corrupted: cleanupResults.corrupted.length,
      cleaned: cleanupResults.cleaned.length,
      alreadyCorrect: cleanupResults.alreadyCorrect.length
    },
    details: cleanupResults
  };

  console.log('🧹 Cleanup Summary:', summary.summary);
  
  if (dryRun) {
    console.log('📋 This was a dry run. No changes were made.');
    console.log('📋 To actually fix the data, call again with dryRun: false');
  } else {
    console.log('✅ Database cleanup completed!');
  }

  return res.status(200).json(summary);
}