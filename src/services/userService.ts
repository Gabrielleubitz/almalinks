import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  collection, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit,
  writeBatch,
  Timestamp
} from 'firebase/firestore';
import { db, retryOnNetworkFailure } from '../firebase/config';
import { UserProfile, UserProfileForm, UserProfileUpdate, UserDirectoryFilters, UserCard } from '../types/user';
import { FilteredProfile, filterProfileForViewer, getViewerRelationship, isProfileVisibleInDirectory } from '../utils/privacy';
import { calculateProfileCompletion, normalizeUrl } from '../utils/validation';
import { ConnectionService } from './connectionService';

export class UserService {
  /**
   * Create a new user profile
   */
  static async createUser(uid: string, profileData: UserProfileForm): Promise<UserProfile> {
    try {
      console.log('👤 Creating user profile for:', uid);
      
      const now = Timestamp.now();
      
      // Normalize URLs
      const normalizedProfile = {
        ...profileData,
        linkedin: normalizeUrl(profileData.linkedin, 'linkedin'),
        website: normalizeUrl(profileData.website, 'website'),
        twitter: normalizeUrl(profileData.twitter, 'twitter')
      };
      
      const userProfile: UserProfile = {
        uid,
        firstName: normalizedProfile.firstName,
        lastName: normalizedProfile.lastName,
        displayName: normalizedProfile.displayName,
        email: normalizedProfile.email,
        phone: normalizedProfile.phone || undefined,
        showPhone: normalizedProfile.showPhone || false,
        linkedin: normalizedProfile.linkedin || undefined,
        website: normalizedProfile.website || undefined,
        twitter: normalizedProfile.twitter || undefined,
        title: normalizedProfile.title || undefined,
        company: normalizedProfile.company || undefined,
        bioTitle: normalizedProfile.bioTitle || undefined,
        bio: normalizedProfile.bio || undefined,
        skills: normalizedProfile.skills || [],
        city: normalizedProfile.city || undefined,
        country: normalizedProfile.country || undefined,
        timezone: normalizedProfile.timezone || undefined,
        avatarUrl: null,
        profileImage: null,
        profileVisibility: normalizedProfile.profileVisibility,
        role: 'member',
        status: 'approved', // UserService.createUser is only used for admin-created users
        registrationComplete: true,
        createdAt: now,
        updatedAt: now,
        joinedAt: now,
        profileCompletionPercentage: 0,
        lastProfileUpdate: now
      };
      
      // Calculate completion percentage
      userProfile.profileCompletionPercentage = calculateProfileCompletion(userProfile);
      
      const userRef = doc(db, 'users', uid);
      await retryOnNetworkFailure(() => setDoc(userRef, userProfile));
      
      console.log('✅ User profile created successfully');
      return userProfile;
      
    } catch (error) {
      console.error('❌ Error creating user profile:', error);
      throw error;
    }
  }
  
  /**
   * Update user profile
   */
  static async updateUser(uid: string, updates: Partial<UserProfileUpdate>): Promise<UserProfile> {
    try {
      console.log('👤 Updating user profile for:', uid);
      
      const userRef = doc(db, 'users', uid);
      const userDoc = await retryOnNetworkFailure(() => getDoc(userRef));
      
      if (!userDoc.exists()) {
        throw new Error('User not found');
      }
      
      const currentProfile = userDoc.data() as UserProfile;
      
      // Normalize URLs if they're being updated
      const normalizedUpdates = { ...updates };
      if (updates.linkedin) {
        normalizedUpdates.linkedin = normalizeUrl(updates.linkedin, 'linkedin');
      }
      if (updates.website) {
        normalizedUpdates.website = normalizeUrl(updates.website, 'website');
      }
      if (updates.twitter) {
        normalizedUpdates.twitter = normalizeUrl(updates.twitter, 'twitter');
      }
      
      const updatedProfile: UserProfile = {
        ...currentProfile,
        ...normalizedUpdates,
        registrationComplete: true,
        updatedAt: Timestamp.now(),
        lastProfileUpdate: Timestamp.now()
      };
      
      // Recalculate completion percentage
      updatedProfile.profileCompletionPercentage = calculateProfileCompletion(updatedProfile);
      
      await retryOnNetworkFailure(() => updateDoc(userRef, updatedProfile));
      
      console.log('✅ User profile updated successfully');
      return updatedProfile;
      
    } catch (error) {
      console.error('❌ Error updating user profile:', error);
      throw error;
    }
  }
  
