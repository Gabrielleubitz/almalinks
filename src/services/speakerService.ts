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
  arrayUnion,
  arrayRemove
} from 'firebase/firestore';
import { 
  ref, 
  uploadBytes, 
  getDownloadURL, 
  deleteObject
} from 'firebase/storage';
import { db, storage } from '../firebase/config';
import { nanoid } from 'nanoid';

export interface SpeakerFile {
  id: string;
  fileName: string;
  originalName: string;
  description: string;
  fileUrl: string;
  fileType: string;
  fileSize: number;
  eventId: string;
  uploadedBy: string;
  uploadedAt: any;
  adminNote?: string;
  adminNoteBy?: string;
  adminNoteAt?: any;
}

export interface EventSpeaker {
  id: string;
  name: string;
  title?: string;
  bio?: string;
  email?: string;
  company?: string;
  imageUrl?: string;
  linkedIn?: string;
  twitter?: string;
  website?: string;
  eventId: string;
  createdAt: any;
  createdBy: string;
  updatedAt?: any;
  updatedBy?: string;
}

export interface SpeakerAssignment {
  id: string;
  eventId: string;
  eventName: string;
  eventDate: string;
  speakerId: string;
  speakerName: string;
  speakerTitle?: string;
  speakerImageUrl?: string;
  createdAt: any;
  createdBy: string;
}

export interface SpeakerDebugInfo {
  speakerId: string;
  speakerName: string;
  assignedEvents: any[];
  speakerAssignments: any[];
  finalResult: boolean;
  timestamp: string;
}

export class SpeakerService {
  
  /**
   * Create a new speaker for an event (admin-managed)
   */
  static async createSpeaker(eventId: string, speakerData: Omit<EventSpeaker, 'id' | 'eventId' | 'createdAt'>, adminUserId: string): Promise<EventSpeaker> {
    try {
      const speakerId = nanoid();
      
      console.log('📝 Creating speaker with data:', speakerData);
      console.log('🎯 For eventId:', eventId);
      
      // Filter out undefined values - Firestore doesn't accept undefined
      const cleanSpeakerData = Object.fromEntries(
        Object.entries(speakerData).filter(([_, value]) => value !== undefined)
      );
      
      console.log('🧹 Cleaned speaker data:', cleanSpeakerData);
      
      const speaker: Partial<EventSpeaker> = {
        id: speakerId,
        eventId,
        ...cleanSpeakerData,
        createdAt: serverTimestamp(),
        createdBy: adminUserId
      };

      console.log('💾 Final speaker object to save:', speaker);
      
      const speakerRef = doc(db, 'speakers', speakerId);
      await setDoc(speakerRef, speaker);

      console.log('✅ Speaker created successfully with ID:', speakerId);
      return speaker as EventSpeaker;

    } catch (error) {
      console.error('❌ Error creating speaker:', error);
      throw error;
    }
  }

  /**
   * Update speaker information
   */
  static async updateSpeaker(speakerId: string, updates: Partial<Omit<EventSpeaker, 'id' | 'eventId' | 'createdAt' | 'createdBy'>>, adminUserId: string): Promise<void> {
    try {
      // Filter out undefined values - Firestore doesn't accept undefined
      const cleanUpdates = Object.fromEntries(
        Object.entries(updates).filter(([_, value]) => value !== undefined)
      );
      
      const speakerRef = doc(db, 'speakers', speakerId);
      await updateDoc(speakerRef, {
        ...cleanUpdates,
        updatedAt: serverTimestamp(),
        updatedBy: adminUserId
      });

      console.log('✅ Speaker updated successfully:', speakerId);

    } catch (error) {
      console.error('❌ Error updating speaker:', error);
      throw error;
    }
  }

  /**
   * Delete a speaker
   */
  static async deleteSpeaker(speakerId: string): Promise<void> {
    try {
      const speakerRef = doc(db, 'speakers', speakerId);
      await deleteDoc(speakerRef);

      console.log('✅ Speaker deleted successfully:', speakerId);

    } catch (error) {
      console.error('❌ Error deleting speaker:', error);
      throw error;
    }
  }

