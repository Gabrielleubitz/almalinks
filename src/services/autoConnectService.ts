import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  query, 
  where
} from 'firebase/firestore';
import { db, retryOnNetworkFailure } from '../firebase/config';
import { ConnectionService, ConnectionReason } from './connectionService';
import { ConnectionType, EnhancedConnection, DiscoverabilityLevel } from '../types/connection';
import { PrivacyService } from './privacyService';

function registrationIsCheckedIn(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false;
  return (data as { checkedIn?: boolean }).checkedIn === true;
}

export class AutoConnectService {
  /**
   * Auto-connect a checked-in user with other checked-in attendees for the same event.
   */
  static async autoConnectForEvent(newUserUid: string, eventId: string): Promise<void> {
    try {
      console.log('🔄 Starting auto-connect for user:', newUserUid, 'event:', eventId);
      
      // Check if event has auto-connect enabled
      const eventDoc = await retryOnNetworkFailure(() => getDoc(doc(db, 'events', eventId)));
      if (!eventDoc.exists()) {
        console.warn('⚠️ Event not found:', eventId);
        return;
      }

      const eventData = eventDoc.data();
      if (eventData.autoConnectEnabled === false) {
        console.log('⏭️ Auto-connect disabled for event:', eventId);
        return;
      }

      const newUserRegSnap = await retryOnNetworkFailure(() =>
        getDoc(doc(db, 'events', eventId, 'registrations', newUserUid))
      );
      if (!newUserRegSnap.exists() || !registrationIsCheckedIn(newUserRegSnap.data())) {
        console.log('⏭️ User is not checked in; skipping auto-connect:', newUserUid, eventId);
        return;
      }

      // Get new user's discoverability settings
      const newUserSettings = await PrivacyService.getUserDiscoverabilitySettings(newUserUid);
      
      if (newUserSettings.discoverability === 'hidden') {
        console.log('⏭️ User has hidden discoverability, skipping auto-connect:', newUserUid);
        return;
      }

      // Get all registrations for this event
      const registrationsRef = collection(db, 'events', eventId, 'registrations');
      const registrationsSnapshot = await retryOnNetworkFailure(() => getDocs(registrationsRef));

      const existingUserIds = registrationsSnapshot.docs
        .filter((d) => d.id !== newUserUid && registrationIsCheckedIn(d.data()))
        .map((d) => d.id);

      if (existingUserIds.length === 0) {
        console.log('ℹ️ No other checked-in users for event:', eventId);
        return;
      }

      // Get user data for enrichment
      const newUserDoc = await retryOnNetworkFailure(() => getDoc(doc(db, 'users', newUserUid)));
      if (!newUserDoc.exists()) {
        console.error('❌ New user not found:', newUserUid);
        return;
      }
      const newUserData = newUserDoc.data();

      let totalConnections = 0;
      let skippedConnections = 0;

      // Process users individually using new connection system
      for (const existingUid of existingUserIds) {
        try {
          const otherUserSettings = await PrivacyService.getUserDiscoverabilitySettings(existingUid);
          
          if (this.shouldAutoConnect(newUserSettings.discoverability, otherUserSettings.discoverability)) {
            // Check if connection already exists
            const exists = await this.checkExistingConnection(newUserUid, existingUid, eventId);
            
            if (!exists) {
              await this.createSingleAutoConnection(newUserUid, existingUid, eventId);
              totalConnections++;
            } else {
              skippedConnections++;
            }
          } else {
            skippedConnections++;
          }
        } catch (error) {
          console.error('❌ Error processing connection for user:', existingUid, error);
          skippedConnections++;
        }
      }

      console.log(`✅ Auto-connect complete for ${newUserUid}:`, {
        event: eventId,
        connectionsCreated: totalConnections,
        connectionsSkipped: skippedConnections,
        totalCandidates: existingUserIds.length
      });

    } catch (error) {
      console.error('❌ Error in auto-connect:', error);
      // Don't throw - we don't want registration to fail if auto-connect fails
    }
  }


