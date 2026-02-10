/**
 * Normalized crop: top-left (x,y) and size (width, height) as fractions of the original image (0..1).
 * Size-invariant: same crop looks identical at any display size.
 */
export interface NormalizedCrop {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
}

/**
 * Legacy crop format (scale + pan %). Used only for migration/fallback.
 */
export interface LegacyCrop {
  scale: number;
  panX: number;
  panY: number;
}

export type CropValue = NormalizedCrop | LegacyCrop;

export function isLegacyCrop(crop: CropValue | null | undefined): crop is LegacyCrop {
  if (!crop || typeof crop !== 'object') return false;
  return 'scale' in crop && typeof (crop as LegacyCrop).scale === 'number';
}

export function isNormalizedCrop(crop: CropValue | null | undefined): crop is NormalizedCrop {
  if (!crop || typeof crop !== 'object') return false;
  return 'width' in crop && typeof (crop as NormalizedCrop).width === 'number';
}

/** react-easy-crop passes area in 0-100 percent; convert to 0-1 */
export function percentAreaToNormalized(area: { x: number; y: number; width: number; height: number }): NormalizedCrop {
  return {
    x: area.x / 100,
    y: area.y / 100,
    width: area.width / 100,
    height: area.height / 100,
  };
}
