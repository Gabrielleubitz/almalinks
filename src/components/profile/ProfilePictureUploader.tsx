import React, { useState, useRef, useEffect } from 'react';
import { Camera, Upload, ImagePlus } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { saveProfileImageWithCrop } from '../../services/profileService';
import type { NormalizedCrop, CropValue } from '../../types/crop';
import CropModal from './CropModal';
import ImageWithCrop from './ImageWithCrop';
import ProfileAvatarPlaceholder from './ProfileAvatarPlaceholder';

interface ProfilePictureUploaderProps {
  currentImageUrl?: string | null;
  currentCrop?: CropValue | null;
  onUploadSuccess: (imageUrl: string, crop?: NormalizedCrop) => void;
  onUploadError: (error: string) => void;
  size?: 'sm' | 'md' | 'lg';
  showButtons?: boolean;
  /** When set (e.g. admin editing another user), upload/delete apply to this user instead of current user. */
  targetUserId?: string | null;
}

const ProfilePictureUploader: React.FC<ProfilePictureUploaderProps> = ({
  currentImageUrl,
  currentCrop = null,
  onUploadSuccess,
  onUploadError,
  size = 'md',
  showButtons = true,
  targetUserId = null
}) => {
  const { user } = useAuth();
  const effectiveUserId = targetUserId ?? user?.uid ?? null;
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentImageUrl || null);
  const [showSourceMenu, setShowSourceMenu] = useState(false);
  const [showCropModal, setShowCropModal] = useState(false);
  const [cropPreviewUrl, setCropPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const sizeClasses = {
    sm: 'w-20 h-20',
    md: 'w-32 h-32',
    lg: 'w-40 h-40'
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !effectiveUserId) return;

    const file = files[0];
    if (!file.type.startsWith('image/')) {
      onUploadError('Please select an image file (JPEG, PNG, HEIC, etc.).');
      return;
    }

    setShowSourceMenu(false);
    try {
      const objectUrl = URL.createObjectURL(file);
      setCropPreviewUrl(objectUrl);
      setShowCropModal(true);
    } catch (error) {
      console.error('Error creating preview:', error);
      onUploadError('Failed to create image preview');
    }
    e.target.value = '';
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  // Choose from files or photo library (no capture)
  const handleChooseFilesOrPhotos = () => {
    setShowSourceMenu(false);
    fileInputRef.current?.click();
  };

  // Take photo (camera; on mobile opens camera, on desktop may show file picker)
  const handleTakePhoto = () => {
    setShowSourceMenu(false);
    cameraInputRef.current?.click();
  };

  useEffect(() => {
    setPreviewUrl((prev) => (currentImageUrl != null ? currentImageUrl : prev));
  }, [currentImageUrl]);

  useEffect(() => {
    if (!showSourceMenu) return;
    const onOutside = (ev: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(ev.target as Node)) {
        setShowSourceMenu(false);
      }
    };
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [showSourceMenu]);

  const handleCropCancel = () => {
    if (cropPreviewUrl) URL.revokeObjectURL(cropPreviewUrl);
    setCropPreviewUrl(null);
    setShowCropModal(false);
  };

  const handleCropConfirm = async (file: File, normalizedCrop: NormalizedCrop) => {
    if (!effectiveUserId) return;
    setIsUploading(true);
    try {
      const imageUrl = await saveProfileImageWithCrop(effectiveUserId, file, normalizedCrop);
      onUploadSuccess(imageUrl, normalizedCrop);
      if (cropPreviewUrl) URL.revokeObjectURL(cropPreviewUrl);
      setCropPreviewUrl(null);
      setShowCropModal(false);
      setPreviewUrl(imageUrl);
    } catch (error: unknown) {
      console.error('Error uploading profile picture:', error);
      onUploadError(error instanceof Error ? error.message : 'Failed to upload profile picture');
    } finally {
      setIsUploading(false);
    }
  };

  const handleOpenSourceMenu = () => {
    if (showCropModal) return;
    setShowSourceMenu((prev) => !prev);
  };

  // Determine if we're showing a placeholder or an actual image
  const hasImage = previewUrl || currentImageUrl;
  
  // Default placeholder initials from user's name
  const getInitials = () => {
    if (!user) return '?';
    if (user.displayName) {
      return user.displayName.charAt(0).toUpperCase();
    }
    return user.email?.charAt(0).toUpperCase() || '?';
  };

  return (
    <div className="flex flex-col items-center">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
        aria-label="Choose from files or photos"
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
        aria-label="Take a photo"
      />

      <div className="relative mb-4" ref={menuRef}>
        <div
          className={`${sizeClasses[size]} rounded-full overflow-hidden border-2 border-gray-200 relative group cursor-pointer bg-brand-dark`}
          onClick={handleOpenSourceMenu}
        >
          {hasImage ? (
            <div className="w-full h-full relative">
              <ImageWithCrop
                src={previewUrl || currentImageUrl || ''}
                crop={currentCrop}
                shape="circle"
                alt="Profile"
                className="rounded-full"
                urlIsCropped={true}
                fallback={
                  <ProfileAvatarPlaceholder
                    name={user?.displayName}
                    email={user?.email}
                    className="absolute inset-0"
                    textClassName="font-bold text-3xl"
                  />
                }
              />
            </div>
          ) : (
            <ProfileAvatarPlaceholder
              name={user?.displayName}
              email={user?.email}
              className={sizeClasses[size]}
              textClassName="font-bold text-3xl"
            />
          )}

          <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <ImagePlus className="h-8 w-8 text-white" />
          </div>
        </div>

        {showSourceMenu && showButtons && !showCropModal && (
          <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 z-20 min-w-[200px] bg-white border border-gray-200 rounded-lg shadow-lg py-1">
            <button
              type="button"
              onClick={handleChooseFilesOrPhotos}
              className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
            >
              <Upload className="h-4 w-4 text-gray-500" />
              Files or photos
            </button>
            <button
              type="button"
              onClick={handleTakePhoto}
              className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
            >
              <Camera className="h-4 w-4 text-gray-500" />
              Take photo
            </button>
          </div>
        )}

        {showButtons && !showCropModal && !showSourceMenu && (
          <button
            type="button"
            onClick={handleOpenSourceMenu}
            className="absolute bottom-0 right-0 bg-brand-dark text-white p-2 rounded-full shadow-md hover:bg-brand-mid transition-colors"
            title="Change profile picture"
          >
            <Camera className="h-4 w-4" />
          </button>
        )}
      </div>

      {showCropModal && cropPreviewUrl && (
        <CropModal
          imageUrl={cropPreviewUrl}
          aspect={1}
          cropShape="round"
          title="Position your photo"
          onConfirm={handleCropConfirm}
          onCancel={handleCropCancel}
        />
      )}
    </div>
  );
};

export default ProfilePictureUploader;