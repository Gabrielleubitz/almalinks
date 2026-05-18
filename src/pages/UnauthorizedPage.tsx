import React from 'react';
import { Link } from 'react-router-dom';
import BackButton from '../components/ui/BackButton';
import { Shield, AlertTriangle } from 'lucide-react';
import logoSvg from '../assets/alma-links-logo.svg';

const UnauthorizedPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-100 flex items-center justify-center px-3 sm:px-4 overflow-x-hidden w-full max-w-full">
      {/* Logo in top left corner */}
      <div className="absolute top-[max(1.5rem,env(safe-area-inset-top))] left-[max(1rem,env(safe-area-inset-left))] z-10">
        <Link to="/" className="hover:opacity-80 transition-opacity duration-200 min-h-[44px] min-w-[44px] flex items-center touch-manipulation">
          <img 
            src={logoSvg}
            alt="AlmaLinks Logo" 
            className="h-8 md:h-10 w-auto"
          />
        </Link>
      </div>

      <div className="max-w-md w-full text-center">
        <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100">
          {/* Error Icon */}
          <div className="inline-flex items-center justify-center w-20 h-20 bg-red-100 rounded-full mb-6">
            <AlertTriangle className="h-10 w-10 text-red-600" />
          </div>

          {/* Error Message */}
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Access Denied
          </h1>
          <p className="text-gray-600 mb-8 leading-relaxed">
            You don't have permission to access this page. This area is restricted to authorized users only.
          </p>

          {/* Action Buttons */}
          <div className="space-y-4">
            <BackButton fallbackTo="/dashboard" className="w-full bg-gradient-to-r from-brand-blue-dark to-brand-blue-light text-white py-3 px-6 rounded-xl hover:shadow-lg transition-all duration-300 font-semibold justify-center" iconClassName="h-5 w-5" />
            
            <Link
              to="/dashboard"
              className="w-full bg-white text-gray-700 py-3 px-6 rounded-xl hover:bg-gray-50 transition-all duration-300 font-semibold border border-gray-200 flex items-center justify-center space-x-2"
            >
              <Shield className="h-5 w-5" />
              <span>Go to Dashboard</span>
            </Link>
          </div>

          {/* Help Text */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <p className="text-sm text-gray-500">
              If you believe this is an error, please contact support at{' '}
              <a 
                href="mailto:info@almalinks.com" 
                className="text-red-600 hover:text-red-700 font-medium"
              >
                info@almalinks.com
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UnauthorizedPage;