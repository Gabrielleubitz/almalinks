import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Shield, AlertTriangle } from 'lucide-react';
import logoSvg from '../assets/alma-links-logo.svg';

const UnauthorizedPage: React.FC = () => {
  const navigate = useNavigate();
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-100 flex items-center justify-center px-4">
      {/* Logo in top left corner */}
      <div className="absolute top-6 left-6 z-10">
        <Link to="/" className="hover:opacity-80 transition-opacity duration-200">
          <img 
            src={logoSvg}
            alt="Alma Links Logo" 
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
            <button
              onClick={() => navigate(-1)}
              className="w-full bg-gradient-to-r from-brand-blue-dark to-brand-blue-light text-white py-3 px-6 rounded-xl hover:shadow-lg transition-all duration-300 font-semibold flex items-center justify-center space-x-2"
            >
              <ArrowLeft className="h-5 w-5" />
              <span>Back to Previous Page</span>
            </button>
            
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