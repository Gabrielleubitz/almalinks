import React from 'react';
import { Link } from 'react-router-dom';
import { Linkedin } from 'lucide-react';
import logoSvg from '../assets/alma-links-logo.svg';

interface FooterProps {
  /** Use a compact footer for in-app pages (e.g. Discover Chats) so content gets more space */
  compact?: boolean;
}

const Footer: React.FC<FooterProps> = ({ compact = true }) => {
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
    <footer className="bg-gray-900 text-white py-5 sm:py-6 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]">
        <div className="text-center">
          <div className="flex items-center justify-center mb-3">
            <img
              src={logoSvg}
              alt="AlmaLinks Logo"
              className="h-8 sm:h-9 w-auto filter brightness-0 invert"
            />
          </div>

          <p className="text-gray-400 text-xs sm:text-sm mb-3 max-w-xl mx-auto px-2 leading-relaxed">
            Impact-driven leaders building meaningful connections. Questions? We&apos;re here.
          </p>

          <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mb-3 px-2">
            <Link
              to="/help"
              className="text-gray-400 hover:text-white text-xs sm:text-sm font-medium"
            >
              Help
            </Link>
            <Link
              to="/terms"
              className="text-gray-400 hover:text-white text-xs sm:text-sm font-medium"
            >
              Terms
            </Link>
            <a
              href="https://www.linkedin.com/company/almalinks/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-white min-h-[40px] min-w-[40px] inline-flex items-center justify-center sm:min-h-0 sm:min-w-0"
              aria-label="LinkedIn"
            >
              <Linkedin className="h-4 w-4 sm:h-5 sm:w-5" />
            </a>
          </div>

          <div className="pt-3 border-t border-gray-800 text-gray-500 text-xs">
            <p>&copy; {new Date().getFullYear()} AlmaLinks</p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;