// Client-side recipient resolution service
// Resolves email recipients from Event, Chat, or Location without requiring API server
import { 
  collection, 
  doc, 
  getDocs, 
  getDoc,
  query, 
  where, 
  limit
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { EventService } from './eventService';

export type RecipientMode = 'individuals' | 'group' | 'event' | 'chat' | 'location';

export interface RecipientResolutionResult {
  ok: boolean;
  recipients: Array<{ userId: string; email: string; name?: string }>;
  count: number;
  error?: string;
}

export interface RecipientResolutionInput {
  mode: RecipientMode;
  ids?: string[];
  groupId?: string;
  eventId?: string;
  chatId?: string;
  location?: string;
}

/**
 * Resolve email recipients client-side from Firestore
 * This replaces the need for /api/resolve-email-recipients endpoint
 */
export class RecipientResolutionService {
  /**
   * Resolve recipients based on mode and selection
   */
  static async resolveRecipients(input: RecipientResolutionInput): Promise<RecipientResolutionResult> {
    try {
      const { mode, ids, groupId, eventId, chatId, location } = input;

      // Validate input
      if (!mode || !['individuals', 'group', 'event', 'chat', 'location'].includes(mode)) {
        return {
          ok: false,
          recipients: [],
          count: 0,
          error: 'mode must be one of: individuals, group, event, chat, location'
        };
      }

      let recipients: Array<{ userId: string; email: string; name?: string }> = [];

      switch (mode) {
        case 'individuals':
          if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return {
              ok: false,
              recipients: [],
              count: 0,
              error: 'ids array is required for individuals mode'
            };
          }
          recipients = await this.resolveIndividualRecipients(ids);
          break;

        case 'group':
          if (!groupId) {
            return {
              ok: false,
              recipients: [],
              count: 0,
              error: 'groupId is required for group mode'
            };
          }
          // Groups not implemented yet
          recipients = [];
          break;

        case 'event':
          if (!eventId) {
            return {
              ok: false,
              recipients: [],
              count: 0,
              error: 'eventId is required for event mode'
            };
          }
          recipients = await this.resolveEventRecipients(eventId);
          break;

        case 'chat':
          if (!chatId) {
            return {
              ok: false,
              recipients: [],
              count: 0,
              error: 'chatId is required for chat mode'
            };
          }
          recipients = await this.resolveChatRecipients(chatId);
          break;

        case 'location':
          if (!location) {
            return {
              ok: false,
              recipients: [],
              count: 0,
              error: 'location is required for location mode'
            };
          }
          recipients = await this.resolveLocationRecipients(location);
          break;
      }

      // Deduplicate by email and userId
      const uniqueRecipients = this.deduplicateRecipients(recipients);

      // Filter out invalid emails
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const validRecipients = uniqueRecipients.filter(r => {
        return r.email && emailRegex.test(r.email);
      });

      return {
        ok: true,
        recipients: validRecipients,
        count: validRecipients.length
      };

    } catch (error: any) {
      console.error('[RecipientResolutionService] Error resolving recipients:', error);
      return {
        ok: false,
        recipients: [],
        count: 0,
        error: error.message || 'Failed to resolve recipients'
      };
    }
  }

  /**
   * Resolve recipients from individual user IDs
   */
  private static async resolveIndividualRecipients(userIds: string[]): Promise<Array<{ userId: string; email: string; name?: string }>> {
    const recipients: Array<{ userId: string; email: string; name?: string }> = [];
    
    // Fetch users in parallel batches
    // Firestore doesn't support 'in' queries on document IDs directly, so we fetch individually
    // But we can parallelize for better performance
    const BATCH_SIZE = 20; // Process 20 at a time in parallel
    for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
      const batch = userIds.slice(i, i + BATCH_SIZE);
      
      // Fetch all users in this batch in parallel
      const userPromises = batch.map(async (uid) => {
        try {
          const userDoc = await getDoc(doc(db, 'users', uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            return {
              userId: uid,
              email: userData.email,
              name: userData.displayName || userData.name || undefined
            };
          }
          return null;
        } catch (error) {
          console.warn(`Failed to fetch user ${uid}:`, error);
          return null;
        }
      });
      
      const batchResults = await Promise.all(userPromises);
      const validResults = batchResults.filter((r): r is { userId: string; email: string; name?: string } => r !== null);
      recipients.push(...validResults);
    }
    
    return recipients;
  }

  /**
   * Resolve recipients from an event (all registered users)
   */
  private static async resolveEventRecipients(eventId: string): Promise<Array<{ userId: string; email: string; name?: string }>> {
    try {
      // Get all registrations for the event using EventService
      const registrations = await EventService.getEventRegistrations(eventId);
      
      if (registrations.length === 0) {
        return [];
      }
      
      // Get user IDs from registrations (registration doc ID is userId)
      const userIds = registrations.map(reg => reg.userId || reg.uid).filter(Boolean);
      
      if (userIds.length === 0) {
        return [];
      }
      
      // Resolve user emails
      return await this.resolveIndividualRecipients(userIds);
    } catch (error) {
      console.error('[RecipientResolutionService] Error resolving event recipients:', error);
      return [];
    }
  }

  /**
   * Resolve recipients from a chat (all chat members)
   */
  private static async resolveChatRecipients(chatId: string): Promise<Array<{ userId: string; email: string; name?: string }>> {
    try {
      // Get all chat members
      const membersQuery = query(
        collection(db, 'chat_members'),
        where('chatId', '==', chatId)
      );
      
      const membersSnapshot = await getDocs(membersQuery);
      
      if (membersSnapshot.empty) {
        return [];
      }
      
      // Get user IDs from chat members
      const userIds = membersSnapshot.docs
        .map(doc => doc.data().userId)
        .filter(Boolean);
      
      if (userIds.length === 0) {
        return [];
      }
      
      // Resolve user emails
      return await this.resolveIndividualRecipients(userIds);
    } catch (error) {
      console.error('[RecipientResolutionService] Error resolving chat recipients:', error);
      return [];
    }
  }

  /**
   * Resolve recipients by location (city or country)
   */
  private static async resolveLocationRecipients(location: string): Promise<Array<{ userId: string; email: string; name?: string }>> {
    try {
      const recipients: Array<{ userId: string; email: string; name?: string }> = [];
      
      // Search users by city or country
      // Note: Firestore doesn't support OR queries, so we'll search both and deduplicate
      const cityQuery = query(
        collection(db, 'users'),
        where('city', '==', location),
        where('status', '==', 'approved')
      );
      
      const countryQuery = query(
        collection(db, 'users'),
        where('country', '==', location),
        where('status', '==', 'approved')
      );
      
      const [citySnapshot, countrySnapshot] = await Promise.all([
        getDocs(cityQuery),
        getDocs(countryQuery)
      ]);
      
      // Combine results
      const allUserDocs = [
        ...citySnapshot.docs,
        ...countrySnapshot.docs
      ];
      
      // Deduplicate by doc ID
      const uniqueUserDocs = Array.from(
        new Map(allUserDocs.map(doc => [doc.id, doc])).values()
      );
      
      uniqueUserDocs.forEach(doc => {
        const userData = doc.data();
        if (userData.email) {
          recipients.push({
            userId: doc.id,
            email: userData.email,
            name: userData.displayName || userData.name || undefined
          });
        }
      });
      
      return recipients;
    } catch (error) {
      console.error('[RecipientResolutionService] Error resolving location recipients:', error);
      return [];
    }
  }

  /**
   * Deduplicate recipients by email and userId
   */
  private static deduplicateRecipients(recipients: Array<{ userId: string; email: string; name?: string }>): Array<{ userId: string; email: string; name?: string }> {
    const seen = new Map<string, { userId: string; email: string; name?: string }>();
    
    recipients.forEach(recipient => {
      const key = recipient.email?.toLowerCase() || recipient.userId;
      if (key && !seen.has(key)) {
        seen.set(key, recipient);
      }
    });
    
    return Array.from(seen.values());
  }
}
