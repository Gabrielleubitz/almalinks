import { 
  collection, 
  doc, 
  getDoc, 
  updateDoc, 
  query, 
  where, 
  getDocs,
  writeBatch
} from 'firebase/firestore';
import { db } from '../firebase/config';

export class ProfileSyncService {
  /**
   * 🔄 Sync user's profile image across all connections and speaker assignments
   * This should be called whenever a user updates their profile picture
   */
  static async syncUserProfileImage(userId: string, newProfileImageUrl: string | null): Promise<void> {
    console.log('🔄 Starting profile image sync for user:', userId);
    console.log('🖼️ New profile image URL:', newProfileImageUrl);
    
    try {
      // Run all sync operations in parallel for better performance
      await Promise.all([
        this.syncConnectionsProfileImage(userId, newProfileImageUrl)
        // Speaker-related syncs removed - speakers functionality has been removed
      ]);
      
      console.log('✅ Profile image sync completed successfully');
    } catch (error) {
      console.error('❌ Error during profile image sync:', error);
      throw error;
    }
  }

  /**
   * 🔗 Update profile image in all connections where user is involved
   */
  private static async syncConnectionsProfileImage(userId: string, profileImageUrl: string | null): Promise<void> {
    console.log('🔗 Syncing profile image in connections...');
    
    try {
      const batch = writeBatch(db);
      let updateCount = 0;

      // Get connections where user is the "from" user
      const fromConnectionsQuery = query(
        collection(db, 'connections'),
        where('fromUid', '==', userId)
      );
      
      const fromConnectionsSnapshot = await getDocs(fromConnectionsQuery);
      fromConnectionsSnapshot.forEach(doc => {
        batch.update(doc.ref, {
          fromProfileImage: profileImageUrl
        });
        updateCount++;
      });

      // Get connections where user is the "to" user
      const toConnectionsQuery = query(
        collection(db, 'connections'),
        where('toUid', '==', userId)
      );
      
      const toConnectionsSnapshot = await getDocs(toConnectionsQuery);
      toConnectionsSnapshot.forEach(doc => {
        batch.update(doc.ref, {
          toProfileImage: profileImageUrl
        });
        updateCount++;
      });

      if (updateCount > 0) {
        await batch.commit();
        console.log(`✅ Updated profile image in ${updateCount} connections`);
      } else {
        console.log('📝 No connections found to update');
      }
    } catch (error) {
      console.error('❌ Error syncing connections profile image:', error);
      throw error;
    }
  }

  /**
   * 🎤 Update profile image in speaker assignments
   * NOTE: Speakers functionality has been removed - this method is now a no-op
   */
  private static async syncSpeakerAssignmentsProfileImage(userId: string, profileImageUrl: string | null): Promise<void> {
    // Speakers functionality removed - no-op
    return Promise.resolve();
  }

  /**
   * 📅 Update profile image in event speakers arrays
   * NOTE: Speakers functionality has been removed - this method is now a no-op
   */
  private static async syncEventSpeakersProfileImage(userId: string, profileImageUrl: string | null): Promise<void> {
    // Speakers functionality removed - no-op
    return Promise.resolve();
  }

  /**
   * 🔄 Full profile data sync (name, work, position, etc.)
   * Use this when user updates any profile information
   */
  static async syncUserProfileData(userId: string): Promise<void> {
    console.log('🔄 Starting full profile data sync for user:', userId);
    
    try {
      // Get latest user data
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (!userDoc.exists()) {
        throw new Error('User document not found');
      }

      const userData = userDoc.data();
      const profileData = {
        name: userData.displayName || userData.name || '',
        work: userData.work || '',
        position: userData.position || '',
        linkedinUsername: userData.linkedinUsername || '',
        email: userData.email || '',
        profileImage: userData.profileImage || null
      };

      console.log('📋 Latest profile data:', profileData);

      // Sync all data types
      await Promise.all([
        this.syncConnectionsFullData(userId, profileData)
        // Speaker-related syncs removed - speakers functionality has been removed
      ]);

      console.log('✅ Full profile data sync completed successfully');
    } catch (error) {
      console.error('❌ Error during full profile sync:', error);
      throw error;
    }
  }

  /**
   * 🔗 Sync full profile data in connections
   */
  private static async syncConnectionsFullData(userId: string, profileData: any): Promise<void> {
    console.log('🔗 Syncing full profile data in connections...');
    
    try {
      const batch = writeBatch(db);
      let updateCount = 0;

      // Update "from" connections
      const fromConnectionsQuery = query(
        collection(db, 'connections'),
        where('fromUid', '==', userId)
      );
      
      const fromConnectionsSnapshot = await getDocs(fromConnectionsQuery);
      fromConnectionsSnapshot.forEach(doc => {
        batch.update(doc.ref, {
          fromName: profileData.name,
          fromWork: profileData.work,
          fromPosition: profileData.position,
          fromLinkedin: profileData.linkedinUsername,
          fromEmail: profileData.email,
          fromProfileImage: profileData.profileImage
        });
        updateCount++;
      });

      // Update "to" connections
      const toConnectionsQuery = query(
        collection(db, 'connections'),
        where('toUid', '==', userId)
      );
      
      const toConnectionsSnapshot = await getDocs(toConnectionsQuery);
      toConnectionsSnapshot.forEach(doc => {
        batch.update(doc.ref, {
          toName: profileData.name,
          toWork: profileData.work,
          toPosition: profileData.position,
          toLinkedin: profileData.linkedinUsername,
          toEmail: profileData.email,
          toProfileImage: profileData.profileImage
        });
        updateCount++;
      });

      if (updateCount > 0) {
        await batch.commit();
        console.log(`✅ Updated full profile data in ${updateCount} connections`);
      }
    } catch (error) {
      console.error('❌ Error syncing connections full data:', error);
      throw error;
    }
  }

  /**
   * 🎤 Sync full profile data in speaker assignments
   * NOTE: Speakers functionality has been removed - this method is now a no-op
   */
  private static async syncSpeakerAssignmentsFullData(userId: string, profileData: any): Promise<void> {
    // Speakers functionality removed - no-op
    return Promise.resolve();
  }

  /**
   * 📅 Sync full profile data in event speakers
   * NOTE: Speakers functionality has been removed - this method is now a no-op
   */
  private static async syncEventSpeakersFullData(userId: string, profileData: any): Promise<void> {
    // Speakers functionality removed - no-op
    return Promise.resolve();
  }

  /**
   * 🔧 Manual sync trigger - use this to fix existing data
   * This can be called from admin panel or run as maintenance
   */
  static async manualSyncAllUsers(): Promise<void> {
    console.log('🔧 Starting manual sync for all users...');
    
    try {
      const usersSnapshot = await getDocs(collection(db, 'users'));
      let processedCount = 0;
      
      for (const userDoc of usersSnapshot.docs) {
        const userId = userDoc.id;
        console.log(`🔄 Processing user ${processedCount + 1}/${usersSnapshot.size}: ${userId}`);
        
        try {
          await this.syncUserProfileData(userId);
          processedCount++;
        } catch (error) {
          console.error(`❌ Failed to sync user ${userId}:`, error);
          // Continue with other users even if one fails
        }
        
        // Add a small delay to avoid overwhelming Firestore
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      console.log(`✅ Manual sync completed. Processed ${processedCount}/${usersSnapshot.size} users`);
    } catch (error) {
      console.error('❌ Error during manual sync:', error);
      throw error;
    }
  }
}

export default ProfileSyncService;