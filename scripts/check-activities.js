// Check Activities in Firestore - Debug Script
// Run this to see what activities are actually in the database

import admin from 'firebase-admin';
import { readFileSync } from 'fs';

// Initialize Firebase Admin
const serviceAccount = JSON.parse(
  readFileSync('./alma-links-test-firebase-adminsdk-fbsvc-0a0cc6c7cc.json', 'utf8')
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function checkActivities() {
  try {
    console.log('🔍 Checking activities in Firestore...\n');

    // Get all activities
    const activitiesSnapshot = await db.collection('activity_logs')
      .orderBy('timestamp', 'desc')
      .limit(20)
      .get();

    console.log(`📊 Found ${activitiesSnapshot.size} recent activities:\n`);

    activitiesSnapshot.docs.forEach((doc, index) => {
      const data = doc.data();
      const timestamp = data.timestamp?.toDate?.() || new Date();

      console.log(`${index + 1}. [${data.activityType}] ${data.userName} (${data.userEmail})`);
      console.log(`   Description: ${data.description}`);
      console.log(`   Time: ${timestamp.toLocaleString()}`);
      console.log(`   User ID: ${data.userId}`);
      if (data.metadata?.chatId) {
        console.log(`   Chat ID: ${data.metadata.chatId}`);
      }
      if (data.metadata?.eventId) {
        console.log(`   Event ID: ${data.metadata.eventId}`);
      }
      console.log('');
    });

    // Get activity counts by type
    const allActivities = await db.collection('activity_logs').get();
    const activityCounts = {};

    allActivities.docs.forEach(doc => {
      const type = doc.data().activityType;
      activityCounts[type] = (activityCounts[type] || 0) + 1;
    });

    console.log('📈 Activity counts by type:');
    Object.entries(activityCounts)
      .sort(([,a], [,b]) => b - a)
      .forEach(([type, count]) => {
        console.log(`   ${type}: ${count}`);
      });

    console.log(`\n✅ Total activities in database: ${allActivities.size}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkActivities();
