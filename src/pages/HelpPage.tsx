import React from 'react';
import { Link } from 'react-router-dom';
import { Bug, ExternalLink, MessageCircle, Lightbulb, ArrowRight } from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { HELP_URL } from '../config/help';
import logoSvg from '../assets/alma-links-logo.svg';

const HelpPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 sm:px-6 py-8 sm:py-12">
        {/* AlmaLinks branding */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <img
            src={logoSvg}
            alt="AlmaLinks"
            className="h-9 sm:h-10 w-auto"
          />
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
            Help &amp; Support
          </h1>
        </div>

        {/* Beta + appreciation copy */}
        <p className="text-center text-gray-700 text-base sm:text-lg mb-8 leading-relaxed">
          AlmaLinks is currently in <strong>beta</strong>. We’re improving things every day, and we
          really appreciate every bug report and piece of feedback—it helps make the experience
          better for everyone. Thank you for being part of this.
        </p>

        {/* Primary CTA: Report a bug */}
        <section className="mb-8" aria-labelledby="report-bug-heading">
          <h2 id="report-bug-heading" className="sr-only">
            Report a bug
          </h2>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 sm:p-8 text-center">
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
              To report a bug, please use our help form at{' '}
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
        <section className="mb-8" aria-labelledby="how-to-report-heading">
          <h2 id="how-to-report-heading" className="text-lg font-bold text-gray-900 mb-4">
            How to report a bug
          </h2>
          <ul className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 sm:p-8 space-y-3 text-gray-800 text-sm sm:text-base list-none">
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-200 text-gray-700 flex items-center justify-center text-xs font-bold">
                1
              </span>
              <span><strong>What happened?</strong> Describe what you saw or what went wrong.</span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-200 text-gray-700 flex items-center justify-center text-xs font-bold">
                2
              </span>
              <span><strong>What you expected</strong> — how it should have worked.</span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-200 text-gray-700 flex items-center justify-center text-xs font-bold">
                3
              </span>
              <span><strong>Steps to reproduce</strong> — what you clicked or did before it happened.</span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-200 text-gray-700 flex items-center justify-center text-xs font-bold">
                4
              </span>
              <span><strong>Screenshot or short video</strong> if you can — it helps a lot.</span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-200 text-gray-700 flex items-center justify-center text-xs font-bold">
                5
              </span>
              <span><strong>Device and browser</strong> (e.g. iPhone Safari, Chrome on Windows).</span>
            </li>
          </ul>
        </section>

        {/* Quick links */}
        <section className="mb-8" aria-labelledby="quick-links-heading">
          <h2 id="quick-links-heading" className="text-lg font-bold text-gray-900 mb-4">
            More options
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <a
              href={HELP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-200 shadow-sm hover:border-gray-300 hover:shadow transition-colors text-gray-800 font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900"
            >
              <MessageCircle className="h-5 w-5 text-gray-600 flex-shrink-0" />
              <span>Contact support</span>
              <ArrowRight className="h-4 w-4 ml-auto text-gray-400" />
            </a>
            <a
              href={HELP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-200 shadow-sm hover:border-gray-300 hover:shadow transition-colors text-gray-800 font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900"
            >
              <Lightbulb className="h-5 w-5 text-gray-600 flex-shrink-0" />
              <span>Request a feature</span>
              <ArrowRight className="h-4 w-4 ml-auto text-gray-400" />
            </a>
          </div>
        </section>

        {/* Powered by Igani - subtle credit */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3 pt-6 border-t border-gray-200">
          <span className="text-sm text-gray-500">Powered by</span>
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
