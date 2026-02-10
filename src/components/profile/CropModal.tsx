/**
 * Crop modal using react-easy-crop: smooth drag/zoom/pinch, bounded panning, normalized crop output.
 * On confirm: produces a cropped image blob and normalized crop (0..1). Preview matches final display.
 */
import React, { useState, useCallback, useRef } from 'react';
import Cropper from 'react-easy-crop';
import type { Area } from 'react-easy-crop';
import { X, Check, RotateCcw } from 'lucide-react';
import { percentAreaToNormalized, type NormalizedCrop } from '../../types/crop';
import { cropImageToBlob, blobToFile, type AreaPixels } from '../../utils/cropImage';
import 'react-easy-crop/react-easy-crop.css';

export type CropAspect = 1 | 3 | number;

const ASPECT_MAP: Record<string, number> = {
  '1': 1,
  '3': 3,
  '16/9': 16 / 9,
};

interface CropModalProps {
  imageUrl: string;
  aspect: CropAspect;
  cropShape: 'rect' | 'round';
  title: string;
  onConfirm: (file: File, normalizedCrop: NormalizedCrop) => void | Promise<void>;
  onCancel: () => void;
}

export default function CropModal({
  imageUrl,
  aspect,
  cropShape,
  title,
  onConfirm,
  onCancel,
}: CropModalProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastAreaRef = useRef<{ area: Area; areaPixels: AreaPixels } | null>(null);

  const aspectNum = typeof aspect === 'number' ? aspect : ASPECT_MAP[String(aspect)] ?? 1;

  const saveCropArea = useCallback((croppedArea: Area, croppedAreaPixels: AreaPixels) => {
    lastAreaRef.current = { area: croppedArea, areaPixels: croppedAreaPixels };
  }, []);

  const onCropComplete = saveCropArea;
  const onCropAreaChange = saveCropArea;

  const handleReset = useCallback(() => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setRotation(0);
    setError(null);
  }, []);

  const handleConfirm = useCallback(async () => {
    const last = lastAreaRef.current;
    if (!last) {
      setError('Please position the image first.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const blob = await cropImageToBlob(imageUrl, last.areaPixels, 'image/jpeg', 0.9);
      const file = blobToFile(blob, 'cropped.jpg');
      const normalizedCrop = percentAreaToNormalized(last.area);
      await onConfirm(file, normalizedCrop);
      onCancel();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to crop image');
    } finally {
      setSaving(false);
    }
  }, [imageUrl, onConfirm, onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={(e) => e.target === e.currentTarget && !saving && onCancel()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="crop-modal-title"
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between shrink-0">
          <h3 id="crop-modal-title" className="text-lg font-semibold text-gray-900">
            {title}
          </h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleReset}
              disabled={saving}
              className="p-2 rounded-full text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-50"
              aria-label="Reset position and zoom"
            >
              <RotateCcw className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={onCancel}
              disabled={saving}
              className="p-2 rounded-full text-gray-500 hover:bg-gray-100 transition-colors disabled:opacity-50"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <p className="px-4 pt-2 text-sm text-gray-600 shrink-0">
          Drag to move, pinch or use the slider to zoom. The area inside the frame is what will be saved.
        </p>

        <div className="relative w-full flex-1 min-h-[280px]" style={{ aspectRatio: aspectNum }}>
          <Cropper
            image={imageUrl}
            crop={crop}
            zoom={zoom}
            rotation={rotation}
            aspect={aspectNum}
            cropShape={cropShape}
            showGrid={cropShape === 'rect'}
            minZoom={1}
            maxZoom={4}
            zoomSpeed={0.5}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onRotationChange={setRotation}
            onCropComplete={onCropComplete}
            onCropAreaChange={onCropAreaChange}
            restrictPosition
            objectFit="contain"
          />
        </div>

        <div className="p-4 border-t border-gray-200 space-y-3 shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">Zoom</span>
            <input
              type="range"
              min={1}
              max={4}
              step={0.05}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="flex-1 h-2 rounded-full appearance-none bg-gray-200 accent-brand-dark"
            />
            <span className="text-sm font-medium text-gray-700 w-10">{Math.round(zoom * 100)}%</span>
          </div>

          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onCancel}
              disabled={saving}
              className="flex-1 py-3 px-4 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={saving}
              className="flex-1 py-3 px-4 rounded-xl bg-[var(--brand-blue-dark)] text-white font-medium hover:bg-[var(--brand-mid)] transition-colors inline-flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {saving ? (
                <span className="inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Check className="h-5 w-5" />
              )}
              {saving ? 'Saving…' : 'Use this photo'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
