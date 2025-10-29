import React, { useState, useEffect, useCallback, useMemo } from 'react';

interface RandomBubble {
  id: number;
  size: number;
  x: number;
  y: number;
  zIndex: number;
  animationDelay: number;
  animationDuration: number;
  opacity: number;
}

interface ProfileBubble {
  image: string;
  size: number;
  startX: number;
  startY: number;
  midY1: number;
  midY2: number;
  endX: number;
  endY: number;
  animationDelay: number;
  animationDuration: number;
  zIndex: number;
}

const FloatingBubbles = () => {
  const [expandedBubble, setExpandedBubble] = useState<number | null>(null);
  const [randomBubbles, setRandomBubbles] = useState<RandomBubble[]>([]);
  const [profileBubbles, setProfileBubbles] = useState<ProfileBubble[]>([]);
  const [imageLoadErrors, setImageLoadErrors] = useState<Set<number>>(new Set());
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  // Optimized and validated image URLs with proper sizing parameters
  const bubbleImages = useMemo(() => [
    'https://ik.imagekit.io/cjenfmnqf/Screenshot%202024-10-30%20at%2017.14.21-min.png?updatedAt=1749634518288&tr=w-400,h-400,c-fill,q-80',
    'https://ik.imagekit.io/cjenfmnqf/Screenshot%202024-10-30%20at%2018.24.49-min.png?updatedAt=1749634516980&tr=w-400,h-400,c-fill,q-80',
    'https://ik.imagekit.io/cjenfmnqf/54259582-af40-4917-a2c7-54e01c9cbf09.jpg?updatedAt=1749634483293&tr=w-400,h-400,c-fill,q-80',
    'https://ik.imagekit.io/cjenfmnqf/IMG_4092.JPG?updatedAt=1749634483205&tr=w-400,h-400,c-fill,q-80',
    'https://ik.imagekit.io/cjenfmnqf/WhatsApp%20Image%202025-06-11%20at%2012.46.49.jpeg?updatedAt=1749636033315&tr=w-400,h-400,c-fill,q-80',
    'https://ik.imagekit.io/cjenfmnqf/WhatsApp%20Image%202025-06-11%20at%2012.46.46.jpeg?updatedAt=1749636033249&tr=w-400,h-400,c-fill,q-80',
    'https://ik.imagekit.io/cjenfmnqf/WhatsApp%20Image%202025-06-11%20at%2012.46.40.jpeg?updatedAt=1749636033114&tr=w-400,h-400,c-fill,q-80',
    'https://ik.imagekit.io/cjenfmnqf/WhatsApp%20Image%202025-06-11%20at%2012.46.54.jpeg?updatedAt=1749639006634&tr=w-400,h-400,c-fill,q-80',
    'https://ik.imagekit.io/cjenfmnqf/WhatsApp%20Image%202025-06-11%20at%2012.46.50.jpeg?updatedAt=1749639007107&tr=w-400,h-400,c-fill,q-80',
    'https://ik.imagekit.io/cjenfmnqf/WhatsApp%20Image%202025-06-11%20at%2012.47.27.jpeg?updatedAt=1749639007137&tr=w-400,h-400,c-fill,q-80'
  ], []);

  // Optimized background image with proper sizing
  const backgroundImage = 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1920&q=80';

  // Check for reduced motion preference
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);
    
    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };
    
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Memoized bubble generation functions
  const generateRandomBubbles = useCallback(() => {
    const bubbles: RandomBubble[] = [];
    const bubbleCount = prefersReducedMotion ? 10 : 20; // Reduce bubbles for reduced motion
    
    for (let i = 0; i < bubbleCount; i++) {
      bubbles.push({
        id: i,
        size: Math.max(15, Math.min(55, Math.random() * 40 + 15)), // Ensure size limits: 15px to 55px
        x: Math.random() * 100,
        y: Math.random() * 100,
        zIndex: Math.floor(Math.random() * 10) + 1,
        animationDelay: Math.random() * 8,
        animationDuration: prefersReducedMotion ? 20 : Math.random() * 6 + 8, // Slower for reduced motion
        opacity: Math.random() * 0.4 + 0.1,
      });
    }
    
    return bubbles;
  }, [prefersReducedMotion]);

  const generateProfileBubbles = useCallback(() => {
    return bubbleImages.map((image, index) => {
      const totalBubbles = bubbleImages.length;
      const baseYStart = (index / totalBubbles) * 80 + 10;
      const baseYEnd = ((index + 5) % totalBubbles / totalBubbles) * 80 + 10;
      
      const startY = Math.max(0, Math.min(100, baseYStart + (Math.random() - 0.5) * 30));
      const endY = Math.max(0, Math.min(100, baseYEnd + (Math.random() - 0.5) * 30));
      
      const startX = Math.random() * 140 - 20;
      const endX = Math.random() * 140 - 20;
      
      const midY1 = Math.max(10, Math.min(90, Math.random() * 80 + 10));
      const midY2 = Math.max(10, Math.min(90, Math.random() * 80 + 10));

      return {
        image,
        size: Math.max(55, Math.min(90, 55 + Math.random() * 35)), // Ensure size limits: 55px to 90px
        startX,
        startY,
        midY1,
        midY2,
        endX,
        endY,
        animationDelay: (index * 2.5) + Math.random() * 5,
        animationDuration: prefersReducedMotion ? 40 : 20 + Math.random() * 10, // Slower for reduced motion
        zIndex: 30 + index,
      };
    });
  }, [bubbleImages, prefersReducedMotion]);

  // Initialize bubbles with performance optimization
  useEffect(() => {
    // Use requestAnimationFrame to avoid blocking the main thread
    const initializeBubbles = () => {
      requestAnimationFrame(() => {
        setRandomBubbles(generateRandomBubbles());
        setProfileBubbles(generateProfileBubbles());
      });
    };

    initializeBubbles();
  }, [generateRandomBubbles, generateProfileBubbles]);

  // Optimized click handler
  const handleBubbleClick = useCallback((index: number) => {
    if (imageLoadErrors.has(index)) return; // Don't expand broken images
    
    setExpandedBubble(current => current === index ? null : index);
  }, [imageLoadErrors]);

  // Handle image load errors
  const handleImageError = useCallback((index: number) => {
    setImageLoadErrors(prev => new Set([...prev, index]));
  }, []);

  // Enhanced keyboard and click handlers
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setExpandedBubble(null);
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains('bubble-overlay')) {
        setExpandedBubble(null);
      }
    };

    if (expandedBubble !== null) {
      document.addEventListener('keydown', handleEscape);
      document.addEventListener('click', handleClickOutside);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.removeEventListener('click', handleClickOutside);
      document.body.style.overflow = '';
    };
  }, [expandedBubble]);

  // Memoized animation styles to prevent unnecessary recalculations
  const profileAnimationKeyframes = useMemo(() => {
    return profileBubbles.map((profile, index) => `
      @keyframes randomFloat-${index} {
        0% {
          left: ${profile.startX}%;
          top: ${profile.startY}%;
          opacity: 0;
          transform: translate(-50%, -50%) scale(0.8);
        }
        10% {
          opacity: 1;
          transform: translate(-50%, -50%) scale(1);
        }
        33% {
          top: ${profile.midY1}%;
          opacity: 1;
          transform: translate(-50%, -50%) scale(1.05);
        }
        66% {
          top: ${profile.midY2}%;
          opacity: 1;
          transform: translate(-50%, -50%) scale(0.95);
        }
        90% {
          opacity: 1;
          transform: translate(-50%, -50%) scale(1);
        }
        100% {
          left: ${profile.endX}%;
          top: ${profile.endY}%;
          opacity: 0;
          transform: translate(-50%, -50%) scale(0.8);
        }
      }
    `).join('');
  }, [profileBubbles]);

  return (
    <section className="relative py-24 overflow-hidden" role="region" aria-label="Community showcase">
      {/* Optimized Background Image */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: `url('${backgroundImage}')`,
          willChange: expandedBubble !== null ? 'auto' : 'transform'
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-red-700 via-red-600 to-blue-600 opacity-85"></div>
      </div>

      {/* Random Floating Bubbles - Background Layer */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        {randomBubbles.map((bubble) => (
          <div
            key={`random-${bubble.id}`}
            className="absolute rounded-full bg-white/20 backdrop-blur-sm border border-white/30"
            style={{
              width: `${bubble.size}px`,
              height: `${bubble.size}px`,
              left: `${bubble.x}%`,
              top: `${bubble.y}%`,
              zIndex: bubble.zIndex,
              animationDelay: `${bubble.animationDelay}s`,
              animationDuration: `${bubble.animationDuration}s`,
              opacity: expandedBubble !== null ? bubble.opacity * 0.3 : bubble.opacity,
              transform: `translate(-50%, -50%)`,
              animation: prefersReducedMotion ? 'none' : 'floatGentle 15s ease-in-out infinite',
              willChange: prefersReducedMotion ? 'auto' : 'transform'
            }}
          />
        ))}
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 z-10">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Content Box */}
          <div className="relative z-20">
            <div className="bg-white/10 backdrop-blur-md rounded-3xl p-8 md:p-12 border border-white/20 shadow-2xl">
              <h2 className="text-4xl md:text-5xl font-bold text-white mb-6 leading-tight">
                Meet Our AlmaLinks Community
              </h2>
              <p className="text-xl text-white/90 leading-relaxed">
                Watch our vibrant community of 500+ CEOs, founders, financiers, and executives flow before your eyes. Each profile represents a meaningful connection waiting to be made at AlmaLinks - where outstanding business leaders build relationships across Jewish communities worldwide.
              </p>
              <p className="mt-4 font-bold text-white text-lg">
                Try Popping A Bubble 🫧
              </p>
            </div>
          </div>

          {/* Right Side - Interactive Profile Bubbles Area */}
          <div className="relative w-full h-96 lg:h-[500px] z-20" style={{ minHeight: '400px' }}>
            {/* Interactive Profile Bubbles */}
            {profileBubbles.map((profile, index) => {
              const hasError = imageLoadErrors.has(index);
              
              return (
                <div key={`profile-${index}`} className="absolute inset-0">
                  <div
                    className={`absolute rounded-full border-4 border-white/30 shadow-xl transition-all duration-500 ${
                      hasError 
                        ? 'opacity-0 pointer-events-none' 
                        : expandedBubble === index 
                          ? 'opacity-0 pointer-events-none scale-0' 
                          : expandedBubble !== null 
                            ? 'opacity-30' 
                            : 'opacity-100 cursor-pointer hover:scale-110 hover:border-white/50'
                    }`}
                    style={{
                      width: `${profile.size}px`,
                      height: `${profile.size}px`,
                      maxWidth: '120px', // Ensure no bubble exceeds reasonable size
                      maxHeight: '120px',
                      zIndex: profile.zIndex,
                      transform: 'translate(-50%, -50%)',
                      animation: prefersReducedMotion ? 'none' : `randomFloat-${index} ${profile.animationDuration}s linear infinite`,
                      animationDelay: `${profile.animationDelay}s`,
                      willChange: prefersReducedMotion ? 'auto' : 'transform, opacity'
                    }}
                    onClick={() => handleBubbleClick(index)}
                    role="button"
                    tabIndex={0}
                    aria-label={`View community member ${index + 1} profile`}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleBubbleClick(index);
                      }
                    }}
                  >
                    <img
                      src={profile.image}
                      alt={`Community member ${index + 1}`}
                      className="w-full h-full rounded-full object-cover"
                      loading="lazy"
                      style={{ maxWidth: '400px', maxHeight: '400px' }} // Ensure image size limit
                      onError={() => handleImageError(index)}
                      onLoad={() => {
                        // Remove from error set if image loads successfully
                        setImageLoadErrors(prev => {
                          const newSet = new Set(prev);
                          newSet.delete(index);
                          return newSet;
                        });
                      }}
                    />
                  </div>
                </div>
              );
            })}

            {/* Decorative bubbles - Reduced count for performance */}
            {[...Array(prefersReducedMotion ? 4 : 6)].map((_, index) => (
              <div
                key={`decorative-${index}`}
                className={`absolute rounded-full bg-white/20 backdrop-blur-sm border border-white/30 transition-all duration-500 ${
                  expandedBubble !== null ? 'opacity-20' : 'opacity-100'
                }`}
                style={{
                  width: `${Math.max(20, Math.min(40, 20 + Math.random() * 20))}px`,
                  height: `${Math.max(20, Math.min(40, 20 + Math.random() * 20))}px`,
                  top: `${Math.random() * 100}%`,
                  right: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 6}s`,
                  animationDuration: `${10 + Math.random() * 5}s`,
                  zIndex: 25,
                  transform: 'translate(-50%, -50%)',
                  animation: prefersReducedMotion ? 'none' : 'floatGentle 12s ease-in-out infinite',
                  willChange: prefersReducedMotion ? 'auto' : 'transform'
                }}
                aria-hidden="true"
              />
            ))}
          </div>
        </div>
      </div>

      {/* Enhanced Expanded Bubble Modal */}
      {expandedBubble !== null && profileBubbles[expandedBubble] && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] bubble-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="expanded-bubble-title"
        >
          <div 
            className="relative animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Expanded bubble image with size constraints */}
            <div className="w-80 h-80 md:w-96 md:h-96 max-w-[400px] max-h-[400px] rounded-full border-8 border-white/50 shadow-2xl overflow-hidden">
              <img
                src={profileBubbles[expandedBubble]?.image}
                alt={`Community member ${expandedBubble + 1} - expanded view`}
                className="w-full h-full object-cover"
                style={{ maxWidth: '400px', maxHeight: '400px' }} // Absolute size limit
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgdmlld0JveD0iMCAwIDQwMCA0MDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSI0MDAiIGhlaWdodD0iNDAwIiBmaWxsPSIjRjNGNEY2Ii8+CjxjaXJjbGUgY3g9IjIwMCIgY3k9IjE2MCIgcj0iMzAiIGZpbGw9IiM5Q0EzQUYiLz4KPGVsbGlwc2UgY3g9IjIwMCIgY3k9IjI4MCIgcng9IjgwIiByeT0iNDAiIGZpbGw9IiM5Q0EzQUYiLz4KPC9zdmc+';
                  target.alt = 'Community member profile';
                }}
                id="expanded-bubble-title"
              />
            </div>
            
            {/* Enhanced close button with better accessibility */}
            <button
              onClick={() => setExpandedBubble(null)}
              className="absolute -top-4 -right-4 w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center text-gray-600 hover:text-gray-800 focus:outline-none focus:ring-4 focus:ring-blue-500 focus:ring-opacity-50 transition-all duration-200"
              aria-label="Close expanded profile view"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            
            {/* Sparkle effects - Only if motion is not reduced */}
            {!prefersReducedMotion && (
              <>
                <div className="absolute -top-8 -left-8 w-4 h-4 bg-yellow-400 rounded-full animate-ping" aria-hidden="true"></div>
                <div className="absolute -top-6 -right-12 w-3 h-3 bg-yellow-300 rounded-full animate-ping" style={{ animationDelay: '0.2s' }} aria-hidden="true"></div>
                <div className="absolute -bottom-8 -left-12 w-3 h-3 bg-yellow-400 rounded-full animate-ping" style={{ animationDelay: '0.4s' }} aria-hidden="true"></div>
                <div className="absolute -bottom-6 -right-8 w-4 h-4 bg-yellow-300 rounded-full animate-ping" style={{ animationDelay: '0.6s' }} aria-hidden="true"></div>
                <div className="absolute top-1/4 -left-16 w-2 h-2 bg-white rounded-full animate-ping" style={{ animationDelay: '0.1s' }} aria-hidden="true"></div>
                <div className="absolute bottom-1/4 -right-16 w-2 h-2 bg-white rounded-full animate-ping" style={{ animationDelay: '0.3s' }} aria-hidden="true"></div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Optimized CSS with performance improvements */}
      <style jsx>{`
        @keyframes floatGentle {
          0%, 100% { 
            transform: translate(-50%, -50%) translateY(0px) rotate(0deg); 
          }
          25% { 
            transform: translate(-50%, -50%) translateY(-10px) rotate(1deg); 
          }
          50% { 
            transform: translate(-50%, -50%) translateY(-20px) rotate(-1deg); 
          }
          75% { 
            transform: translate(-50%, -50%) translateY(-10px) rotate(0.5deg); 
          }
        }

        @keyframes scale-in {
          0% { 
            transform: scale(0) rotate(0deg); 
            opacity: 0; 
          }
          50% { 
            transform: scale(1.1) rotate(180deg); 
            opacity: 0.8; 
          }
          100% { 
            transform: scale(1) rotate(360deg); 
            opacity: 1; 
          }
        }

        .animate-scale-in {
          animation: scale-in 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        /* Reduced motion support */
        @media (prefers-reduced-motion: reduce) {
          * {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
            scroll-behavior: auto !important;
          }
        }

        ${profileAnimationKeyframes}
      `}</style>
    </section>
  );
};

export default FloatingBubbles;