/**
 * First-time user onboarding: step-based tour with modal and spotlight.
 * Shows only when user has not completed onboarding (hasSeenOnboarding === false).
 * Progress is persisted via markOnboardingComplete() in useAuth (Firestore).
 *
 * To extend: add or edit steps in ONBOARDING_STEPS. Each step can have:
 * - targetSelector: DOM selector for spotlight (e.g. [data-onboarding="profile"])
 * - route: path to navigate to before showing (so target is in DOM)
 * - skipIf: (user) => boolean to auto-skip (e.g. profile already complete)
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import logoSvg from '../../assets/alma-links-logo.svg';

const ONBOARDING_STEPS = [
  {
    id: 'welcome',
    title: 'Welcome to AlmaLinks',
    body: 'This is where you connect with your chapter, join events, and stay in the loop.',
    primaryLabel: 'Show me around',
    primaryAction: 'next' as const,
    secondaryLabel: 'Skip for now',
    targetSelector: null,
    route: null,
  },
  {
    id: 'profile',
    title: 'Your profile',
    body: 'Complete your profile so other members can find you and you can get the most from chapter events and matching.',
    primaryLabel: 'Complete your profile',
    primaryAction: 'next' as const,
    secondaryLabel: 'Skip',
    targetSelector: '[data-onboarding="profile"]',
    route: '/dashboard',
  },
  {
    id: 'chapters',
    title: 'Chapters',
    body: 'Members belong to one of our global chapters. Your chapter unlocks local events, people near you, and relevant updates.',
    primaryLabel: 'Next',
    primaryAction: 'next' as const,
    secondaryLabel: 'Skip',
    targetSelector: '[data-onboarding="chapter"]',
    route: '/dashboard',
  },
  {
    id: 'events',
    title: 'Events',
    body: 'Browse and RSVP to events, get reminders, and follow up with attendees.',
    primaryLabel: 'View upcoming events',
    primaryAction: 'next' as const,
    secondaryLabel: 'Skip',
    targetSelector: '[data-onboarding="events"]',
    route: null,
  },
  {
    id: 'community',
    title: 'Community',
    body: 'Use the Members directory and Chats to connect with others, join groups, and grow your network.',
    primaryLabel: 'Next',
    primaryAction: 'next' as const,
    secondaryLabel: 'Skip',
    targetSelector: '[data-onboarding="community"]',
    route: null,
  },
  {
    id: 'wrapup',
    title: "You're all set",
    body: 'You can always open your Dashboard or use the menu to explore events, members, and chats.',
    primaryLabel: 'Start exploring',
    primaryAction: 'finish' as const,
    secondaryLabel: null,
    targetSelector: null,
    route: null,
  },
];

const MAX_WAIT_MS = 5000;
const POLL_INTERVAL_MS = 100;

export default function OnboardingTour() {
  const { user, markOnboardingComplete, checkProfileComplete, isPending, isRejected } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [visible, setVisible] = useState(false);

  const step = ONBOARDING_STEPS[stepIndex];
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const isModalOnly = !step.targetSelector || isMobile;
  const isLastStep = stepIndex === ONBOARDING_STEPS.length - 1;

  // Show tour only for authenticated, approved users who haven't completed onboarding (not pending/rejected)
  const shouldShow = Boolean(
    user &&
    user.hasSeenOnboarding !== true &&
    !isPending &&
    !isRejected
  );

  // Optional: auto-skip profile step if profile is already complete
  useEffect(() => {
    if (!shouldShow || step?.id !== 'profile') return;
    if (checkProfileComplete?.()) {
      setStepIndex((i) => Math.min(i + 1, ONBOARDING_STEPS.length - 1));
    }
  }, [shouldShow, step?.id, checkProfileComplete]);

  // Navigate to step route when needed
  useEffect(() => {
    if (!shouldShow || !step?.route) return;
    if (location.pathname !== step.route) {
      navigate(step.route, { replace: true });
    }
  }, [shouldShow, step?.route, location.pathname, navigate]);

  // Wait for target element and measure it for spotlight
  useEffect(() => {
    if (!shouldShow || !step?.targetSelector) {
      setTargetRect(null);
      return;
    }
    let cancelled = false;
    const start = Date.now();
    const tick = () => {
      if (cancelled || Date.now() - start > MAX_WAIT_MS) {
        setTargetRect(null);
        return;
      }
      const el = document.querySelector(step!.targetSelector!);
      if (el) {
        setTargetRect(el.getBoundingClientRect());
        return;
      }
      setTimeout(tick, POLL_INTERVAL_MS);
    };
    tick();
    return () => {
      cancelled = true;
    };
  }, [shouldShow, step?.targetSelector, stepIndex]);

  // Show overlay after a brief delay so layout is stable
  useEffect(() => {
    if (!shouldShow) {
      setVisible(false);
      return;
    }
    const t = setTimeout(() => setVisible(true), 150);
    return () => clearTimeout(t);
  }, [shouldShow]);

  const handleSkip = useCallback(async () => {
    if (!user?.uid) return;
    try {
      await markOnboardingComplete();
      setVisible(false);
    } catch (e) {
      console.error('Onboarding skip failed', e);
    }
  }, [user?.uid, markOnboardingComplete]);

  const handlePrimary = useCallback(async () => {
    if (step.primaryAction === 'finish') {
      try {
        await markOnboardingComplete();
        setVisible(false);
      } catch (e) {
        console.error('Onboarding complete failed', e);
      }
      return;
    }
    if (step.primaryLabel === 'View upcoming events') {
      navigate('/events');
    }
    if (step.primaryLabel === 'Complete your profile') {
      navigate('/complete-profile');
    }
    setStepIndex((i) => Math.min(i + 1, ONBOARDING_STEPS.length - 1));
  }, [step.primaryAction, step.primaryLabel, markOnboardingComplete, navigate]);

  if (!shouldShow || !visible) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
    >
      {/* Backdrop: dimmed for modal-only steps; for spotlight steps we draw a hole */}
      {isModalOnly ? (
        <div
          className="absolute inset-0 bg-black/60"
          onClick={(e) => e.target === e.currentTarget && handleSkip()}
          aria-hidden
        />
      ) : (
        <SpotlightBackdrop targetRect={targetRect} onClick={handleSkip} />
      )}

      {/* Card: modal (centered) or tooltip (near target); when spotlight but no target yet, center the card */}
      <div
        id="onboarding-card"
        className={
          isModalOnly || !targetRect
            ? 'relative z-10 w-full max-w-md rounded-2xl bg-white shadow-xl p-6 sm:p-8'
            : 'absolute z-10 w-full max-w-sm rounded-2xl bg-white shadow-xl p-5 sm:p-6'
        }
        style={
          !isModalOnly && targetRect
            ? {
                left: Math.max(16, Math.min(targetRect.left, typeof window !== 'undefined' ? window.innerWidth - 336 - 16 : 400)),
                top:
                  targetRect.bottom + 12 + 200 <= (typeof window !== 'undefined' ? window.innerHeight : 768)
                    ? targetRect.bottom + 12
                    : Math.max(16, targetRect.top - 220),
              }
            : undefined
        }
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <img src={logoSvg} alt="AlmaLinks" className="h-7 w-auto" />
            <span className="text-xs text-gray-400" aria-hidden>
              {stepIndex + 1} of {ONBOARDING_STEPS.length}
            </span>
          </div>
          <h2 id="onboarding-title" className="text-xl font-semibold text-gray-900">
            {step.title}
          </h2>
          <p className="text-gray-600 text-sm leading-relaxed">{step.body}</p>
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-2">
            <button
              type="button"
              onClick={handlePrimary}
              className="flex-1 min-h-[44px] px-4 py-2.5 rounded-xl bg-[var(--brand-blue-dark)] text-white font-medium hover:bg-[var(--brand-mid)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-light)] focus:ring-offset-2"
            >
              {step.primaryLabel}
            </button>
            {step.secondaryLabel && (
              <button
                type="button"
                onClick={handleSkip}
                className="flex-1 min-h-[44px] px-4 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2"
              >
                {step.secondaryLabel}
              </button>
            )}
          </div>
          {isLastStep && (
            <p className="text-gray-400 text-xs pt-2 text-center" aria-hidden>
              Powered by Igani
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function SpotlightBackdrop({
  targetRect,
  onClick,
}: {
  targetRect: DOMRect | null;
  onClick: () => void;
}) {
  if (!targetRect) {
    return <div className="absolute inset-0 bg-black/60" onClick={onClick} aria-hidden />;
  }
  const pad = 8;
  const t = Math.max(0, targetRect.top - pad);
  const l = Math.max(0, targetRect.left - pad);
  const w = targetRect.width + pad * 2;
  const h = targetRect.height + pad * 2;
  const W = typeof window !== 'undefined' ? window.innerWidth : 1024;
  const H = typeof window !== 'undefined' ? window.innerHeight : 768;
  return (
    <div className="absolute inset-0" onClick={onClick} aria-hidden>
      <div className="absolute left-0 right-0 top-0 bg-black/60" style={{ height: t }} />
      <div className="absolute left-0 right-0 bg-black/60" style={{ top: t + h, height: H - t - h }} />
      <div className="absolute bg-black/60" style={{ top: t, left: 0, width: l, height: h }} />
      <div className="absolute bg-black/60" style={{ top: t, left: l + w, width: W - l - w, height: h }} />
    </div>
  );
}
