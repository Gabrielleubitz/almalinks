import React from 'react';
import { Link } from 'react-router-dom';
import { Linkedin } from 'lucide-react';
import logoSvg from '../assets/alma-links-logo.svg';

interface FooterProps {
  /** Use a compact footer for in-app pages (e.g. Discover Chats) so content gets more space */
  compact?: boolean;
}

const Footer: React.FC<FooterProps> = ({ compact = false }) => {
  if (compact) {
    return (
      <footer className="flex-shrink-0 bg-gray-900 text-white py-4 sm:py-5 mt-auto pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]">
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-center">
            <img
              src={logoSvg}
              alt="AlmaLinks"
              className="h-6 w-auto filter brightness-0 invert inline-block"
            />
            <Link to="/help" className="text-gray-400 hover:text-white text-xs sm:text-sm">
              Need help? Report a bug
            </Link>
            <Link to="/terms" className="text-gray-400 hover:text-white text-xs sm:text-sm">
              Terms &amp; Conditions
            </Link>
            <p className="text-gray-400 text-xs sm:text-sm">
              A community of impact-driven leaders. Connect with us anytime!
            </p>
            <a
              href="https://www.linkedin.com/company/almalinks/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-white transition-colors"
              aria-label="LinkedIn"
            >
              <Linkedin className="h-4 w-4 sm:h-5 sm:w-5" />
            </a>
            <span className="text-gray-500 text-xs">&copy; 2025 AlmaLinks</span>
          </div>
        </div>
      </footer>
    );
  }

  return (
    <footer className="bg-gray-900 text-white py-12 sm:py-16 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]">
        <div className="text-center">
          <div className="flex items-center justify-center space-x-3 mb-6 sm:mb-8">
            <img 
              src={logoSvg}
              alt="AlmaLinks Logo" 
              className="h-12 sm:h-16 w-auto filter brightness-0 invert"
            />
          </div>
          
          <p className="text-gray-400 text-base sm:text-lg mb-6 sm:mb-8 max-w-2xl mx-auto px-4">
            A community of impact-driven CEOs, financiers, and executives committed to Israel 
            and Jewish communities. Building meaningful relationships between outstanding 
            business leaders worldwide. Connect with us anytime!
          </p>
          
          <div className="flex flex-wrap justify-center gap-4 sm:gap-6 mb-6 sm:mb-8 px-4">
            <Link
              to="/help"
              className="text-gray-400 hover:text-white transition-colors duration-200 font-medium text-sm"
            >
              Need help? Report a bug
            </Link>
            <Link
              to="/terms"
              className="text-gray-400 hover:text-white transition-colors duration-200 font-medium text-sm"
            >
              Terms &amp; Conditions
            </Link>
            <a
              href="https://www.linkedin.com/company/almalinks/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-white transition-colors duration-200 min-h-[44px] min-w-[44px] flex items-center justify-center sm:min-h-0 sm:min-w-0"
              aria-label="LinkedIn"
            >
              <Linkedin className="h-5 w-5 sm:h-6 sm:w-6" />
            </a>
          </div>
          
          <div className="mt-12 pt-8 border-t border-gray-800 text-gray-500 text-sm space-y-4">
            <p>&copy; 2025 AlmaLinks. All rights reserved.</p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;