import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { useGoBack } from '../../hooks/useGoBack';

const DEFAULT_CLASS =
  'inline-flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors duration-200 font-medium';

export interface BackButtonProps {
  /** Used when the user opened this page directly (no prior in-app history). */
  fallbackTo?: string;
  className?: string;
  iconClassName?: string;
  label?: string;
  /** Icon-only control; label is still exposed to screen readers. */
  iconOnly?: boolean;
  title?: string;
}

const BackButton: React.FC<BackButtonProps> = ({
  fallbackTo = '/',
  className = DEFAULT_CLASS,
  iconClassName = 'h-5 w-5',
  label = 'Back',
  iconOnly = false,
  title,
}) => {
  const goBack = useGoBack(fallbackTo);
  return (
    <button
      type="button"
      onClick={goBack}
      className={className}
      title={title ?? label}
      aria-label={label}
    >
      <ArrowLeft className={iconClassName} aria-hidden />
      {iconOnly ? <span className="sr-only">{label}</span> : <span>{label}</span>}
    </button>
  );
};

export default BackButton;
