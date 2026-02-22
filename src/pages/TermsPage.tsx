import React from 'react';
import { Link } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { TERMS_TITLE, TERMS_SECTIONS } from '../content/termsText';

const TermsPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex flex-col">
      <Header />
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 pt-[var(--content-offset-top)] sm:pt-24 pb-12 sm:pb-16">
        <div className="mb-8">
          <Link
            to="/"
            className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
          >
            ← Back to home
          </Link>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
          {TERMS_TITLE}
        </h1>
        <p className="text-sm text-gray-500 mb-8">
          Last updated: 2025. Please read these terms carefully before using the Platform.
        </p>

        <article className="prose prose-gray max-w-none">
          {TERMS_SECTIONS.map((section, index) => (
            <section key={index} className="mb-8">
              <h2 className="text-lg font-bold text-gray-900 mb-3 mt-6 first:mt-0">
                {section.title}
              </h2>
              <div className="text-gray-700 text-sm sm:text-base leading-relaxed whitespace-pre-line">
                {section.content}
              </div>
            </section>
          ))}
        </article>

        <div className="mt-12 pt-8 border-t border-gray-200">
          <Link
            to="/"
            className="text-[var(--brand-light)] hover:underline font-medium"
          >
            ← Back to home
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default TermsPage;