  /**
   * Test method to check if we can read from speakers collection
   */
  static async testSpeakersCollection(): Promise<void> {
    try {
      console.log('🧪 Testing speakers collection access...');
      const speakersRef = collection(db, 'speakers');
      const snapshot = await getDocs(speakersRef);
      console.log(`✅ Can read speakers collection. Found ${snapshot.docs.length} documents`);
    } catch (error) {
      console.error('❌ Cannot read speakers collection:', error);
    }
  }

  /**
   * Get all speakers for an event (NEW VERSION)
   */
  static async getEventSpeakersNew(eventId: string): Promise<EventSpeaker[]> {
    console.error('🚀🚀🚀 NEW FUNCTION RUNNING - getEventSpeakersNew called with eventId:', eventId);
    alert('NEW FUNCTION getEventSpeakersNew called with eventId: ' + eventId);
    
    try {
      const speakersRef = collection(db, 'speakers');
      
      // Get all speakers and filter manually (temporary fix)
      console.error('📡📡📡 Fetching all speakers...');
      const allSnapshot = await getDocs(speakersRef);
      console.error(`📊📊📊 Retrieved ${allSnapshot.docs.length} total speaker documents`);
      
      const allSpeakers = allSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Log each speaker for debugging
      allSpeakers.forEach(speaker => {
        console.error(`📄📄📄 Speaker: ${speaker.name} | eventId: "${speaker.eventId}" | matches: ${speaker.eventId === eventId}`);
      });
      
      // Filter for the specific event
      const eventSpeakers = allSpeakers.filter(speaker => speaker.eventId === eventId);
      console.error(`✅✅✅ Found ${eventSpeakers.length} speakers for event ${eventId}:`, eventSpeakers);
      
      return eventSpeakers as EventSpeaker[];

    } catch (error) {
      console.error('❌❌❌ Error in getEventSpeakersNew:', error);
      return [];
    }
  }

  /**
   * Get all speakers for an event
   */
  static async getEventSpeakers(eventId: string): Promise<EventSpeaker[]> {
    // Call the new version
    return this.getEventSpeakersNew(eventId);
  }

  /**
   * Get a specific speaker by ID
   */
  static async getSpeaker(speakerId: string): Promise<EventSpeaker | null> {
    try {
      const speakerRef = doc(db, 'speakers', speakerId);
      const speakerDoc = await getDoc(speakerRef);

      if (speakerDoc.exists()) {
        return {
          id: speakerDoc.id,
          ...speakerDoc.data()
        } as EventSpeaker;
      }

      return null;

    } catch (error) {
      console.error('❌ Error getting speaker:', error);
      return null;
    }
  }

  /**
   * 🎯 DEPRECATED: Check if user is a speaker (keeping for backward compatibility)
   * This method is now deprecated since speakers are no longer user-based
   */
  static async isUserSpeaker(userId: string): Promise<boolean> {
    if (!userId) {
      console.log('❌ No userId provided to isUserSpeaker');
      return false;
    }

    try {
      console.log('🔍 === SPEAKER STATUS CHECK START ===');
      console.log('🔍 Checking speaker status for user:', userId);
      
      let isSpeaker = false;

      // ===== METHOD 1: Check user's role in profile =====
      console.log('📋 Step 1: Checking user role in profile...');
      const userDocRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userDocRef);
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        console.log('👤 User document found:', userData);
        console.log('🎭 User role:', userData.role);
        
        if (userData.role === 'speaker' || userData.role === 'admin') {
          console.log('✅ User has speaker/admin role - IS SPEAKER!');
          isSpeaker = true;
        } else {
          console.log('⚠️ User role is not speaker/admin:', userData.role);
        }
      } else {
        console.log('❌ User document not found in Firestore');
      }