  /**
   * Get user profile with privacy filtering
   */
  static async getUser(
    targetUid: string,
    viewerUid: string | null,
    viewerRole?: string
  ): Promise<FilteredProfile | null> {
    try {
      const userRef = doc(db, 'users', targetUid);
      const userDoc = await retryOnNetworkFailure(() => getDoc(userRef));
      
      if (!userDoc.exists()) {
        return null;
      }
      
      const profile = userDoc.data() as UserProfile;
      
      // Get viewer's relationship to this profile
      let explicitConnections: string[] = [];
      let sharedEvents: string[] = [];
      
      if (viewerUid && viewerUid !== targetUid) {
        // Check for explicit connections
        const connection = await ConnectionService.checkExistingConnection(viewerUid, targetUid);
        if (connection) {
          explicitConnections = [targetUid];
        }
        
        // TODO: Check for shared events
        // This would require querying event registrations
        // For now, we'll implement a basic version
        sharedEvents = await this.getSharedEvents(viewerUid, targetUid);
      }
      
      const relationship = await getViewerRelationship(
        viewerUid,
        targetUid,
        viewerRole,
        explicitConnections,
        sharedEvents
      );
      
      return filterProfileForViewer(profile, relationship);
      
    } catch (error) {
      console.error('❌ Error getting user profile:', error);
      return null;
    }
  }
  
  /**
   * Get user directory with filters and privacy
   */
  static async getUserDirectory(
    viewerUid: string | null,
    viewerRole: string | undefined,
    filters: UserDirectoryFilters = {},
    limitCount: number = 50
  ): Promise<UserCard[]> {
    try {
      console.log('📋 Getting user directory with filters:', filters);
      
      // Start with approved users only - this is the base filter
      let q = query(
        collection(db, 'users'),
        where('status', '==', 'approved'),
        orderBy('updatedAt', 'desc')
      );
      
      // Apply additional filters
      if (filters.country) {
        q = query(q, where('country', '==', filters.country));
      }
      
      if (filters.company) {
        q = query(q, where('company', '==', filters.company));
      }
      
      // Apply limit
      q = query(q, limit(limitCount * 2)); // Get extra to account for privacy filtering
      
      const snapshot = await retryOnNetworkFailure(() => getDocs(q));
      const allUsers = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
      
      // Filter users based on privacy and search criteria
      const filteredUsers: UserCard[] = [];
      
      for (const user of allUsers) {
        // Get viewer relationship
        let explicitConnections: string[] = [];
        let sharedEvents: string[] = [];
        
        if (viewerUid && viewerUid !== user.uid) {
          const connection = await ConnectionService.checkExistingConnection(viewerUid, user.uid);
          if (connection) {
            explicitConnections = [user.uid];
          }
          sharedEvents = await this.getSharedEvents(viewerUid, user.uid);
        }
        
        const relationship = await getViewerRelationship(
          viewerUid,
          user.uid,
          viewerRole,
          explicitConnections,
          sharedEvents
        );
        
        // Check if profile should be visible in directory
        if (!isProfileVisibleInDirectory(user, relationship)) {
          continue;
        }
        
        // Apply search filter
        if (filters.search) {
          const searchTerm = filters.search.toLowerCase();
          const searchableText = `${user.displayName} ${user.title} ${user.company} ${user.bioTitle} ${user.bio} ${(user.skills || []).join(' ')}`.toLowerCase();
          
          if (!searchableText.includes(searchTerm)) {
            continue;
          }
        }
        
        // Apply skills filter
        if (filters.skills && filters.skills.length > 0) {
          const userSkills = (user.skills || []).map(s => s.toLowerCase());
          const hasMatchingSkill = filters.skills.some(skill => 
            userSkills.includes(skill.toLowerCase())
          );
          
          if (!hasMatchingSkill) {
            continue;
          }
        }
        
        // Apply title filter
        if (filters.title) {
          const titleMatch = user.title?.toLowerCase().includes(filters.title.toLowerCase());
          if (!titleMatch) {
            continue;
          }
        }
        
        // Apply city filter
        if (filters.city) {
          if (user.city?.toLowerCase() !== filters.city.toLowerCase()) {
            continue;
          }
        }
        
        // Filter profile data
        const filteredProfile = filterProfileForViewer(user, relationship);
        
        // Create user card
        const userCard: UserCard = {
          uid: user.uid,
          avatarUrl: user.avatarUrl || user.profileImage,
          displayName: user.displayName,
          title: user.title,
          company: user.company,
          city: user.city,
          country: user.country,
          skills: (user.skills || []).slice(0, 3), // Show first 3 skills
          profileVisibility: user.profileVisibility,
          canContact: filteredProfile.canViewContact,
          canConnect: filteredProfile.canConnect
        };
        
        filteredUsers.push(userCard);
        
        // Stop when we have enough results
        if (filteredUsers.length >= limitCount) {
          break;
        }
      }
      
      console.log(`✅ Retrieved ${filteredUsers.length} users for directory`);
      return filteredUsers;
      
    } catch (error) {
      console.error('❌ Error getting user directory:', error);
      return [];
    }
  }
  
