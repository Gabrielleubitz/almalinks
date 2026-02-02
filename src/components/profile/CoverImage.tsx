import React from 'react';
import type { CoverCrop } from './CoverPhotoCropModal';

interface CoverImageProps {
  src: string;
  crop?: CoverCrop | null;
  alt?: string;
  className?: string;
}

/**
 * Renders a cover photo with optional crop (zoom/pan).
 * Use in profile header and dashboard for consistent display.
 */
const CoverImage: React.FC<CoverImageProps> = ({ src, crop, alt = '', className = '' }) => {
  if (!crop || (crop.scale === 1 && crop.panX === 0 && crop.panY === 0)) {
    return (
      <img
        src={src}
        alt={alt}
        className={`absolute inset-0 w-full h-full object-cover ${className}`}
      />
    );
  }
  const { scale, panX, panY } = crop;
  return (
    <div className={`absolute inset-0 overflow-hidden ${className}`}>
      <div
        className="absolute inset-0 origin-center"
        style={{
          transform: `scale(${scale}) translate(${panX}%, ${panY}%)`,
        }}
      >
        <img
          src={src}
          alt={alt}
          className="absolute inset-0 w-full h-full object-cover"
        />
      </div>
    </div>
  );
};

export default CoverImage;
