import React, { useState, useRef, useCallback } from 'react';
import { Camera, Upload, X, RefreshCw } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { uploadProfilePicture } from '../../services/profileService';
import imageCompression from 'browser-image-compression';

interface ProfilePictureUploaderProps {
  currentImageUrl?: string | null;
  onUploadSuccess: (imageUrl: string) => void;
  onUploadError: (error: string) => void;
  size?: 'sm' | 'md' | 'lg';
  showButtons?: boolean;
}

const ProfilePictureUploader: React.FC<ProfilePictureUploaderProps> = ({
  currentImageUrl,
  onUploadSuccess,
  onUploadError,
  size = 'md',
  showButtons = true
}) => {
  const { user } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentImageUrl || null);
  const [showPreview, setShowPreview] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Size classes based on the size prop
  const sizeClasses = {
    sm: 'w-20 h-20',
    md: 'w-32 h-32',
    lg: 'w-40 h-40'
  };

  // Resize and compress image before upload
  const processImage = async (file: File): Promise<File> => {
    try {
      // Compression options
      const options = {
        maxSizeMB: 0.3, // 300KB
        maxWidthOrHeight: 500,
        useWebWorker: true,
        fileType: 'image/jpeg'
      };

      // Compress the image
      const compressedFile = await imageCompression(file, options);
      console.log('✅ Image compressed successfully');
      console.log('Original size:', file.size / 1024 / 1024, 'MB');
      console.log('Compressed size:', compressedFile.size / 1024 / 1024, 'MB');
      
      return compressedFile;
    } catch (error) {
      console.error('❌ Error compressing image:', error);
      throw error;
    }
  };

  // Handle file selection
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !user?.uid) return;

    const file = files[0];
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      onUploadError('Please select an image file (JPEG, PNG, etc.)');
      return;
    }

    try {
      // Create preview
      const objectUrl = URL.createObjectURL(file);
      setPreviewUrl(objectUrl);
      setShowPreview(true);
      
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('❌ Error creating preview:', error);
      onUploadError('Failed to create image preview');
    }
  };

  // Cancel preview and reset
  const handleCancelPreview = () => {
    setShowPreview(false);
    // Don't reset previewUrl to keep showing the current profile picture
  };

  // Upload the image
  const handleUpload = async () => {
    if (!previewUrl || !user?.uid) return;

    setIsUploading(true);
    
    try {
      // Convert preview URL to blob
      const response = await fetch(previewUrl);
      const blob = await response.blob();
      const file = new File([blob], 'profile-picture.jpg', { type: 'image/jpeg' });
      
      // Process the image (resize and compress)
      const processedFile = await processImage(file);
      
      // Upload to storage
      const imageUrl = await uploadProfilePicture(user.uid, processedFile);
      
      // Call success callback
      onUploadSuccess(imageUrl);
      
      // Reset preview state
      setShowPreview(false);
    } catch (error: any) {
      console.error('❌ Error uploading profile picture:', error);
      onUploadError(error.message || 'Failed to upload profile picture');
    } finally {
      setIsUploading(false);
    }
  };

  // Trigger file input click
  const handleSelectImage = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
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
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
        capture="environment"
      />

      {/* Profile Picture Container */}
      <div className="relative mb-4">
        <div 
          className={`${sizeClasses[size]} rounded-full overflow-hidden border-2 border-gray-200 relative group cursor-pointer`}
          onClick={handleSelectImage}
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

          {/* Overlay on hover */}
          <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <Camera className="h-8 w-8 text-white" />
          </div>
        </div>

        {/* Edit button overlay */}
        {showButtons && !showPreview && (
          <button
            onClick={handleSelectImage}
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