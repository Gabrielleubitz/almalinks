import React from 'react';
import { Users, Calendar, Trophy } from 'lucide-react';

const About = () => {
  const stats = [
    { icon: Calendar, number: '300+', label: 'Events to Date' },
    { icon: Users, number: '500+', label: 'Members' },
    { icon: Trophy, number: '45+', label: 'Cities Worldwide' },
  ];

  return (
    <section id="about" className="py-16 sm:py-20 md:py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12 sm:mb-16">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900 mb-4 sm:mb-6 slide-up px-2">
            What is <span className="gradient-text">AlmaLinks</span>?
          </h2>
          <p className="text-lg sm:text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed slide-up-delay px-4">
            AlmaLinks is a global professional network that fosters meaningful relationships between 
            altruistic CEOs, founders, financiers, and seasoned executives. We nurture our members' 
            professional success and personal development by connecting them to each other — outstanding 
            business leaders in Israel and the Jewish communities worldwide.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 sm:gap-8 mb-12 sm:mb-16">
          {stats.map((stat, index) => {
            const IconComponent = stat.icon;
            return (
              <div
                key={index}
                className={`text-center slide-up hover-lift bg-gray-50 p-6 sm:p-8 rounded-2xl`}
                style={{ animationDelay: `${index * 0.2}s` }}
              >
                <div className="inline-flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-brand-blue-dark to-brand-blue-light rounded-full mb-3 sm:mb-4">
                  <IconComponent className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
                </div>
                <div className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">{stat.number}</div>
                <div className="text-sm sm:text-base text-gray-600 font-medium">{stat.label}</div>
              </div>
            );
          })}
        </div>

        {/* Quote section - using Brygada 1918 for quotes as per brand guidelines */}
        <div className="bg-gradient-to-r from-red-50 to-blue-50 rounded-2xl sm:rounded-3xl p-6 sm:p-8 md:p-12 slide-up">
          <div className="max-w-4xl mx-auto text-center">
            <p className="text-base sm:text-lg md:text-xl text-gray-700 leading-relaxed italic" style={{ fontFamily: "'Brygada 1918', serif" }}>
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