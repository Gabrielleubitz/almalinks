import React from 'react';
import { Users, Calendar, Trophy } from 'lucide-react';

const About = () => {
  const stats = [
    { icon: Calendar, number: '300+', label: 'Events to Date' },
    { icon: Users, number: '500+', label: 'Members' },
    { icon: Trophy, number: '45+', label: 'Cities Worldwide' },
  ];

  return (
    <section id="about" className="py-12 sm:py-16 md:py-20 lg:py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8 sm:mb-12 md:mb-16">
          <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 mb-3 sm:mb-4 md:mb-6 slide-up px-2">
            What is <span className="gradient-text">AlmaLinks</span>?
          </h2>
          <p className="text-sm sm:text-base md:text-lg lg:text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed slide-up-delay px-2 sm:px-4">
            AlmaLinks is a global professional network that fosters meaningful relationships between 
            altruistic CEOs, founders, financiers, and seasoned executives. We nurture our members' 
            professional success and personal development by connecting them to each other — outstanding 
            business leaders in Israel and the Jewish communities worldwide.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 md:gap-8 mb-8 sm:mb-12 md:mb-16">
          {stats.map((stat, index) => {
            const IconComponent = stat.icon;
            return (
              <div
                key={index}
                className={`text-center slide-up hover-lift bg-gray-50 p-4 sm:p-6 md:p-8 rounded-xl sm:rounded-2xl`}
                style={{ animationDelay: `${index * 0.2}s` }}
              >
                <div className="inline-flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 md:w-16 md:h-16 bg-gradient-to-br from-brand-blue-dark to-brand-blue-light rounded-full mb-2 sm:mb-3 md:mb-4">
                  <IconComponent className="h-5 w-5 sm:h-6 sm:w-6 md:h-8 md:w-8 text-white" />
                </div>
                <div className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-1 sm:mb-2">{stat.number}</div>
                <div className="text-xs sm:text-sm md:text-base text-gray-600 font-medium">{stat.label}</div>
              </div>
            );
          })}
        </div>

        {/* Quote section - using Brygada 1918 for quotes as per brand guidelines */}
        <div className="bg-gradient-to-r from-red-50 to-blue-50 rounded-xl sm:rounded-2xl md:rounded-3xl p-4 sm:p-6 md:p-8 lg:p-12 slide-up">
          <div className="max-w-4xl mx-auto text-center">
            <p className="text-sm sm:text-base md:text-lg lg:text-xl text-gray-700 leading-relaxed italic" style={{ fontFamily: "'Brygada 1918', serif" }}>
              "AlmaLinks embodies our core values of intellectual generosity, a culture of curiosity, 
              mutual respect, and openness. We build genuine connections without expectations, fostering 
              an environment where every member seeks to learn and share. While all members are of Jewish 
              heritage, AlmaLinks is not religiously or politically affiliated."
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default About;