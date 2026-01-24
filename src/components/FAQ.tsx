import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

const FAQ = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs = [
    {
      question: "What is AlmaLinks?",
      answer: "AlmaLinks is a global professional network that fosters meaningful relationships between altruistic CEOs, founders, financiers, and seasoned executives. We nurture our members' professional success and personal development by connecting them to outstanding business leaders in Israel and Jewish communities worldwide."
    },
    {
      question: "Who are AlmaLinks members?",
      answer: "Our community consists of impact-driven CEOs, founders, financiers, and seasoned executives from Jewish heritage. We maintain high standards for membership to ensure meaningful connections and valuable professional relationships across 20+ industries in 45+ cities worldwide."
    },
    {
      question: "Can I present or speak at AlmaLinks events?",
      answer: "Absolutely! We're always looking for exceptional speakers who can share valuable insights with our community. AlmaLinks is designed for genuine relationship building and strategic conversations. We welcome presentations that focus on actionable insights, intellectual generosity, and fostering our culture of curiosity. If you're interested in speaking, please contact us directly. We'll review your background and presentation topic to ensure it aligns with our community's interests."
    },
    {
      question: "Is AlmaLinks membership exclusive?",
      answer: "Yes, absolutely. We carefully curate our membership to maintain the quality and meaningful connections that make our network special. Applications are reviewed by our team, and invitations are extended based on professional background, potential contribution to the community, and alignment with our core values of intellectual generosity, mutual respect, and openness."
    },
    {
      question: "Do I need to be in tech to join?",
      answer: "While many of our members are from the tech industry, we welcome leaders from various sectors across 20+ industries. We value diverse perspectives and believe cross-industry connections often lead to the most meaningful opportunities. All members share Jewish heritage and commitment to supporting Israel and Jewish communities."
    }
  ];

  return (
    <section id="faq" className="relative py-24 sm:py-32 bg-gradient-to-b from-gray-50 to-white overflow-hidden">
      {/* Subtle background pattern */}
      <div className="absolute inset-0 opacity-[0.015]">
        <div className="absolute inset-0" style={{
          backgroundImage: `linear-gradient(45deg, #000 1px, transparent 1px), linear-gradient(-45deg, #000 1px, transparent 1px)`,
          backgroundSize: '60px 60px'
        }}></div>
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-20 sm:mb-24">
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold text-gray-900 mb-6 slide-up" style={{ fontFamily: "'Playfair Display', serif" }}>
            Frequently Asked <span className="bg-gradient-to-r from-blue-700 to-red-700 bg-clip-text text-transparent">Questions</span>
          </h2>
          <p className="text-xl sm:text-2xl text-gray-600 slide-up-delay" style={{ fontFamily: "'Lora', serif" }}>
            Everything you need to know about AlmaLinks
          </p>
        </div>

        <div className="space-y-4 sm:space-y-6">
          {faqs.map((faq, index) => (
            <div
              key={index}
              className={`group relative bg-white rounded-2xl sm:rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-500 slide-up overflow-hidden`}
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              {/* Gradient accent on hover */}
              <div className="absolute inset-0 bg-gradient-to-r from-blue-50/0 via-blue-50/0 to-red-50/0 group-hover:from-blue-50/30 group-hover:via-blue-50/20 group-hover:to-red-50/30 transition-all duration-500"></div>
              
              <button
                className="relative w-full px-6 sm:px-8 py-6 sm:py-8 text-left flex items-center justify-between focus:outline-none group"
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
              >
                <span className="text-lg sm:text-xl font-semibold text-gray-900 pr-4 group-hover:text-blue-700 transition-colors" style={{ fontFamily: "'Playfair Display', serif" }}>
                  {faq.question}
                </span>
                <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                  openIndex === index 
                    ? 'bg-gradient-to-br from-blue-600 to-red-600 text-white rotate-180' 
                    : 'bg-gray-100 text-gray-400 group-hover:bg-blue-50 group-hover:text-blue-600'
                }`}>
                  {openIndex === index ? (
                    <ChevronUp className="h-5 w-5" />
                  ) : (
                    <ChevronDown className="h-5 w-5" />
                  )}
                </div>
              </button>
              
              {openIndex === index && (
                <div className="px-6 sm:px-8 pb-6 sm:pb-8 relative">
                  <div className="h-px w-full bg-gradient-to-r from-transparent via-gray-200 to-transparent mb-6"></div>
                  <p className="text-gray-600 leading-relaxed text-base sm:text-lg" style={{ fontFamily: "'Lora', serif" }}>
                    {faq.answer}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Contact Information with refined design */}
        <div className="mt-20 sm:mt-24 text-center">
          <div className="relative bg-white rounded-3xl sm:rounded-[2.5rem] p-8 sm:p-12 border border-gray-100 shadow-xl overflow-hidden">
            {/* Decorative background */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-blue-100/20 to-red-100/20 rounded-full blur-3xl -mr-32 -mt-32"></div>
            
            <div className="relative z-10">
              <h3 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4" style={{ fontFamily: "'Playfair Display', serif" }}>
                Have More Questions?
              </h3>
              <p className="text-gray-600 mb-8 text-lg" style={{ fontFamily: "'Lora', serif" }}>
                We're here to help! Reach out to us directly for any inquiries about events, speaking opportunities, or partnerships.
              </p>
              <a 
                href="mailto:info@almalinks.org"
                className="group relative inline-flex items-center justify-center gap-3 bg-gradient-to-r from-blue-700 via-blue-600 to-red-700 text-white px-8 py-4 rounded-full hover:shadow-xl hover:shadow-blue-500/30 transition-all duration-300 font-semibold text-base sm:text-lg hover:scale-105 overflow-hidden"
              >
                <span className="relative z-10">Contact Us: info@almalinks.org</span>
                <div className="absolute inset-0 bg-gradient-to-r from-blue-800 via-blue-700 to-red-800 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default FAQ;