import React from 'react';
import { Users, Calendar, Trophy, Sparkles } from 'lucide-react';

const About = () => {
  const stats = [
    { icon: Calendar, number: '300+', label: 'Events to Date', color: 'from-blue-500 to-blue-600' },
    { icon: Users, number: '500+', label: 'Members', color: 'from-red-500 to-red-600' },
    { icon: Trophy, number: '45+', label: 'Cities Worldwide', color: 'from-blue-600 to-red-600' },
  ];

  return (
    <section id="about" className="relative py-24 sm:py-32 md:py-40 bg-white overflow-hidden">
      {/* Subtle background texture */}
      <div className="absolute inset-0 opacity-[0.02]">
        <div className="absolute top-0 left-0 w-full h-full" style={{
          backgroundImage: `radial-gradient(circle at 2px 2px, #000 1px, transparent 0)`,
          backgroundSize: '40px 40px'
        }}></div>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Asymmetric header layout */}
        <div className="mb-20 sm:mb-24">
          <div className="grid md:grid-cols-12 gap-8 items-start">
            {/* Left column - smaller, offset */}
            <div className="md:col-span-4 md:pt-8">
              <div className="inline-flex items-center gap-2 px-4 py-2 mb-6 rounded-full bg-blue-50 border border-blue-100 slide-up">
                <Sparkles className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-700">Our Mission</span>
              </div>
            </div>
            
            {/* Right column - main content */}
            <div className="md:col-span-8">
              <h2 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-gray-900 mb-6 slide-up" style={{ fontFamily: "'Playfair Display', serif" }}>
                What is <span className="bg-gradient-to-r from-blue-700 to-red-700 bg-clip-text text-transparent">AlmaLinks</span>?
              </h2>
              <p className="text-xl sm:text-2xl text-gray-600 max-w-3xl leading-relaxed slide-up-delay" style={{ fontFamily: "'Lora', serif" }}>
                AlmaLinks is a global professional network that fosters meaningful relationships between 
                altruistic CEOs, founders, financiers, and seasoned executives. We nurture our members' 
                professional success and personal development by connecting them to each other — outstanding 
                business leaders in Israel and the Jewish communities worldwide.
              </p>
            </div>
          </div>
        </div>

        {/* Stats with sophisticated card design */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8 mb-20 sm:mb-24">
          {stats.map((stat, index) => {
            const IconComponent = stat.icon;
            return (
              <div
                key={index}
                className="group relative slide-up hover-lift"
                style={{ animationDelay: `${index * 0.15}s` }}
              >
                {/* Card with gradient border effect */}
                <div className="relative bg-white rounded-3xl p-8 sm:p-10 border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-500 overflow-hidden">
                  {/* Gradient overlay on hover */}
                  <div className={`absolute inset-0 bg-gradient-to-br ${stat.color} opacity-0 group-hover:opacity-5 transition-opacity duration-500`}></div>
                  
                  {/* Icon with gradient background */}
                  <div className={`relative inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br ${stat.color} rounded-2xl mb-6 shadow-lg group-hover:scale-110 transition-transform duration-500`}>
                    <IconComponent className="h-8 w-8 sm:h-10 sm:w-10 text-white" />
                  </div>
                  
                  {/* Number with distinctive typography */}
                  <div className="text-5xl sm:text-6xl font-bold text-gray-900 mb-3" style={{ fontFamily: "'Playfair Display', serif" }}>
                    {stat.number}
                  </div>
                  
                  {/* Label */}
                  <div className="text-base sm:text-lg text-gray-600 font-medium" style={{ fontFamily: "'Lora', serif" }}>
                    {stat.label}
                  </div>
                  
                  {/* Decorative corner accent */}
                  <div className={`absolute top-0 right-0 w-20 h-20 bg-gradient-to-br ${stat.color} opacity-5 rounded-bl-full`}></div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Quote section with editorial design */}
        <div className="relative slide-up">
          <div className="relative bg-gradient-to-br from-slate-50 via-blue-50/50 to-red-50/30 rounded-3xl sm:rounded-[2.5rem] p-8 sm:p-12 md:p-16 border border-gray-100/50 shadow-xl overflow-hidden">
            {/* Decorative quote mark */}
            <div className="absolute top-8 left-8 sm:top-12 sm:left-12 text-blue-200/40" style={{ fontFamily: "'Playfair Display', serif", fontSize: '8rem', lineHeight: '1', transform: 'rotate(180deg)' }}>
              "
            </div>
            
            <div className="relative max-w-4xl mx-auto">
              <p className="text-xl sm:text-2xl md:text-3xl text-gray-800 leading-relaxed italic text-center" style={{ fontFamily: "'Lora', serif" }}>
                "AlmaLinks embodies our core values of intellectual generosity, a culture of curiosity, 
                mutual respect, and openness. We build genuine connections without expectations, fostering 
                an environment where every member seeks to learn and share. While all members are of Jewish 
                heritage, AlmaLinks is not religiously or politically affiliated."
              </p>
              
              {/* Attribution */}
              <div className="mt-8 text-center">
                <div className="inline-block h-px w-24 bg-gradient-to-r from-transparent via-gray-300 to-transparent mb-4"></div>
                <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">AlmaLinks Values</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default About;