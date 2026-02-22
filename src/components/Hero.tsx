import React from 'react';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const Hero = () => {
  const { user, isPending } = useAuth();

  return (
    <section className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-white pt-[var(--content-offset-top)] md:pt-20 pb-8 md:pb-0">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <div className="max-w-4xl mx-auto">
          {/* Main heading - using Outfit as per brand guidelines */}
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold text-gray-900 mb-4 sm:mb-6 md:mb-6 fade-in">
            <div className="mb-2 sm:mb-3 md:mb-4">AlmaLinks</div>
            <div className="text-xl sm:text-2xl md:text-3xl lg:text-4xl xl:text-5xl 2xl:text-6xl leading-tight md:leading-normal">
              A Global <span className="gradient-text-bold-ideas">Professional Network</span>
              <br className="hidden sm:block" />
              <span className="sm:hidden"> </span>
              <span className="gradient-text">for Jewish Business Leaders</span>
            </div>
          </h1>
          
          {/* Subheading - using Outfit for body text */}
          <p className="text-sm sm:text-base md:text-lg lg:text-xl xl:text-2xl text-gray-600 mb-6 sm:mb-8 md:mb-12 max-w-3xl mx-auto leading-relaxed fade-in-delay px-2 sm:px-4">
            A community of impact-driven CEOs, financiers, and executives committed to Israel and Jewish communities. 
            Building meaningful relationships between outstanding business leaders worldwide.
          </p>
          
          {/* Primary CTA */}
          <div className="flex justify-center slide-up px-2 sm:px-4">
            {user ? (
              isPending ? (
                <Link
                  to="/pending"
                  className="bg-yellow-600 text-white px-6 sm:px-8 md:px-10 py-3 sm:py-3.5 md:py-4 rounded-full hover:bg-yellow-700 active:bg-yellow-800 transition-colors duration-200 font-semibold text-base sm:text-base md:text-lg flex items-center justify-center space-x-2 hover-lift w-full sm:w-auto max-w-xs sm:max-w-none min-h-[44px] md:min-h-0 touch-manipulation"
                >
                  <span className="hidden sm:inline">Check Application Status</span>
                  <span className="sm:hidden">Check Status</span>
                  <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
                </Link>
              ) : (
                <Link
                  to="/events"
                  className="bg-red-700 text-white px-6 sm:px-8 md:px-10 py-3 sm:py-3.5 md:py-4 rounded-full hover:bg-red-800 active:bg-red-900 transition-colors duration-200 font-semibold text-base sm:text-base md:text-lg flex items-center justify-center space-x-2 hover-lift w-full sm:w-auto max-w-xs sm:max-w-none min-h-[44px] md:min-h-0 touch-manipulation"
                >
                  <span>View Network Events</span>
                  <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
                </Link>
              )
            ) : (
              <Link
                to="/signup"
                className="bg-red-700 text-white px-6 sm:px-8 md:px-10 py-3 sm:py-3.5 md:py-4 rounded-full hover:bg-red-800 active:bg-red-900 transition-colors duration-200 font-semibold text-base sm:text-base md:text-lg flex items-center justify-center space-x-2 hover-lift w-full sm:w-auto max-w-xs sm:max-w-none min-h-[44px] md:min-h-0 touch-manipulation"
              >
                <span className="hidden sm:inline">Join AlmaLinks</span>
                <span className="sm:hidden">Join Now</span>
                <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
              </Link>
            )}
          </div>
        </div>
        
        {/* Simple scroll indicator */}
        <div className="mt-8 sm:mt-12 md:mt-16 lg:mt-20 slide-up-delay">
          <div className="flex justify-center">
            <div className="w-2 h-10 sm:h-12 md:h-16 bg-gradient-to-b from-brand-blue-dark to-brand-blue-light rounded-full animate-pulse"></div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;