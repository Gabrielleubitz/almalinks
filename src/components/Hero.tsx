import React, { useEffect, useRef } from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const Hero = () => {
  const { user, isPending } = useAuth();
  const heroRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Parallax effect on scroll
    const handleScroll = () => {
      if (heroRef.current) {
        const scrolled = window.scrollY;
        const parallax = scrolled * 0.5;
        heroRef.current.style.transform = `translateY(${parallax}px)`;
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-slate-50 via-white to-blue-50/30">
      {/* Animated background mesh */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-gradient-to-br from-blue-200/20 to-transparent rounded-full blur-3xl animate-pulse" style={{ animationDuration: '8s' }}></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-gradient-to-tl from-red-200/20 to-transparent rounded-full blur-3xl animate-pulse" style={{ animationDuration: '10s', animationDelay: '1s' }}></div>
        <div className="absolute top-1/2 right-0 w-72 h-72 bg-gradient-to-bl from-blue-100/30 to-transparent rounded-full blur-2xl animate-pulse" style={{ animationDuration: '12s', animationDelay: '2s' }}></div>
      </div>

      {/* Decorative geometric elements */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-20 left-10 w-2 h-32 bg-gradient-to-b from-blue-600/20 to-transparent rotate-12"></div>
        <div className="absolute bottom-32 right-16 w-2 h-24 bg-gradient-to-t from-red-600/20 to-transparent -rotate-12"></div>
        <div className="absolute top-1/3 right-1/4 w-1 h-16 bg-gradient-to-b from-blue-400/15 to-transparent rotate-45"></div>
      </div>

      <div ref={heroRef} className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <div className="max-w-5xl mx-auto">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 mb-8 rounded-full bg-white/80 backdrop-blur-sm border border-gray-200/50 shadow-sm fade-in">
            <Sparkles className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-medium text-gray-700">Exclusive Professional Network</span>
          </div>

          {/* Main heading with distinctive typography */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-bold mb-8 fade-in" style={{ fontFamily: "'Playfair Display', serif" }}>
            <div className="mb-4 text-gray-900 tracking-tight leading-[1.1]">
              AlmaLinks
            </div>
            <div className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl leading-[1.2]">
              <span className="block text-gray-800">A Global</span>
              <span className="block mt-2 bg-gradient-to-r from-blue-700 via-blue-600 to-red-700 bg-clip-text text-transparent">
                Professional Network
              </span>
              <span className="block mt-2 text-gray-700 font-light italic" style={{ fontFamily: "'Lora', serif" }}>
                for Jewish Business Leaders
              </span>
            </div>
          </h1>
          
          {/* Subheading with refined typography */}
          <p className="text-lg sm:text-xl md:text-2xl text-gray-600 mb-12 max-w-3xl mx-auto leading-relaxed fade-in-delay px-4" style={{ fontFamily: "'Lora', serif" }}>
            A community of impact-driven CEOs, financiers, and executives committed to Israel and Jewish communities. 
            <span className="block mt-2 text-gray-500">Building meaningful relationships between outstanding business leaders worldwide.</span>
          </p>
          
          {/* CTA Button with sophisticated styling */}
          <div className="flex justify-center slide-up px-4">
            {user ? (
              isPending ? (
                <Link
                  to="/pending"
                  className="group relative inline-flex items-center gap-3 bg-gradient-to-r from-amber-500 to-amber-600 text-white px-8 sm:px-10 py-4 sm:py-5 rounded-full font-semibold text-base sm:text-lg shadow-lg shadow-amber-500/30 hover:shadow-xl hover:shadow-amber-500/40 transition-all duration-300 hover:scale-105 overflow-hidden"
                >
                  <span className="relative z-10">Check Application Status</span>
                  <ArrowRight className="h-5 w-5 relative z-10 group-hover:translate-x-1 transition-transform" />
                  <div className="absolute inset-0 bg-gradient-to-r from-amber-600 to-amber-700 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                </Link>
              ) : (
                <Link
                  to="/events"
                  className="group relative inline-flex items-center gap-3 bg-gradient-to-r from-blue-700 via-blue-600 to-red-700 text-white px-8 sm:px-10 py-4 sm:py-5 rounded-full font-semibold text-base sm:text-lg shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 transition-all duration-300 hover:scale-105 overflow-hidden"
                >
                  <span className="relative z-10">View Network Events</span>
                  <ArrowRight className="h-5 w-5 relative z-10 group-hover:translate-x-1 transition-transform" />
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-800 via-blue-700 to-red-800 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                </Link>
              )
            ) : (
              <Link
                to="/signup"
                className="group relative inline-flex items-center gap-3 bg-gradient-to-r from-blue-700 via-blue-600 to-red-700 text-white px-8 sm:px-10 py-4 sm:py-5 rounded-full font-semibold text-base sm:text-lg shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 transition-all duration-300 hover:scale-105 overflow-hidden"
              >
                <span className="relative z-10">Join AlmaLinks</span>
                <ArrowRight className="h-5 w-5 relative z-10 group-hover:translate-x-1 transition-transform" />
                <div className="absolute inset-0 bg-gradient-to-r from-blue-800 via-blue-700 to-red-800 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              </Link>
            )}
          </div>
        </div>
        
        {/* Scroll indicator with refined animation */}
        <div className="mt-20 sm:mt-24 md:mt-32 slide-up-delay">
          <div className="flex flex-col items-center gap-2">
            <div className="w-px h-16 bg-gradient-to-b from-blue-600/60 via-blue-400/40 to-transparent"></div>
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Scroll</span>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;