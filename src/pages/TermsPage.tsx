import React, { useEffect } from 'react';
import BackButton from '../components/ui/BackButton';
import Header from '../components/Header';
import Footer from '../components/Footer';
import {
  TERMS_TITLE,
  TERMS_SECTIONS,
  PRIVACY_TITLE,
  PRIVACY_SECTIONS,
} from '../content/termsText';

const LegalSection: React.FC<{
  id: string;
  title: string;
  lastUpdatedNote: string;
  sections: { title: string; content: string }[];
}> = ({ id, title, lastUpdatedNote, sections }) => (
  <section id={id} className="scroll-mt-24">
    <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-1">{title}</h2>
    <p className="text-sm text-gray-500 mb-6">{lastUpdatedNote}</p>
    <div className="space-y-6">
      {sections.map((section, index) => (
        <div
          key={index}
          className="bg-white rounded-lg border border-gray-200 p-4 sm:p-5 shadow-sm"
        >
          <h3 className="text-base font-semibold text-gray-900 mb-2 sm:mb-3">
            {section.title}
          </h3>
          <div className="text-gray-700 text-sm sm:text-base leading-relaxed whitespace-pre-line">
            {section.content}
          </div>
        </div>
      ))}
    </div>
  </section>
);

const TermsPage: React.FC = () => {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col overflow-x-hidden w-full max-w-full">
      <Header />
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 pt-[var(--content-offset-top)] sm:pt-24 pb-12 sm:pb-16">
        <div className="mb-6">
          <BackButton
            fallbackTo="/"
            className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
          />
        </div>

        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
          Terms and Conditions & Privacy Policy
        </h1>
        <p className="text-sm text-gray-500 mb-6">
          Last updated: 2025. Please read both documents before using the Platform.
        </p>

        <nav className="flex flex-wrap gap-3 mb-10">
          <a
            href="#terms"
            className="px-4 py-2 rounded-lg bg-white border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 hover:border-gray-300 transition-colors"
          >
            Terms and Conditions
          </a>
          <a
            href="#privacy"
            className="px-4 py-2 rounded-lg bg-white border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 hover:border-gray-300 transition-colors"
          >
            Privacy Policy
          </a>
        </nav>

        <LegalSection
          id="terms"
          title={TERMS_TITLE}
          lastUpdatedNote="Please read these terms carefully before using the Platform."
          sections={TERMS_SECTIONS}
        />

        <div className="mt-12 pt-8">
          <LegalSection
            id="privacy"
            title={PRIVACY_TITLE}
            lastUpdatedNote="This policy describes how we collect, use, and protect your information."
            sections={PRIVACY_SECTIONS}
          />
        </div>

        <div className="mt-12 pt-8 border-t border-gray-200">
          <BackButton
            fallbackTo="/"
            className="text-brand-blue hover:text-brand-blue-hover font-medium text-sm"
          />
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default TermsPage;
