import { useState, useEffect } from 'react';

/**
 * Custom hook to detect mobile screen size using media queries
 * Treats mobile as width < 768px (md breakpoint in Tailwind)
 * SSR-safe with proper hydration handling
 */
export const useIsMobile = (userPreference?: 'auto' | 'mobile' | 'desktop'): boolean => {
  // SSR-safe initial state - defaults to false (desktop) to prevent hydration mismatch
  const [isMobile, setIsMobile] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    // Mark as hydrated once we're client-side
    setIsHydrated(true);

    // If user has a specific preference, respect it
    if (userPreference === 'mobile') {
      setIsMobile(true);
      return;
    }
    if (userPreference === 'desktop') {
      setIsMobile(false);
      return;
    }

    // Default behavior: use media query
    const mediaQuery = window.matchMedia('(max-width: 767px)');
    
    // Set initial value
    setIsMobile(mediaQuery.matches);

    // Create handler for media query changes
    const handleMediaQueryChange = (e: MediaQueryListEvent) => {
      setIsMobile(e.matches);
    };

    // Add listener for viewport changes
    mediaQuery.addEventListener('change', handleMediaQueryChange);

    // Cleanup
    return () => {
      mediaQuery.removeEventListener('change', handleMediaQueryChange);
    };
  }, [userPreference]);

  // During SSR or before hydration, return false to prevent layout shift
  if (!isHydrated) {
    return false;
  }

  return isMobile;
};

/**
 * Hook to get the current screen breakpoint
 * Useful for more granular responsive behavior
 */
export const useScreenSize = () => {
  const [screenSize, setScreenSize] = useState<'sm' | 'md' | 'lg' | 'xl' | '2xl'>('lg');
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);

    const updateScreenSize = () => {
      const width = window.innerWidth;
      if (width < 640) {
        setScreenSize('sm');
      } else if (width < 768) {
        setScreenSize('md');
      } else if (width < 1024) {
        setScreenSize('lg');
      } else if (width < 1280) {
        setScreenSize('xl');
      } else {
        setScreenSize('2xl');
      }
    };

    // Set initial value
    updateScreenSize();

    // Add resize listener
    window.addEventListener('resize', updateScreenSize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', updateScreenSize);
    };
  }, []);

  // During SSR, return default desktop size
  if (!isHydrated) {
    return 'lg';
  }

  return screenSize;
};

export default useIsMobile;