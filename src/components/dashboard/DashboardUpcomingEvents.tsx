import React from 'react';
import { Link } from 'react-router-dom';
import { Calendar, ArrowRight } from 'lucide-react';
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
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5 text-brand-dark shrink-0" />
          Upcoming events
        </h3>
        <Link
          to="/events"
          className="text-[10px] font-medium text-brand-blue hover:text-brand-blue-hover whitespace-nowrap"
        >
          Browse all
        </Link>
      </div>
      <div className="p-2.5">
        {registrationsLoading ? (
          <p className="text-xs text-gray-500 py-1">Loading…</p>
        ) : upcomingRsvpRegistrations.length === 0 ? (
          <p className="text-xs text-gray-600 leading-snug">
            No upcoming RSVPs.{' '}
            <Link to="/events" className="text-brand-blue font-medium hover:underline">
              Browse events
            </Link>
          </p>
        ) : (
          <ul className="space-y-1.5 max-h-[11rem] overflow-y-auto pr-0.5">
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
                    className="flex items-start gap-2 rounded-lg border border-gray-100 bg-gray-50/80 px-2 py-1.5 hover:border-brand-dark/20 hover:bg-white transition-colors group"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-900 group-hover:text-brand-dark line-clamp-2 leading-snug">
                        {reg.eventName || ev?.name}
                      </p>
                      {dt && (
                        <p className="text-[10px] text-gray-600 mt-0.5 line-clamp-1">
                          {dt.dateLine}
                          {dt.timeLine ? ` · ${dt.timeLine}` : ''}
                        </p>
                      )}
                    </div>
                    <div className="shrink-0 flex flex-col items-end gap-0.5">
                      <span
                        className={`text-[9px] uppercase font-semibold px-1 py-0.5 rounded ${
                          reg.registrationStatus === 'approved'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-amber-50 text-amber-800'
                        }`}
                      >
                        {reg.registrationStatus === 'approved' ? 'RSVP' : 'Pending'}
                      </span>
                      <ArrowRight className="h-3 w-3 text-gray-400 group-hover:text-brand-dark" />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};

export default DashboardUpcomingEvents;