      // ===== METHOD 2: Check event speaker assignments =====
      if (!isSpeaker) {
        console.log('📅 Step 2: Checking event speaker assignments...');
        
        const eventsRef = collection(db, 'events');
        const eventsSnapshot = await getDocs(eventsRef);
        
        console.log('📊 Total events in database:', eventsSnapshot.size);
        
        let eventCount = 0;
        for (const eventDoc of eventsSnapshot.docs) {
          eventCount++;
          const eventData = eventDoc.data();
          const eventSpeakers = eventData.speakers || [];
          
          console.log(`📅 Event ${eventCount}/${eventsSnapshot.size} - "${eventData.name || eventDoc.id}":`);
          console.log(`   - Speakers array:`, eventSpeakers);
          console.log(`   - Speakers count:`, eventSpeakers.length);
          
          // Check if user is in speakers array
          const foundAsSpeaker = eventSpeakers.some((speaker: EventSpeaker) => {
            const match = speaker.userId === userId;
            if (match) {
              console.log(`   ✅ FOUND USER AS SPEAKER:`, speaker);
            }
            return match;
          });
          
          if (foundAsSpeaker) {
            console.log('🎉 User found as speaker in event:', eventDoc.id);
            isSpeaker = true;
            break;
          }
        }
        
        if (!isSpeaker) {
          console.log('❌ User not found as speaker in any events');
        }
      }

      // ===== METHOD 3: Check speakerAssignments collection =====
      if (!isSpeaker) {
        console.log('📝 Step 3: Checking speakerAssignments collection...');
        
        try {
          const assignmentsRef = collection(db, 'speakerAssignments');
          const q = query(assignmentsRef, where('speakerId', '==', userId));
          const assignmentsSnapshot = await getDocs(q);
          
          console.log('📊 Speaker assignments found:', assignmentsSnapshot.size);
          
          if (!assignmentsSnapshot.empty) {
            console.log('✅ User found in speakerAssignments collection - IS SPEAKER!');
            isSpeaker = true;
          } else {
            console.log('❌ User not found in speakerAssignments collection');
          }
        } catch (error) {
          console.log('⚠️ Error checking speakerAssignments (collection may not exist yet):', error);
        }
      }

      console.log('🏁 === SPEAKER STATUS CHECK RESULT ===');
      console.log(`🎯 Final Result: ${isSpeaker ? 'IS SPEAKER ✅' : 'NOT SPEAKER ❌'}`);
      console.log('🔍 === SPEAKER STATUS CHECK END ===');
      
