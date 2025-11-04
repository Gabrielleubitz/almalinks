/**
 * Cleanup Orphaned Connections
 *
 * This script removes connection reasons that reference non-existent events.
 * Run this to clean up connections from events that were deleted before the
 * automatic cleanup feature was implemented.
 *
 * Usage: npx tsx scripts/cleanup-orphaned-connections.ts
 */

import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin
if (!admin.apps.length) {
  try {
    // Check for environment variable first
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      const serviceAccountKey = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
      console.log(`🔍 Using service account for project: ${serviceAccountKey.project_id}`);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccountKey)
      });
    } else {
      // Fallback to service account file
      const serviceAccountPath = path.join(__dirname, '..', 'alma-links-test-firebase-adminsdk-fbsvc-0a0cc6c7cc.json');
      const serviceAccountContent = readFileSync(serviceAccountPath, 'utf8');
      const serviceAccount = JSON.parse(serviceAccountContent);
      console.log(`🔍 Using service account for project: ${serviceAccount.project_id}`);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
    }
    console.log(`✅ Firebase Admin SDK initialized successfully\n`);
  } catch (error: any) {
    console.error('❌ Failed to initialize Firebase Admin:', error.message);
    process.exit(1);
  }
}

const db = admin.firestore();

interface ConnectionReason {
  type: 'event' | 'admin' | 'user';
  timestamp: any;
  eventId?: string;
  adminId?: string;
  requestId?: string;
  context?: string;
}

interface Connection {
  id: string;
  uid1: string;
  uid2: string;
  reasons: ConnectionReason[];
  createdAt: any;
  updatedAt: any;
}

async function cleanupOrphanedConnections() {
  try {
    console.log('🧹 Starting cleanup of orphaned connections...\n');

    // Get all events to build a set of valid event IDs
    console.log('📋 Fetching all events...');
    const eventsSnapshot = await db.collection('events').get();
    const validEventIds = new Set<string>();

    eventsSnapshot.docs.forEach(doc => {
      validEventIds.add(doc.id);
    });

    console.log(`✅ Found ${validEventIds.size} valid events\n`);

    // Get all connections
    console.log('📋 Fetching all connections...');
    const connectionsSnapshot = await db.collection('connections').get();
    console.log(`✅ Found ${connectionsSnapshot.size} connections to check\n`);

    let orphanedReasonsFound = 0;
    let connectionsDeleted = 0;
    let connectionsUpdated = 0;
    let connectionsSkipped = 0;

    // Process each connection
    for (const connectionDoc of connectionsSnapshot.docs) {
      const connection = connectionDoc.data() as Connection;

      if (!connection.reasons || connection.reasons.length === 0) {
        console.log(`⚠️  Connection ${connectionDoc.id} has no reasons - skipping`);
        connectionsSkipped++;
        continue;
      }

      // Find reasons that reference non-existent events
      const orphanedReasons = connection.reasons.filter(
        reason => reason.type === 'event' && reason.eventId && !validEventIds.has(reason.eventId)
      );

      if (orphanedReasons.length === 0) {
        // No orphaned reasons, skip
        continue;
      }

      orphanedReasonsFound += orphanedReasons.length;

      console.log(`🔍 Connection ${connectionDoc.id}:`);
      console.log(`   Users: ${connection.uid1} ↔ ${connection.uid2}`);
      console.log(`   Total reasons: ${connection.reasons.length}`);
      console.log(`   Orphaned reasons: ${orphanedReasons.length}`);

      orphanedReasons.forEach(reason => {
        console.log(`   ❌ Orphaned event ID: ${reason.eventId}`);
      });

      // Remove orphaned reasons
      const remainingReasons = connection.reasons.filter(
        reason => !(reason.type === 'event' && reason.eventId && !validEventIds.has(reason.eventId))
      );

      console.log(`   Remaining reasons: ${remainingReasons.length}`);

      if (remainingReasons.length === 0) {
        // No more reasons left, delete the entire connection
        console.log(`   🗑️  Deleting connection (no remaining reasons)\n`);
        await connectionDoc.ref.delete();
        connectionsDeleted++;
      } else {
        // Update connection with remaining reasons
        console.log(`   🔄 Updating connection with remaining reasons\n`);
        await connectionDoc.ref.update({
          reasons: remainingReasons,
          updatedAt: new Date()
        });
        connectionsUpdated++;
      }
    }

    // Summary
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ CLEANUP COMPLETE\n');
    console.log(`📊 Summary:`);
    console.log(`   Total connections checked: ${connectionsSnapshot.size}`);
    console.log(`   Orphaned event references found: ${orphanedReasonsFound}`);
    console.log(`   Connections deleted: ${connectionsDeleted}`);
    console.log(`   Connections updated: ${connectionsUpdated}`);
    console.log(`   Connections skipped: ${connectionsSkipped}`);
    console.log(`   Connections unchanged: ${connectionsSnapshot.size - connectionsDeleted - connectionsUpdated - connectionsSkipped}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    process.exit(1);
  }
}

// Run the cleanup
cleanupOrphanedConnections()
  .then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });
