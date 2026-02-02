import React, { useState, useRef, useCallback, useEffect } from 'react';
import { X, ZoomIn, ZoomOut, Check } from 'lucide-react';

export interface CoverCrop {
  scale: number;
  panX: number;
  panY: number;
}

const MIN_SCALE = 1;
const MAX_SCALE = 3;
const SCALE_STEP = 0.15;

interface CoverPhotoCropModalProps {
  imageUrl: string;
  onConfirm: (url: string, crop: CoverCrop) => void;
  onCancel: () => void;
  /** Aspect ratio of the crop frame, e.g. '3/1', '1/1', '16/9'. Default '3/1'. */
  aspectRatio?: string;
  /** Modal title. Default "Position your cover". */
  title?: string;
}

const CoverPhotoCropModal: React.FC<CoverPhotoCropModalProps> = ({
  imageUrl,
  onConfirm,
  onCancel,
  aspectRatio = '3/1',
  title = 'Position your cover',
}) => {
  const [scale, setScale] = useState(1);
  const [translateX, setTranslateX] = useState(0);
  const [translateY, setTranslateY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, tx: 0, ty: 0 });
  const [lastPinchDistance, setLastPinchDistance] = useState<number | null>(null);
  const [lastPinchScale, setLastPinchScale] = useState(1);
  const viewportRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const clampScale = (s: number) => Math.max(MIN_SCALE, Math.min(MAX_SCALE, s));
  const zoomIn = useCallback(() => setScale((s) => clampScale(s + SCALE_STEP)), []);
  const zoomOut = useCallback(() => setScale((s) => clampScale(s - SCALE_STEP)), []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if ((e.target as HTMLElement).closest('button')) return;
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      setIsDragging(true);
      setDragStart({ x: e.clientX, y: e.clientY, tx: translateX, ty: translateY });
    },
    [translateX, translateY]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging) return;
      setTranslateX(dragStart.tx + (e.clientX - dragStart.x));
      setTranslateY(dragStart.ty + (e.clientY - dragStart.y));
    },
    [isDragging, dragStart]
  );

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setScale((s) => clampScale(e.deltaY > 0 ? s - SCALE_STEP : s + SCALE_STEP));
  }, []);

  const touchStartRef = useRef({ x: 0, y: 0, tx: 0, ty: 0 });

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 2) {
        const d = Math.hypot(
          e.touches[1].clientX - e.touches[0].clientX,
          e.touches[1].clientY - e.touches[0].clientY
        );
        setLastPinchDistance(d);
        setLastPinchScale(scale);
      } else if (e.touches.length === 1) {
        touchStartRef.current = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
          tx: translateX,
          ty: translateY,
        };
        setIsDragging(true);
      }
    },
    [scale, translateX, translateY]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 2 && lastPinchDistance != null) {
        e.preventDefault();
        const d = Math.hypot(
          e.touches[1].clientX - e.touches[0].clientX,
          e.touches[1].clientY - e.touches[0].clientY
        );
        const ratio = d / lastPinchDistance;
        setScale(clampScale(lastPinchScale * ratio));
      } else if (e.touches.length === 1) {
        e.preventDefault();
        const start = touchStartRef.current;
        setTranslateX(start.tx + (e.touches[0].clientX - start.x));
        setTranslateY(start.ty + (e.touches[0].clientY - start.y));
      }
    },
    [lastPinchDistance, lastPinchScale]
  );

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (e.touches.length < 2) setLastPinchDistance(null);
    if (e.touches.length === 0) setIsDragging(false);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onCancel]);

  const getViewportSize = useCallback(() => {
    const el = viewportRef.current;
    if (!el) return { w: 300, h: 100 };
    const rect = el.getBoundingClientRect();
    return { w: rect.width, h: rect.height };
  }, []);

  const minHeight = aspectRatio === '1/1' ? '220px' : aspectRatio === '16/9' ? '160px' : '140px';

  const handleConfirm = useCallback(() => {
    const { w, h } = getViewportSize();
    const panX = w ? (translateX / w) * 100 : 0;
    const panY = h ? (translateY / h) * 100 : 0;
    onConfirm(imageUrl, { scale, panX, panY });
  }, [imageUrl, scale, translateX, translateY, getViewportSize, onConfirm]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={(e) => e.target === e.currentTarget && onCancel()}
      role="dialog"
      aria-modal="true"
      aria-label="Position cover photo"
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <button
            type="button"
            onClick={onCancel}
            className="p-2 rounded-full text-gray-500 hover:bg-gray-100 transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="px-4 pt-2 text-sm text-gray-600">
          Drag to move and use the buttons or pinch to zoom. The area inside the frame is what will be displayed.
        </p>

        <div
          ref={viewportRef}
          className="relative flex-1 min-h-0 flex items-center justify-center bg-gray-900 my-4 mx-4 rounded-xl overflow-hidden select-none"
          style={{ aspectRatio, minHeight }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onWheel={handleWheel}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div
            ref={containerRef}
            className="absolute inset-0"
            style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
          >
            <div
              className="absolute inset-0 origin-center"
              style={{
                transform: `scale(${scale}) translate(${translateX}px, ${translateY}px)`,
                transition: isDragging ? 'none' : 'transform 0.1s ease-out',
              }}
            >
              <img
                src={imageUrl}
                alt="Cover preview"
                className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                draggable={false}
              />
            </div>
          </div>
          {/* Overlay: show what will be displayed (circle for 1:1, frame border for others) */}
          {aspectRatio === '1/1' ? (
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: 'radial-gradient(circle closest-side at center, transparent 0%, transparent 100%, rgba(0,0,0,0.65) 100%)',
                borderRadius: 'inherit',
              }}
              aria-hidden
            />
          ) : null}
          {aspectRatio !== '1/1' ? (
            <div
              className="absolute inset-0 pointer-events-none rounded-xl ring-2 ring-white ring-inset"
              aria-hidden
            />
          ) : null}
        </div>

        <div className="p-4 border-t border-gray-200 space-y-4">
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={zoomOut}
              disabled={scale <= MIN_SCALE}
              className="p-3 rounded-full bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors touch-manipulation"
              aria-label="Zoom out"
            >
              <ZoomOut className="h-5 w-5 text-gray-700" />
            </button>
            <span className="text-sm font-medium text-gray-600 min-w-[4rem] text-center">
              {Math.round(scale * 100)}%
            </span>
            <button
              type="button"
              onClick={zoomIn}
              disabled={scale >= MAX_SCALE}
              className="p-3 rounded-full bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors touch-manipulation"
              aria-label="Zoom in"
            >
              <ZoomIn className="h-5 w-5 text-gray-700" />
            </button>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-3 px-4 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="flex-1 py-3 px-4 rounded-xl bg-brand-dark text-white font-medium hover:bg-brand-mid transition-colors inline-flex items-center justify-center gap-2"
            >
              <Check className="h-5 w-5" />
              Use this position
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CoverPhotoCropModal;
export type { CoverCrop };
