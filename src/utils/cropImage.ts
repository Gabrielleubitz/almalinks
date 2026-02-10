/**
 * Produce a cropped image blob from a source image and crop area (pixels).
 * Used after react-easy-crop: croppedAreaPixels are in natural image coordinate system.
 */

export interface AreaPixels {
  x: number;
  y: number;
  width: number;
  height: number;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = src;
  });
}

/**
 * Crop the image to the given pixel area and return a JPEG blob.
 * Rounds pixel values to integers. Clamps to image bounds.
 */
export async function cropImageToBlob(
  imageSrc: string,
  crop: AreaPixels,
  mimeType: 'image/jpeg' | 'image/png' = 'image/jpeg',
  quality = 0.9
): Promise<Blob> {
  const img = await loadImage(imageSrc);
  const { naturalWidth, naturalHeight } = img;

  const x = Math.max(0, Math.floor(crop.x));
  const y = Math.max(0, Math.floor(crop.y));
  let w = Math.floor(crop.width);
  let h = Math.floor(crop.height);
  if (w <= 0 || h <= 0) {
    throw new Error('Invalid crop dimensions');
  }
  if (x + w > naturalWidth) w = naturalWidth - x;
  if (y + h > naturalHeight) h = naturalHeight - y;

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2d not available');

  ctx.drawImage(img, x, y, w, h, 0, 0, w, h);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Canvas toBlob failed'));
      },
      mimeType,
      quality
    );
  });
}

/**
 * Convert blob to File for upload (e.g. profile image).
 */
export function blobToFile(blob: Blob, fileName: string): File {
  return new File([blob], fileName, { type: blob.type });
}
