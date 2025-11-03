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
    <section className="py-24 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6 slide-up">
            Featured <span className="gradient-text">In the Press</span>
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed slide-up-delay">
            See what industry leaders and top publications are saying about AlmaLinks' 
            impact on professional networking and business connections.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-2 gap-8">
          {pressArticles.map((article, index) => (
            <div
              key={article.id}
              className={`bg-white rounded-2xl shadow-sm hover:shadow-lg transition-all duration-300 p-6 border border-gray-100 hover-lift slide-up`}
              style={{ animationDelay: `${index * 0.1}s` }}
            >
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
                <div className="text-center">
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
            </div>
          ))}
        </div>

        {/* Call to Action */}
        <div className="mt-16 text-center">
          <div className="bg-white rounded-2xl shadow-sm p-8 border border-gray-100">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">
              Media Inquiries
            </h3>
            <p className="text-gray-600 mb-6">
              Interested in covering AlmaLinks or interviewing our community members? 
              We'd love to hear from you.
            </p>
            <a 
              href="mailto:press@almalinks.org"
              className="inline-flex items-center justify-center bg-gradient-to-r from-brand-blue-dark to-brand-blue-light text-white px-8 py-3 rounded-full hover:shadow-lg transition-all duration-300 font-semibold"
            >
              Contact Press Team
            </a>
          </div>
        </div>
      </div>
    </section>
  );
};

export default InThePress;