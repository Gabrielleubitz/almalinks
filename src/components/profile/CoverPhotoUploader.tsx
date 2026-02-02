import React, { useState, useRef } from 'react';
import { Camera, X, Image as ImageIcon } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { uploadCoverPhoto, deleteCoverPhoto } from '../../services/profileService';
import imageCompression from 'browser-image-compression';

/** Cover-style crop for Cloudinary (3:1 banner). */
const COVER_TRANSFORM = 'ar_3:1,c_fill,w_1200';

/** Six template cover images from Cloudinary demo (wide crop). */
const COVER_TEMPLATES: { url: string; label: string }[] = [
  { url: `https://res.cloudinary.com/demo/image/upload/${COVER_TRANSFORM}/sample.jpg`, label: 'Beach' },
  { url: `https://res.cloudinary.com/demo/image/upload/${COVER_TRANSFORM}/balloons.jpg`, label: 'Balloons' },
  { url: `https://res.cloudinary.com/demo/image/upload/${COVER_TRANSFORM}/woman.jpg`, label: 'Portrait' },
  { url: `https://res.cloudinary.com/demo/image/upload/${COVER_TRANSFORM}/bird.jpg`, label: 'Nature' },
  { url: `https://res.cloudinary.com/demo/image/upload/${COVER_TRANSFORM}/kayak.jpg`, label: 'Kayak' },
  { url: `https://res.cloudinary.com/demo/image/upload/${COVER_TRANSFORM}/couple.jpg`, label: 'Couple' },
];

const COVER_OPTIONS = {
  maxSizeMB: 0.8,
  maxWidthOrHeight: 1600,
  useWebWorker: true,
  fileType: 'image/jpeg' as const,
  initialQuality: 0.85,
};

interface CoverPhotoUploaderProps {
  currentCoverUrl?: string | null;
  onUploadSuccess: (url: string) => void;
  onUploadError: (error: string) => void;
  onRemove?: () => void;
  /** When user picks a template (no upload), call this so the parent can save the URL. */
  onTemplateSelect?: (url: string) => void;
  /** When set (e.g. admin editing another user), upload/delete apply to this user instead of current user. */
  targetUserId?: string | null;
}

const CoverPhotoUploader: React.FC<CoverPhotoUploaderProps> = ({
  currentCoverUrl,
  onUploadSuccess,
  onUploadError,
  onRemove,
  onTemplateSelect,
  targetUserId = null,
}) => {
  const { user } = useAuth();
  const effectiveUserId = targetUserId ?? user?.uid ?? null;
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !effectiveUserId) return;
    if (!file.type.startsWith('image/')) {
      onUploadError('Please select an image file (JPEG, PNG, etc.).');
      return;
    }
    setUploading(true);
    try {
      const compressed = await imageCompression(file, COVER_OPTIONS);
      const url = await uploadCoverPhoto(effectiveUserId, compressed);
      onUploadSuccess(url);
    } catch (err: unknown) {
      onUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      e.target.value = '';
      inputRef.current && (inputRef.current.value = '');
    }
  };

  const handleRemove = async () => {
    if (!effectiveUserId || !onRemove) return;
    setRemoving(true);
    try {
      await deleteCoverPhoto(effectiveUserId);
      onRemove();
    } catch (err: unknown) {
      onUploadError(err instanceof Error ? err.message : 'Failed to remove cover');
    } finally {
      setRemoving(false);
    }
  };

  const handleTemplateSelect = (url: string) => {
    setShowTemplates(false);
    if (onTemplateSelect) {
      onTemplateSelect(url);
    } else {
      onUploadSuccess(url);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        <strong>Add or change:</strong> upload a photo below or choose a template. <strong>Remove:</strong> use the &quot;Remove cover photo&quot; link below when a cover is set.
      </p>
      <div className="rounded-2xl overflow-hidden border border-gray-200 bg-gray-100 group">
      <div className="relative aspect-[3/1] min-h-[120px] max-h-[200px]">
        {currentCoverUrl ? (
          <img
            src={currentCoverUrl}
            alt="Cover"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-r from-brand-blue-dark to-brand-blue-light flex items-center justify-center text-white/80">
            <Camera className="h-10 w-10" />
          </div>
        )}
        <div className={`absolute inset-0 flex items-center justify-center gap-2 transition-colors ${currentCoverUrl ? 'bg-black/0 group-hover:bg-black/30 opacity-0 group-hover:opacity-100' : 'bg-black/20'}`}>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
            aria-label="Upload cover photo"
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="px-4 py-2 rounded-lg bg-white/90 text-gray-800 text-sm font-medium hover:bg-white disabled:opacity-50 flex items-center gap-2"
          >
            {uploading ? (
              <span className="animate-pulse">Uploading...</span>
            ) : currentCoverUrl ? (
              <>Change cover</>
            ) : (
              <>Add cover photo</>
            )}
          </button>
          {currentCoverUrl && onRemove && (
            <button
              type="button"
              onClick={handleRemove}
              disabled={removing}
              className="p-2 rounded-lg bg-white/90 text-gray-700 hover:bg-white disabled:opacity-50"
              title="Remove cover photo"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>
      </div>

      {/* Remove cover - visible when cover is set */}
      {currentCoverUrl && onRemove && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleRemove}
            disabled={removing}
            className="inline-flex items-center gap-2 text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
          >
            <X className="h-4 w-4" />
            {removing ? 'Removing...' : 'Remove cover photo'}
          </button>
        </div>
      )}

      {/* Template picker */}
      <div>
        <button
          type="button"
          onClick={() => setShowTemplates((v) => !v)}
          className="inline-flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900"
        >
          <ImageIcon className="h-4 w-4" />
          {showTemplates ? 'Hide templates' : 'Or choose a template'}
        </button>
        {showTemplates && (
          <div className="mt-3 grid grid-cols-3 sm:grid-cols-6 gap-2">
            {COVER_TEMPLATES.map((t) => (
              <button
                key={t.url}
                type="button"
                onClick={() => handleTemplateSelect(t.url)}
                className={`relative aspect-[3/1] rounded-xl overflow-hidden border-2 transition-all hover:ring-2 hover:ring-brand-blue focus:ring-2 focus:ring-brand-blue focus:outline-none ${
                  currentCoverUrl === t.url ? 'border-brand-blue ring-2 ring-brand-blue' : 'border-gray-200'
                }`}
                title={t.label}
              >
                <img
                  src={t.url}
                  alt={t.label}
                  className="absolute inset-0 w-full h-full object-cover"
                />
                <span className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs py-0.5 px-1 truncate">
                  {t.label}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CoverPhotoUploader;