      return isSpeaker;

    } catch (error) {
      console.error('💥 ERROR in isUserSpeaker:', error);
      console.error('Stack trace:', error.stack);
      return false;
    }
  }

  /**
   * 🐛 ENHANCED DEBUG: Get comprehensive speaker status info
   */
  static async debugSpeakerStatus(userId: string): Promise<SpeakerDebugInfo> {
    console.log('🐛 === ENHANCED DEBUG MODE START ===');
    
    const debugInfo: SpeakerDebugInfo = {
      userId,
      hasUserDoc: false,
      userRole: null,
      userDocData: null,
      assignedEvents: [],
      speakerAssignments: [],
      roleBasedSpeaker: false,
      eventBasedSpeaker: false,
      finalResult: false,
      timestamp: new Date().toISOString()
    };

    try {
      // Check user document
      console.log('🐛 Checking user document...');
      const userDocRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userDocRef);
      
      debugInfo.hasUserDoc = userDoc.exists();
      if (userDoc.exists()) {
        debugInfo.userDocData = userDoc.data();
        debugInfo.userRole = userDoc.data().role || null;
        debugInfo.roleBasedSpeaker = debugInfo.userRole === 'speaker' || debugInfo.userRole === 'admin';
      }

      console.log('🐛 User document exists:', debugInfo.hasUserDoc);
      console.log('🐛 User role:', debugInfo.userRole);
      console.log('🐛 Role-based speaker:', debugInfo.roleBasedSpeaker);

      // Check event assignments
      console.log('🐛 Checking event assignments...');
      const eventsRef = collection(db, 'events');
      const eventsSnapshot = await getDocs(eventsRef);
      
      for (const eventDoc of eventsSnapshot.docs) {
        const eventData = eventDoc.data();
        const eventSpeakers = eventData.speakers || [];
        
        if (eventSpeakers.some((speaker: EventSpeaker) => speaker.userId === userId)) {
          debugInfo.assignedEvents.push({
            id: eventDoc.id,
            name: eventData.name || 'Unnamed Event',
            date: eventData.date,
            speakers: eventSpeakers,
            userSpeakerRecord: eventSpeakers.find((s: EventSpeaker) => s.userId === userId)
          });
        }
      }

      debugInfo.eventBasedSpeaker = debugInfo.assignedEvents.length > 0;
      debugInfo.finalResult = debugInfo.roleBasedSpeaker || debugInfo.eventBasedSpeaker;

      console.log('🐛 Event-based speaker:', debugInfo.eventBasedSpeaker);
      console.log('🐛 Assigned to events:', debugInfo.assignedEvents.length);
      console.log('🐛 Final speaker status:', debugInfo.finalResult);

      // Check speakerAssignments collection if it exists
      try {
        const speakerAssignmentsRef = collection(db, 'speakerAssignments');
        const assignmentsQuery = query(speakerAssignmentsRef, where('speakerId', '==', userId));
        const assignmentsSnapshot = await getDocs(assignmentsQuery);
        
        debugInfo.speakerAssignments = assignmentsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        console.log('🐛 Speaker assignments found:', debugInfo.speakerAssignments.length);
      } catch (assignmentError) {
        console.log('🐛 No speakerAssignments collection found (this is normal)');
      }

      console.log('🐛 === COMPLETE DEBUG INFO ===');
      console.table(debugInfo);
      console.log('🐛 === ENHANCED DEBUG MODE END ===');

      return debugInfo;

    } catch (error) {
      console.error('💥 ERROR in debugSpeakerStatus:', error);
      return {
        ...debugInfo,
        finalResult: false
      };
    }
  }

  /**
   * 🔧 UTILITY: Set user role to speaker
   */
  static async setUserAsSpeaker(userId: string): Promise<void> {
    if (!userId) throw new Error('User ID is required');

    try {
      console.log('🔧 Setting user as speaker:', userId);
      
      const userRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userRef);
      
      if (userDoc.exists()) {
        // Update existing user document
        await updateDoc(userRef, {
          role: 'speaker',
          updatedAt: serverTimestamp()
        });
        console.log('✅ Updated existing user role to speaker');
      } else {
        // Create new user document with speaker role
        await setDoc(userRef, {
          role: 'speaker',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        console.log('✅ Created new user document with speaker role');
      }
      
      console.log('🎉 User is now a speaker! Refresh the page to see changes.');
    } catch (error) {
      console.error('❌ Error setting user as speaker:', error);
      throw error;
    }
  }

  /**
   * 🧪 UTILITY: Create test speaker assignment for debugging
   */
  static async createTestSpeakerAssignment(
    userId: string, 
    userName: string, 
    userEmail: string
  ): Promise<void> {
    try {
      console.log('🧪 Creating test speaker assignment...');
      
      // Create a test event
      const testEventId = `test-event-${Date.now()}`;
      const testEventRef = doc(db, 'events', testEventId);
      
      const testEvent = {
        name: '🧪 Test Speaker Event (Auto-Generated)',
        description: 'This is a test event created for speaker debugging. You can delete this.',
        date: new Date().toISOString(),
        location: 'Test Location',
        speakers: [{
          userId,
          name: userName,
          email: userEmail,
          assignedAt: serverTimestamp(),
          assignedBy: 'system-debug'
        }],
        createdAt: serverTimestamp(),
        isTestEvent: true
      };
      
      await setDoc(testEventRef, testEvent);
      
      console.log('✅ Test event created:', testEventId);
      console.log('✅ User assigned as speaker to test event');
      console.log('🎉 Test assignment complete! Refresh the page to see changes.');
      
      return;
    } catch (error) {
      console.error('❌ Error creating test speaker assignment:', error);
      throw error;
    }
  }

  /**
   * 🧹 UTILITY: Clean up test events
   */
  static async cleanupTestEvents(): Promise<void> {
    try {
      console.log('🧹 Cleaning up test events...');
      
      const eventsRef = collection(db, 'events');
      const testEventsQuery = query(eventsRef, where('isTestEvent', '==', true));
      const snapshot = await getDocs(testEventsQuery);
      
      const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);
      
      console.log(`✅ Cleaned up ${snapshot.docs.length} test events`);
    } catch (error) {
      console.error('❌ Error cleaning up test events:', error);
      throw error;
    }
  }

  /**
   * 📊 Get events where user is assigned as speaker
   */
  static async getUserSpeakerEvents(userId: string): Promise<any[]> {
    try {
      console.log('🔍 Getting speaker events for user:', userId);
      
      // First check the speakerAssignments collection
      const assignments = await this.getUserSpeakerAssignments(userId);
      
      if (assignments.length > 0) {
        console.log('✅ Found speaker assignments in speakerAssignments collection:', assignments.length);
        return assignments;
      }
      
      // Fallback to checking events collection
      console.log('⚠️ No assignments found in speakerAssignments, checking events collection...');
      
      const eventsRef = collection(db, 'events');
      const eventsSnapshot = await getDocs(eventsRef);
      
      const speakerEvents = [];
      
      for (const eventDoc of eventsSnapshot.docs) {
        const eventData = { id: eventDoc.id, ...eventDoc.data() };
        if (eventData.speakers && eventData.speakers.some((speaker: EventSpeaker) => speaker.userId === userId)) {
          speakerEvents.push(eventData);
        }
      }
      
      console.log('✅ Found speaker events in events collection:', speakerEvents.length);
      
      return speakerEvents.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    } catch (error) {
      console.error('❌ Error fetching speaker events:', error);
      return [];
    }
  }

  /**
   * 📋 Get speaker assignments for a user
   */
  static async getUserSpeakerAssignments(userId: string): Promise<SpeakerAssignment[]> {
    try {
      console.log('🔍 Getting speaker assignments for user:', userId);
      
      const assignmentsRef = collection(db, 'speakerAssignments');
      const q = query(assignmentsRef, where('speakerId', '==', userId), orderBy('eventDate', 'desc'));
      
      const snapshot = await getDocs(q);
      
      const assignments = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as SpeakerAssignment[];
      
      console.log('✅ Found speaker assignments:', assignments.length);
      
      return assignments;
    } catch (error) {
      console.error('❌ Error fetching speaker assignments:', error);
      return [];
    }
  }

  /**
   * 📤 Upload file to Firebase Storage
   */
  static async uploadFile(
    file: File, 
    description: string, 
    eventId: string, 
    userId: string
  ): Promise<SpeakerFile> {
    try {
      console.log('🔍 Starting file upload process...');
      
      // Validate file
      const maxSize = 50 * 1024 * 1024; // 50MB
      if (file.size > maxSize) {
        throw new Error('File size must be less than 50MB');
      }

      const allowedTypes = [
        'application/pdf',
        'image/jpeg',
        'image/png',
        'image/gif',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain'
      ];

      if (!allowedTypes.includes(file.type)) {
        throw new Error('File type not supported. Please upload PDF, images, presentations, or documents.');
      }

      // Generate unique file ID and name
      const fileId = nanoid(12);
      const fileName = `${fileId}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      
      // Create storage reference with consistent path format
      const storagePath = `speaker_files/${eventId}/${userId}/${fileName}`;
      console.log('📁 Storage path:', storagePath);
      const storageRef = ref(storage, storagePath);

      // Upload file using Firebase Storage SDK
      console.log('📤 Uploading file to Firebase Storage...');
      const uploadResult = await uploadBytes(storageRef, file);
      console.log('✅ File uploaded to storage, getting download URL...');
      
      // Get download URL using Firebase Storage SDK
      const fileUrl = await getDownloadURL(uploadResult.ref);
      console.log('✅ Download URL obtained:', fileUrl);

      // Create file metadata object
      const speakerFile: SpeakerFile = {
        id: fileId,
        fileName,
        originalName: file.name,
        description: description.trim(),
        fileUrl,
        fileType: file.type,
        fileSize: file.size,
        eventId,
        uploadedBy: userId,
        uploadedAt: serverTimestamp()
      };

      // Save metadata to Firestore
      console.log('📝 Saving file metadata to Firestore...');
      await setDoc(doc(db, 'speakerFiles', fileId), speakerFile);

      console.log('✅ File uploaded successfully:', fileId);
      return speakerFile;
    } catch (error) {
      console.error('❌ Error uploading file:', error);
      throw error;
    }
  }

  /**
   * 📁 Get files uploaded by a specific user
   */
  static async getUserFiles(userId: string): Promise<SpeakerFile[]> {
    try {
      const filesRef = collection(db, 'speakerFiles');
      const q = query(filesRef, where('uploadedBy', '==', userId), orderBy('uploadedAt', 'desc'));
      const snapshot = await getDocs(q);
      
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as SpeakerFile[];
    } catch (error) {
      console.error('❌ Error fetching user files:', error);
      return [];
    }
  }

  /**
   * 📋 Get all speaker files (admin only)
   */
  static async getAllSpeakerFiles(): Promise<SpeakerFile[]> {
    try {
      const filesRef = collection(db, 'speakerFiles');
      const q = query(filesRef, orderBy('uploadedAt', 'desc'));
      const snapshot = await getDocs(q);
      
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as SpeakerFile[];
    } catch (error) {
      console.error('❌ Error fetching all speaker files:', error);
      return [];
    }
  }

  /**
   * 📅 Get files for a specific event (admin only)
   */
  static async getEventFiles(eventId: string): Promise<SpeakerFile[]> {
    try {
      const filesRef = collection(db, 'speakerFiles');
      const q = query(filesRef, where('eventId', '==', eventId), orderBy('uploadedAt', 'desc'));
      const snapshot = await getDocs(q);
      
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as SpeakerFile[];
    } catch (error) {
      console.error('❌ Error fetching event files:', error);
      return [];
    }
  }

  /**
   * 🗑️ Delete file
   */
  static async deleteFile(fileId: string, userId?: string): Promise<void> {
    try {
      // Get file metadata
      const fileDoc = await getDoc(doc(db, 'speakerFiles', fileId));
      if (!fileDoc.exists()) {
        throw new Error('File not found');
      }

      const fileData = fileDoc.data() as SpeakerFile;

      // Check permissions (user can only delete their own files, admins can delete any)
      if (userId && fileData.uploadedBy !== userId) {
        throw new Error('You can only delete your own files');
      }

      // Delete from Firebase Storage using the same path format as upload
      console.log('🗑️ Deleting file from storage:', fileData.fileName);
      const storagePath = `speaker_files/${fileData.eventId}/${fileData.uploadedBy}/${fileData.fileName}`;
      const storageRef = ref(storage, storagePath);
      
      try {
        await deleteObject(storageRef);
        console.log('✅ File deleted from storage');
      } catch (storageError) {
        console.error('⚠️ Error deleting from storage (file may not exist):', storageError);
        // Continue with Firestore deletion even if storage deletion fails
      }

      // Delete metadata from Firestore
      await deleteDoc(doc(db, 'speakerFiles', fileId));
      console.log('✅ File metadata deleted from Firestore');

      console.log('✅ File deleted successfully:', fileId);
    } catch (error) {
      console.error('❌ Error deleting file:', error);
      throw error;
    }
  }

  /**
   * 📝 Add admin note to file
   */
  static async addAdminNote(fileId: string, note: string, adminId: string): Promise<void> {
    try {
      await updateDoc(doc(db, 'speakerFiles', fileId), {
        adminNote: note.trim(),
        adminNoteBy: adminId,
        adminNoteAt: serverTimestamp()
      });
      console.log('✅ Admin note added to file:', fileId);
    } catch (error) {
      console.error('❌ Error adding admin note:', error);
      throw error;
    }
  }

  /**
   * ➕ Assign speaker to event
   */
  static async assignSpeakerToEvent(
    eventId: string, 
    userId: string, 
    userName: string, 
    userEmail: string, 
    adminId: string
  ): Promise<void> {
    try {
      console.log('🎤 Assigning speaker to event:', { eventId, userId, userName });
      
      // 1. Get event details
      const eventRef = doc(db, 'events', eventId);
      const eventDoc = await getDoc(eventRef);
      
      if (!eventDoc.exists()) {
        throw new Error('Event not found');
      }

      const eventData = eventDoc.data();
      const currentSpeakers = eventData.speakers || [];

      // Check if user is already assigned
      if (currentSpeakers.some((speaker: EventSpeaker) => speaker.userId === userId)) {
        throw new Error('User is already assigned as a speaker for this event');
      }

      // Get user profile to get profile image
      const userDoc = await getDoc(doc(db, 'users', userId));
      const userData = userDoc.exists() ? userDoc.data() : null;
      const profileImage = userData?.profileImage || null;

      // 2. Create new speaker object with a regular Date instead of serverTimestamp
      const newSpeaker: EventSpeaker = {
        userId,
        name: userName,
        email: userEmail,
        assignedAt: new Date(), // Use regular Date instead of serverTimestamp
        assignedBy: adminId,
        profileImage
      };

      // 3. Update event document with new speaker
      await updateDoc(eventRef, {
        speakers: arrayUnion(newSpeaker)
      });
      
      console.log('✅ Speaker added to event document');

      // 4. Create entry in speakerAssignments collection
      const assignmentId = nanoid(12);
      const assignmentRef = doc(db, 'speakerAssignments', assignmentId);
      
      // Use serverTimestamp only for the separate document
      await setDoc(assignmentRef, {
        id: assignmentId,
        eventId,
        eventName: eventData.name,
        eventDate: eventData.date,
        speakerId: userId,
        speakerName: userName,
        speakerEmail: userEmail,
        speakerProfileImage: profileImage,
        assignedAt: serverTimestamp(),
        assignedBy: adminId
      });
      
      console.log('✅ Speaker assignment created in speakerAssignments collection:', assignmentId);
      console.log('✅ Speaker assigned to event successfully');
    } catch (error) {
      console.error('❌ Error assigning speaker:', error);
      throw error;
    }
  }

  /**
   * ➖ Remove speaker from event
   */
  static async removeSpeakerFromEvent(eventId: string, userId: string): Promise<void> {
    try {
      // 1. Update event document
      const eventRef = doc(db, 'events', eventId);
      const eventDoc = await getDoc(eventRef);
      
      if (!eventDoc.exists()) {
        throw new Error('Event not found');
      }

      const eventData = eventDoc.data();
      const currentSpeakers = eventData.speakers || [];
      const speakerToRemove = currentSpeakers.find((speaker: EventSpeaker) => speaker.userId === userId);

      if (!speakerToRemove) {
        throw new Error('Speaker not found for this event');
      }

      await updateDoc(eventRef, {
        speakers: arrayRemove(speakerToRemove)
      });
      
      console.log('✅ Speaker removed from event document');

      // 2. Delete from speakerAssignments collection
      try {
        const assignmentsRef = collection(db, 'speakerAssignments');
        const q = query(
          assignmentsRef, 
          where('eventId', '==', eventId),
          where('speakerId', '==', userId)
        );
        
        const snapshot = await getDocs(q);
        
        if (!snapshot.empty) {
          const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
          await Promise.all(deletePromises);
          console.log('✅ Speaker assignments deleted from speakerAssignments collection');
        }
      } catch (error) {
        console.error('⚠️ Error removing from speakerAssignments (collection may not exist):', error);
      }

      console.log('✅ Speaker removed from event successfully');
    } catch (error) {
      console.error('❌ Error removing speaker:', error);
      throw error;
    }
  }

  /**
   * 👥 Get event speakers
   */
  static async getEventSpeakers(eventId: string): Promise<EventSpeaker[]> {
    try {
      const eventDoc = await getDoc(doc(db, 'events', eventId));
      if (!eventDoc.exists()) {
        return [];
      }

      const eventData = eventDoc.data();
      return eventData.speakers || [];
    } catch (error) {
      console.error('❌ Error fetching event speakers:', error);
      return [];
    }
  }

  /**
   * 📏 Format file size for display
   */
  static formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * 🎯 Get file type icon
   */
  static getFileTypeIcon(fileType: string): string {
    if (fileType.includes('pdf')) return '📄';
    if (fileType.includes('image')) return '🖼️';
    if (fileType.includes('presentation') || fileType.includes('powerpoint')) return '📊';
    if (fileType.includes('document') || fileType.includes('word')) return '📝';
    if (fileType.includes('text')) return '📃';
    return '📎';
  }

  /**
   * 🆘 EMERGENCY DEBUG: Run all diagnostic checks
   */
  static async emergencyDebug(userId: string): Promise<void> {
    console.log('🆘 === EMERGENCY DEBUG MODE START ===');
    console.log('Running comprehensive diagnostics...');
    
    try {
      // 1. Check user document
      console.log('\n1️⃣ USER DOCUMENT CHECK:');
      const userDoc = await getDoc(doc(db, 'users', userId));
      console.log('User doc exists:', userDoc.exists());
      if (userDoc.exists()) {
        console.log('User data:', userDoc.data());
      }

      // 2. Check all events
      console.log('\n2️⃣ EVENTS CHECK:');
      const eventsSnapshot = await getDocs(collection(db, 'events'));
      console.log('Total events:', eventsSnapshot.size);
      
      let userFoundInEvents = 0;
      eventsSnapshot.docs.forEach((doc, index) => {
        const eventData = doc.data();
        const speakers = eventData.speakers || [];
        const userInThisEvent = speakers.some((s: EventSpeaker) => s.userId === userId);
        
        console.log(`Event ${index + 1}: "${eventData.name || doc.id}"`);
        console.log(`  - Speakers: ${speakers.length}`);
        console.log(`  - User in this event: ${userInThisEvent}`);
        
        if (userInThisEvent) {
          userFoundInEvents++;
          console.log(`  - USER SPEAKER RECORD:`, speakers.find((s: EventSpeaker) => s.userId === userId));
        }
      });
      
      console.log(`\nUser found as speaker in ${userFoundInEvents} events`);

      // 3. Run standard checks
      console.log('\n3️⃣ STANDARD CHECKS:');
      const isUserSpeaker = await this.isUserSpeaker(userId);
      console.log('isUserSpeaker result:', isUserSpeaker);

      // 4. Debug info
      console.log('\n4️⃣ DETAILED DEBUG:');
      const debugInfo = await this.debugSpeakerStatus(userId);
      console.log('Debug summary:', {
        hasUserDoc: debugInfo.hasUserDoc,
        userRole: debugInfo.userRole,
        assignedEvents: debugInfo.assignedEvents.length,
        finalResult: debugInfo.finalResult
      });

      console.log('\n🆘 === EMERGENCY DEBUG COMPLETE ===');
      
      // Recommendations
      console.log('\n💡 RECOMMENDATIONS:');
      if (!debugInfo.hasUserDoc) {
        console.log('❌ No user document found. Run: await SpeakerService.setUserAsSpeaker("' + userId + '")');
      } else if (!debugInfo.userRole || debugInfo.userRole === 'member') {
        console.log('❌ User role is not speaker. Run: await SpeakerService.setUserAsSpeaker("' + userId + '")');
      } else if (debugInfo.assignedEvents.length === 0) {
        console.log('⚠️ No event assignments found. Run: await SpeakerService.createTestSpeakerAssignment("' + userId + '", "Your Name", "your@email.com")');
      } else {
        console.log('✅ Everything looks correct. The issue might be in the Header component or auth state.');
      }

    } catch (error) {
      console.error('💥 ERROR in emergencyDebug:', error);
    }
  }
}