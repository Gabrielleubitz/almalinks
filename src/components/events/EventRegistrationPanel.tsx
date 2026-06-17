import React from 'react';
import { CheckCircle, AlertCircle, CalendarPlus, Ticket } from 'lucide-react';
import type { EventData } from '../../services/eventService';
import type { EventRegistrationWithStatus } from '../../types/event';

const PRIMARY_BTN_BASE =
  'w-full rounded-xl font-bold text-white shadow-md transition-all focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-blue-dark/30 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2.5';

export interface EventRegistrationPanelProps {
  variant?: 'card' | 'sticky';
  ended: boolean;
  canRegister: boolean;
  registering: boolean;
  user: { uid?: string } | null | undefined;
  registration: EventRegistrationWithStatus | null;
  statusInfo: {
    canRegister: boolean;
    message: string;
    buttonText: string;
    buttonClass: string;
  };
  event: Pick<EventData, 'status'>;
  error: string | null;
  success: string | null;
  showTicket: boolean;
  onRegister: (e: React.MouseEvent<HTMLButtonElement>) => void;
  onToggleTicket: () => void;
  onSignup: () => void;
  onLogin: () => void;
  calendarUrl: string;
}

export const EventRegistrationPanel: React.FC<EventRegistrationPanelProps> = ({
  variant = 'card',
  ended,
  canRegister,
  registering,
  user,
  registration,
  statusInfo,
  event,
  error,
  success,
  showTicket,
  onRegister,
  onToggleTicket,
  onSignup,
  onLogin,
  calendarUrl,
}) => {
  const isSticky = variant === 'sticky';
  const showOpenHint =
    !isSticky && !ended && canRegister && user && !registration;

  const wrapperClass = isSticky
    ? 'p-0'
    : 'rounded-2xl border border-gray-200/80 bg-white p-4 sm:p-5 shadow-[0_8px_30px_rgba(11,43,107,0.08)] ring-1 ring-gray-100';

  const primaryBtnSize = isSticky
    ? 'min-h-[3.25rem] text-base'
    : 'min-h-[3rem] sm:min-h-[3.25rem] text-base sm:text-lg';

  const registerButton = (
    <button
      type="button"
      onClick={onRegister}
      disabled={!canRegister || registering}
      className={`${PRIMARY_BTN_BASE} ${primaryBtnSize} ${statusInfo.buttonClass} hover:shadow-lg hover:brightness-105 active:scale-[0.99]`}
    >
      {registering ? (
        <>
          <span className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          Submitting…
        </>
      ) : (
        <>
          <Ticket className="h-5 w-5 shrink-0" aria-hidden />
          {statusInfo.buttonText || 'Register for this event'}
        </>
      )}
    </button>
  );

  let body: React.ReactNode;

  if (ended && !registration) {
    body = (
      <div
        className={`w-full ${isSticky ? 'min-h-[3rem]' : 'min-h-[3rem]'} rounded-xl bg-gray-100 text-gray-600 text-sm font-semibold flex items-center justify-center border border-gray-200`}
      >
        Event ended
      </div>
    );
  } else if (!user && !ended) {
    body = (
      <div className="space-y-3">
        <button
          type="button"
          onClick={onSignup}
          className={`${PRIMARY_BTN_BASE} ${primaryBtnSize} bg-gradient-to-r from-brand-blue-dark to-brand-blue-light hover:shadow-lg`}
        >
          <Ticket className="h-5 w-5 shrink-0" aria-hidden />
          Join to register
        </button>
        {!isSticky && (
          <p className="text-center text-sm text-gray-600">
            Already a member?{' '}
            <button type="button" className="text-brand-blue-dark font-semibold hover:underline" onClick={onLogin}>
              Sign in
            </button>
          </p>
        )}
      </div>
    );
  } else if (registration?.status === 'pending' && ended) {
    body = (
      <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 text-sm text-gray-700">
        <p className="font-semibold text-gray-900">This event has ended.</p>
        <p className="mt-1">Your registration was still pending approval.</p>
      </div>
    );
  } else if (registration?.status === 'pending') {
    body = (
      <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 text-sm text-amber-900">
        <p className="font-semibold">Registration pending approval</p>
        <p className="mt-1 text-amber-800">We&apos;ll email details once confirmed.</p>
      </div>
    );
  } else if (registration?.status === 'rejected' && ended) {
    body = (
      <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 text-sm text-gray-700">
        <p className="font-semibold text-gray-900">This event has ended.</p>
        <p className="mt-1">Your registration was not approved.</p>
        {registration.rejectionReason ? <p className="mt-1 text-gray-600">{registration.rejectionReason}</p> : null}
      </div>
    );
  } else if (registration?.status === 'rejected') {
    body = (
      <div className="p-4 bg-red-50 rounded-xl border border-red-200 text-sm">
        <p className="font-semibold text-red-900">Registration not approved</p>
        {registration.rejectionReason && <p className="mt-1 text-red-800">{registration.rejectionReason}</p>}
      </div>
    );
  } else if (registration?.status === 'approved' && ended) {
    body = (
      <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 text-sm text-gray-700">
        <p className="font-semibold text-gray-900">This event has ended.</p>
        <p className="mt-1">You were registered for this event.</p>
        {event.status === 'completed' && registration.checkedIn ? (
          <p className="mt-2 text-gray-600">Share feedback in the reviews section below.</p>
        ) : null}
      </div>
    );
  } else if (registration?.status === 'approved') {
    body = (
      <div className="space-y-3">
        <div className="flex items-center gap-2 p-3.5 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-900 font-semibold text-sm">
          <CheckCircle className="h-5 w-5 shrink-0" />
          You&apos;re registered
        </div>
        {!isSticky && (
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={onToggleTicket}
              className="w-full min-h-[2.75rem] rounded-xl border border-gray-300 text-gray-900 font-semibold text-sm hover:bg-gray-50"
            >
              {showTicket ? 'Hide ticket' : 'View ticket'}
            </button>
            <a
              href={calendarUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full min-h-[2.75rem] inline-flex items-center justify-center gap-2 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800"
            >
              <CalendarPlus className="h-4 w-4" />
              Add to calendar
            </a>
          </div>
        )}
      </div>
    );
  } else if (ended) {
    body = (
      <div className="w-full min-h-[3rem] rounded-xl bg-gray-100 text-gray-600 text-sm font-semibold flex items-center justify-center border border-gray-200">
        Event ended
      </div>
    );
  } else {
    body = registerButton;
  }

  if (isSticky) {
    return <div className={wrapperClass}>{body}</div>;
  }

  return (
    <div id="event-register" className={wrapperClass}>
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">Registration</p>
      {showOpenHint ? (
        <p className="text-sm text-gray-700 mb-3 leading-snug">
          Secure your spot — members only. Approval may be required.
        </p>
      ) : null}
      {!isSticky && error ? (
        <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-xl flex gap-2 text-sm text-red-800">
          <AlertCircle className="h-5 w-5 shrink-0" />
          {error}
        </div>
      ) : null}
      {!isSticky && success ? (
        <div className="mb-3 p-3 bg-green-50 border border-green-200 rounded-xl flex gap-2 text-sm text-green-800">
          <CheckCircle className="h-5 w-5 shrink-0" />
          {success}
        </div>
      ) : null}
      {body}
      {!isSticky && !canRegister && user && !ended && registration?.status !== 'approved' ? (
        <p className="text-sm text-gray-600 mt-3">{statusInfo.message}</p>
      ) : null}
    </div>
  );
};
