import React from 'react';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const Hero = () => {
  const { user, isPending } = useAuth();

  return (
    <section className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-white pt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold text-gray-900 mb-6 fade-in px-2">
            <div className="mb-2 sm:mb-4">AlmaLinks</div>
            <div className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl">
              A Global <span className="gradient-text-bold-ideas">Professional Network</span>
              <br className="hidden sm:block" />
              <span className="sm:hidden"> </span>
              <span className="gradient-text">for Jewish Business Leaders</span>
            </div>
          </h1>
          
          <p className="text-base sm:text-lg md:text-xl lg:text-2xl text-gray-600 mb-8 sm:mb-12 max-w-3xl mx-auto leading-relaxed fade-in-delay px-4">
            A community of impact-driven CEOs, financiers, and executives committed to Israel and Jewish communities. 
            Building meaningful relationships between outstanding business leaders worldwide.
          </p>
          
          <div className="flex justify-center slide-up px-4">
            {user ? (
              // If user is logged in but pending, don't show events button
              isPending ? (
                <Link
                  to="/pending"
                  className="bg-yellow-600 text-white px-4 sm:px-6 md:px-8 py-3 sm:py-4 rounded-full hover:bg-yellow-700 transition-all duration-300 font-semibold text-sm sm:text-base md:text-lg flex items-center space-x-2 hover-lift w-full sm:w-auto max-w-xs sm:max-w-none justify-center"
                >
                  <span className="hidden sm:inline">Check Application Status</span>
                  <span className="sm:hidden">Check Status</span>
                  <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
                </Link>
              ) : (
                <Link
                  to="/events"
                  className="bg-red-700 text-white px-4 sm:px-6 md:px-8 py-3 sm:py-4 rounded-full hover:bg-red-800 transition-all duration-300 font-semibold text-sm sm:text-base md:text-lg flex items-center space-x-2 hover-lift w-full sm:w-auto max-w-xs sm:max-w-none justify-center"
                >
                  <span>View Network Events</span>
                  <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
                </Link>
              )
            ) : (
              <Link
                to="/signup"
                className="bg-red-700 text-white px-4 sm:px-6 md:px-8 py-3 sm:py-4 rounded-full hover:bg-red-800 transition-all duration-300 font-semibold text-sm sm:text-base md:text-lg flex items-center space-x-2 hover-lift w-full sm:w-auto max-w-xs sm:max-w-none justify-center"
              >
                <span className="hidden sm:inline">Join AlmaLinks</span>
                <span className="sm:hidden">Join Now</span>
                <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
              </Link>
            )}
          </div>
        </div>
        
        <div className="mt-12 sm:mt-16 md:mt-20 slide-up-delay">
          <div className="flex justify-center">
            <div className="w-2 h-12 sm:h-16 bg-gradient-to-b from-brand-blue-dark to-brand-blue-light rounded-full animate-pulse"></div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;