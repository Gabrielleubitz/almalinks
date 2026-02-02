import React, { useEffect, useState } from 'react';
import { Check } from 'lucide-react';

const SHOW_DURATION_MS = 3000;

interface SavedIndicatorProps {
  /** Timestamp when save completed (Date.now()) */
  savedAt: number | null;
  /** Whether a save is in progress */
  saving?: boolean;
  className?: string;
}

/**
 * Shows "Saved" with checkmark when savedAt is recent, hides after SHOW_DURATION_MS.
 */
export const SavedIndicator: React.FC<SavedIndicatorProps> = ({
  savedAt,
  saving = false,
  className = '',
}) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!savedAt) {
      setVisible(false);
      return;
    }
    setVisible(true);
    const t = setTimeout(() => setVisible(false), SHOW_DURATION_MS);
    return () => clearTimeout(t);
  }, [savedAt]);

  if (saving) {
    return (
      <span className={`inline-flex items-center gap-1.5 text-sm text-gray-500 ${className}`}>
        <span className="inline-block w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
        <span>Saving...</span>
      </span>
    );
  }

  if (!visible || !savedAt) return null;

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-sm text-green-600 animate-in fade-in duration-200 ${className}`}
      role="status"
      aria-live="polite"
    >
      <Check className="h-4 w-4 flex-shrink-0" />
      <span>Saved</span>
    </span>
  );
};

export default SavedIndicator;
