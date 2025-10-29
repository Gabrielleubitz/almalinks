import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit as firestoreLimit,
  serverTimestamp
} from 'firebase/firestore';
import { db, retryOnNetworkFailure } from '../firebase/config';
import { UserDirectoryEntry, DiscoverabilityLevel } from '../types/connection';
import { PrivacyService } from './privacyService';

export class DirectoryService {
  /**
   * Update or create user directory entry
   */
  static async updateUserDirectoryEntry(userId: string): Promise<void> {
    try {
      // Get user data
      const userDoc = await retryOnNetworkFailure(() => getDoc(doc(db, 'users', userId)));
      
      if (!userDoc.exists()) {
        console.warn('⚠️ User not found for directory update:', userId);
        return;
      }

      const userData = userDoc.data();
      
      // Get user's registered events
      const eventIds = await this.getUserRegisteredEventIds(userId);
      
      // Generate search tokens for name and work
      const searchTokens = this.generateSearchTokens([
        userData.displayName || userData.name || '',
        userData.work || ''
      ]);

      const directoryEntry: UserDirectoryEntry = {
        uid: userId,
        name: userData.displayName || userData.name || 'Unknown User',
        work: userData.work || 'Not specified',
        position: userData.position || '',
        profileImage: userData.profileImage || null,
        discoverability: userData.discoverability || 'event_only',
        lastActive: new Date(),
        eventIds,
        searchTokens,
        updatedAt: new Date()
      };

      // Convert dates to Firestore timestamps
      const firestoreEntry = {
        ...directoryEntry,
        lastActive: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      await retryOnNetworkFailure(() => 
        setDoc(doc(db, 'user_directory', userId), firestoreEntry)
      );
      
      console.log('✅ Updated user directory entry for:', userId);
      
    } catch (error) {
      console.error('❌ Error updating user directory entry:', error);
      // Don't throw - this is a background operation
    }
  }

  /**
   * Search users in global directory
   */
  static async searchUsers(
    searchQuery: string,
    requestingUserId: string,
    options: {
      limit?: number;
      includeEventOnly?: boolean;
      requiredEventIds?: string[];
    } = {}
  ): Promise<UserDirectoryEntry[]> {
    try {
      const { 
        limit = 50, 
        includeEventOnly = false,
        requiredEventIds = []
      } = options;

      // Get requesting user's event IDs for privacy filtering
      const requestingUserEventIds = await this.getUserRegisteredEventIds(requestingUserId);
      
      // If not including event-only users, only search public users
      const discoverabilityFilter: DiscoverabilityLevel[] = includeEventOnly 
        ? ['public', 'event_only'] 
        : ['public'];

      // Get all candidate users
      const directoryRef = collection(db, 'user_directory');
      const baseQuery = query(
        directoryRef,
        where('discoverability', 'in', discoverabilityFilter),
        orderBy('lastActive', 'desc'),
        firestoreLimit(limit * 2) // Get more to filter out non-discoverable ones
      );

      const snapshot = await retryOnNetworkFailure(() => getDocs(baseQuery));
      const candidates = snapshot.docs.map(doc => ({
        ...doc.data(),
        uid: doc.id,
        lastActive: doc.data().lastActive?.toDate() || new Date(0),
        updatedAt: doc.data().updatedAt?.toDate() || new Date(0)
      })) as UserDirectoryEntry[];

      // Apply search filtering and privacy rules
      const searchTokens = this.generateSearchTokens([searchQuery]);
      const filteredUsers: UserDirectoryEntry[] = [];

      for (const candidate of candidates) {
        // Skip self
        if (candidate.uid === requestingUserId) continue;

        // Apply search filter
        if (searchQuery.trim() && !this.matchesSearch(candidate, searchTokens)) {
          continue;
        }

        // Apply event filter if specified
        if (requiredEventIds.length > 0) {
          const hasRequiredEvent = requiredEventIds.some(eventId => 
            candidate.eventIds.includes(eventId)
          );
          if (!hasRequiredEvent) continue;
        }

        // Check privacy rules
        const canDiscover = await this.canUserBeDiscovered(
          candidate.uid, 
          requestingUserId, 
          candidate.discoverability,
          requestingUserEventIds,
          candidate.eventIds
        );

        if (!canDiscover) continue;

        filteredUsers.push(candidate);
        
        // Limit results
        if (filteredUsers.length >= limit) break;
      }

      console.log(`🔍 Directory search completed:`, {
        query: searchQuery,
        candidatesFound: candidates.length,
        filteredResults: filteredUsers.length,
        requestingUser: requestingUserId
      });

      return filteredUsers;

    } catch (error) {
      console.error('❌ Error searching users:', error);
      return [];
    }
  }

  /**
   * Get users for a specific event (for event-based directory)
   */
  static async getEventUsers(
    eventId: string,
    requestingUserId: string,
    options: { limit?: number } = {}
  ): Promise<UserDirectoryEntry[]> {
    try {
      const { limit = 100 } = options;

      // Get all users registered for this event
      const { EventService } = await import('./eventService');
      const registrations = await EventService.getEventRegistrations(eventId);
      
      if (registrations.length === 0) {
        return [];
      }

      // Get directory entries for these users
      const userIds = registrations.map((reg, index) => {
        // Handle both document ID and nested uid field
        return reg.uid || Object.keys(registrations)[index] || '';
      }).filter(Boolean);

      const directoryEntries: UserDirectoryEntry[] = [];
      
      // Batch get directory entries
      for (const userId of userIds) {
        if (userId === requestingUserId) continue; // Skip self

        try {
          const entryDoc = await retryOnNetworkFailure(() => 
            getDoc(doc(db, 'user_directory', userId))
          );
          
          if (entryDoc.exists()) {
            const entry = {
              ...entryDoc.data(),
              uid: entryDoc.id,
              lastActive: entryDoc.data().lastActive?.toDate() || new Date(0),
              updatedAt: entryDoc.data().updatedAt?.toDate() || new Date(0)
            } as UserDirectoryEntry;

            // Check if user can be discovered
            const canDiscover = await this.canUserBeDiscovered(
              entry.uid,
              requestingUserId,
              entry.discoverability,
              [eventId], // Requesting user has this event
              entry.eventIds
            );

            if (canDiscover) {
              directoryEntries.push(entry);
            }
          }
        } catch (error) {
          console.warn('⚠️ Error getting directory entry for user:', userId, error);
        }
      }

      // Sort by last active
      directoryEntries.sort((a, b) => b.lastActive.getTime() - a.lastActive.getTime());

      // Apply limit
      const limitedEntries = directoryEntries.slice(0, limit);

      console.log(`📋 Event directory loaded:`, {
        eventId,
        totalRegistrants: userIds.length,
        discoverableUsers: limitedEntries.length,
        requestingUser: requestingUserId
      });

      return limitedEntries;

    } catch (error) {
      console.error('❌ Error getting event users:', error);
      return [];
    }
  }

  /**
   * Check if user can be discovered by requesting user
   */
  private static async canUserBeDiscovered(
    targetUserId: string,
    requestingUserId: string,
    targetDiscoverability: DiscoverabilityLevel,
    requestingUserEventIds: string[],
    targetUserEventIds: string[]
  ): Promise<boolean> {
    try {
      switch (targetDiscoverability) {
        case 'public':
          return true;
          
        case 'event_only':
          // Can be discovered if users share at least one event
          const sharedEvents = requestingUserEventIds.filter(eventId => 
            targetUserEventIds.includes(eventId)
          );
          return sharedEvents.length > 0;
          
        case 'hidden':
          // Check if they already have an existing connection
          return await this.hasExistingConnection(targetUserId, requestingUserId);
          
        default:
          return false;
      }
    } catch (error) {
      console.error('❌ Error checking discoverability:', error);
      return false;
    }
  }

  /**
   * Check if two users have existing connection
   */
  private static async hasExistingConnection(userId1: string, userId2: string): Promise<boolean> {
    try {
      const { ConnectionService } = await import('./connectionService');
      const userConnections = await ConnectionService.getUserConnections(userId1);
      
      return userConnections.some(conn => 
        conn.fromUid === userId2 || conn.toUid === userId2
      );
      
    } catch (error) {
      console.error('❌ Error checking existing connection:', error);
      return false;
    }
  }

  /**
   * Get user's registered event IDs
   */
  private static async getUserRegisteredEventIds(userId: string): Promise<string[]> {
    try {
      const { EventService } = await import('./eventService');
      
      const events = await EventService.getPublicEvents();
      const registeredEventIds: string[] = [];
      
      for (const event of events) {
        try {
          const registration = await EventService.getUserRegistration(event.id, userId);
          if (registration) {
            registeredEventIds.push(event.id);
          }
        } catch (error) {
          // Skip individual event errors
          console.warn('⚠️ Error checking registration for event:', event.id, error);
        }
      }
      
      return registeredEventIds;
    } catch (error) {
      console.error('❌ Error getting user registered events:', error);
      return [];
    }
  }

  /**
   * Generate search tokens for text search
   */
  private static generateSearchTokens(texts: string[]): string[] {
    const tokens = new Set<string>();
    
    for (const text of texts) {
      if (!text) continue;
      
      // Normalize text
      const normalized = text.toLowerCase().trim();
      
      // Add whole text
      tokens.add(normalized);
      
      // Add individual words
      const words = normalized.split(/\s+/);
      words.forEach(word => {
        if (word.length > 2) {
          tokens.add(word);
        }
      });
      
      // Add partial matches for names (first 3+ characters)
      if (normalized.length >= 3) {
        for (let i = 3; i <= normalized.length; i++) {
          tokens.add(normalized.substring(0, i));
        }
      }
    }
    
    return Array.from(tokens);
  }

  /**
   * Check if user matches search tokens
   */
  private static matchesSearch(user: UserDirectoryEntry, searchTokens: string[]): boolean {
    if (searchTokens.length === 0) return true;
    
    return searchTokens.some(token => 
      user.searchTokens.some(userToken => 
        userToken.includes(token) || token.includes(userToken)
      )
    );
  }

  /**
   * Bulk update directory entries for all users (admin maintenance function)
   */
  static async bulkUpdateDirectory(batchSize: number = 50): Promise<void> {
    try {
      console.log('🔄 Starting bulk directory update...');

      const usersRef = collection(db, 'users');
      const snapshot = await retryOnNetworkFailure(() => getDocs(usersRef));
      
      const userIds = snapshot.docs.map(doc => doc.id);
      console.log(`📋 Found ${userIds.length} users to update`);

      // Process in batches
      const batches = [];
      for (let i = 0; i < userIds.length; i += batchSize) {
        batches.push(userIds.slice(i, i + batchSize));
      }

      let completed = 0;
      for (const batch of batches) {
        const promises = batch.map(userId => this.updateUserDirectoryEntry(userId));
        await Promise.allSettled(promises);
        completed += batch.length;
        
        console.log(`✅ Updated ${completed}/${userIds.length} directory entries`);
        
        // Small delay between batches to avoid overwhelming Firestore
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      console.log('✅ Bulk directory update completed');

    } catch (error) {
      console.error('❌ Error in bulk directory update:', error);
      throw error;
    }
  }
}