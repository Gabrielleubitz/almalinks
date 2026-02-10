/**
 * First-time user onboarding: deterministic step-based tour.
 * Steps advance ONLY on user action (Next, Back, Skip) or explicit allowAutoSkip+precondition.
 * Target resolution: retry up to 2500ms; if not found, show fallback (Try again / Skip step / Exit).
 * Progress: persisted via markOnboardingComplete(); step index in localStorage for consistency.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import logoSvg from '../../assets/alma-links-logo.svg';

const TOUR_DEBUG = typeof window !== 'undefined' && (
  window.location.search.includes('tourDebug=1') ||
  (process.env.NODE_ENV === 'development' && (window as unknown as { __TOUR_DEBUG?: boolean }).__TOUR_DEBUG)
);

const STORAGE_KEY_STEP = 'alma_onboarding_step';

type TourStatus = 'idle' | 'resolving' | 'showing' | 'error';

interface OnboardingStep {
  id: string;
  title: string;
  body: string;
  primaryLabel: string;
  primaryAction: 'next' | 'finish';
  secondaryLabel: string | null;
  targetSelector: string | null;
  route: string | null;
  /** When true, step can be auto-skipped when precondition returns true */
  allowAutoSkip?: boolean;
  /** When allowAutoSkip: when this returns true, we skip to next step (e.g. profile already complete) */
  precondition?: (user: { uid: string; [k: string]: unknown } | null) => boolean;
  /** Human-readable hint for fallback "navigate to X" */
  fallbackNavigateHint?: string;
}

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to AlmaLinks',
    body: 'AlmaLinks is where you connect with other members, discover events, and join conversations. This short tour will show you the basics.',
    primaryLabel: 'Show me around',
    primaryAction: 'next',
    secondaryLabel: 'Skip for now',
    targetSelector: null,
    route: null,
  },
  {
    id: 'profile',
    title: 'Profile & editing your info',
    body: 'Your profile and photo live here. You can edit your bio, chapter, LinkedIn, and other details anytime. Keeping your profile updated helps other members find and connect with you.',
    primaryLabel: 'Next',
    primaryAction: 'next',
    secondaryLabel: 'Skip',
    targetSelector: '[data-tour="profile"]',
    route: null,
    fallbackNavigateHint: 'Header (profile or avatar button)',
  },
  {
    id: 'members',
    title: 'Members & connections',
    body: 'This is where you can browse other members. Click a member to view their profile. From there, you can connect or send a connection request.',
    primaryLabel: 'Next',
    primaryAction: 'next',
    secondaryLabel: 'Skip',
    targetSelector: '[data-tour="members"]',
    route: null,
    fallbackNavigateHint: 'Header (Members link)',
  },
  {
    id: 'chats',
    title: 'Chats & messaging',
    body: 'Once you’re connected with someone, you can chat here. This is where your direct conversations and group chats live.',
    primaryLabel: 'Next',
    primaryAction: 'next',
    secondaryLabel: 'Skip',
    targetSelector: '[data-tour="chats"]',
    route: null,
    fallbackNavigateHint: 'Header (Chats link)',
  },
  {
    id: 'events',
    title: 'Events & registration',
    body: 'Browse upcoming events here. Click an event to see details and register or RSVP directly from the event page. This is how you join events.',
    primaryLabel: 'Next',
    primaryAction: 'next',
    secondaryLabel: 'Skip',
    targetSelector: '[data-tour="events"]',
    route: null,
    fallbackNavigateHint: 'Header (Events link)',
  },
  {
    id: 'wrapup',
    title: "You're all set",
    body: 'You can always open your Dashboard or use the menu to explore events, members, and chats.',
    primaryLabel: 'Start exploring',
    primaryAction: 'finish',
    secondaryLabel: null,
    targetSelector: null,
    route: null,
  },
];

const RESOLVE_MAX_MS = 2500;
const RESOLVE_POLL_MS = 100;

/** Igani logo from public folder; subtle credit branding on welcome and wrap-up only */
function IganiCredit() {
  return (
    <div className="pt-3 text-center flex flex-col items-center gap-2" aria-hidden>
      <span className="text-gray-400 text-xs">Powered by Igani</span>
      <img src="/igani-logo.png" alt="" className="h-12 w-12 object-contain opacity-90" />
    </div>
  );
}

