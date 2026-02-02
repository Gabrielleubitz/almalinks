import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';

/**
 * Upload a profile picture as base64 (fallback when Firebase Storage is not available)
 * @param userId User ID
 * @param file Image file to upload
 * @returns Base64 data URL of the image
 */
export const uploadProfilePictureBase64 = async (userId: string, file: File): Promise<string> => {
  try {
    console.log('🖼️ Converting profile picture to base64 for user:', userId);
    
    // Convert file to base64
    const base64String = await fileToBase64(file);
    console.log('✅ Profile picture converted to base64');
    
    // Update user document in Firestore with base64 data
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      profileImage: base64String,
      profileImageUpdatedAt: new Date().toISOString()
    });
    console.log('✅ User document updated with base64 profile image');
    return base64String;
  } catch (error) {
    console.error('❌ Error uploading profile picture as base64:', error);
    throw error;
  }
};

/**
 * Convert File to base64 string
 */
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
};

/**
 * Delete a profile picture (base64 fallback version)
 * @param userId User ID
 */
export const deleteProfilePictureBase64 = async (userId: string): Promise<void> => {
  try {
    console.log('🗑️ Deleting profile picture for user:', userId);
    
    // Update user document in Firestore
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      profileImage: null,
      profileImageUpdatedAt: new Date().toISOString()
    });
    console.log('✅ User document updated to remove profile image');
  } catch (error) {
    console.error('❌ Error deleting profile picture:', error);
    throw error;
  }
};