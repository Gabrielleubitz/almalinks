import React from 'react';
import { Bug, ExternalLink, MessageCircle, Lightbulb, ArrowRight } from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { HELP_URL } from '../config/help';
import logoSvg from '../assets/alma-links-logo.svg';

const HelpPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex flex-col overflow-x-hidden w-full max-w-full">
      <Header />
      {/* pt-20 clears the fixed navbar */}
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 sm:px-6 pt-[var(--content-offset-top)] sm:pt-24 pb-12 sm:pb-16">
        {/* Partnership: AlmaLinks + Igani logos */}
        <div className="flex flex-col items-center mb-10 sm:mb-12">
          <div className="flex items-center justify-center gap-4 sm:gap-6 mb-3">
            <img
              src={logoSvg}
              alt="AlmaLinks"
              className="h-10 sm:h-12 w-auto"
            />
            <span className="text-gray-300 text-xl sm:text-2xl font-light select-none" aria-hidden>
              ×
            </span>
            <a
              href="https://www.igani.co/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <img
                src="/igani-logo.png"
                alt="Igani"
                className="h-8 sm:h-10 w-auto object-contain"
                loading="lazy"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  if (target.src.endsWith('.png')) target.src = '/igani-logo-placeholder.svg';
                }}
              />
            </a>
          </div>
          <p className="text-sm text-gray-500 font-medium">
            Support delivered in partnership
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mt-4">
            Help &amp; Support
          </h1>
        </div>

        {/* Beta + appreciation copy */}
        <p className="text-center text-gray-600 text-base sm:text-lg mb-10 leading-relaxed max-w-lg mx-auto">
          AlmaLinks is currently in <strong>beta</strong>. We’re improving things every day, and we
          really appreciate every bug report and piece of feedback—it helps make the experience
          better for everyone. Thank you for being part of this.
        </p>

        {/* Primary CTA: Report a bug */}
        <section className="mb-10" aria-labelledby="report-bug-heading">
          <h2 id="report-bug-heading" className="sr-only">
            Report a bug
          </h2>
          <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-6 sm:p-8 text-center">
            <a
              href={HELP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 w-full sm:w-auto min-h-[48px] px-6 py-4 bg-gray-900 hover:bg-gray-800 text-white font-semibold text-lg rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900"
            >
              <Bug className="h-5 w-5" aria-hidden />
              Report a bug
              <ExternalLink className="h-4 w-4 opacity-80" aria-hidden />
            </a>
            <p className="mt-3 text-sm text-gray-600 max-w-md mx-auto">
              Use our help form at{' '}
              <a
                href={HELP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-900 font-medium underline hover:no-underline"
              >
                igani.co/help/almalinks
              </a>{' '}
              so it reaches the right team.
            </p>
          </div>
        </section>

        {/* How to report a bug */}
        <section className="mb-10" aria-labelledby="how-to-report-heading">
          <h2 id="how-to-report-heading" className="text-lg font-bold text-gray-900 mb-4">
            How to report a bug
          </h2>
          <ul className="bg-white rounded-2xl shadow-md border border-gray-100 p-6 sm:p-8 space-y-4 text-gray-800 text-sm sm:text-base list-none">
            {[
              { n: 1, text: <><strong>What happened?</strong> Describe what you saw or what went wrong.</> },
              { n: 2, text: <><strong>What you expected</strong> — how it should have worked.</> },
              { n: 3, text: <><strong>Steps to reproduce</strong> — what you clicked or did before it happened.</> },
              { n: 4, text: <><strong>Screenshot or short video</strong> if you can — it helps a lot.</> },
              { n: 5, text: <><strong>Device and browser</strong> (e.g. iPhone Safari, Chrome on Windows).</> },
            ].map(({ n, text }) => (
              <li key={n} className="flex gap-3">
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-gray-100 text-gray-700 flex items-center justify-center text-sm font-semibold">
                  {n}
                </span>
                <span>{text}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Quick links */}
        <section className="mb-10" aria-labelledby="quick-links-heading">
          <h2 id="quick-links-heading" className="text-lg font-bold text-gray-900 mb-4">
            More options
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <a
              href={HELP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-4 sm:p-5 bg-white rounded-xl border border-gray-100 shadow-md hover:border-gray-200 hover:shadow-lg transition-all text-gray-800 font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900"
            >
              <MessageCircle className="h-5 w-5 text-gray-600 flex-shrink-0" />
              <span>Contact support</span>
              <ArrowRight className="h-4 w-4 ml-auto text-gray-400" />
            </a>
            <a
              href={HELP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-4 sm:p-5 bg-white rounded-xl border border-gray-100 shadow-md hover:border-gray-200 hover:shadow-lg transition-all text-gray-800 font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900"
            >
              <Lightbulb className="h-5 w-5 text-gray-600 flex-shrink-0" />
              <span>Request a feature</span>
              <ArrowRight className="h-4 w-4 ml-auto text-gray-400" />
            </a>
          </div>
        </section>

        {/* Partnership credit */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3 pt-8 border-t border-gray-200">
          <span className="text-sm text-gray-500">Support in partnership with</span>
          <a
            href="https://www.igani.co/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <img
              src="/igani-logo.png"
              alt="Igani"
              className="h-5 w-auto"
              loading="lazy"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                if (target.src.endsWith('.png')) target.src = '/igani-logo-placeholder.svg';
              }}
            />
            <span className="text-sm font-medium">Igani</span>
          </a>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default HelpPage;
