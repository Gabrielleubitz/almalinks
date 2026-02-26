import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowRight } from 'lucide-react';
import logoSvg from '../assets/alma-links-logo.svg';

const RejectedPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-red-100 flex items-center justify-center px-3 sm:px-4 overflow-x-hidden w-full max-w-full relative">
      {/* Logo in top left corner */}
      <div className="absolute top-[max(1.5rem,env(safe-area-inset-top))] left-[max(1rem,env(safe-area-inset-left))] z-10">
        <button
          type="button"
          onClick={() => navigate('/login')}
          className="hover:opacity-80 transition-opacity duration-200"
        >
          <img src={logoSvg} alt="Alma Links Logo" className="h-8 md:h-10 w-auto" />
        </button>
      </div>

      <div className="max-w-md w-full">
        <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
              <AlertCircle className="h-8 w-8 text-red-600" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">
              Application Not Approved
            </h2>
            <p className="text-sm sm:text-base text-gray-600">
              Thank you for your interest. At this time, your application to Alma Links was not
              approved. You are welcome to apply again in the future.
            </p>
          </div>

          <div className="mt-6 flex justify-center">
            <button
              type="button"
              onClick={() => navigate('/signup')}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-gradient-to-r from-brand-blue-dark to-brand-blue-light text-white text-sm font-semibold hover:shadow-lg transition-all duration-200"
            >
              <span>Back to sign up</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RejectedPage;

