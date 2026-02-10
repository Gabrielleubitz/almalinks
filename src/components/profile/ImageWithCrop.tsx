/**
 * Single renderer for images with optional crop. Works at any size; same crop looks identical everywhere.
 * - No crop or normalized crop (stored URL is already cropped): render plain img.
 * - Legacy crop (scale/pan): render with CSS transform for backward compatibility.
 */
import React from 'react';
import { isLegacyCrop, type CropValue, type NormalizedCrop } from '../../types/crop';

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
}

export default function ImageWithCrop({
  src,
  crop,
  shape = 'rect',
  alt = '',
  className = '',
  urlIsCropped = true,
  onError,
}: ImageWithCropProps) {
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
        onError={onError}
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
          onError={onError}
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
            onError={onError}
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
        onError={onError}
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
        onError={onError}
      />
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={`${baseClass} ${className}`.trim()}
      onError={onError}
    />
  );
}
