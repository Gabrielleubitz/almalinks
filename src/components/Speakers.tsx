import React, { useState, useEffect } from 'react';
import { Quote } from 'lucide-react';

const Speakers = () => {
  const [currentQuote, setCurrentQuote] = useState(0);

  const testimonials = [
    {
      quote: "AlmaLinks creates the perfect balance of meaningful networking and genuine business conversations. The events I attended were filled with high-level connections, great energy, and a real openness to share ideas. It's rare to find a professional community like this where business growth happens so naturally.",
      author: "Mati Greenspan",
      title: "Managing Partner, TechVentures",
      company: "Leading VC Firm"
    },
    {
      quote: "I had the pleasure of presenting SleepAI at a recent AlmaLinks event. It was a fantastic experience — well-organized, great energy, and full of valuable networking. I connected with several professionals who are already becoming meaningful contacts. Grateful to the AlmaLinks team for building such a supportive platform for business leaders.",
      author: "Shirel Attia",
      title: "Co-Founder & CEO",
      company: "SleepAI"
    },
    {
      quote: "AlmaLinks has become the must-attend network for anyone serious about the future of technology and business. The connections made here are invaluable.",
      author: "Dr. Emily Watson",
      title: "Chief Innovation Officer",
      company: "Fortune 500 Tech Company"
    }
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentQuote((prev) => (prev + 1) % testimonials.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  return (
    <section id="speakers" className="py-24 pb-40 bg-gradient-to-br from-gray-900 to-black text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-6 slide-up">
            These are just a few of the{' '}
            <span className="gradient-text">bold thinkers</span>{' '}
            who bring AlmaLinks to life.
          </h2>
        </div>

        <div className="max-w-4xl mx-auto">
          {/* Increased min-height and added extra bottom padding to ensure content doesn't overlap with floating elements */}
          <div className="relative min-h-[400px] md:min-h-[350px] flex items-center justify-center">
            {testimonials.map((testimonial, index) => (
              <div
                key={index}
                className={`absolute inset-0 transition-all duration-1000 ${
                  index === currentQuote 
                    ? 'opacity-100 transform translate-x-0' 
                    : 'opacity-0 transform translate-x-8'
                }`}
              >
                <div className="text-center p-4 md:p-8">
                  <Quote className="h-12 w-12 text-red-400 mx-auto mb-6" />
                  <blockquote className="text-xl md:text-2xl font-light leading-relaxed mb-8 text-gray-100 max-w-3xl mx-auto">
                    "{testimonial.quote}"
                  </blockquote>
                  <div className="mt-8">
                    <div className="font-semibold text-xl text-white">{testimonial.author}</div>
                    <div className="text-red-400 font-medium">{testimonial.title}</div>
                    <div className="text-gray-400">{testimonial.company}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Added more space above the navigation dots and moved them higher */}
          <div className="flex justify-center space-x-2 mt-8">
            {testimonials.map((_, index) => (
              <button
                key={index}
                className={`h-3 w-3 rounded-full transition-all duration-300 ${
                  index === currentQuote ? 'bg-red-500' : 'bg-gray-600'
                }`}
                onClick={() => setCurrentQuote(index)}
                aria-label={`View testimonial ${index + 1}`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default Speakers;