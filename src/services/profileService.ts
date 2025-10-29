import { 
  ref, 
  uploadBytes, 
  getDownloadURL, 
  deleteObject 
} from 'firebase/storage';
import { doc, updateDoc } from 'firebase/firestore';
import { db, storage } from '../firebase/config';
import { ProfileSyncService } from './profileSyncService';
import { uploadProfilePictureBase64, deleteProfilePictureBase64 } from './profileService-fallback';

/**
 * Upload a profile picture to Firebase Storage and update Firestore
 * @param userId User ID
 * @param file Image file to upload
 * @returns URL of the uploaded image
 */
export const uploadProfilePicture = async (userId: string, file: File): Promise<string> => {
  try {
    console.log('🖼️ Uploading profile picture for user:', userId);
    
    // Try Firebase Storage first
    try {
      // Create storage reference
      const storageRef = ref(storage, `profile-pictures/${userId}/avatar.jpg`);
      
      // Upload file
      const snapshot = await uploadBytes(storageRef, file);
      console.log('✅ Profile picture uploaded to Firebase Storage');
      
      // Get download URL
      const downloadUrl = await getDownloadURL(snapshot.ref);
      console.log('✅ Download URL obtained:', downloadUrl);
      
      // Update user document in Firestore
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        profileImage: downloadUrl,
        profileImageUpdatedAt: new Date().toISOString()
      });
      console.log('✅ User document updated with profile image URL');
      
      // Sync profile image across all connections and speaker assignments
      try {
        await ProfileSyncService.syncUserProfileImage(userId, downloadUrl);
        console.log('✅ Profile image synced across all data');
      } catch (syncError) {
        console.error('⚠️ Profile image uploaded but sync failed:', syncError);
        // Don't throw here - the main operation succeeded
      }
      
      return downloadUrl;
      
    } catch (storageError: any) {
      console.warn('⚠️ Firebase Storage upload failed, falling back to base64:', storageError);
      
      // Check if it's a storage-not-enabled error
      if (storageError.code === 'storage/project-not-found' || 
          storageError.code === 'storage/unauthorized' ||
          storageError.message?.includes('Firebase Storage is not available') ||
          storageError.message?.includes('CORS')) {
        
        console.log('📦 Using base64 fallback for profile picture');
        return await uploadProfilePictureBase64(userId, file);
      } else {
        // Re-throw other errors
        throw storageError;
      }
    }
  } catch (error) {
    console.error('❌ Error uploading profile picture:', error);
    throw error;
  }
};

/**
 * Delete a profile picture from Firebase Storage and update Firestore
 * @param userId User ID
 * @returns void
 */
export const deleteProfilePicture = async (userId: string): Promise<void> => {
  try {
    console.log('🗑️ Deleting profile picture for user:', userId);
    
    // Try to delete from Firebase Storage first (if it exists there)
    try {
      const storageRef = ref(storage, `profile-pictures/${userId}/avatar.jpg`);
      await deleteObject(storageRef);
      console.log('✅ Profile picture deleted from Firebase Storage');
    } catch (storageError: any) {
      console.warn('⚠️ Could not delete from Firebase Storage (may not exist or Storage not enabled):', storageError);
      // This is fine - could be base64 image or storage not enabled
    }
    
    // Always update Firestore to remove image reference
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      profileImage: null,
      profileImageUpdatedAt: new Date().toISOString()
    });
    console.log('✅ User document updated to remove profile image');
    
    // Sync profile image removal across all connections and speaker assignments
    try {
      await ProfileSyncService.syncUserProfileImage(userId, null);
      console.log('✅ Profile image removal synced across all data');
    } catch (syncError) {
      console.error('⚠️ Profile image deleted but sync failed:', syncError);
      // Don't throw here - the main operation succeeded
    }
  } catch (error) {
    console.error('❌ Error deleting profile picture:', error);
    throw error;
  }
};