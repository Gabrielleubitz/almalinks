import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronUp, Calendar, MapPin, User, Mail, Phone, Briefcase, X, ExternalLink } from 'lucide-react';
import logoSvg from '../../assets/alma-links-logo.svg';

export interface EventTicketCardProps {
  eventName: string;
  eventDate: string;
  eventTime: string;
  eventLocation: string;
  attendeeName: string;
  attendeeEmail: string;
  attendeePhone?: string;
  attendeeWork?: string;
  ticketId?: string;
  isExpired?: boolean;
  /** Event image shown on the ticket card (before expand) */
  eventImageUrl?: string;
  /** Slug for linking to event page: /events/:eventSlug */
  eventSlug?: string;
  /** Registration status for approval workflow badge */
  registrationStatus?: 'pending' | 'approved' | 'rejected' | 'cancelled';
  className?: string;
}

/**
 * Minimal event ticket card that matches site UI. Shows logo, event name, and date.
 * On click, content "comes out of the card" (expandable panel below) with full event + attendee details.
 */
const EventTicketCard: React.FC<EventTicketCardProps> = ({
  eventName,
  eventDate,
  eventTime,
  eventLocation,
  attendeeName,
  attendeeEmail,
  attendeePhone = '',
  attendeeWork = '',
  ticketId = 'TICKET',
  isExpired = false,
  eventImageUrl,
  eventSlug,
  registrationStatus,
  className = '',
}) => {
  const [expanded, setExpanded] = useState(false);
  const statusBadge = registrationStatus === 'pending'
    ? { label: 'Pending approval', class: 'bg-amber-100 text-amber-800' }
    : registrationStatus === 'approved'
      ? { label: 'Approved', class: 'bg-green-100 text-green-800' }
      : registrationStatus === 'rejected'
        ? { label: 'Not approved', class: 'bg-red-100 text-red-800' }
        : null;

  const displayDate = eventDate?.trim() || '—';
  const displayTime = eventTime?.trim() || '—';
  const displayLocation = eventLocation?.trim() || '—';

  // Compact date line for minimal view: "Mon, Feb 23 · 6:59 PM"
  const dateTimeLine = [displayDate, displayTime].filter(Boolean).join(' · ') || '—';

  const eventPageUrl = eventSlug ? `/events/${eventSlug}` : null;

  return (
    <div className={`w-full max-w-[320px] ${className}`}>
      {/* Minimal card - clickable to expand */}
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
        aria-label={expanded ? 'Close ticket details' : `View ticket details for ${eventName}`}
        className={`
          relative w-full text-left bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden
          hover:border-brand-dark/20 hover:shadow-md transition-all duration-200
          focus:outline-none focus:ring-2 focus:ring-brand-blue focus:ring-offset-2
          ${isExpired ? 'opacity-80' : ''}
        `}
      >
        <div className="flex items-center gap-3 p-3 sm:p-4">
          {statusBadge && (
            <span className={`absolute top-2 right-2 text-[10px] font-medium px-2 py-0.5 rounded ${statusBadge.class}`}>
              {statusBadge.label}
            </span>
          )}
          {/* Event image (or Alma logo fallback) */}
          <div className="flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden bg-gray-100 border border-gray-100">
            {eventImageUrl ? (
              <img
                src={eventImageUrl}
                alt=""
                className="w-full h-full object-cover"
                aria-hidden
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <img src={logoSvg} alt="" className="h-6 w-auto" aria-hidden />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-gray-900 font-medium text-sm truncate" title={eventName}>
              {eventName || 'Event'}
            </p>
            <p className="text-gray-500 text-xs mt-0.5 truncate" title={dateTimeLine}>
              {dateTimeLine}
            </p>
          </div>
          <div className="flex flex-shrink-0 items-center gap-1">
            {eventPageUrl && (
              <Link
                to={eventPageUrl}
                onClick={(e) => e.stopPropagation()}
                className="p-1.5 rounded-lg text-gray-500 hover:text-brand-blue hover:bg-gray-100 transition-colors"
                title="View event page"
                aria-label="View event page"
              >
                <ExternalLink className="h-4 w-4" />
              </Link>
            )}
            <span className="text-gray-400">
              {expanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
            </span>
          </div>
        </div>
      </button>

      {/* Expandable detail - "comes out of the file" (not full screen) */}
      <div
        className={`overflow-hidden transition-[max-height,opacity] duration-300 ease-out ${expanded ? 'max-h-[480px] opacity-100' : 'max-h-0 opacity-0'}`}
      >
        <div
          className="bg-white rounded-b-xl border border-t-0 border-gray-200 shadow-lg rounded-t-none"
          style={{ boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)' }}
        >
          {/* Header strip with logo + event name */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-gray-50/50">
            <img src={logoSvg} alt="AlmaLinks" className="h-6 w-auto flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <h3 className="text-gray-900 font-semibold text-sm truncate">{eventName || 'Event'}</h3>
              {ticketId && (
                <p className="text-gray-500 text-xs">#{ticketId}</p>
              )}
            </div>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setExpanded(false); }}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="p-4 space-y-4">
            {/* Event details */}
            <div className="grid grid-cols-1 gap-3 text-sm">
              <div className="flex items-start gap-2">
                <Calendar className="h-4 w-4 text-gray-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-gray-500 text-xs">Date & time</p>
                  <p className="text-gray-900">{displayDate} · {displayTime}</p>
                </div>
              </div>
              {displayLocation !== '—' && (
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-gray-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-gray-500 text-xs">Location</p>
                    <p className="text-gray-900">{displayLocation}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Attendee */}
            {(attendeeName || attendeeEmail) && (
              <div className="pt-3 border-t border-gray-100">
                <p className="text-gray-500 text-xs font-medium uppercase tracking-wide mb-2">Attendee</p>
                <div className="flex items-start gap-2">
                  <User className="h-4 w-4 text-gray-400 flex-shrink-0 mt-0.5" />
                  <div className="space-y-1 text-sm">
                    <p className="text-gray-900 font-medium">{attendeeName || '—'}</p>
                    {attendeeEmail && (
                      <p className="text-gray-600 flex items-center gap-1.5">
                        <Mail className="h-3.5 w-3 text-gray-400" />
                        {attendeeEmail}
                      </p>
                    )}
                    {attendeePhone && (
                      <p className="text-gray-600 flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3 text-gray-400" />
                        {attendeePhone}
                      </p>
                    )}
                    {attendeeWork && (
                      <p className="text-gray-600 flex items-center gap-1.5">
                        <Briefcase className="h-3.5 w-3 text-gray-400" />
                        {attendeeWork}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* View event page */}
            {eventPageUrl && (
              <div className="pt-3 border-t border-gray-100">
                <Link
                  to={eventPageUrl}
                  className="inline-flex items-center gap-2 text-sm font-medium text-brand-blue hover:text-brand-blue-hover"
                >
                  <ExternalLink className="h-4 w-4" />
                  View event page
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EventTicketCard;
