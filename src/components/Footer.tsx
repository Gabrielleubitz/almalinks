import React from 'react';
import { Link } from 'react-router-dom';
import { Linkedin } from 'lucide-react';
import logoSvg from '../assets/alma-links-logo.svg';

interface FooterProps {
  /** Minimal single-row footer for in-app pages (events, chats, etc.) */
  compact?: boolean;
}

const Footer: React.FC<FooterProps> = ({ compact = true }) => {
  if (compact) {
    return (
      <footer className="flex-shrink-0 bg-gray-900 text-white py-2 sm:py-2.5 mt-auto pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))]">
          <div className="flex flex-wrap items-center justify-center gap-x-3 sm:gap-x-4 gap-y-1 text-center text-[11px] sm:text-xs">
            <img
              src={logoSvg}
              alt="AlmaLinks"
              className="h-5 w-auto filter brightness-0 invert inline-block"
            />
            <Link to="/help" className="text-gray-400 hover:text-white whitespace-nowrap">
              Help
            </Link>
            <Link to="/terms" className="text-gray-400 hover:text-white whitespace-nowrap">
              Terms
            </Link>
            <a
              href="https://www.linkedin.com/company/almalinks/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-white inline-flex items-center"
              aria-label="LinkedIn"
            >
              <Linkedin className="h-3.5 w-3.5" />
            </a>
            <span className="text-gray-500 whitespace-nowrap">&copy; {new Date().getFullYear()} AlmaLinks</span>
          </div>
        </div>
      </footer>
    );
  }

  return (
    <footer className="bg-gray-900 text-white py-4 sm:py-5 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]">
        <div className="text-center">
          <div className="flex items-center justify-center mb-2">
            <img
              src={logoSvg}
              alt="AlmaLinks Logo"
              className="h-7 sm:h-8 w-auto filter brightness-0 invert"
            />
          </div>

          <p className="text-gray-400 text-xs sm:text-sm mb-2 max-w-xl mx-auto px-2 leading-relaxed">
            Impact-driven leaders building meaningful connections.
          </p>

          <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mb-2 px-2">
            <Link to="/help" className="text-gray-400 hover:text-white text-xs sm:text-sm font-medium">
              Help
            </Link>
            <Link to="/terms" className="text-gray-400 hover:text-white text-xs sm:text-sm font-medium">
              Terms
            </Link>
            <a
              href="https://www.linkedin.com/company/almalinks/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-white inline-flex items-center justify-center"
              aria-label="LinkedIn"
            >
              <Linkedin className="h-4 w-4" />
            </a>
          </div>

          <div className="pt-2 border-t border-gray-800 text-gray-500 text-[11px] sm:text-xs">
            <p>&copy; {new Date().getFullYear()} AlmaLinks</p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
