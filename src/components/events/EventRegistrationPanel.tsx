import React from 'react';
import { CheckCircle, AlertCircle, CalendarPlus, Ticket } from 'lucide-react';
import type { EventData } from '../../services/eventService';
import type { EventRegistrationWithStatus } from '../../types/event';

const PRIMARY_BTN =
  'w-full min-h-[4.25rem] sm:min-h-[4.75rem] rounded-2xl text-xl sm:text-2xl font-extrabold tracking-tight text-white shadow-xl transition-all focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-blue-dark/40 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3';

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
    : 'mt-4 rounded-2xl border-2 border-red-200/70 bg-gradient-to-br from-white via-red-50/50 to-sky-50/40 p-4 sm:p-6 shadow-lg ring-1 ring-gray-200/60';

  const registerButton = (
    <button
      type="button"
      onClick={onRegister}
      disabled={!canRegister || registering}
      className={`${PRIMARY_BTN} ${statusInfo.buttonClass} hover:shadow-2xl hover:brightness-105 active:scale-[0.99]`}
    >
      {registering ? (
        <>
          <span className="h-6 w-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
          Submitting…
        </>
      ) : (
        <>
          <Ticket className="h-7 w-7 sm:h-8 sm:w-8 shrink-0" aria-hidden />
          Register for this event
        </>
      )}
    </button>
  );

  let body: React.ReactNode;

  if (ended && !registration) {
    body = (
      <div
        className={`w-full ${isSticky ? 'min-h-[3.25rem]' : 'min-h-[52px]'} rounded-2xl bg-gray-100 text-gray-600 text-lg font-bold flex items-center justify-center border border-gray-200`}
      >
        Event Ended
      </div>
    );
  } else if (!user && !ended) {
    body = (
      <div className="space-y-3">
        <button
          type="button"
          onClick={onSignup}
          className={`${PRIMARY_BTN} bg-gray-900 hover:bg-gray-800 hover:shadow-2xl`}
        >
          <Ticket className="h-7 w-7 shrink-0" aria-hidden />
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
        <p className="font-semibold">Registration pending approval.</p>
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
        <p className="font-semibold text-red-900">Registration not approved.</p>
        {registration.rejectionReason && <p className="mt-1 text-red-800">{registration.rejectionReason}</p>}
      </div>
    );
  } else if (registration?.status === 'approved' && ended) {
    body = (
      <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 text-sm text-gray-700">
        <p className="font-semibold text-gray-900">This event has ended.</p>
        <p className="mt-1">You were registered for this event.</p>
        {event.status === 'completed' && registration.checkedIn ? (
          <p className="mt-2 text-gray-600">You can share feedback in the reviews section below.</p>
        ) : null}
      </div>
    );
  } else if (registration?.status === 'approved') {
    body = (
      <div className="space-y-3">
        <div className="flex items-center gap-2 p-3 bg-green-50 rounded-xl border border-green-200 text-green-900 font-semibold text-sm">
          <CheckCircle className="h-5 w-5 shrink-0" />
          You&apos;re registered
        </div>
        {!isSticky && (
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={onToggleTicket}
              className="flex-1 min-h-[52px] rounded-xl border-2 border-gray-900 text-gray-900 font-semibold hover:bg-gray-50"
            >
              {showTicket ? 'Hide ticket' : 'View ticket'}
            </button>
            <a
              href={calendarUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 min-h-[52px] inline-flex items-center justify-center gap-2 rounded-xl bg-gray-900 text-white font-semibold hover:bg-gray-800"
            >
              <CalendarPlus className="h-5 w-5" />
              Add to calendar
            </a>
          </div>
        )}
      </div>
    );
  } else if (ended) {
    body = (
      <div className="w-full min-h-[52px] rounded-2xl bg-gray-100 text-gray-600 text-lg font-bold flex items-center justify-center border border-gray-200">
        Event Ended
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
      {showOpenHint ? (
        <p className="text-sm sm:text-base font-semibold text-gray-800 mb-3 text-center sm:text-left">
          Registration is open — secure your spot below.
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
        <p className="text-sm text-gray-600 mt-3 text-center sm:text-left">{statusInfo.message}</p>
      ) : null}
    </div>
  );
};
