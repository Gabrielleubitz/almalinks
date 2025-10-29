import { 
  doc, 
  updateDoc, 
  getDoc,
  serverTimestamp 
} from 'firebase/firestore';
import { db, retryOnNetworkFailure } from '../firebase/config';
import { 
  DiscoverabilityLevel, 
  UserDiscoverabilitySettings,
  UserRateLimits
} from '../types/connection';

export class PrivacyService {
  /**
   * Update user's discoverability settings
   */
  static async updateDiscoverabilitySettings(
    userId: string,
    discoverability: DiscoverabilityLevel,
    hasConsented: boolean = true
  ): Promise<void> {
    try {
      const userRef = doc(db, 'users', userId);
      const updates: any = {
        discoverability,
        discoverabilityConsented: hasConsented,
        updatedAt: serverTimestamp()
      };

      if (hasConsented) {
        updates.discoverabilityConsentedAt = serverTimestamp();
      }

      await retryOnNetworkFailure(() => updateDoc(userRef, updates));
      
      console.log('✅ Updated discoverability settings for user:', userId, 'to:', discoverability);
      
      // Update user directory entry
      await this.updateUserDirectoryEntry(userId);
      
    } catch (error) {
      console.error('❌ Error updating discoverability settings:', error);
      throw error;
    }
  }

  /**
   * Get user's current discoverability settings
   */
  static async getUserDiscoverabilitySettings(userId: string): Promise<UserDiscoverabilitySettings> {
    try {
      const userDoc = await retryOnNetworkFailure(() => getDoc(doc(db, 'users', userId)));
      
      if (!userDoc.exists()) {
        throw new Error('User not found');
      }

      const userData = userDoc.data();
      
      return {
        discoverability: userData.discoverability || 'event_only',
        discoverabilityConsented: userData.discoverabilityConsented || false,
        discoverabilityConsentedAt: userData.discoverabilityConsentedAt?.toDate()
      };
      
    } catch (error) {
      console.error('❌ Error getting discoverability settings:', error);
      throw error;
    }
  }

  /**
   * Check if user needs to consent to discoverability settings
   */
  static async needsDiscoverabilityConsent(userId: string): Promise<boolean> {
    try {
      const settings = await this.getUserDiscoverabilitySettings(userId);
      return !settings.discoverabilityConsented;
    } catch (error) {
      console.error('❌ Error checking consent status:', error);
      return true; // Default to requiring consent on error
    }
  }

  /**
   * Check if user can be discovered by another user
   */
  static async canUserBeDiscovered(
    targetUserId: string,
    requestingUserId: string,
    sharedEventIds: string[] = []
  ): Promise<boolean> {
    try {
      const settings = await this.getUserDiscoverabilitySettings(targetUserId);
      
      switch (settings.discoverability) {
        case 'public':
          return true;
          
        case 'event_only':
          // Can be discovered if users share at least one event
          return sharedEventIds.length > 0;
          
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
   * Check if two users have an existing connection
   */
  static async hasExistingConnection(userId1: string, userId2: string): Promise<boolean> {
    try {
      // Import here to avoid circular dependency
      const { ConnectionService } = await import('./connectionService');
      
      // Check all events - we'll need to modify this to support global connections
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
   * Update user directory entry (for global directory optimization)
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

      const directoryEntry = {
        uid: userId,
        name: userData.displayName || userData.name || 'Unknown User',
        work: userData.work || 'Not specified',
        position: userData.position || '',
        profileImage: userData.profileImage || null,
        discoverability: userData.discoverability || 'event_only',
        lastActive: serverTimestamp(),
        eventIds,
        searchTokens,
        updatedAt: serverTimestamp()
      };

      await retryOnNetworkFailure(() => 
        updateDoc(doc(db, 'user_directory', userId), directoryEntry)
      );
      
      console.log('✅ Updated user directory entry for:', userId);
      
    } catch (error) {
      console.error('❌ Error updating user directory entry:', error);
      // Don't throw - this is a background optimization
    }
  }

  /**
   * Get user's registered event IDs
   */
  private static async getUserRegisteredEventIds(userId: string): Promise<string[]> {
    try {
      // Import here to avoid circular dependency
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
   * Check and increment rate limit for connection requests
   */
  static async checkAndIncrementRateLimit(userId: string): Promise<{ allowed: boolean; remaining: number }> {
    try {
      const userRef = doc(db, 'users', userId);
      const userDoc = await retryOnNetworkFailure(() => getDoc(userRef));
      
      if (!userDoc.exists()) {
        throw new Error('User not found');
      }

      const userData = userDoc.data();
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      
      let dailyRequests = userData.dailyConnectRequests || 0;
      const lastRequestDate = userData.lastRequestDate || '';
      
      // Reset counter if it's a new day
      if (lastRequestDate !== today) {
        dailyRequests = 0;
      }
      
      const DAILY_LIMIT = 50;
      
      if (dailyRequests >= DAILY_LIMIT) {
        return { allowed: false, remaining: 0 };
      }
      
      // Increment counter
      const newCount = dailyRequests + 1;
      
      await retryOnNetworkFailure(() => updateDoc(userRef, {
        dailyConnectRequests: newCount,
        lastRequestDate: today,
        updatedAt: serverTimestamp()
      }));
      
      return { 
        allowed: true, 
        remaining: DAILY_LIMIT - newCount 
      };
      
    } catch (error) {
      console.error('❌ Error checking rate limit:', error);
      throw error;
    }
  }

  /**
   * Get user's current rate limit status
   */
  static async getRateLimitStatus(userId: string): Promise<{ requests: number; remaining: number; resetDate: string }> {
    try {
      const userDoc = await retryOnNetworkFailure(() => getDoc(doc(db, 'users', userId)));
      
      if (!userDoc.exists()) {
        throw new Error('User not found');
      }

      const userData = userDoc.data();
      const today = new Date().toISOString().split('T')[0];
      
      let dailyRequests = userData.dailyConnectRequests || 0;
      const lastRequestDate = userData.lastRequestDate || '';
      
      // Reset if new day
      if (lastRequestDate !== today) {
        dailyRequests = 0;
      }
      
      const DAILY_LIMIT = 50;
      
      return {
        requests: dailyRequests,
        remaining: Math.max(0, DAILY_LIMIT - dailyRequests),
        resetDate: today
      };
      
    } catch (error) {
      console.error('❌ Error getting rate limit status:', error);
      throw error;
    }
  }
}