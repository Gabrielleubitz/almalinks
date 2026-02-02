import React, { useState, useRef, useEffect } from 'react';
import { Camera, Upload, X, RefreshCw, ImagePlus } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { uploadProfilePicture } from '../../services/profileService';
import imageCompression from 'browser-image-compression';

/** Normalize and compress to JPEG for consistent storage (max 300KB, 500px). */
const TARGET_JPEG_OPTIONS = {
  maxSizeMB: 0.3,
  maxWidthOrHeight: 500,
  useWebWorker: true,
  fileType: 'image/jpeg' as const,
  initialQuality: 0.85,
};

interface ProfilePictureUploaderProps {
  currentImageUrl?: string | null;
  onUploadSuccess: (imageUrl: string) => void;
  onUploadError: (error: string) => void;
  size?: 'sm' | 'md' | 'lg';
  showButtons?: boolean;
  /** When set (e.g. admin editing another user), upload/delete apply to this user instead of current user. */
  targetUserId?: string | null;
}

const ProfilePictureUploader: React.FC<ProfilePictureUploaderProps> = ({
  currentImageUrl,
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
  const [showPreview, setShowPreview] = useState(false);
  const [showSourceMenu, setShowSourceMenu] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Size classes based on the size prop
  const sizeClasses = {
    sm: 'w-20 h-20',
    md: 'w-32 h-32',
    lg: 'w-40 h-40'
  };

  // Normalize to JPEG and compress for consistent storage
  const processImage = async (file: File): Promise<File> => {
    const compressed = await imageCompression(file, TARGET_JPEG_OPTIONS);
    return compressed;
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
      setSelectedFile(file);
      const objectUrl = URL.createObjectURL(file);
      setPreviewUrl(objectUrl);
      setShowPreview(true);
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

  const handleCancelPreview = () => {
    if (previewUrl && previewUrl !== currentImageUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(currentImageUrl || null);
    setSelectedFile(null);
    setShowPreview(false);
  };

  const handleUpload = async () => {
    if (!effectiveUserId) return;
    const fileToUse = selectedFile;
    if (!fileToUse) return;

    setIsUploading(true);
    try {
      const processedFile = await processImage(fileToUse);
      const imageUrl = await uploadProfilePicture(effectiveUserId, processedFile);
      onUploadSuccess(imageUrl);
      if (previewUrl && previewUrl !== currentImageUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      setPreviewUrl(imageUrl);
      setSelectedFile(null);
      setShowPreview(false);
    } catch (error: any) {
      console.error('Error uploading profile picture:', error);
      onUploadError(error.message || 'Failed to upload profile picture');
    } finally {
      setIsUploading(false);
    }
  };

  const handleOpenSourceMenu = () => {
    if (showPreview) return;
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
          className={`${sizeClasses[size]} rounded-full overflow-hidden border-2 border-gray-200 relative group cursor-pointer`}
          onClick={handleOpenSourceMenu}
        >
          {hasImage ? (
            <img 
              src={previewUrl || currentImageUrl || ''} 
              alt="Profile" 
              className="w-full h-full object-cover"
              onError={(e) => {
                // Handle image load error
                const target = e.target as HTMLImageElement;
                target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjRjNGNEY2Ii8+CjxjaXJjbGUgY3g9IjEwMCIgY3k9IjgwIiByPSIzMCIgZmlsbD0iIzlDQTNBRiIvPgo8ZWxsaXBzZSBjeD0iMTAwIiBjeT0iMTQwIiByeD0iNDAiIHJ5PSIyMCIgZmlsbD0iIzlDQTNBRiIvPgo8L3N2Zz4=';
              }}
            />
          ) : (
            <div className={`${sizeClasses[size]} bg-gradient-to-br from-red-500 to-blue-500 flex items-center justify-center text-white font-bold text-3xl`}>
              {getInitials()}
            </div>
          )}

          <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <ImagePlus className="h-8 w-8 text-white" />
          </div>
        </div>

        {showSourceMenu && showButtons && !showPreview && (
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

        {showButtons && !showPreview && !showSourceMenu && (
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

      {/* Preview Actions */}
      {showPreview && showButtons && (
        <div className="flex space-x-3 mt-2">
          <button
            onClick={handleCancelPreview}
            className="px-3 py-1 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors flex items-center space-x-1"
            disabled={isUploading}
          >
            <X className="h-4 w-4" />
            <span>Cancel</span>
          </button>
          <button
            onClick={handleUpload}
            className="px-3 py-1 bg-brand-dark text-white rounded-lg hover:bg-brand-mid transition-colors flex items-center space-x-1 disabled:opacity-50"
            disabled={isUploading}
          >
            {isUploading ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>Uploading...</span>
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                <span>Save</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};

export default ProfilePictureUploader;