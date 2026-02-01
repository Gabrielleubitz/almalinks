import React from 'react';

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
  className?: string;
}

/**
 * Event ticket card styled to match the site: white card, brand blue gradient header,
 * same typography and borders as the rest of the dashboard.
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
  className = '',
}) => {
  const displayDate = eventDate?.trim() || '—';
  const displayTime = eventTime?.trim() || '—';
  const displayLocation = eventLocation?.trim() || '—';

  return (
    <article
      aria-label={`Ticket for ${eventName}`}
      className={`
        w-full max-w-[280px] bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden
        hover:shadow-md transition-shadow duration-200
        ${isExpired ? 'opacity-75' : ''}
        ${className}
      `}
    >
      {/* Header - site brand blue gradient (matches Browse Events button) */}
      <div className="bg-gradient-to-r from-brand-blue-dark to-brand-blue-light px-4 py-3">
        <h3 className="text-white font-semibold text-base truncate" title={eventName}>
          {eventName || 'Event'}
        </h3>
        {ticketId && (
          <p className="text-white/80 text-xs mt-0.5">#{ticketId}</p>
        )}
      </div>

      {/* Body - same gray text as rest of site */}
      <div className="p-4">
        <div className="grid grid-cols-3 gap-2 text-center border-b border-gray-100 pb-3">
          <div>
            <p className="text-gray-900 font-medium text-sm truncate" title={displayDate}>{displayDate}</p>
            <p className="text-gray-500 text-xs">Date</p>
          </div>
          <div className="border-x border-gray-100 px-1">
            <p className="text-gray-900 font-medium text-sm truncate" title={displayTime}>{displayTime}</p>
            <p className="text-gray-500 text-xs">Time</p>
          </div>
          <div>
            <p className="text-gray-900 font-medium text-sm truncate" title={displayLocation}>{displayLocation}</p>
            <p className="text-gray-500 text-xs">Location</p>
          </div>
        </div>
        {(attendeeName || attendeeEmail) && (
          <div className="mt-3 pt-3">
            <p className="text-gray-500 text-xs">Attendee</p>
            <p className="text-gray-900 font-medium text-sm truncate">{attendeeName || '—'}</p>
            {attendeeEmail && <p className="text-gray-500 text-xs truncate">{attendeeEmail}</p>}
            {attendeePhone && <p className="text-gray-500 text-xs truncate">{attendeePhone}</p>}
            {attendeeWork && <p className="text-gray-500 text-xs truncate">{attendeeWork}</p>}
          </div>
        )}
      </div>
    </article>
  );
};

export default EventTicketCard;
