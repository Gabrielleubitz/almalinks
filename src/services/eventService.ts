import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc,
  query, 
  where, 
  orderBy, 
  serverTimestamp,
  Timestamp 
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { nanoid } from 'nanoid';

export interface EventData {
  id: string;
  name: string;
  slug: string; // Added slug field
  location: string;
  date: string; // ISO string
  description: string;
  imageUrl: string;
  status: 'active' | 'non-active' | 'sold-out' | 'completed';
  createdBy: string;
  createdAt: any;
  updatedAt?: any;
  autoConnectEnabled?: boolean; // NEW: Auto-connect control
}

export interface EventRegistration {
  name: string;
  email: string;
  phone: string;
  work: string;
  registeredAt: any;
  qrCodeUrl?: string;
  checkedIn?: boolean;
  checkedInAt?: any;
  checkedInBy?: string;
  profileImage?: string | null;
}

// Generate URL-friendly slug from event name
export const generateSlug = (name: string): string => {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters except spaces and hyphens
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
    .trim()
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
};

export class EventService {
  // Create a new event
  static async createEvent(eventData: Omit<EventData, 'id' | 'slug' | 'createdAt' | 'updatedAt'>, adminUid: string): Promise<string> {
    try {
      const eventId = nanoid(12); // Generate unique ID
      const slug = generateSlug(eventData.name);
      
      // Check if slug already exists and make it unique if needed
      const uniqueSlug = await this.ensureUniqueSlug(slug);
      
      const newEvent: EventData = {
        ...eventData,
        id: eventId,
        slug: uniqueSlug,
        createdBy: adminUid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        autoConnectEnabled: eventData.autoConnectEnabled ?? true // Default to true
      };

      await setDoc(doc(db, 'events', eventId), newEvent);
      console.log('✅ Event created successfully:', eventId, 'with slug:', uniqueSlug);
      return eventId;
    } catch (error) {
      console.error('❌ Error creating event:', error);
      throw error;
    }
  }

  // Ensure slug is unique by checking existing events
  static async ensureUniqueSlug(baseSlug: string): Promise<string> {
    try {
      let slug = baseSlug;
      let counter = 1;
      
      while (true) {
        const existingEvent = await this.getEventBySlug(slug);
        if (!existingEvent) {
          return slug;
        }
        
        // If slug exists, append counter
        slug = `${baseSlug}-${counter}`;
        counter++;
        
        // Safety check to prevent infinite loop
        if (counter > 100) {
          slug = `${baseSlug}-${Date.now()}`;
          break;
        }
      }
      
      return slug;
    } catch (error) {
      console.error('❌ Error ensuring unique slug:', error);
      // Fallback to timestamp-based slug
      return `${baseSlug}-${Date.now()}`;
    }
  }

  // Add slugs to existing events that don't have them
  static async addSlugsToExistingEvents(): Promise<void> {
    try {
      console.log('🔄 Adding slugs to existing events...');
      
      const eventsRef = collection(db, 'events');
      const snapshot = await getDocs(eventsRef);
      
      const updatePromises = [];
      
      for (const docSnapshot of snapshot.docs) {
        const eventData = docSnapshot.data() as EventData;
        
        // Only update if slug is missing
        if (!eventData.slug) {
          const slug = generateSlug(eventData.name);
          const uniqueSlug = await this.ensureUniqueSlug(slug);
          
          console.log(`📝 Adding slug "${uniqueSlug}" to event: ${eventData.name}`);
          
          updatePromises.push(
            updateDoc(doc(db, 'events', docSnapshot.id), {
              slug: uniqueSlug,
              updatedAt: serverTimestamp()
            })
          );
        }
      }
      
      if (updatePromises.length > 0) {
        await Promise.all(updatePromises);
        console.log(`✅ Added slugs to ${updatePromises.length} events`);
      } else {
        console.log('✅ All events already have slugs');
      }
    } catch (error) {
      console.error('❌ Error adding slugs to existing events:', error);
    }
  }

