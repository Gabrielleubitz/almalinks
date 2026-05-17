import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, ArrowRight } from 'lucide-react';
import { EventService, EventData } from '../services/eventService';
import Header from '../components/Header';
import Footer from '../components/Footer';
import CropImage from '../components/profile/CropImage';
import { EventTimeDisplay, eventFormatLabel } from '../components/EventTimeDisplay';
import { getRestrictedEventAccessLabel } from '../utils/eventAccessLabel';

type EventFilter = 'all' | 'active' | 'completed';

const EVENTS_PER_PAGE = 12;

const EventsPage: React.FC = () => {
  const [events, setEvents] = useState<EventData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<EventFilter>('all');
  const [visibleCount, setVisibleCount] = useState(EVENTS_PER_PAGE);

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    try {
      setLoading(true);
      setError(null);
      const eventsData = await EventService.getPublicEvents();
      const sortedEvents = eventsData.sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      setEvents(sortedEvents);
    } catch (err: unknown) {
      console.error('Failed to load events:', err);
      setError('Failed to load events. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getEventStatus = (event: EventData): 'active' | 'completed' => {
    const eventDate = new Date(event.date);
    const now = new Date();
    if (now > eventDate) return 'completed';
    if (event.status === 'completed') return 'completed';
    if (event.status === 'non-active') return 'completed';
    return 'active';
  };

  const filteredEvents = events.filter(event => {
    if (filter === 'all') return true;
    return getEventStatus(event) === filter;
  });

  const visibleEvents = filteredEvents.slice(0, visibleCount);
  const hasMore = filteredEvents.length > visibleCount;

  const handleShowMore = () => {
    setVisibleCount(prev => prev + EVENTS_PER_PAGE);
  };

  useEffect(() => {
    setVisibleCount(EVENTS_PER_PAGE);
  }, [filter]);

  const getStatusBadge = (event: EventData, status: 'active' | 'completed') => {
    const styles = {
      active:
        event.status === 'sold-out' ? 'bg-orange-100 text-orange-800' : 'bg-green-100 text-green-800',
      completed: 'bg-blue-50 text-blue-800',
    };

    const labels = {
      active: event.status === 'sold-out' ? 'Sold Out' : 'Upcoming',
      completed: 'Completed',
    };

    return (
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold ${styles[status]}`}
      >
        {labels[status]}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white overflow-x-hidden w-full max-w-full">
        <Header />
        <section className="pt-[var(--content-offset-top)] pb-16 bg-gradient-to-br from-gray-50 to-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <div className="w-10 h-10 border-2 border-gray-200 border-t-gray-700 rounded-full animate-spin mx-auto mb-3" />
              <p className="text-gray-600 text-sm">Loading events…</p>
            </div>
          </div>
        </section>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col overflow-x-hidden">
      <Header />

      <section className="pt-[var(--content-offset-top)] pb-3 sm:pb-4 bg-white flex-shrink-0 border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
            AlmaLinks <span className="gradient-text">Events</span>
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            Upcoming and past gatherings — tap an event for details and registration.
          </p>
        </div>
      </section>

      <div className="sticky z-10 flex-shrink-0 bg-white border-b border-gray-100 shadow-sm top-[var(--content-offset-top)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
          <div className="flex justify-center overflow-x-hidden">
            <div className="flex flex-wrap sm:flex-nowrap gap-1 bg-gray-100 p-0.5 rounded-full max-w-full">
              {[
                { key: 'all', label: 'All' },
                { key: 'active', label: 'Upcoming' },
                { key: 'completed', label: 'Past' },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFilter(key as EventFilter)}
                  className={`px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-semibold rounded-full transition-all ${
                    filter === key
                      ? 'bg-gray-900 text-white shadow-sm'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <section className="flex-1 py-4 sm:py-6 bg-gray-50/50 min-h-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4 max-w-2xl mx-auto text-center text-sm text-red-800">
              {error}
              <button
                type="button"
                onClick={loadEvents}
                className="mt-2 block mx-auto text-red-700 font-semibold underline"
              >
                Try again
              </button>
            </div>
          )}

          {filteredEvents.length === 0 ? (
            <div className="text-center py-12 text-gray-600 text-sm">
              No events match this filter.
            </div>
          ) : (
            <>
              <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 auto-rows-fr">
                {visibleEvents.map(event => {
                  const status = getEventStatus(event);
                  const restricted = getRestrictedEventAccessLabel(event.eventAudience ?? null);
                  return (
                    <Link
                      key={event.id}
                      to={`/events/${event.slug}`}
                      className="group bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-gray-300 transition-all flex flex-col h-full overflow-hidden"
                    >
                      <div className="aspect-[16/9] max-h-32 bg-gray-100 border-b border-gray-100">
                        <CropImage
                          src={event.imageUrl}
                          crop={event.imageCrop ?? null}
                          alt=""
                          mode="block"
                          className="w-full h-full object-cover"
                          onError={e => {
                            const target = e.target as HTMLImageElement;
                            target.src =
                              'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIwIiBoZWlnaHQ9IjE4MCIgdmlld0JveD0iMCAwIDMyMCAxODAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjMyMCIgaGVpZ2h0PSIxODAiIGZpbGw9IiNGM0Y0RjYiLz48L3N2Zz4=';
                          }}
                        />
                      </div>
                      <div className="p-3 flex-1 flex flex-col min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <h2 className="text-sm sm:text-base font-bold text-gray-900 leading-snug line-clamp-2 group-hover:text-brand-blue-dark">
                              {event.name}
                            </h2>
                            <div className="shrink-0">{getStatusBadge(event, status)}</div>
                          </div>
                          <div className="mt-auto space-y-1 text-xs text-gray-600">
                            <EventTimeDisplay
                              event={event}
                              layout="split"
                              showLabels={false}
                              textClassName="text-gray-600 text-xs"
                            />
                            {event.location ? (
                              <div className="flex items-center gap-1.5 min-w-0">
                                <MapPin className="h-3.5 w-3.5 text-red-700 shrink-0" />
                                <span className="truncate">{event.location}</span>
                              </div>
                            ) : null}
                            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                              <span className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold bg-gray-100 px-1.5 py-0.5 rounded">
                                {eventFormatLabel(event.eventFormat ?? null)}
                              </span>
                              {restricted ? (
                                <span className="text-[10px] font-medium text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100">
                                  {restricted}
                                </span>
                              ) : null}
                            </div>
                          </div>
                      </div>
                      <div className="px-3 pb-3 flex justify-end border-t border-gray-50 pt-2">
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-brand-blue-dark">
                          Details
                          <ArrowRight className="h-3.5 w-3.5" />
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>

              {hasMore && (
                <div className="flex justify-center mt-6">
                  <button
                    type="button"
                    onClick={handleShowMore}
                    className="px-6 py-2 rounded-full text-sm font-semibold text-white bg-gray-900 hover:bg-gray-800"
                  >
                    Show more
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default EventsPage;
