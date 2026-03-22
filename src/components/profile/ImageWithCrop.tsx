/**
 * Single renderer for images with optional crop. Works at any size; same crop looks identical everywhere.
 * - No crop or normalized crop (stored URL is already cropped): render plain img.
 * - Legacy crop (scale/pan): render with CSS transform for backward compatibility.
 * - Invalid URLs or failed loads: render optional `fallback` (e.g. initials avatar).
 */
import React, { useEffect, useState } from 'react';
import { isLegacyCrop, type CropValue, type NormalizedCrop } from '../../types/crop';
import { isSafeImageUrl } from '../../utils/imageUrl';

interface ImageWithCropProps {
  src: string;
  crop?: CropValue | null;
  /** 'circle' for avatar, 'rect' for cover/cards */
  shape?: 'circle' | 'rect';
  alt?: string;
  className?: string;
  /** When true, image is the final cropped asset so crop is only for metadata (display as plain img). */
  urlIsCropped?: boolean;
  onError?: (e: React.SyntheticEvent<HTMLImageElement>) => void;
  /** Shown when URL is invalid or the image fails to load (404, blocked, etc.) */
  fallback?: React.ReactNode;
}

export default function ImageWithCrop({
  src,
  crop,
  shape = 'rect',
  alt = '',
  className = '',
  urlIsCropped = true,
  onError,
  fallback,
}: ImageWithCropProps) {
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    setLoadFailed(false);
  }, [src]);

  const safe = isSafeImageUrl(src);
  if (!safe || loadFailed) {
    if (fallback !== undefined && fallback !== null) {
      return <>{fallback}</>;
    }
    return null;
  }

  const handleError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    setLoadFailed(true);
    onError?.(e);
  };

  const baseClass = shape === 'circle'
    ? 'absolute inset-0 w-full h-full object-cover'
    : 'w-full h-full object-cover';
  const wrapperClass = shape === 'circle'
    ? `absolute inset-0 overflow-hidden ${className}`.trim()
    : `overflow-hidden ${className}`.trim();

  const noCrop = !crop || (urlIsCropped && !isLegacyCrop(crop));
  if (noCrop) {
    return (
      <img
        src={src}
        alt={alt}
        className={`${baseClass} ${className}`.trim()}
        onError={handleError}
        referrerPolicy="no-referrer"
        loading="lazy"
        decoding="async"
      />
    );
  }

  if (isLegacyCrop(crop)) {
    const { scale, panX, panY } = crop;
    const hasTransform = scale !== 1 || panX !== 0 || panY !== 0;
    if (!hasTransform) {
      return (
        <img
          src={src}
          alt={alt}
          className={`${baseClass} ${className}`.trim()}
          onError={handleError}
          referrerPolicy="no-referrer"
          loading="lazy"
          decoding="async"
        />
      );
    }
    return (
      <div className={wrapperClass}>
        <div
          className={shape === 'circle' ? 'absolute inset-0 origin-center' : 'w-full h-full origin-center'}
          style={{
            transform: `scale(${scale}) translate(${panX}%, ${panY}%)`,
          }}
        >
          <img
            src={src}
            alt={alt}
            className={shape === 'circle' ? 'absolute inset-0 w-full h-full object-cover' : 'w-full h-full object-cover'}
            onError={handleError}
            referrerPolicy="no-referrer"
            loading="lazy"
            decoding="async"
          />
        </div>
      </div>
    );
  }

  const norm = crop as NormalizedCrop;
  const hasNormCrop = norm.width < 1 || norm.height < 1 || norm.x !== 0 || norm.y !== 0;
  if (!hasNormCrop && urlIsCropped) {
    return (
      <img
        src={src}
        alt={alt}
        className={`${baseClass} ${className}`.trim()}
        onError={handleError}
        referrerPolicy="no-referrer"
        loading="lazy"
        decoding="async"
      />
    );
  }

  if (!urlIsCropped && hasNormCrop) {
    const objectPosition = `${norm.x * 50 + norm.width * 50}% ${norm.y * 50 + norm.height * 50}%`;
    const objectFit = 'cover';
    return (
      <img
        src={src}
        alt={alt}
        className={`${baseClass} ${className}`.trim()}
        style={{ objectPosition, objectFit }}
        onError={handleError}
        referrerPolicy="no-referrer"
        loading="lazy"
        decoding="async"
      />
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={`${baseClass} ${className}`.trim()}
      onError={handleError}
      referrerPolicy="no-referrer"
      loading="lazy"
      decoding="async"
    />
  );
}
