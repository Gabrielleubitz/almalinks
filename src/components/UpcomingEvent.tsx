import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Calendar, Clock, Users, ArrowRight } from 'lucide-react';
import { EventService, EventData } from '../services/eventService';
import { useAuth } from '../hooks/useAuth';
import CropImage from './profile/CropImage';

const UpcomingEvent = () => {
  const [upcomingEvent, setUpcomingEvent] = useState<EventData | null>(null);
  const [loading, setLoading] = useState(true);
  const { user, isPending, isApproved } = useAuth();

  useEffect(() => {
    loadUpcomingEvent();
  }, []);

  const loadUpcomingEvent = async () => {
    try {
      const events = await EventService.getPublicEvents();
      
      // Find the next upcoming event (active status and future date)
      const now = new Date();
      const upcoming = events
        .filter(event => event.status === 'active' && new Date(event.date) > now)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0];
      
      setUpcomingEvent(upcoming);
    } catch (error) {
      console.error('❌ Error loading upcoming event:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      }),
      time: date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
      })
    };
  };

  const getStatusBadge = (status: EventData['status']) => {
    const badges = {
      'active': { bg: 'bg-green-100', text: 'text-green-800', label: 'Register Now' },
      'sold-out': { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Sold Out' },
      'completed': { bg: 'bg-blue-50', text: 'text-blue-800', label: 'Completed' }
    };
    
    const badge = badges[status as keyof typeof badges];
    if (!badge) return null;

    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${badge.bg} ${badge.text}`}>
        {badge.label}
      </span>
    );
  };

  if (loading) {
    return (
      <section id="events" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-red-200 border-t-red-600 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">Loading upcoming event...</p>
          </div>
        </div>
      </section>
    );
  }

  if (!upcomingEvent) {
    return (
      <section id="events" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6 slide-up">
              Next <span className="gradient-text">AlmaLinks Event</span>
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto slide-up-delay">
              We're working on our next amazing event. Stay tuned for updates!
            </p>
          </div>
          
          <div className="max-w-4xl mx-auto">
            <div className="bg-gradient-to-br from-blue-50 via-white to-blue-100 rounded-3xl p-8 md:p-12 shadow-xl text-center">
              <Calendar className="h-16 w-16 text-gray-400 mx-auto mb-6" />
              <h3 className="text-2xl font-bold text-gray-900 mb-4">
                No Upcoming Events
              </h3>
              <p className="text-gray-600 mb-8">
                We're planning something special. Follow us for updates on our next exclusive gathering.
              </p>
              <Link
                to="/events"
                className="bg-gradient-to-r from-brand-blue-dark to-brand-blue-light text-white px-8 py-4 rounded-full hover:shadow-lg transition-all duration-300 font-semibold inline-flex items-center space-x-2"
              >
                <span>View Past Events</span>
                <ArrowRight className="h-5 w-5" />
              </Link>
            </div>
          </div>
        </div>
      </section>
    );
  }

  const formattedDate = formatDate(upcomingEvent.date);
  const isUserApproved = user && !isPending && isApproved;

  return (
    <section id="events" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6 slide-up">
            Next <span className="gradient-text">AlmaLinks Event</span>
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto slide-up-delay">
            Join us for our most ambitious gathering yet. Limited spots available.
          </p>
        </div>

        <div className="max-w-4xl mx-auto">
          {/* Event Card - Same design as events listing page */}
          <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden hover-lift slide-up">
            {/* Event Image */}
            <div className="h-64 md:h-80 bg-gray-200 relative overflow-hidden">
              <CropImage
                src={upcomingEvent.imageUrl}
                crop={upcomingEvent.imageCrop ?? null}
                alt={upcomingEvent.name}
                mode="block"
                className="w-full h-full"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAwIiBoZWlnaHQ9IjMyMCIgdmlld0JveD0iMCAwIDYwMCAzMjAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSI2MDAiIGhlaWdodD0iMzIwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0zMDAgMTYwQzMwNS41MjMgMTYwIDMxMCAxNTUuNTIzIDMxMCAxNTBTMzA1LjUyMyAxNDAgMzAwIDE0MFMyOTAgMTQ0LjQ3NyAyOTAgMTUwUzI5NC40NzcgMTYwIDMwMCAxNjBaIiBmaWxsPSIjOUNBM0FGIi8+Cjwvc3ZnPg==';
                }}
              />
              <div className="absolute top-4 right-4">
                {getStatusBadge(upcomingEvent.status)}
              </div>
            </div>

            {/* Event Content */}
            <div className="p-8 md:p-12">
              <h3 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">{upcomingEvent.name}</h3>
              
              <div className="grid md:grid-cols-3 gap-6 mb-8">
                {isUserApproved ? (
                  // Full details for approved users
                  <>
                    <div className="flex items-center space-x-4">
                      <div className="flex-shrink-0">
                        <Calendar className="h-8 w-8 text-red-700" />
                      </div>
                      <div>
                        <div className="font-semibold text-gray-900">When?</div>
                        <div className="text-gray-600">{formattedDate.date}</div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-4">
                      <div className="flex-shrink-0">
                        <Clock className="h-8 w-8 text-brand-blue" />
                      </div>
                      <div>
                        <div className="font-semibold text-gray-900">Time?</div>
                        <div className="text-gray-600">{formattedDate.time}</div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-4">
                      <div className="flex-shrink-0">
                        <MapPin className="h-8 w-8 text-red-700" />
                      </div>
                      <div>
                        <div className="font-semibold text-gray-900">Where?</div>
                        <div className="text-gray-600">{upcomingEvent.location}</div>
                      </div>
                    </div>
                  </>
                ) : (
                  // Limited details for non-approved users
                  <div className="md:col-span-3">
                    <div className="bg-gradient-to-r from-red-50 to-blue-50 p-6 rounded-xl text-center">
                      <div className="flex flex-col items-center justify-center space-y-4">
                        <div className="flex items-center space-x-3">
                          <Calendar className="h-6 w-6 text-red-700" />
                          <Clock className="h-6 w-6 text-brand-blue" />
                          <MapPin className="h-6 w-6 text-red-700" />
                        </div>
                        <p className="text-lg font-medium text-gray-800">Sign up to see event details</p>
                        <p className="text-sm text-gray-600">Join our exclusive community to access full event information</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {isUserApproved ? (
                // Full description for approved users
                <p className="text-gray-600 mb-8 leading-relaxed text-lg">
                  {upcomingEvent.description}
                </p>
              ) : (
                // Limited description for non-approved users
                <div className="bg-gray-50 p-6 rounded-xl mb-8">
                  <p className="text-gray-600 leading-relaxed text-lg text-center">
                    This exclusive event is only visible to approved members.
                    <br />
                    Apply for membership to see full details and register.
                  </p>
                </div>
              )}

              <div className="border-t border-gray-200 pt-8">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-gray-500">
                    <Users className="h-5 w-5" />
                    <span>Exclusive Event</span>
                  </div>
                  
                  {user ? (
                    isPending ? (
                      // Pending users - go to pending page
                      <Link
                        to="/pending"
                        className="bg-yellow-600 text-white px-8 py-4 rounded-full hover:shadow-lg transition-all duration-300 font-semibold text-lg flex items-center space-x-2"
                      >
                        <span>Check Application Status</span>
                        <ArrowRight className="h-5 w-5" />
                      </Link>
                    ) : isApproved ? (
                      // Approved users - go to event detail page
                      <Link
                        to={`/events/${upcomingEvent.slug}`}
                        className="bg-gradient-to-r from-brand-blue-dark to-brand-blue-light text-white px-8 py-4 rounded-full hover:shadow-lg transition-all duration-300 font-semibold text-lg flex items-center space-x-2"
                      >
                        <span>Register Now</span>
                        <ArrowRight className="h-5 w-5" />
                      </Link>
                    ) : (
                      // Rejected users - show message
                      <div className="bg-red-100 text-red-700 px-8 py-4 rounded-full font-semibold text-lg">
                        <span>Access Restricted</span>
                      </div>
                    )
                  ) : (
                    // Not logged in - go to signup page
                    <Link
                      to="/signup"
                      className="bg-gradient-to-r from-brand-blue-dark to-brand-blue-light text-white px-8 py-4 rounded-full hover:shadow-lg transition-all duration-300 font-semibold text-lg flex items-center space-x-2"
                    >
                      <span>Apply for Access</span>
                      <ArrowRight className="h-5 w-5" />
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default UpcomingEvent;