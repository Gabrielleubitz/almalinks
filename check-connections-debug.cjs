// Quick debug script to check Firestore connections
const admin = require('firebase-admin');

// Initialize Firebase Admin
const serviceAccount = require('./alma-links-test-firebase-adminsdk-q9zf3-acdce1b9e5.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function checkConnections() {
  console.log('🔍 Checking connections collection...\n');

  try {
    // Get all connections
    const snapshot = await db.collection('connections').limit(10).get();

    console.log(`📊 Total connections found: ${snapshot.size}`);

    if (snapshot.empty) {
      console.log('\n⚠️  No connections found in database!');
      console.log('This means users haven\'t made any connections yet.');
      return;
    }

    console.log('\n📝 Sample connections:');
    snapshot.forEach((doc, index) => {
      const data = doc.data();
      console.log(`\n${index + 1}. Connection ID: ${doc.id}`);
      console.log(`   uid1: ${data.uid1}`);
      console.log(`   uid2: ${data.uid2}`);
      console.log(`   uid1Name: ${data.uid1Name}`);
      console.log(`   uid2Name: ${data.uid2Name}`);
      console.log(`   reasons: ${data.reasons?.length || 0} reason(s)`);
      console.log(`   createdAt: ${data.createdAt?.toDate?.() || 'N/A'}`);
    });

    // Check indexes
    console.log('\n\n🔍 Checking if queries work...');

    // Try a sample query that the app uses
    const testUid = snapshot.docs[0]?.data()?.uid1 || 'test-uid';
    console.log(`\nTesting query: where('uid1', '==', '${testUid}').orderBy('updatedAt', 'desc')`);

    try {
      const querySnapshot = await db.collection('connections')
        .where('uid1', '==', testUid)
        .orderBy('updatedAt', 'desc')
        .limit(5)
        .get();

      console.log(`✅ Query successful! Found ${querySnapshot.size} connection(s)`);
    } catch (error) {
      console.error('❌ Query failed:', error.message);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }

  process.exit(0);
}

checkConnections();
