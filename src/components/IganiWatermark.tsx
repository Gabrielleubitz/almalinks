import React from 'react';

interface IganiWatermarkProps {
  position?: 'footer' | 'bottom-right' | 'bottom-center';
  size?: 'sm' | 'md' | 'lg';
  opacity?: number;
}

const IganiWatermark: React.FC<IganiWatermarkProps> = ({
  position = 'footer',
  size = 'md',
  opacity = 0.4
}) => {
  const sizeClasses = {
    sm: 'h-6 sm:h-7 w-auto',
    md: 'h-7 sm:h-9 w-auto',
    lg: 'h-9 sm:h-12 w-auto'
  };

  const positionClasses = {
    'footer': 'flex items-center justify-center gap-1.5 sm:gap-2',
    'bottom-right': 'fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-[max(1rem,env(safe-area-inset-right))] z-10',
    'bottom-center': 'flex items-center justify-center'
  };

  return (
    <a
      href="https://www.igani.co/"
      target="_blank"
      rel="noopener noreferrer"
      className={`${positionClasses[position]} min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 items-center hover:opacity-100 transition-opacity duration-200 group`}
      style={{ opacity }}
      title="Built by Igani"
    >
      <span className="text-xs sm:text-sm text-gray-500 font-medium group-hover:text-gray-700 transition-colors">
        Powered by
      </span>
      <img
        src="/igani-logo.png"
        alt="Igani"
        className={`${sizeClasses[size]} transition-transform group-hover:scale-105 object-contain`}
        onError={(e) => {
          // Fallback to SVG if PNG doesn't exist
          const target = e.target as HTMLImageElement;
          if (target.src.endsWith('.png')) {
            target.src = '/igani-logo.svg';
          } else {
            // If neither image exists, hide the watermark
            const parent = target.parentElement;
            if (parent) {
              parent.style.display = 'none';
            }
          }
        }}
      />
    </a>
  );
};

export default IganiWatermark;