  /**
   * Get all users for the Members directory page
   * Only returns approved users (status === 'approved')
   */
  static async getAllMembersForDirectory(
    viewerUid: string | null,
    viewerRole: string | undefined
  ): Promise<UserCard[]> {
    try {
      console.log('👥 Getting approved members for directory');
      console.log('👤 Viewer:', { uid: viewerUid, role: viewerRole });
      
      let approvedUsers: UserProfile[] = [];
      
      // Try with composite index first (status + updatedAt)
      try {
        const q = query(
          collection(db, 'users'),
          where('status', '==', 'approved'),
          orderBy('updatedAt', 'desc')
        );
        
        const snapshot = await retryOnNetworkFailure(() => getDocs(q));
        const raw = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
        approvedUsers = raw.filter((u) => (u as any).registrationComplete !== false);
        console.log(`👥 Found ${approvedUsers.length} approved users with completed registration (with index)`);
      } catch (indexError: any) {
        // If index is missing, try fallback query without orderBy
        if (indexError.code === 'failed-precondition' || indexError.message?.includes('index')) {
          console.warn('⚠️ Composite index missing, trying fallback query without orderBy...');
          console.warn('⚠️ Index required: users collection, fields: status (Ascending), updatedAt (Descending)');
          
          try {
            const fallbackQ = query(
              collection(db, 'users'),
              where('status', '==', 'approved')
            );
            
            const snapshot = await retryOnNetworkFailure(() => getDocs(fallbackQ));
            const raw = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
            approvedUsers = raw.filter((u) => (u as any).registrationComplete !== false);
            // Sort client-side by updatedAt
            approvedUsers.sort((a, b) => {
              const aTime = a.updatedAt?.toDate?.()?.getTime() || a.updatedAt?.seconds || 0;
              const bTime = b.updatedAt?.toDate?.()?.getTime() || b.updatedAt?.seconds || 0;
              return bTime - aTime; // Descending
            });
            
            console.log(`👥 Found ${approvedUsers.length} approved users (fallback, sorted client-side)`);
          } catch (fallbackError: any) {
            console.error('❌ Fallback query also failed:', fallbackError);
            
            // If permission denied, throw with helpful message
            if (fallbackError.code === 'permission-denied') {
              throw new Error('Permission denied: Unable to read users. Make sure you are logged in as an admin and have proper Firestore rules configured.');
            }
            
            throw fallbackError;
          }
        } else {
          // For other errors (e.g., permission-denied), throw with context
          if (indexError.code === 'permission-denied') {
            throw new Error('Permission denied: Unable to read users. Make sure you are logged in as an admin and have proper Firestore rules configured.');
          }
          throw indexError;
        }
      }
      
      // Process only approved users
      const memberCards: UserCard[] = [];
      
      for (const user of approvedUsers) {
        const _d = (v: unknown) => (v === undefined || v === null ? '(not set)' : String(v));
        console.log(`👤 Processing user: ${user.displayName || user.firstName || (user as any).name || user.uid}`);
        console.log(`   📋 Raw name data: displayName=${_d(user.displayName)}, firstName=${_d(user.firstName)}, lastName=${_d(user.lastName)}, name=${_d((user as any).name)}`);
        
        // Create user card with ALL available info (handle legacy data)
        // Try multiple field combinations for names
        const displayName = user.displayName || 
                          (user as any).name || 
                          `${user.firstName || ''} ${user.lastName || ''}`.trim() ||
                          'Member';
        
        // Extract first/last names from various sources
        let firstName = user.firstName;
        let lastName = user.lastName;
        
        // If no structured names, try to parse from displayName or name
        if (!firstName && !lastName) {
          const fullName = user.displayName || (user as any).name || '';
          const nameParts = fullName.trim().split(' ');
          if (nameParts.length > 0) {
            firstName = nameParts[0];
            lastName = nameParts.slice(1).join(' ');
          }
        }
        
        const userCard: UserCard = {
          uid: user.uid,
          avatarUrl: user.avatarUrl || user.profileImage,
          displayName: displayName,
          firstName: firstName,
          lastName: lastName,
          email: user.email || undefined, // Include email for autocomplete and admin uses
          title: user.title || (user as any).work || undefined, // Handle legacy 'work' field
          company: user.company,
          city: user.city,
          country: user.country,
          bioTitle: user.bioTitle,
          bio: user.bio, // Add full bio for search functionality
          linkedin: user.linkedin,
          skills: (user.skills || []).slice(0, 3), // Show first 3 skills
          profileVisibility: user.profileVisibility || 'public', // Default to public if not set
          canContact: true, // Always allow contact for members page
          canConnect: true  // Always allow connections
        };
        
        memberCards.push(userCard);
      }
      
      console.log(`✅ Retrieved ${memberCards.length} approved members for directory`);
      return memberCards;
      
    } catch (error: any) {
      console.error('❌ Error getting all members:', error);
      console.error('❌ Error details:', {
        code: error.code,
        message: error.message,
        stack: error.stack
      });
      
      // Re-throw with context for better error handling in UI
      if (error.message?.includes('Permission denied') || error.code === 'permission-denied') {
        throw new Error('Permission denied: Unable to load users. Please ensure you are logged in as an admin and Firestore rules allow reading users.');
      }
      
      if (error.code === 'failed-precondition' || error.message?.includes('index')) {
        throw new Error('Missing Firestore index. The query requires an index on users collection (status, updatedAt). Check the browser console for a link to create it.');
      }
      
      throw error; // Re-throw so UI can handle it
    }
  }
  
