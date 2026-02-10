import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { uploadProfilePictureBase64 } from './profileService-fallback';
import { apiRequest } from '../utils/apiClient';
import type { NormalizedCrop } from '../types/crop';

/** Convert File to base64 data URL for Cloudinary API */
function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
  });
}

/**
 * Upload a profile picture to Cloudinary (via API) and update Firestore.
 * Falls back to base64 in Firestore if Cloudinary is not configured or request fails.
 * @param userId User ID
 * @param file Image file to upload
 * @returns URL of the uploaded image
 */
export const uploadProfilePicture = async (userId: string, file: File): Promise<string> => {
  try {
    console.log('🖼️ Uploading profile picture for user:', userId);

    try {
      const imageDataUrl = await fileToDataUrl(file);
      const res = await apiRequest('/api/upload-profile-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, image: imageDataUrl }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok && data.url) {
        const downloadUrl = data.url as string;
        const publicId = (data.publicId as string) || null;
        const userRef = doc(db, 'users', userId);
        await updateDoc(userRef, {
          profileImage: downloadUrl,
          ...(publicId && { profileImagePublicId: publicId }),
          profileImageUpdatedAt: new Date().toISOString(),
        });
        console.log('✅ Profile picture uploaded to Cloudinary');
        return downloadUrl;
      }
      // 503 or error body → fall through to base64 fallback
      if (res.status === 503) {
        console.warn('⚠️ Cloudinary not configured, using base64 fallback');
      } else {
        console.warn('⚠️ Cloudinary upload failed:', (data as { error?: string })?.error || res.status);
      }
    } catch (apiError) {
      console.warn('⚠️ Profile image API request failed, falling back to base64:', apiError);
    }

    return await uploadProfilePictureBase64(userId, file);
  } catch (error) {
    console.error('❌ Error uploading profile picture:', error);
    throw error;
  }
};

/**
 * Upload a cropped profile image and persist both URL and normalized crop in one write.
 * Ensures crop is never lost after upload. Prefer this over uploadProfilePicture when using the new crop UI.
 */
export const saveProfileImageWithCrop = async (
  userId: string,
  file: File,
  normalizedCrop: NormalizedCrop
): Promise<string> => {
  const imageDataUrl = await fileToDataUrl(file);
  const userRef = doc(db, 'users', userId);

  try {
    const res = await apiRequest('/api/upload-profile-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, image: imageDataUrl }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.ok && data.url) {
      const downloadUrl = data.url as string;
      const publicId = (data.publicId as string) || null;
      await updateDoc(userRef, {
        profileImage: downloadUrl,
        ...(publicId && { profileImagePublicId: publicId }),
        profileImageCrop: normalizedCrop,
        profileImageUpdatedAt: new Date().toISOString(),
      });
      console.log('✅ Profile picture and crop saved');
      return downloadUrl;
    }
  } catch (apiError) {
    console.warn('⚠️ Profile image API request failed, falling back to base64:', apiError);
  }

  const fallbackUrl = await uploadProfilePictureBase64(userId, file);
  await updateDoc(userRef, { profileImageCrop: normalizedCrop });
  return fallbackUrl;
};

/**
 * Upload a cover/background photo for the profile header (LinkedIn-style banner).
 * Uses same API as profile picture with imageType: 'cover'.
 * @param userId User ID
 * @param file Image file to upload
 * @returns URL of the uploaded image
 */
export const uploadCoverPhoto = async (userId: string, file: File): Promise<string> => {
  const imageDataUrl = await fileToDataUrl(file);
  const res = await apiRequest('/api/upload-profile-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, image: imageDataUrl, imageType: 'cover' }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok || !data.url) {
    throw new Error((data as { error?: string })?.error || 'Cover photo upload failed');
  }
  const downloadUrl = data.url as string;
  const userRef = doc(db, 'users', userId);
  await updateDoc(userRef, { coverPhotoUrl: downloadUrl });
  return downloadUrl;
};

/**
 * Upload a cropped cover photo and persist both URL and normalized crop in one write.
 */
export const saveCoverPhotoWithCrop = async (
  userId: string,
  file: File,
  normalizedCrop: NormalizedCrop
): Promise<string> => {
  const imageDataUrl = await fileToDataUrl(file);
  const userRef = doc(db, 'users', userId);
  const res = await apiRequest('/api/upload-profile-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, image: imageDataUrl, imageType: 'cover' }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok || !data.url) {
    throw new Error((data as { error?: string })?.error || 'Cover photo upload failed');
  }
  const downloadUrl = data.url as string;
  await updateDoc(userRef, { coverPhotoUrl: downloadUrl, coverCrop: normalizedCrop });
  return downloadUrl;
};

/**
 * Remove cover photo from user profile.
 */
export const deleteCoverPhoto = async (userId: string): Promise<void> => {
  const userRef = doc(db, 'users', userId);
  await updateDoc(userRef, { coverPhotoUrl: null, coverCrop: null });
};

/**
 * Delete a profile picture (Cloudinary if we have publicId, else just clear Firestore).
 * @param userId User ID
 * @param publicId Optional Cloudinary public_id; if not provided, read from user doc.
 */
export const deleteProfilePicture = async (
  userId: string,
  publicId?: string | null
): Promise<void> => {
  try {
    console.log('🗑️ Deleting profile picture for user:', userId);

    let effectivePublicId = publicId;
    if (effectivePublicId === undefined) {
      const userRef = doc(db, 'users', userId);
      const snap = await getDoc(userRef);
      effectivePublicId = (snap.data()?.profileImagePublicId as string) || null;
    }

    if (effectivePublicId) {
      try {
        const res = await apiRequest('/api/delete-profile-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, publicId: effectivePublicId }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          if (res.status !== 503) {
            console.warn('⚠️ Cloudinary delete failed:', data.error || res.status);
          }
        }
      } catch (apiError) {
        console.warn('⚠️ Delete profile image API request failed:', apiError);
      }
    }

    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      profileImage: null,
      profileImagePublicId: null,
      profileImageUpdatedAt: new Date().toISOString(),
    });
    console.log('✅ Profile picture removed');
  } catch (error) {
    console.error('❌ Error deleting profile picture:', error);
    throw error;
  }
};
