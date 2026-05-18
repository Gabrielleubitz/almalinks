import React from 'react';
import { Link } from 'react-router-dom';
import { Calendar } from 'lucide-react';
import { EventData } from '../../services/eventService';
import { formatEventDateAndTime } from '../../utils/eventDisplayTime';

type RegistrationRow = {
  eventId: string;
  eventName?: string;
  registrationStatus?: string;
  eventSlug?: string;
};

export interface DashboardUpcomingEventsProps {
  events: EventData[];
  upcomingRsvpRegistrations: RegistrationRow[];
  registrationsLoading: boolean;
}

const DashboardUpcomingEvents: React.FC<DashboardUpcomingEventsProps> = ({
  events,
  upcomingRsvpRegistrations,
  registrationsLoading,
}) => {
  const hasRsvps = upcomingRsvpRegistrations.length > 0;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="px-2.5 py-1.5 border-b border-gray-100">
        <h3 className="text-xs font-semibold text-gray-900 flex items-start gap-1.5 leading-snug">
          <Calendar className="h-3 w-3 text-brand-dark shrink-0 mt-0.5" />
          <span>Your Upcoming AlmaLinks Events</span>
        </h3>
      </div>
      <div className="px-2.5 py-2 space-y-2">
        {registrationsLoading ? (
          <p className="text-[10px] text-gray-500">Loading…</p>
        ) : !hasRsvps ? (
          <p className="text-[10px] text-gray-600 leading-snug">
            No new upcoming events at the moment
          </p>
        ) : (
          <ul className="space-y-1 max-h-[7.5rem] overflow-y-auto">
            {upcomingRsvpRegistrations.map((reg) => {
              const ev = events.find((e) => e.id === reg.eventId);
              const slug = reg.eventSlug || ev?.slug;
              if (!slug) return null;
              const dt =
                ev?.date &&
                formatEventDateAndTime(ev.date, {
                  eventFormat: ev.eventFormat ?? null,
                  chapter: ev.chapter ?? null,
                  displayTimezone: ev.displayTimezone ?? null,
                });
              return (
                <li key={reg.eventId}>
                  <Link
                    to={`/events/${slug}`}
                    className="block rounded-md px-1.5 py-1 hover:bg-gray-50 transition-colors group"
                  >
                    <p className="text-[10px] font-medium text-gray-900 group-hover:text-brand-dark line-clamp-2 leading-snug">
                      {reg.eventName || ev?.name}
                    </p>
                    {dt && (
                      <p className="text-[9px] text-gray-500 mt-0.5 line-clamp-1">
                        {dt.dateLine}
                        {dt.timeLine ? ` · ${dt.timeLine}` : ''}
                        {' · '}
                        <span
                          className={
                            reg.registrationStatus === 'approved'
                              ? 'text-green-700'
                              : 'text-amber-700'
                          }
                        >
                          {reg.registrationStatus === 'approved' ? 'RSVP' : 'Pending'}
                        </span>
                      </p>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
        <Link
          to="/events"
          className="flex items-center justify-center w-full rounded-md border border-gray-200 bg-gray-50 px-2 py-1.5 text-[10px] font-semibold text-brand-dark hover:bg-white hover:border-brand-dark/30 transition-colors"
        >
          Explore events
        </Link>
      </div>
    </div>
  );
};

export default DashboardUpcomingEvents;
