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
    sm: 'h-7 w-auto',     // Small: 28px height (scales to ~70px width)
    md: 'h-9 w-auto',     // Medium: 36px height (scales to ~90px width)
    lg: 'h-12 w-auto'     // Large: 48px height (scales to ~120px width)
  };

  const positionClasses = {
    'footer': 'flex items-center justify-center space-x-2',
    'bottom-right': 'fixed bottom-4 right-4 z-10',
    'bottom-center': 'flex items-center justify-center'
  };

  return (
    <a
      href="https://www.igani.co/"
      target="_blank"
      rel="noopener noreferrer"
      className={`${positionClasses[position]} hover:opacity-100 transition-opacity duration-200 group`}
      style={{ opacity }}
      title="Built by Igani"
    >
      <span className="text-xs text-gray-500 font-medium group-hover:text-gray-700 transition-colors">
        Powered by
      </span>
      <img
        src="/igani-logo.png"
        alt="Igani"
        className={`${sizeClasses[size]} transition-transform group-hover:scale-105`}
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
