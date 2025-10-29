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
      case 'test-qr-data':
        return await testQRData(req, res);
      case 'cleanup-qr':
        return await cleanupQR(req, res);
      default:
        return res.status(400).json({ 
          success: false, 
          error: `Unknown action: ${action}. Available actions: test-qr-data, cleanup-qr` 
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

// Test QR data for an event (replaces test-qr-data.js)
async function testQRData(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed for test-qr-data' });
  }

  const { eventId } = req.query;

  if (!eventId) {
    return res.status(400).json({ error: 'Missing eventId parameter' });
  }

  console.log(`🔍 Testing QR code data for event: ${eventId}`);
  
  // Fetch attendees (same logic as badge API)
  const registrationsSnapshot = await db.collection('events').doc(eventId).collection('registrations').get();
  
  const qrTestData = [];
  registrationsSnapshot.forEach(doc => {
    const registration = doc.data();
    const userId = doc.id;
    
    // Same logic as in the badge API
    const qrCodeUrl = registration.qrCodeUrl || `https://almalinks.org/connect?to=${userId}&event=${eventId}`;
    
    qrTestData.push({
      userId: userId,
      userName: registration.name || 'Unknown',
      hasExistingQrUrl: !!registration.qrCodeUrl,
      hasTicketUrl: !!registration.ticket_url,
      generatedQrUrl: qrCodeUrl,
      isTemplateGenerated: !registration.qrCodeUrl && !registration.ticket_url
    });
  });

  console.log(`📊 QR Code test results:`, qrTestData);

  return res.status(200).json({
    success: true,
    eventId: eventId,
    totalAttendees: qrTestData.length,
    qrData: qrTestData,
    analysis: {
      withExistingQrUrl: qrTestData.filter(item => item.hasExistingQrUrl).length,
      withTicketUrl: qrTestData.filter(item => item.hasTicketUrl).length,
      generatedFromTemplate: qrTestData.filter(item => item.isTemplateGenerated).length
    }
  });
}

// Clean up corrupted QR codes (replaces cleanup-registration-qr.js)
async function cleanupQR(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed for cleanup-qr' });
  }

  const { eventId, dryRun = true } = req.body;

  if (!eventId) {
    return res.status(400).json({ error: 'Missing eventId parameter' });
  }

  console.log(`🧹 Starting QR cleanup for event: ${eventId} (dryRun: ${dryRun})`);
  
  // Fetch all registrations for the event
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
    
    // Check if qrCodeUrl is corrupted (contains API key data or invalid format)
    const currentQrUrl = registration.qrCodeUrl;
    const expectedQrUrl = `https://almalinks.org/connect?to=${userId}&event=${eventId}`;
    
    console.log(`🔍 Checking ${userName} (${userId}):`);
    console.log(`   Current: ${currentQrUrl}`);
    console.log(`   Expected: ${expectedQrUrl}`);
    
    const isCorrupted = !currentQrUrl || 
                       currentQrUrl.includes('sk-') || 
                       currentQrUrl.includes('API_KEY') || 
                       !currentQrUrl.startsWith('https://almalinks.org/connect');
    
    if (isCorrupted) {
      console.log(`   ❌ CORRUPTED: Will fix`);
      cleanupResults.corrupted.push({
        userId,
        userName,
        currentQrUrl: currentQrUrl || 'null',
        expectedQrUrl
      });
      
      if (!dryRun) {
        const docRef = db.collection('events').doc(eventId).collection('registrations').doc(userId);
        batch.update(docRef, {
          qrCodeUrl: expectedQrUrl,
          checkInCode: `${eventId}-${userId}`, // Also ensure we have proper check-in code
          qrFixedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        batchCount++;
        cleanupResults.cleaned.push({ userId, userName });
        
        // Commit batch every 450 operations (Firestore limit is 500)
        if (batchCount >= 450) {
          await batch.commit();
          batchCount = 0;
        }
      }
    } else if (currentQrUrl === expectedQrUrl) {
      console.log(`   ✅ CORRECT: No changes needed`);
      cleanupResults.alreadyCorrect.push({ userId, userName });
    } else {
      console.log(`   ⚠️  DIFFERENT: ${currentQrUrl}`);
      cleanupResults.corrupted.push({
        userId,
        userName,
        currentQrUrl,
        expectedQrUrl,
        note: 'Different format but not API key'
      });
      
      if (!dryRun) {
        const docRef = db.collection('events').doc(eventId).collection('registrations').doc(userId);
        batch.update(docRef, {
          qrCodeUrl: expectedQrUrl,
          checkInCode: `${eventId}-${userId}`,
          qrFixedAt: admin.firestore.FieldValue.serverTimestamp()
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