  /**
   * Search users (with privacy filtering)
   */
  static async searchUsers(
    searchTerm: string,
    viewerUid: string | null,
    viewerRole: string | undefined,
    limitCount: number = 20
  ): Promise<UserCard[]> {
    return this.getUserDirectory(
      viewerUid,
      viewerRole,
      { search: searchTerm },
      limitCount
    );
  }

  /**
   * Search users for admin purposes (no privacy filtering)
   * Used for adding members to chats, admin management, etc.
   */
  static async searchUsersForAdmin(
    searchTerm: string,
    limitCount: number = 20
  ): Promise<UserCard[]> {
    try {
      if (!searchTerm.trim()) {
        return [];
      }

      console.log('🔍 Admin searching for users:', searchTerm);
      
      const searchQuery = searchTerm.toLowerCase();
      
      // Get all users and filter locally for now
      // In production, you might want to implement full-text search
      const q = query(
        collection(db, 'users'), 
        orderBy('updatedAt', 'desc'),
        limit(limitCount * 5) // Get extra to filter locally
      );
      
      const snapshot = await retryOnNetworkFailure(() => getDocs(q));
      const allUsers = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
      
      const matchedUsers: UserCard[] = [];
      
      for (const user of allUsers) {
        // Handle both new schema (displayName, firstName, lastName) and legacy schema (name)
        // This matches the logic used in other parts of the app
        const displayName = user.displayName || 
                          (user as any).name || 
                          `${user.firstName || ''} ${user.lastName || ''}`.trim() ||
                          'User';
        
        const email = user.email || '';
        const company = user.company || '';
        const title = user.title || '';
        
        console.log(`🔍 Processing user for search: displayName="${user.displayName}", name="${(user as any).name}", firstName="${user.firstName}", final="${displayName}"`);
        
        const searchableText = `${displayName} ${email} ${company} ${title}`.toLowerCase();
        
        if (searchableText.includes(searchQuery)) {
          const userCard: UserCard = {
            uid: user.uid,
            id: user.uid, // Add id field for compatibility
            avatarUrl: user.avatarUrl || user.profileImage,
            displayName: displayName,
            name: displayName, // Add name field for compatibility
            firstName: user.firstName,
            lastName: user.lastName,
            title: user.title,
            company: user.company,
            email: user.email, // Include email for admin searches
            city: user.city,
            country: user.country,
            bioTitle: user.bioTitle,
            bio: user.bio,
            linkedin: user.linkedin,
            skills: user.skills || [],
            profileVisibility: user.profileVisibility || 'public',
            canContact: true,
            canConnect: true
          };
          
          matchedUsers.push(userCard);
          
          if (matchedUsers.length >= limitCount) {
            break;
          }
        }
      }
      
      console.log(`✅ Found ${matchedUsers.length} matching users for admin search`);
      return matchedUsers;
      
    } catch (error) {
      console.error('❌ Error in admin user search:', error);
      return [];
    }
  }
  
