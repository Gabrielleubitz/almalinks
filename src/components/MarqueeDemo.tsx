import React from 'react';
import Marquee from './ui/marquee';
import { marqueeImages } from '../config/marqueeImages';

const MarqueeDemo: React.FC = () => {
  return (
    <section className="relative py-20 sm:py-24 bg-white overflow-hidden">
      {/* Subtle background accent */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-blue-50/20 to-transparent"></div>
      
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12 sm:mb-16">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900 mb-4 slide-up" style={{ fontFamily: "'Playfair Display', serif" }}>
            Backed by <span className="bg-gradient-to-r from-blue-700 to-red-700 bg-clip-text text-transparent">Bold Founders</span>
          </h2>
          <p className="mt-2 text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto slide-up-delay" style={{ fontFamily: "'Lora', serif" }}>
            Members of AlmaLinks are building the future—from AI to blockchain. We connect outstanding leaders across industries.
          </p>
        </div>

        <div className="relative">
          <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-white to-transparent z-10"></div>
          <div className="absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-white to-transparent z-10"></div>
          
          <Marquee className="py-6" pauseOnHover>
            {marqueeImages.map((image, index) => (
              <a 
                key={index}
                href={image.url}
                target="_blank"
                rel="noopener noreferrer"
                className="transition-opacity hover:opacity-80 focus:opacity-80"
                title={`Visit ${image.alt}`}
              >
                <img
                  src={image.src}
                  alt={image.alt}
                  className="h-[40px] object-contain mx-[4rem] w-auto max-w-[160px]"
                />
              </a>
            ))}
          </Marquee>
        </div>
      </div>
    </section>
  );
};

export default MarqueeDemo;