import React from 'react';

/**
 * Global "Powered by Igani" bar shown on every page.
 * Mobile-optimized: responsive sizing, touch-friendly (min 44px tap target).
 */
const PoweredByIgani: React.FC = () => {
  return (
    <footer
      className="w-full border-t border-gray-200 bg-gray-50/95 backdrop-blur-sm shrink-0 pb-[env(safe-area-inset-bottom)]"
      aria-label="Powered by Igani"
    >
      <a
        href="https://www.igani.co/"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-2 min-h-[44px] sm:min-h-[40px] py-2.5 sm:py-2 px-4 text-gray-500 hover:text-gray-700 hover:bg-gray-100/80 active:bg-gray-200/80 transition-colors duration-200"
        title="Built by Igani"
      >
        <span className="text-xs sm:text-sm font-medium select-none">
          Powered by
        </span>
        <img
          src="/igani-logo.png"
          alt="Igani"
          className="h-6 w-auto sm:h-7 object-contain"
          loading="lazy"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            if (target.src.endsWith('.png')) {
              target.src = '/igani-logo.svg';
            } else {
              target.style.display = 'none';
            }
          }}
        />
      </a>
    </footer>
  );
};

export default PoweredByIgani;
