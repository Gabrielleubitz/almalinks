// Backfill missing uid1/uid2/updatedAt fields in connections collection
// Run with: node scripts/backfill-connection-fields.js
// Or import in admin panel for one-time migration

import admin from 'firebase-admin';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin (adjust path to your service account)
// For local dev, you may need to set GOOGLE_APPLICATION_CREDENTIALS env var
if (!admin.apps.length) {
  try {
    const serviceAccount = require('../secrets/serviceAccount.json');
    initializeApp({
      credential: cert(serviceAccount)
    });
  } catch (error) {
    console.error('Failed to initialize Firebase Admin. Make sure serviceAccount.json exists or GOOGLE_APPLICATION_CREDENTIALS is set.');
    process.exit(1);
  }
}

const db = getFirestore();

async function backfillConnectionFields(limit = 200) {
  console.log(`[backfill-connections] Starting backfill for last ${limit} connections...`);
  
  try {
    // Get recent connections (ordered by createdAt or document ID)
    const connectionsRef = db.collection('connections');
    const snapshot = await connectionsRef.limit(limit).get();
    
    if (snapshot.empty) {
      console.log('[backfill-connections] No connections found');
      return;
    }
    
    let updated = 0;
    let skipped = 0;
    let errors = 0;
    
    const batch = db.batch();
    let batchCount = 0;
    const BATCH_SIZE = 500; // Firestore batch limit
    
    snapshot.forEach((doc) => {
      const data = doc.data();
      const updates = {};
      let needsUpdate = false;
      
      // Check for missing uid1
      if (!data.uid1) {
        // Try to infer from userA or userIds[0]
        if (data.userA) {
          updates.uid1 = data.userA;
          needsUpdate = true;
        } else if (data.userIds && data.userIds.length > 0) {
          updates.uid1 = data.userIds[0];
          needsUpdate = true;
        } else {
          console.warn(`[backfill-connections] Doc ${doc.id} missing uid1 and cannot infer from userA/userIds`);
        }
      }
      
      // Check for missing uid2
      if (!data.uid2) {
        // Try to infer from userB or userIds[1]
        if (data.userB) {
          updates.uid2 = data.userB;
          needsUpdate = true;
        } else if (data.userIds && data.userIds.length > 1) {
          updates.uid2 = data.userIds[1];
          needsUpdate = true;
        } else {
          console.warn(`[backfill-connections] Doc ${doc.id} missing uid2 and cannot infer from userB/userIds`);
        }
      }
      
      // Check for missing updatedAt
      if (!data.updatedAt) {
        // Use createdAt if available, otherwise use serverTimestamp
        if (data.createdAt) {
          updates.updatedAt = data.createdAt;
        } else {
          updates.updatedAt = admin.firestore.FieldValue.serverTimestamp();
        }
        needsUpdate = true;
      }
      
      if (needsUpdate) {
        batch.update(doc.ref, updates);
        batchCount++;
        updated++;
        
        if (process.env.NODE_ENV !== 'production') {
          console.log(`[backfill-connections] Will update ${doc.id}:`, updates);
        }
        
        // Commit batch if we hit the limit
        if (batchCount >= BATCH_SIZE) {
          batch.commit();
          batchCount = 0;
        }
      } else {
        skipped++;
      }
    });
    
    // Commit remaining updates
    if (batchCount > 0) {
      await batch.commit();
    }
    
    console.log(`[backfill-connections] Complete:`);
    console.log(`  - Updated: ${updated}`);
    console.log(`  - Skipped (already correct): ${skipped}`);
    console.log(`  - Errors: ${errors}`);
    
  } catch (error) {
    console.error('[backfill-connections] Error:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  const limit = process.argv[2] ? parseInt(process.argv[2], 10) : 200;
  backfillConnectionFields(limit)
    .then(() => {
      console.log('[backfill-connections] Backfill completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('[backfill-connections] Backfill failed:', error);
      process.exit(1);
    });
}

export { backfillConnectionFields };