  /**
   * Get shared events between two users
   */
  private static async getSharedEvents(uid1: string, uid2: string): Promise<string[]> {
    try {
      // TODO: Implement proper shared events detection
      // This would query event registrations for both users
      // For now, return empty array
      return [];
      
    } catch (error) {
      console.error('❌ Error getting shared events:', error);
      return [];
    }
  }
  
  /**
   * Migrate legacy user data to new schema
   */
  static async migrateLegacyUser(uid: string): Promise<UserProfile | null> {
    try {
      console.log('🔄 Migrating legacy user data for:', uid);
      
      const userRef = doc(db, 'users', uid);
      const userDoc = await retryOnNetworkFailure(() => getDoc(userRef));
      
      if (!userDoc.exists()) {
        return null;
      }
      
      const legacyData = userDoc.data();
      
      // Map legacy fields to new schema
      const migratedProfile: Partial<UserProfile> = {
        uid,
        // Try to parse name into firstName/lastName
        firstName: this.extractFirstName(legacyData.name || legacyData.displayName) || 'User',
        lastName: this.extractLastName(legacyData.name || legacyData.displayName) || '',
        displayName: legacyData.displayName || legacyData.name || `User ${uid.slice(0, 8)}`,
        email: legacyData.email || '',
        title: legacyData.position || legacyData.work,
        company: legacyData.company,
        linkedin: legacyData.linkedinUsername ? `https://www.linkedin.com/in/${legacyData.linkedinUsername}` : undefined,
        profileImage: legacyData.profileImage,
        avatarUrl: legacyData.profileImage,
        profileVisibility: 'event_only', // Default for existing users
        role: legacyData.role || 'member',
        status: legacyData.status || 'active',
        updatedAt: Timestamp.now(),
        lastProfileUpdate: Timestamp.now()
      };
      
      // Calculate completion percentage
      migratedProfile.profileCompletionPercentage = calculateProfileCompletion(migratedProfile as UserProfile);
      
      // Update the user document
      await retryOnNetworkFailure(() => updateDoc(userRef, migratedProfile));
      
      console.log('✅ User data migrated successfully');
      
      // Return the updated profile
      const updatedDoc = await retryOnNetworkFailure(() => getDoc(userRef));
      return updatedDoc.data() as UserProfile;
      
    } catch (error) {
      console.error('❌ Error migrating legacy user data:', error);
      return null;
    }
  }
  
  /**
   * Bulk migration utility
   */
  static async migrateAllLegacyUsers(): Promise<{ success: number; errors: number }> {
    try {
      console.log('🔄 Starting bulk migration of legacy users');
      
      const usersRef = collection(db, 'users');
      const snapshot = await retryOnNetworkFailure(() => getDocs(usersRef));
      
      let success = 0;
      let errors = 0;
      
      for (const doc of snapshot.docs) {
        try {
          const userData = doc.data();
          
          // Check if user needs migration (missing firstName/lastName)
          if (!userData.firstName || !userData.lastName) {
            await this.migrateLegacyUser(doc.id);
            success++;
          }
          
        } catch (error) {
          console.error(`❌ Error migrating user ${doc.id}:`, error);
          errors++;
        }
      }
      
      console.log(`✅ Migration complete: ${success} successful, ${errors} errors`);
      return { success, errors };
      
    } catch (error) {
      console.error('❌ Error in bulk migration:', error);
      throw error;
    }
  }
  
  /**
   * Extract first name from full name
   */
  private static extractFirstName(fullName: string): string {
    if (!fullName) return '';
    return fullName.trim().split(' ')[0] || '';
  }
  
  /**
   * Extract last name from full name
   */
  private static extractLastName(fullName: string): string {
    if (!fullName) return '';
    const parts = fullName.trim().split(' ');
    return parts.length > 1 ? parts.slice(1).join(' ') : '';
  }
  
  /**
   * Get user's completion suggestions
   */
  static async getUserSuggestions(uid: string): Promise<string[]> {
    try {
      const userRef = doc(db, 'users', uid);
      const userDoc = await retryOnNetworkFailure(() => getDoc(userRef));
      
      if (!userDoc.exists()) {
        return [];
      }
      
      const profile = userDoc.data() as UserProfile;
      return require('../utils/privacy').getProfileCompletionSuggestions(profile);
      
    } catch (error) {
      console.error('❌ Error getting user suggestions:', error);
      return [];
    }
  }
}