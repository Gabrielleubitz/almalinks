import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  Users,
  MessageCircle,
  UserPlus,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import logoSvg from '../assets/alma-links-logo.svg';

const capabilities = [
  {
    icon: Calendar,
    title: 'Events',
    description: 'Discover and join network events, meetups, and gatherings with fellow members.',
  },
  {
    icon: Users,
    title: 'Member Directory',
    description: 'Browse the member directory, view profiles, and find people to connect with.',
  },
  {
    icon: MessageCircle,
    title: 'Chats',
    description: 'Join group chats, start conversations, and stay in touch with the community.',
  },
  {
    icon: UserPlus,
    title: 'Connections',
    description: 'Request and manage connections with other members to grow your network.',
  },
];

const WelcomeOnboardingPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, markOnboardingComplete, checkProfileComplete, isAdmin } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleGetStarted = async () => {
    if (!user) return;
    setIsSubmitting(true);
    try {
      await markOnboardingComplete();
      if (isAdmin) {
        navigate('/admin', { replace: true });
      } else if (checkProfileComplete()) {
        navigate('/members', { replace: true });
      } else {
        navigate('/complete-profile', { replace: true });
      }
    } catch (err) {
      console.error('Failed to complete onboarding:', err);
      setIsSubmitting(false);
    }
  };

  const firstName = user?.displayName?.split(' ')[0] || user?.email?.split('@')[0] || 'there';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30 flex flex-col overflow-x-hidden w-full max-w-full">
      <header className="flex justify-center py-6 px-4">
        <img src={logoSvg} alt="AlmaLinks" className="h-8 md:h-9" />
      </header>

      <main className="flex-1 flex flex-col items-center px-4 pb-12 pt-4 max-w-3xl mx-auto w-full">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 rounded-full bg-[var(--brand-blue-dark)]/10 text-[var(--brand-blue-dark)] px-4 py-1.5 text-sm font-medium mb-4">
            <Sparkles className="h-4 w-4" aria-hidden />
            Welcome to AlmaLinks
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-[var(--text)] mb-3">
            Hi {firstName},
          </h1>
          <p className="text-base sm:text-lg text-[var(--muted)] leading-relaxed">
            Here’s what you can do on the platform. You’ll only see this once.
          </p>
        </div>

        <ul className="grid gap-4 w-full mb-10" role="list">
          {capabilities.map((item) => {
            const Icon = item.icon;
            return (
              <li
                key={item.title}
                className="flex gap-4 p-4 rounded-2xl bg-white border border-[var(--border)] shadow-sm hover:shadow-md transition-shadow duration-200"
              >
                <div
                  className="flex-shrink-0 w-12 h-12 rounded-xl bg-[var(--brand-blue-dark)]/10 flex items-center justify-center text-[var(--brand-blue-dark)]"
                  aria-hidden
                >
                  <Icon className="w-6 h-6" />
                </div>
                <div className="min-w-0 flex-1 text-left">
                  <h2 className="font-semibold text-[var(--text)] mb-0.5">
                    {item.title}
                  </h2>
                  <p className="text-sm text-[var(--muted)] leading-relaxed">
                    {item.description}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>

        <button
          type="button"
          onClick={handleGetStarted}
          disabled={isSubmitting}
          className="w-full sm:w-auto min-w-[200px] min-h-[48px] px-8 py-3 rounded-full bg-[var(--brand-blue-dark)] text-white font-semibold text-base shadow-md hover:bg-[var(--brand-mid)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-light)] focus:ring-offset-2 active:scale-[0.98] transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isSubmitting ? (
            <span className="inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              Get started
              <ArrowRight className="w-5 h-5" aria-hidden />
            </>
          )}
        </button>
      </main>
    </div>
  );
};

export default WelcomeOnboardingPage;
