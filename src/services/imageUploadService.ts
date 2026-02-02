/**
 * Upload an image to the shared image library (Cloudinary) for chat groups or events.
 * Admin-only; used from CreateChatGroup, AddEvent, EditEvent.
 */
import imageCompression from 'browser-image-compression';
import { apiRequest } from '../utils/apiClient';

const COMPRESSION_OPTIONS = {
  maxSizeMB: 0.5,
  maxWidthOrHeight: 800,
  useWebWorker: true,
  fileType: 'image/jpeg' as const,
  initialQuality: 0.85,
};

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
  });
}

export type ImageLibraryFolder = 'chat-groups' | 'events';

/**
 * Compress image and upload to Cloudinary in the given folder.
 * @param folder - 'chat-groups' or 'events'
 * @param file - Image file
 * @returns The public URL of the uploaded image
 */
export async function uploadImageToLibrary(
  folder: ImageLibraryFolder,
  file: File
): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please select an image file (JPEG, PNG, etc.).');
  }
  const compressed = await imageCompression(file, COMPRESSION_OPTIONS);
  const imageDataUrl = await fileToDataUrl(compressed);
  const res = await apiRequest('/api/upload-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ folder, image: imageDataUrl }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok || !data.url) {
    const msg = (data.error as string) || `Upload failed (${res.status})`;
    throw new Error(msg);
  }
  return data.url as string;
}
