import React from 'react';
import { ExternalLink } from 'lucide-react';

// Import logo assets
import timesOfIsraelLogo from '../assets/download.png';
import einPresswireLogo from '../assets/FeTzSjh8_400x400.jpg';
import benzingaLogo from '../assets/download-1.png';

const InThePress = () => {
  const pressArticles = [
    {
      id: 1,
      publication: "Times of Israel",
      logo: timesOfIsraelLogo,
      headline: "Israel's Resilience and Innovation Amidst Conflict: Alma Links's Impact",
      blurb: "Jul 7, 2024.",
      url: "https://blogs.timesofisrael.com/israels-resilience-and-innovation-amidst-conflict-wine-grinds-impact/",
    },
    {
      id: 2,
      publication: "EIN Presswire / AP News",
      logo: einPresswireLogo,
      headline: "Alma Links Brings Founders and Investors Together in Israel's Innovation Hub",
      blurb: "July 10, 2024.",
      url: "https://apnews.com/press-release/ein-presswire-newsmatics/israel-992251169fb2af3a8ab978a2462c72fb",
    },
    {
      id: 3,
      publication: "Benzinga",
      logo: benzingaLogo,
      headline: "Alma Links: Bridging Tech Startups and Investors with a Unique Networking Experience in Israel",
      blurb: "July 10, 2024.",
      url: "https://www.benzinga.com/content/39710031/alma-links-bridging-tech-startups-and-investors-with-a-unique-networking-experience-in-israel",
    },
    {
      id: 4,
      publication: "Times of Israel",
      logo: timesOfIsraelLogo,
      headline: "Alma Links: A Community Built on Authentic Connections",
      blurb: "Feb 3, 2025",
      url: "https://blogs.timesofisrael.com/alma-links-a-community-built-on-authentic-connections/",
    }
  ];

  return (
    <section className="relative py-24 sm:py-32 bg-gradient-to-b from-white via-gray-50 to-white overflow-hidden">
      {/* Background texture */}
      <div className="absolute inset-0 opacity-[0.02]">
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, #000 1px, transparent 0)`,
          backgroundSize: '30px 30px'
        }}></div>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-20 sm:mb-24">
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold text-gray-900 mb-6 slide-up" style={{ fontFamily: "'Playfair Display', serif" }}>
            Featured <span className="bg-gradient-to-r from-blue-700 to-red-700 bg-clip-text text-transparent">In the Press</span>
          </h2>
          <p className="text-xl sm:text-2xl text-gray-600 max-w-3xl mx-auto leading-relaxed slide-up-delay" style={{ fontFamily: "'Lora', serif" }}>
            See what industry leaders and top publications are saying about AlmaLinks' 
            impact on professional networking and business connections.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-2 gap-6 sm:gap-8">
          {pressArticles.map((article, index) => (
            <div
              key={article.id}
              className={`group relative bg-white rounded-2xl sm:rounded-3xl shadow-sm hover:shadow-xl transition-all duration-500 p-6 sm:p-8 border border-gray-100 hover-lift slide-up overflow-hidden`}
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              {/* Gradient overlay on hover */}
              <div className="absolute inset-0 bg-gradient-to-br from-blue-50/0 to-red-50/0 group-hover:from-blue-50/20 group-hover:to-red-50/20 transition-all duration-500"></div>
              {/* Desktop Layout: Logo left, content right */}
              <div className="hidden md:flex items-start space-x-4">
                {/* Publication Logo */}
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-gray-50 rounded-lg p-2 shadow-sm border border-gray-100 flex items-center justify-center">
                    <img
                      src={article.logo}
                      alt={`${article.publication} logo`}
                      className="max-w-full max-h-full object-contain"
                    />
                  </div>
                </div>

                {/* Article Content */}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-500 mb-2">
                    {article.publication}
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-3 leading-tight">
                    {article.headline}
                  </h3>
                  <p className="text-gray-600 mb-4 leading-relaxed">
                    {article.blurb}
                  </p>
                  <a
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center space-x-2 text-red-700 hover:text-brand-light font-semibold transition-colors duration-200 group"
                  >
                    <span>Read more</span>
                    <ExternalLink className="h-4 w-4 group-hover:translate-x-1 transition-transform duration-200" />
                  </a>
                </div>
              </div>

              {/* Mobile Layout: Logo top, content below */}
              <div className="md:hidden">
                {/* Publication Logo */}
                <div className="flex justify-center mb-4">
                  <div className="w-16 h-16 bg-gray-50 rounded-lg p-3 shadow-sm border border-gray-100 flex items-center justify-center">
                    <img
                      src={article.logo}
                      alt={`${article.publication} logo`}
                      className="max-w-full max-h-full object-contain"
                    />
                  </div>
                </div>

                {/* Article Content */}
                <div className="text-center relative z-10">
                  <div className="text-sm font-medium text-gray-500 mb-2">
                    {article.publication}
                  </div>
                  <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-3 leading-tight group-hover:text-blue-700 transition-colors" style={{ fontFamily: "'Playfair Display', serif" }}>
                    {article.headline}
                  </h3>
                  <p className="text-gray-600 mb-4 leading-relaxed" style={{ fontFamily: "'Lora', serif" }}>
                    {article.blurb}
                  </p>
                  <a
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="relative inline-flex items-center space-x-2 text-blue-700 hover:text-red-700 font-semibold transition-colors duration-300 group/link"
                  >
                    <span>Read more</span>
                    <ExternalLink className="h-4 w-4 group-hover/link:translate-x-1 transition-transform duration-300" />
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Call to Action */}
        <div className="mt-20 sm:mt-24 text-center">
          <div className="relative bg-white rounded-3xl sm:rounded-[2.5rem] shadow-xl p-8 sm:p-12 border border-gray-100 overflow-hidden">
            {/* Decorative background */}
            <div className="absolute top-0 left-0 w-64 h-64 bg-gradient-to-br from-blue-100/20 to-red-100/20 rounded-full blur-3xl -ml-32 -mt-32"></div>
            
            <div className="relative z-10">
              <h3 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4" style={{ fontFamily: "'Playfair Display', serif" }}>
                Media Inquiries
              </h3>
              <p className="text-gray-600 mb-8 text-lg" style={{ fontFamily: "'Lora', serif" }}>
                Interested in covering AlmaLinks or interviewing our community members? 
                We'd love to hear from you.
              </p>
              <a 
                href="mailto:press@almalinks.org"
                className="group relative inline-flex items-center justify-center gap-3 bg-gradient-to-r from-blue-700 via-blue-600 to-red-700 text-white px-8 py-4 rounded-full hover:shadow-xl hover:shadow-blue-500/30 transition-all duration-300 font-semibold text-base sm:text-lg hover:scale-105 overflow-hidden"
              >
                <span className="relative z-10">Contact Press Team</span>
                <div className="absolute inset-0 bg-gradient-to-r from-blue-800 via-blue-700 to-red-800 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default InThePress;