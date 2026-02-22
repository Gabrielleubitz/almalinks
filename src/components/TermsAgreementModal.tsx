import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText } from 'lucide-react';

const STORAGE_KEY = 'almalinks_terms_agreed';

export function getTermsAgreed(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setTermsAgreed(): void {
  try {
    localStorage.setItem(STORAGE_KEY, 'true');
  } catch {
    // ignore
  }
}

interface TermsAgreementModalProps {
  onAgree: () => void;
}

const TermsAgreementModal: React.FC<TermsAgreementModalProps> = ({ onAgree }) => {
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAgree = () => {
    if (!checked) {
      setError('Please confirm that you have read and agree to the Terms and Conditions.');
      return;
    }
    setError(null);
    setTermsAgreed();
    onAgree();
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="terms-modal-title"
    >
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 sm:p-8 flex-shrink-0">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
              <FileText className="h-5 w-5 text-gray-600" />
            </div>
            <h2 id="terms-modal-title" className="text-xl font-bold text-gray-900">
              Terms and Conditions
            </h2>
          </div>
          <p className="text-gray-600 text-sm sm:text-base mb-4">
            Please read and accept our Terms and Conditions to continue using AlmaLinks.
          </p>
          <p className="text-gray-600 text-sm mb-4">
            You can read the full text on our{' '}
            <Link to="/terms" className="text-[var(--brand-light)] font-medium hover:underline" target="_blank" rel="noopener noreferrer">
              Terms and Conditions page
            </Link>.
          </p>

          <label className="flex items-start gap-3 cursor-pointer group mt-4">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => {
                setChecked(e.target.checked);
                setError(null);
              }}
              className="mt-1 w-5 h-5 rounded border-gray-300 text-[var(--brand-dark)] focus:ring-[var(--brand-light)] touch-manipulation"
              aria-describedby="terms-checkbox-desc"
            />
            <span id="terms-checkbox-desc" className="text-sm text-gray-700 group-hover:text-gray-900">
              I have read and agree to the Terms and Conditions
            </span>
          </label>

          {error && (
            <p className="mt-2 text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
        </div>

        <div className="p-6 sm:p-8 pt-0 flex-shrink-0">
          <button
            type="button"
            onClick={handleAgree}
            className="w-full min-h-[48px] px-4 py-3 bg-gray-900 hover:bg-gray-800 text-white font-semibold rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900 touch-manipulation"
          >
            I Agree
          </button>
        </div>
      </div>
    </div>
  );
};

export default TermsAgreementModal;
