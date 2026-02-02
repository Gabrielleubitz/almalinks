import React from 'react';
import type { CoverCrop } from './CoverPhotoCropModal';

interface CropImageProps {
  src: string;
  crop?: CoverCrop | null;
  alt?: string;
  /** Use for cover/header (absolute fill). Use 'block' for inline (event/group cards, avatars). */
  mode?: 'fill' | 'block';
  className?: string;
  onError?: (e: React.SyntheticEvent<HTMLImageElement>) => void;
}

/**
 * Renders an image with optional crop (zoom/pan).
 * - fill: absolute inset-0 (parent must be position relative with size). Use for cover, avatar inside a circle.
 * - block: inline block with w-full h-full (parent sets size). Use for event/group card images.
 */
const CropImage: React.FC<CropImageProps> = ({
  src,
  crop,
  alt = '',
  mode = 'fill',
  className = '',
  onError,
}) => {
  const baseClass = mode === 'fill'
    ? 'absolute inset-0 w-full h-full object-cover'
    : 'w-full h-full object-cover';
  const wrapperClass = mode === 'fill'
    ? `absolute inset-0 overflow-hidden ${className}`
    : `overflow-hidden ${className}`;

  if (!crop || (crop.scale === 1 && crop.panX === 0 && crop.panY === 0)) {
    return (
      <img
        src={src}
        alt={alt}
        className={`${baseClass} ${className}`}
        onError={onError}
      />
    );
  }
  const { scale, panX, panY } = crop;
  return (
    <div className={wrapperClass}>
      <div
        className={mode === 'fill' ? 'absolute inset-0 origin-center' : 'w-full h-full origin-center'}
        style={{
          transform: `scale(${scale}) translate(${panX}%, ${panY}%)`,
        }}
      >
        <img
          src={src}
          alt={alt}
          className={mode === 'fill' ? 'absolute inset-0 w-full h-full object-cover' : 'w-full h-full object-cover'}
          onError={onError}
        />
      </div>
    </div>
  );
};

export default CropImage;