  /**
   * Determine if auto-connection should be created based on privacy settings
   */
  private static shouldAutoConnect(
    userADiscoverability: DiscoverabilityLevel,
    userBDiscoverability: DiscoverabilityLevel
  ): boolean {
    // Both users must allow connections at event level or higher
    const allowedLevels: DiscoverabilityLevel[] = ['public', 'event_only'];
    
    return allowedLevels.includes(userADiscoverability) && 
           allowedLevels.includes(userBDiscoverability);
  }

  /**
   * Check if connection already exists between two users for a specific event
   */
  private static async checkExistingConnection(
    fromUid: string, 
    toUid: string, 
    eventId: string
  ): Promise<boolean> {
    try {
      return await ConnectionService.checkExistingConnectionForEvent(fromUid, toUid, eventId);
    } catch (error) {
      console.error('❌ Error checking existing connection:', error);
      return false;
    }
  }

  /**
   * Retroactively create auto-connections for all existing event registrants
   * Useful for events that enable auto-connect after people have already registered
   */
  static async retroactiveAutoConnect(eventId: string): Promise<void> {
    try {
      console.log('🔄 Starting retroactive auto-connect for event:', eventId);

      // Check if event has auto-connect enabled
      const eventDoc = await retryOnNetworkFailure(() => getDoc(doc(db, 'events', eventId)));
      if (!eventDoc.exists() || eventDoc.data().autoConnectEnabled === false) {
        console.log('⏭️ Auto-connect not enabled for event:', eventId);
        return;
      }

      // Get all registrations
      const registrationsRef = collection(db, 'events', eventId, 'registrations');
      const registrationsSnapshot = await retryOnNetworkFailure(() => getDocs(registrationsRef));
      const userIds = registrationsSnapshot.docs
        .filter((d) => registrationIsCheckedIn(d.data()))
        .map((d) => d.id);

      if (userIds.length < 2) {
        console.log('ℹ️ Not enough checked-in users for connections:', userIds.length);
        return;
      }

      // Create connections between all pairs
      let totalConnections = 0;
      const processed = new Set<string>();

      for (const userId of userIds) {
        // Get user's privacy settings
        const userSettings = await PrivacyService.getUserDiscoverabilitySettings(userId);
        
        if (userSettings.discoverability === 'hidden') {
          console.log('⏭️ Skipping hidden user:', userId);
          continue;
        }

        // Auto-connect with all other eligible users
        const otherUserIds = userIds.filter(id => id !== userId && !processed.has(`${userId}-${id}`) && !processed.has(`${id}-${userId}`));
        
        for (const otherUserId of otherUserIds) {
          // Mark this pair as processed
          processed.add(`${userId}-${otherUserId}`);
          processed.add(`${otherUserId}-${userId}`);

          const otherUserSettings = await PrivacyService.getUserDiscoverabilitySettings(otherUserId);
          
          if (this.shouldAutoConnect(userSettings.discoverability, otherUserSettings.discoverability)) {
            // Check if connection already exists
            const exists = await this.checkExistingConnection(userId, otherUserId, eventId);
            
            if (!exists) {
              await this.createSingleAutoConnection(userId, otherUserId, eventId);
              totalConnections++;
            }
          }
        }
      }

      console.log(`✅ Retroactive auto-connect complete:`, {
        event: eventId,
        totalUsers: userIds.length,
        connectionsCreated: totalConnections
      });

    } catch (error) {
      console.error('❌ Error in retroactive auto-connect:', error);
      throw error;
    }
  }

  /**
   * Create a single auto-connection between two users
   */
  private static async createSingleAutoConnection(
    fromUid: string,
    toUid: string,
    eventId: string
  ): Promise<void> {
    try {
      const reason: Omit<ConnectionReason, 'timestamp'> = {
        type: 'event',
        eventId,
        context: 'auto-connect on event check-in'
      };

      await ConnectionService.createOrUpdateConnection(fromUid, toUid, reason);

      console.log('✅ Created/updated auto-connection:', fromUid, '<->', toUid);

    } catch (error) {
      console.error('❌ Error creating single auto-connection:', error);
    }
  }
}