import React from 'react';
import { Save, Check } from 'lucide-react';

const SUCCESS_RESET_MS = 3000;

export interface SaveButtonWithFeedbackProps {
  saving: boolean;
  /** Set to Date.now() when save succeeds; button shows green check + successLabel for a few seconds */
  savedAt?: number | null;
  disabled?: boolean;
  type?: 'button' | 'submit';
  onClick?: () => void;
  /** Default label when idle (e.g. "Save Changes") */
  label?: string;
  /** Label while saving (e.g. "Saving..." or "Creating Event...") */
  savingLabel?: string;
  /** Label when success (e.g. "Changes saved") */
  successLabel?: string;
  /** Optional extra class for the button */
  className?: string;
  /** Optional class when showing success state */
  successClassName?: string;
  children?: React.ReactNode;
}

/**
 * Save button that shows spinner when saving, then green with check + "Changes saved" for a few seconds.
 * Parent sets savedAt to Date.now() on successful save; no need to clear.
 */
export const SaveButtonWithFeedback: React.FC<SaveButtonWithFeedbackProps> = ({
  saving,
  savedAt = null,
  disabled = false,
  type = 'submit',
  onClick,
  label = 'Save Changes',
  savingLabel = 'Saving...',
  successLabel = 'Changes saved',
  className = '',
  successClassName = 'bg-green-600 hover:bg-green-700 text-white',
  children,
}) => {
  const [showSuccess, setShowSuccess] = React.useState(false);

  React.useEffect(() => {
    if (savedAt == null || savedAt <= 0) return;
    setShowSuccess(true);
    const t = setTimeout(() => setShowSuccess(false), SUCCESS_RESET_MS);
    return () => clearTimeout(t);
  }, [savedAt]);

  const isSuccess = showSuccess && !saving;

  return (
    <button
      type={type}
      disabled={disabled || saving}
      onClick={onClick}
      className={
        isSuccess
          ? `inline-flex items-center space-x-2 px-6 py-3 rounded-xl font-medium transition-all duration-200 ${successClassName} ${className}`
          : className
      }
    >
      {saving ? (
        <>
          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          <span>{savingLabel}</span>
        </>
      ) : isSuccess ? (
        <>
          <Check className="h-5 w-5 flex-shrink-0" />
          <span>{successLabel}</span>
        </>
      ) : (
        children ?? (
          <>
            <Save className="h-5 w-5 flex-shrink-0" />
            <span>{label}</span>
          </>
        )
      )}
    </button>
  );
};

export default SaveButtonWithFeedback;