  // Delete an event and all its registrations
  static async deleteEvent(eventId: string): Promise<void> {
    try {
      console.log('🗑️ Deleting event:', eventId);

      // First, delete all registrations for this event
      const registrationsRef = collection(db, 'events', eventId, 'registrations');
      const registrationsSnapshot = await getDocs(registrationsRef);

      // Delete all registration documents
      const deletePromises = registrationsSnapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);

      console.log(`✅ Deleted ${registrationsSnapshot.size} registrations for event ${eventId}`);

      // Delete all connections associated with this event
      // Import ConnectionService dynamically to avoid circular dependencies
      const { ConnectionService } = await import('./connectionService');
      const connectionResults = await ConnectionService.removeConnectionsForEvent(eventId);
      console.log(`✅ Cleaned up connections: ${connectionResults.removed} removed, ${connectionResults.updated} updated`);

      // Then delete the event itself
      await deleteDoc(doc(db, 'events', eventId));

      console.log('✅ Event deleted successfully:', eventId);
    } catch (error) {
      console.error('❌ Error deleting event:', error);
      throw error;
    }
  }

  // Get all events (for admin)
  static async getAllEvents(): Promise<EventData[]> {
    try {
      const eventsRef = collection(db, 'events');
      const q = query(eventsRef, orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      
      const events = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as EventData[];

      // Add slugs to events that don't have them
      const eventsNeedingSlugs = events.filter(event => !event.slug);
      if (eventsNeedingSlugs.length > 0) {
        console.log(`🔄 Found ${eventsNeedingSlugs.length} events without slugs, adding them...`);
        await this.addSlugsToExistingEvents();
        
        // Refetch events to get updated slugs
        const updatedSnapshot = await getDocs(q);
        return updatedSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as EventData[];
      }

      return events;
    } catch (error) {
      console.error('❌ Error fetching all events:', error);
      return [];
    }
  }

  // Get public events (non-admin users)
  static async getPublicEvents(): Promise<EventData[]> {
    try {
      console.log('🔍 Fetching public events...');
      
      const eventsRef = collection(db, 'events');
      
      // Query for public events (active, sold-out, completed)
      console.log('🔍 Creating Firestore query with WHERE status IN:', ['active', 'sold-out', 'completed']);
      const q = query(
        eventsRef,
        where('status', 'in', ['active', 'sold-out', 'completed'])
      );
      console.log('✅ Firestore query created');
      
      console.log('📊 Executing Firestore query for public events...');
      const snapshot = await getDocs(q);
      
      console.log(`📋 Raw Firestore results: ${snapshot.docs.length} documents`);
      
      const events = snapshot.docs.map(doc => {
        const data = doc.data();
        console.log(`🔍 Raw document: ${doc.id} - Status: "${data.status}" - Name: "${data.name}"`);
        return {
          id: doc.id,
          ...data
        };
      }) as EventData[];
      
      console.log(`✅ Processed ${events.length} public events with statuses:`, events.map(e => `${e.name}: ${e.status}`));

      // Add slugs to events that don't have them
      const eventsNeedingSlugs = events.filter(event => !event.slug);
      if (eventsNeedingSlugs.length > 0) {
        console.log(`🔄 Found ${eventsNeedingSlugs.length} public events without slugs, adding them...`);
        await this.addSlugsToExistingEvents();
        
        // Refetch events to get updated slugs
        const updatedSnapshot = await getDocs(q);
        const updatedEvents = updatedSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as EventData[];
        
        // Sort manually by date
        updatedEvents.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        
        console.log(`✅ Successfully fetched ${updatedEvents.length} public events with slugs`);
        return updatedEvents;
      }
      
      // Sort manually by date
      events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      console.log(`✅ Successfully fetched ${events.length} public events`);
      return events;
      
    } catch (error: any) {
      console.error('❌ Error fetching public events:', error);
      return [];
    }
  }

  // Get single event by ID
  static async getEventById(eventId: string): Promise<EventData | null> {
    try {
      const docRef = doc(db, 'events', eventId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const event = { id: docSnap.id, ...docSnap.data() } as EventData;
        
        // Add slug if missing
        if (!event.slug) {
          const slug = generateSlug(event.name);
          const uniqueSlug = await this.ensureUniqueSlug(slug);
          
          await updateDoc(docRef, {
            slug: uniqueSlug,
            updatedAt: serverTimestamp()
          });
          
          event.slug = uniqueSlug;
        }
        
        return event;
      }
      return null;
    } catch (error) {
      console.error('❌ Error fetching event:', error);
      return null;
    }
  }

  // Get single event by slug
  static async getEventBySlug(slug: string): Promise<EventData | null> {
    try {
      console.log('🔍 Fetching event by slug:', slug);
      
      const eventsRef = collection(db, 'events');
      const q = query(eventsRef, where('slug', '==', slug));
      const snapshot = await getDocs(q);
      
      if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        const event = { id: doc.id, ...doc.data() } as EventData;
        console.log('✅ Found event by slug:', event.name);
        return event;
      }
      
      console.log('❌ No event found with slug:', slug);
      return null;
    } catch (error) {
      console.error('❌ Error fetching event by slug:', error);
      return null;
    }
  }

  // Get event by slug OR ID (fallback for compatibility)
  static async getEventBySlugOrId(slugOrId: string): Promise<EventData | null> {
    try {
      console.log('🔍 Fetching event by slug or ID:', slugOrId);
      
      // First try to get by slug
      let event = await this.getEventBySlug(slugOrId);
      
      // If not found by slug, try by ID (for backward compatibility)
      if (!event) {
        console.log('🔄 Slug not found, trying by ID...');
        event = await this.getEventById(slugOrId);
      }
      
      return event;
    } catch (error) {
      console.error('❌ Error fetching event by slug or ID:', error);
      return null;
    }
  }

  // Update event status
  static async updateEventStatus(eventId: string, status: EventData['status']): Promise<void> {
    try {
      console.log(`🔄 UPDATING EVENT STATUS: ${eventId} -> "${status}"`);
      const docRef = doc(db, 'events', eventId);
      await updateDoc(docRef, { 
        status,
        updatedAt: serverTimestamp()
      });
      console.log(`✅ Event status updated successfully: ${eventId} -> "${status}"`);
      
      // Verify the update by reading it back
      const updatedDoc = await getDoc(docRef);
      if (updatedDoc.exists()) {
        const updatedData = updatedDoc.data();
        console.log(`🔍 Verification - Event ${eventId} now has status: "${updatedData.status}"`);
      }
    } catch (error) {
      console.error('❌ Error updating event status:', error);
      throw error;
    }
  }

  // Update entire event
  static async updateEvent(eventId: string, eventData: Partial<Omit<EventData, 'id' | 'createdAt' | 'createdBy'>>): Promise<void> {
    try {
      console.log('🔄 Updating event:', eventId, eventData);
      
      const docRef = doc(db, 'events', eventId);
      
      // If name is being updated, regenerate slug
      let updateData = { ...eventData };
      if (eventData.name) {
        const newSlug = generateSlug(eventData.name);
        
        // Get current event to check if slug should be updated
        const currentEvent = await this.getEventById(eventId);
        if (currentEvent && currentEvent.slug !== newSlug) {
          // Ensure new slug is unique
          const uniqueSlug = await this.ensureUniqueSlug(newSlug);
          updateData.slug = uniqueSlug;
          console.log('📝 Updated slug for event:', newSlug, '->', uniqueSlug);
        }
      }
      
      // Add update timestamp
      updateData.updatedAt = serverTimestamp();
      
      await updateDoc(docRef, updateData);
      console.log('✅ Event updated successfully:', eventId);
    } catch (error) {
      console.error('❌ Error updating event:', error);
      throw error;
    }
  }

  // Register user for event
  static async registerForEvent(
    eventId: string, 
    userId: string, 
    registrationData: EventRegistration
  ): Promise<void> {
    try {
      // Check if user is already registered
      const existingReg = await this.getUserRegistration(eventId, userId);
      if (existingReg) {
        throw new Error('You are already registered for this event');
      }

      // Check if event is active
      const event = await this.getEventById(eventId);
      if (!event || event.status !== 'active') {
        throw new Error('Registration is not available for this event');
      }

      // Generate connection URL for in-app / share link
      const qrCodeUrl = `https://almalinks.org/connect?to=${userId}&event=${eventId}`;
      
      // Also store the check-in code for admin scanner
      const checkInCode = `${eventId}-${userId}`;

      const regRef = doc(db, 'events', eventId, 'registrations', userId);
      await setDoc(regRef, {
        ...registrationData,
        qrCodeUrl, // Connection URL for user-to-user link
        checkInCode, // Simple code for admin check-in scanner
        checkedIn: false,
        registeredAt: serverTimestamp()
      });
      
      console.log('✅ User registered for event:', eventId, userId);
      
      // ENHANCED: Trigger auto-connect after successful registration
      try {
        // Import here to avoid circular dependency
        const { AutoConnectService } = await import('./autoConnectService');
        await AutoConnectService.autoConnectForEvent(userId, eventId);
        console.log('✅ Auto-connect completed for user registration:', userId, eventId);
      } catch (autoConnectError) {
        // Log but don't fail registration if auto-connect fails
        console.error('⚠️ Auto-connect failed (registration still successful):', autoConnectError);
      }
      
    } catch (error) {
      console.error('❌ Error registering for event:', error);
      throw error;
    }
  }

  // Cancel registration for event
  static async cancelRegistration(
    eventId: string,
    userId: string
  ): Promise<void> {
    try {
      // Check if registration exists
      const regRef = doc(db, 'events', eventId, 'registrations', userId);
      const regSnap = await getDoc(regRef);
      
      if (!regSnap.exists()) {
        throw new Error('Registration not found');
      }

      // Delete the registration document
      await deleteDoc(regRef);
      
      console.log('✅ Registration cancelled successfully:', eventId, userId);
    } catch (error) {
      console.error('❌ Error cancelling registration:', error);
      throw error;
    }
  }

  // Get user's registration for an event
  static async getUserRegistration(eventId: string, userId: string): Promise<EventRegistration | null> {
    try {
      const regRef = doc(db, 'events', eventId, 'registrations', userId);
      const regSnap = await getDoc(regRef);
      
      if (regSnap.exists()) {
        return regSnap.data() as EventRegistration;
      }
      return null;
    } catch (error) {
      console.error('❌ Error fetching user registration:', error);
      return null;
    }
  }

  // Get all registrations for an event (admin only)
  static async getEventRegistrations(eventId: string): Promise<Array<EventRegistration & { userId: string }>> {
    try {
      const regsRef = collection(db, 'events', eventId, 'registrations');
      const snapshot = await getDocs(regsRef);
      
      return snapshot.docs.map(doc => ({
        userId: doc.id,
        ...doc.data()
      })) as Array<EventRegistration & { userId: string }>;
    } catch (error) {
      console.error('❌ Error fetching event registrations:', error);
      return [];
    }
  }

  // Get user by ID to fetch additional profile data
  static async getUserById(userId: string): Promise<any | null> {
    try {
      const userRef = doc(db, 'users', userId);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists()) {
        return userSnap.data();
      }
      return null;
    } catch (error) {
      console.error('❌ Error fetching user data:', error);
      return null;
    }
  }

  // Update check-in status for a user registration
  static async updateCheckInStatus(
    eventId: string, 
    userId: string, 
    checkedIn: boolean, 
    checkedInBy?: string
  ): Promise<void> {
    try {
      const regRef = doc(db, 'events', eventId, 'registrations', userId);
      const updateData: any = { 
        checkedIn,
        ...(checkedIn ? { 
          checkedInAt: serverTimestamp(),
          ...(checkedInBy && { checkedInBy })
        } : {})
      };
      
      await updateDoc(regRef, updateData);
      console.log('✅ Check-in status updated:', eventId, userId, checkedIn);
      
      // ENHANCED: Trigger auto-connect when user checks in
      if (checkedIn) {
        try {
          // Import here to avoid circular dependency
          const { AutoConnectService } = await import('./autoConnectService');
          await AutoConnectService.autoConnectForEvent(userId, eventId);
          console.log('✅ Auto-connect completed for user check-in:', userId, eventId);
        } catch (autoConnectError) {
          // Log but don't fail check-in if auto-connect fails
          console.error('⚠️ Auto-connect failed during check-in (check-in still successful):', autoConnectError);
        }
      }
      
    } catch (error) {
      console.error('❌ Error updating check-in status:', error);
      throw error;
    }
  }

  // Get registration statistics for an event
  static async getEventStats(eventId: string): Promise<{ total: number; registered: number; checkedIn: number }> {
    try {
      const registrations = await this.getEventRegistrations(eventId);
      
      const total = registrations.length;
      const checkedIn = registrations.filter(reg => reg.checkedIn === true).length;
      const registered = total - checkedIn;
      
      return { total, registered, checkedIn };
    } catch (error) {
      console.error('❌ Error loading event stats:', error);
      return { total: 0, registered: 0, checkedIn: 0 };
    }
  }

  // ENHANCED: Update auto-connect setting for an event
  static async updateAutoConnectSetting(eventId: string, enabled: boolean): Promise<void> {
    try {
      const eventRef = doc(db, 'events', eventId);
      await updateDoc(eventRef, {
        autoConnectEnabled: enabled,
        updatedAt: serverTimestamp()
      });
      
      console.log('✅ Auto-connect setting updated:', eventId, enabled);
      
      // If enabling auto-connect, trigger retroactive connections
      if (enabled) {
        try {
          const { AutoConnectService } = await import('./autoConnectService');
          await AutoConnectService.retroactiveAutoConnect(eventId);
          console.log('✅ Retroactive auto-connect completed for event:', eventId);
        } catch (error) {
          console.error('⚠️ Retroactive auto-connect failed:', error);
          // Don't throw - the setting update was successful
        }
      }
      
    } catch (error) {
      console.error('❌ Error updating auto-connect setting:', error);
      throw error;
    }
  }

  // ENHANCED: Get auto-connect status for an event
  static async getAutoConnectStatus(eventId: string): Promise<boolean> {
    try {
      const eventDoc = await getDoc(doc(db, 'events', eventId));
      if (!eventDoc.exists()) {
        return true; // Default to enabled for new events
      }
      
      const eventData = eventDoc.data();
      return eventData.autoConnectEnabled ?? true; // Default to true if not set
      
    } catch (error) {
      console.error('❌ Error getting auto-connect status:', error);
      return true; // Default to enabled on error
    }
  }

  // ENHANCED: Manual trigger for retroactive auto-connect (admin only)
  static async triggerRetroactiveAutoConnect(eventId: string): Promise<void> {
    try {
      const { AutoConnectService } = await import('./autoConnectService');
      await AutoConnectService.retroactiveAutoConnect(eventId);
      console.log('✅ Manual retroactive auto-connect completed for event:', eventId);
    } catch (error) {
      console.error('❌ Error in manual retroactive auto-connect:', error);
      throw error;
    }
  }
}