function getStoredStepIndex(): number {
  try {
    const s = sessionStorage.getItem(STORAGE_KEY_STEP);
    if (s != null) {
      const n = parseInt(s, 10);
      if (Number.isFinite(n) && n >= 0 && n < ONBOARDING_STEPS.length) return n;
    }
  } catch {
    // ignore
  }
  return 0;
}

function setStoredStepIndex(index: number) {
  try {
    sessionStorage.setItem(STORAGE_KEY_STEP, String(index));
  } catch {
    // ignore
  }
}

function clearStoredStep() {
  try {
    sessionStorage.removeItem(STORAGE_KEY_STEP);
  } catch {
    // ignore
  }
}

export default function OnboardingTour() {
  const { user, markOnboardingComplete, checkProfileComplete, isPending, isRejected } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [status, setStatus] = useState<TourStatus>('idle');
  const [resolvedTargetRect, setResolvedTargetRect] = useState<DOMRect | null>(null);
  const [lastResolvedStepId, setLastResolvedStepId] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const resolveCancelRef = useRef<boolean>(false);
  const mountedRef = useRef(true);

  const step = ONBOARDING_STEPS[currentStepIndex];
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const isModalOnly = !step?.targetSelector || isMobile;
  const isLastStep = currentStepIndex === ONBOARDING_STEPS.length - 1;
  const isFirstStep = currentStepIndex === 0;

  const shouldShow = Boolean(
    user &&
    user.hasSeenOnboarding !== true &&
    !isPending &&
    !isRejected
  );

  // Expose checkProfileComplete for precondition (profile step)
  useEffect(() => {
    if (typeof checkProfileComplete !== 'function') return;
    (window as unknown as { __checkProfileComplete?: () => boolean }).__checkProfileComplete = checkProfileComplete;
    return () => {
      delete (window as unknown as { __checkProfileComplete?: () => boolean }).__checkProfileComplete;
    };
  }, [checkProfileComplete]);

  // Persist step index when it changes (so Back/Next is deterministic)
  useEffect(() => {
    if (!shouldShow) return;
    setStoredStepIndex(currentStepIndex);
  }, [shouldShow, currentStepIndex]);

  // Show overlay when tour should be visible; always start from step 0 when opening tour
  useEffect(() => {
    if (!shouldShow) {
      setVisible(false);
      return;
    }
    clearStoredStep();
    setCurrentStepIndex(0);
    const t = setTimeout(() => {
      if (mountedRef.current) setVisible(true);
    }, 150);
    return () => clearTimeout(t);
  }, [shouldShow]);

  // Explicit AutoSkip: only when step has allowAutoSkip and precondition returns true
  const tryAutoSkip = useCallback(() => {
    if (!step || !step.allowAutoSkip || typeof step.precondition !== 'function') return false;
    if (step.precondition(user)) {
      if (TOUR_DEBUG) console.log('[OnboardingTour] AutoSkip step (precondition true):', step.id);
      setCurrentStepIndex((i) => Math.min(i + 1, ONBOARDING_STEPS.length - 1));
      return true;
    }
    return false;
  }, [step, user]);

  // Navigate to step.route if needed; then run target resolution
  const resolveTarget = useCallback((stepIndex: number) => {
    const s = ONBOARDING_STEPS[stepIndex];
    if (!s) return;

    if (s.route && location.pathname !== s.route) {
      navigate(s.route, { replace: true });
    }

    if (!s.targetSelector) {
      setStatus('showing');
      setResolvedTargetRect(null);
      setLastResolvedStepId(s.id);
      return;
    }

    setStatus('resolving');
    setResolvedTargetRect(null);
    resolveCancelRef.current = false;
    const selector = s.targetSelector;
    const start = Date.now();

    const tryFind = () => {
      if (resolveCancelRef.current || !mountedRef.current) return;
      const el = document.querySelector(selector) as HTMLElement | null;
      if (el) {
        const style = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        const visible = style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
        if (visible) {
          el.scrollIntoView({ block: 'center', behavior: 'smooth' });
          const afterScroll = () => {
            if (resolveCancelRef.current || !mountedRef.current) return;
            const r = el.getBoundingClientRect();
            setResolvedTargetRect(new DOMRect(r.x, r.y, r.width, r.height));
            setLastResolvedStepId(s.id);
            setStatus('showing');
          };
          requestAnimationFrame(() => setTimeout(afterScroll, 300));
          return;
        }
      }
      if (Date.now() - start >= RESOLVE_MAX_MS) {
        if (!resolveCancelRef.current && mountedRef.current) {
          setStatus('error');
          setLastResolvedStepId(s.id);
        }
        return;
      }
      setTimeout(tryFind, RESOLVE_POLL_MS);
    };

    tryFind();
  }, [location.pathname, navigate]);

  // When step index or route changes, run resolution (no automatic index change)
  useEffect(() => {
    if (!shouldShow || !visible || !step) return;
    resolveTarget(currentStepIndex);
    return () => {
      resolveCancelRef.current = true;
    };
  }, [shouldShow, visible, currentStepIndex, step?.id, resolveTarget]);

  // After navigation, re-run resolution for current step when pathname matches step.route
  useEffect(() => {
    if (!shouldShow || !visible || !step?.route) return;
    if (location.pathname === step.route && lastResolvedStepId !== step.id) {
      resolveTarget(currentStepIndex);
    }
  }, [shouldShow, visible, step?.route, step?.id, location.pathname, lastResolvedStepId, currentStepIndex, resolveTarget]);

  // AutoSkip only when step has allowAutoSkip and precondition returns true (explicit only)
  useEffect(() => {
    if (!shouldShow || !visible) return;
    if (status !== 'idle' && status !== 'resolving') return;
    if (tryAutoSkip()) {
      // currentStepIndex advanced; resolution for new step runs from dependency
    }
  }, [shouldShow, visible, status, tryAutoSkip]);

  // Recompute rect on scroll/resize/orientation (only when showing and we have a target)
  useEffect(() => {
    if (status !== 'showing' || !step?.targetSelector || !resolvedTargetRect) return;
    const el = document.querySelector(step.targetSelector) as HTMLElement | null;
    if (!el) return;

    const updateRect = () => {
      if (!step?.targetSelector) return;
      const e = document.querySelector(step.targetSelector) as HTMLElement | null;
      if (e) setResolvedTargetRect(e.getBoundingClientRect());
    };

    window.addEventListener('scroll', updateRect, true);
    window.addEventListener('resize', updateRect);
    window.addEventListener('orientationchange', updateRect);
    return () => {
      window.removeEventListener('scroll', updateRect, true);
      window.removeEventListener('resize', updateRect);
      window.removeEventListener('orientationchange', updateRect);
    };
  }, [status, step?.targetSelector, resolvedTargetRect]);

  mountedRef.current = true;
  useEffect(() => () => { mountedRef.current = false; }, []);

  const goNext = useCallback(() => {
    if (step?.primaryAction === 'finish') {
      clearStoredStep();
      markOnboardingComplete().then(() => setVisible(false)).catch((e) => console.error('Onboarding complete failed', e));
      return;
    }
    // No forced navigation: onboarding only points and explains
    setCurrentStepIndex((i) => Math.min(i + 1, ONBOARDING_STEPS.length - 1));
  }, [step?.primaryAction, markOnboardingComplete]);

  const goBack = useCallback(() => {
    setCurrentStepIndex((i) => Math.max(i - 1, 0));
  }, []);

  const handleSkipTour = useCallback(async () => {
    clearStoredStep();
    try {
      await markOnboardingComplete();
      setVisible(false);
    } catch (e) {
      console.error('Onboarding skip failed', e);
    }
  }, [markOnboardingComplete]);

  const handleSkipThisStep = useCallback(() => {
    setStatus('idle');
    setResolvedTargetRect(null);
    setCurrentStepIndex((i) => Math.min(i + 1, ONBOARDING_STEPS.length - 1));
  }, []);

  const handleTryAgain = useCallback(() => {
    setStatus('resolving');
    setResolvedTargetRect(null);
    resolveTarget(currentStepIndex);
  }, [currentStepIndex, resolveTarget]);

  if (!shouldShow || !visible) return null;

  // Fallback UI when target not found after retries
  if (status === 'error') {
    const fallbackStep = ONBOARDING_STEPS[currentStepIndex];
    const hint = fallbackStep?.fallbackNavigateHint || 'the page where this section appears';
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="onboarding-fallback-title">
        <div className="absolute inset-0 bg-black/60" aria-hidden />
        <div className="relative z-10 w-full max-w-md rounded-2xl bg-white shadow-xl p-6 sm:p-8">
          <h2 id="onboarding-fallback-title" className="text-xl font-semibold text-gray-900 mb-2">
            Can&apos;t find this section
          </h2>
          <p className="text-gray-600 text-sm leading-relaxed mb-4">
            We can&apos;t find the section for this step. Please navigate to {hint}, then click &quot;Try again&quot;.
          </p>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={handleTryAgain}
              className="min-h-[44px] px-4 py-2.5 rounded-xl bg-[var(--brand-blue-dark)] text-white font-medium hover:opacity-95"
            >
              Try again
            </button>
            <button
              type="button"
              onClick={handleSkipThisStep}
              className="min-h-[44px] px-4 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-50"
            >
              Skip this step
            </button>
            <button
              type="button"
              onClick={handleSkipTour}
              className="min-h-[44px] px-4 py-2.5 rounded-xl border border-red-200 text-red-700 font-medium hover:bg-red-50"
            >
              Exit tour
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Always show card; when resolving with a target, show centered "Finding section…"
  const showCard = true;
  const targetRect = status === 'showing' ? resolvedTargetRect : null;
  const cardIsCentered = isModalOnly || !targetRect || status === 'resolving';

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
    >
      {cardIsCentered ? (
        <div className="absolute inset-0 bg-black/60" onClick={(e) => e.target === e.currentTarget && handleSkipTour()} aria-hidden />
      ) : (
        <SpotlightBackdrop targetRect={targetRect} onClick={handleSkipTour} />
      )}

      {showCard && (
        <div
          id="onboarding-card"
          className={
            cardIsCentered
              ? 'relative z-10 w-full max-w-md rounded-2xl bg-white shadow-xl p-6 sm:p-8'
              : 'absolute z-10 w-full max-w-sm rounded-2xl bg-white shadow-xl p-5 sm:p-6'
          }
          style={
            !cardIsCentered && targetRect
              ? (() => {
                  const W = typeof window !== 'undefined' ? window.innerWidth : 1024;
                  const H = typeof window !== 'undefined' ? window.innerHeight : 768;
                  const cardH = 220;
                  const below = targetRect.bottom + 12 + cardH <= H;
                  return {
                    left: Math.max(16, Math.min(targetRect.left, W - 336 - 16)),
                    top: below ? targetRect.bottom + 12 : Math.max(16, targetRect.top - cardH),
                  };
                })()
              : undefined
          }
        >
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <img src={logoSvg} alt="AlmaLinks" className="h-7 w-auto" />
              <span className="text-xs text-gray-400" aria-hidden>
                {currentStepIndex + 1} of {ONBOARDING_STEPS.length}
              </span>
            </div>
            {status === 'resolving' && step?.targetSelector ? (
              <p className="text-gray-500 text-sm">Finding section…</p>
            ) : (
              <>
                <h2 id="onboarding-title" className="text-xl font-semibold text-gray-900">
                  {step.title}
                </h2>
                <p className="text-gray-600 text-sm leading-relaxed">{step.body}</p>
              </>
            )}
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-2">
              {!isFirstStep && (
                <button
                  type="button"
                  onClick={goBack}
                  className="flex-1 min-h-[44px] px-4 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-50"
                >
                  Back
                </button>
              )}
              <button
                type="button"
                onClick={goNext}
                disabled={status === 'resolving'}
                className="flex-1 min-h-[44px] px-4 py-2.5 rounded-xl bg-[var(--brand-blue-dark)] text-white font-medium hover:opacity-95 disabled:opacity-70"
              >
                {step.primaryLabel}
              </button>
              {step.secondaryLabel && (
                <button
                  type="button"
                  onClick={handleSkipTour}
                  className="flex-1 min-h-[44px] px-4 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-50"
                >
                  {step.secondaryLabel}
                </button>
              )}
            </div>
            {(isFirstStep || isLastStep) && <IganiCredit />}
          </div>
        </div>
      )}

      {TOUR_DEBUG && (
        <div className="fixed bottom-4 left-4 right-4 z-[101] rounded-lg bg-black/80 text-white text-xs p-3 font-mono">
          <div>Step: {step?.id} ({currentStepIndex + 1}/{ONBOARDING_STEPS.length})</div>
          <div>Target: {step?.targetSelector ?? '—'}</div>
          <div>Status: {status}</div>
        </div>
      )}
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
