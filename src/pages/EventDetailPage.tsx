import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Calendar, MapPin, ArrowLeft, Users, CheckCircle, AlertCircle, Ticket, User, Linkedin, Briefcase, CalendarPlus, ExternalLink, Link as LinkIcon } from 'lucide-react';
import { EventService, EventData } from '../services/eventService';
import { getMyRegistration, createPending } from '../services/registrationService';
import type { EventRegistrationWithStatus, EventPrivateDetails } from '../types/event';
import EventTicketCard from '../components/dashboard/EventTicketCard';
import { useAuth } from '../hooks/useAuth';
import { useActivityTracking } from '../hooks/useActivityTracking';
import Header from '../components/Header';
import Footer from '../components/Footer';
import EventPositionChart from '../components/analytics/EventPositionChart';
import ReviewSection from '../components/reviews/ReviewSection';
import CropImage from '../components/profile/CropImage';
import { EventDualTimezoneDisplay } from '../components/EventDualTimezoneDisplay';

const HOSTNAME_LABELS: Record<string, string> = {
  'zoom.us': 'Zoom',
  'meet.google.com': 'Google Meet',
  'docs.google.com': 'Google Docs',
  'calendar.google.com': 'Google Calendar',
  'notion.so': 'Notion',
  'notion.tech': 'Notion',
};

function getResourceLabel(url: string, customLabel?: string | null): string {
  if (customLabel?.trim()) return customLabel.trim();
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    return HOSTNAME_LABELS[host] || host;
  } catch {
    return 'Link';
  }
}

function ResourceLinkCard({ url, label: customLabel }: { url: string; label?: string | null }) {
  const label = getResourceLabel(url, customLabel);
  let faviconHost = '';
  try {
    faviconHost = new URL(url).hostname;
  } catch {
    faviconHost = '';
  }
  const faviconUrl = faviconHost
    ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(faviconHost)}&sz=64`
    : '';

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors"
    >
      {faviconUrl ? (
        <img
          src={faviconUrl}
          alt=""
          className="w-5 h-5 rounded flex-shrink-0 object-contain"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
      ) : (
        <LinkIcon className="h-5 w-5 text-gray-400 flex-shrink-0" />
      )}
      <div className="min-w-0 flex-1">
        <span className="font-medium text-gray-900 block truncate">{label}</span>
        <span className="text-sm text-gray-500 truncate block">{url}</span>
      </div>
      <ExternalLink className="h-4 w-4 text-gray-400 flex-shrink-0" />
    </a>
  );
}

const EventDetailPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { logEventRegistration } = useActivityTracking();
  
  const [event, setEvent] = useState<EventData | null>(null);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [registration, setRegistration] = useState<EventRegistrationWithStatus | null>(null);
  const [privateDetails, setPrivateDetails] = useState<EventPrivateDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showTicket, setShowTicket] = useState(false);
  
  // Ref for scrolling to top
  const topRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (slug) {
      loadEvent();
    }
  }, [slug, user]);

  // Scroll to top when component mounts
  useEffect(() => {
    if (topRef.current) {
      topRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  // Update document title when event loads
  useEffect(() => {
    if (event) {
      document.title = `${event.name} - AlmaLinks`;
    } else if (error) {
      document.title = 'Event Not Found - AlmaLinks';
    } else {
      document.title = 'Loading Event - AlmaLinks';
    }

    // Cleanup: Reset title when component unmounts
    return () => {
      document.title = 'AlmaLinks - Where Bold Ideas Meet Real Conversations';
    };
  }, [event, error]);

  const isEventCompleted = event?.status === 'completed';

  useEffect(() => {
    if (!event?.id || !isEventCompleted) return;
    if (searchParams.get('review') !== '1') return;
    const timer = window.setTimeout(() => {
      document.getElementById('event-reviews')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 500);
    return () => window.clearTimeout(timer);
  }, [event?.id, isEventCompleted, searchParams]);

  const loadEvent = async () => {
    if (!slug) return;
    
    try {
      console.log('🔍 Loading event by slug:', slug);
      setLoading(true);
      setError(null);
      
      // Try to get event by slug first, then by ID for backward compatibility
      const eventData = await EventService.getEventBySlugOrId(slug);
      
      if (eventData) {
        setEvent(eventData);
        console.log('✅ Event loaded:', eventData.name);
        
        // Check registration status if user is logged in
        if (user?.uid) {
          checkRegistrationStatus(eventData.id);
        }
      } else {
        console.log('❌ Event not found for slug/ID:', slug);
        setError('Event not found');
      }
    } catch (error) {
      console.error('❌ Error loading event:', error);
      setError('Failed to load event details');
    } finally {
      setLoading(false);
    }
  };

  const checkRegistrationStatus = async (eventId: string) => {
    if (!user?.uid) return;
    try {
      const reg = await getMyRegistration(eventId, user.uid);
      setRegistration(reg);
      if (reg?.status === 'approved') {
        const details = await EventService.getEventPrivateDetails(eventId);
        setPrivateDetails(details);
      } else {
        setPrivateDetails(null);
      }
    } catch (err) {
      console.error('❌ Error checking registration status:', err);
    }
  };

  const handleRegister = async (e: React.MouseEvent<HTMLButtonElement>) => {
    // Prevent any default behavior and page jumping
    e.preventDefault();
    e.stopPropagation();

    if (!event || !user?.uid) {
      setError('You must be logged in to register for events');
      setTimeout(() => {
        navigate('/login');
      }, 2000);
      return;
    }

    // Check if user has complete profile
    if (!user.displayName || !user.phone || !user.work) {
      setError('Please complete your profile to register for events');
      setTimeout(() => {
        navigate('/signup');
      }, 2000);
      return;
    }

    if (event.status !== 'active') {
      setError('Registration is not available for this event');
      return;
    }

    if (registration && registration.status !== 'rejected' && registration.status !== 'cancelled') {
      setError('You are already registered for this event');
      return;
    }

    setRegistering(true);
    setError(null);
    setSuccess(null);

    try {
      console.log('🎯 Starting registration process (pending approval)...');
      await createPending(event.id, user.uid, {
        name: user.displayName || '',
        email: user.email || '',
        phone: user.phone || '',
        work: user.work || '',
        profileImage: user.profileImage || null,
        position: user.position || 'other',
      });
      console.log('✅ Registration submitted (pending approval)');
      logEventRegistration(event.id, event.name);
      await checkRegistrationStatus(event.id);
      setSuccess('Registration pending approval. We\'ll email you the event details once confirmed.');
      setTimeout(() => setSuccess(null), 8000);

    } catch (err: any) {
      console.error('❌ Registration failed:', err);
      setError(err.message || 'Failed to register for event. Please try again.');
      
      // Clear error message after 5 seconds
      setTimeout(() => {
        setError(null);
      }, 5000);
    } finally {
      setRegistering(false);
    }
  };

  // Format event date and time for Google Calendar
  const formatGoogleCalendarDate = (dateString: string) => {
    const date = new Date(dateString);
    
    // Format to YYYYMMDDTHHmmssZ
    const formatDate = (date: Date) => {
      return date.toISOString().replace(/-|:|\.\d+/g, '');
    };
    
    // Start time is the event time
    const startTime = formatDate(date);
    
    // End time is 3 hours after start (default duration)
    const endDate = new Date(date);
    endDate.setHours(endDate.getHours() + 3);
    const endTime = formatDate(endDate);
    
    return { startTime, endTime };
  };

  // Create Google Calendar URL (use private details when approved)
  const createGoogleCalendarUrl = () => {
    if (!event) return '';
    const { startTime, endTime } = formatGoogleCalendarDate(event.date);
    const location = registration?.status === 'approved' && privateDetails
      ? (privateDetails.locationText || event.location)
      : event.location;
    let details = event.description || '';
    if (registration?.status === 'approved' && privateDetails) {
      if (privateDetails.meetingUrl) details += `\n\nMeeting: ${privateDetails.meetingUrl}`;
      if (privateDetails.resourceLinkUrl) details += `\n\nLink: ${privateDetails.resourceLinkUrl}`;
    }
    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: event.name,
      dates: `${startTime}/${endTime}`,
      details: details.trim(),
      location: location || '',
    });
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  };

  const getStatusInfo = (status: EventData['status']) => {
    const statusInfo = {
      'active': {
        canRegister: true,
        message: 'Registration is open',
        buttonText: 'Register Now',
        buttonClass: 'bg-gradient-to-r from-brand-blue-dark to-brand-blue-light hover:shadow-lg'
      },
      'sold-out': {
        canRegister: false,
        message: 'This event is sold out',
        buttonText: 'Sold Out',
        buttonClass: 'bg-yellow-500 cursor-not-allowed'
      },
      'completed': {
        canRegister: false,
        message: 'This event has been completed',
        buttonText: 'Event Completed',
        buttonClass: 'bg-blue-500 cursor-not-allowed'
      },
      'non-active': {
        canRegister: false,
        message: 'Registration is not available',
        buttonText: 'Registration Closed',
        buttonClass: 'bg-gray-500 cursor-not-allowed'
      }
    };

    return statusInfo[status];
  };

  const handleApplyToSpeak = () => {
    window.location.href = "mailto:speakers@almalinks.com?subject=Speaker Application for " + event?.name;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white overflow-x-hidden w-full max-w-full">
        <Header />
        <div className="pt-[var(--content-offset-top)] pb-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-red-200 border-t-red-600 rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-600">Loading event details...</p>
            </div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (error && !event) {
    return (
      <div className="min-h-screen bg-white overflow-x-hidden w-full max-w-full">
        <Header />
        <div className="pt-[var(--content-offset-top)] pb-16">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-6" />
            <h1 className="text-3xl font-bold text-gray-900 mb-4">Event Not Found</h1>
            <p className="text-xl text-gray-600 mb-8">
              {error === 'Event not found' 
                ? `We couldn't find an event with the identifier "${slug}". It may have been moved or deleted.`
                : error
              }
            </p>
            <div className="space-y-4">
              <button
                onClick={() => navigate('/events')}
                className="bg-gradient-to-r from-brand-blue-dark to-brand-blue-light text-white px-8 py-4 rounded-full hover:shadow-lg transition-all duration-300 font-semibold inline-flex items-center space-x-2"
              >
                <ArrowLeft className="h-5 w-5" />
                <span>Back to Events</span>
              </button>
              <div className="text-sm text-gray-500">
                <p>Looking for a specific event? Try browsing our events page or contact us for assistance.</p>
              </div>
            </div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (!event) return null;

  const statusInfo = getStatusInfo(event.status);

  return (
    <div className="min-h-screen bg-white overflow-x-hidden w-full max-w-full">
      <Header />
      
      {/* Reference for scrolling to top */}
      <div ref={topRef}></div>
      
      {/* Hero Section */}
      <section className="pt-[var(--content-offset-top)] sm:pt-32 pb-16 bg-gradient-to-br from-gray-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Back Button */}
          <div className="mb-8">
            <button
              onClick={() => navigate('/events')}
              className="inline-flex items-center space-x-2 text-gray-600 hover:text-gray-800 transition-colors duration-200 font-medium"
            >
              <ArrowLeft className="h-5 w-5" />
              <span>Back to Events</span>
            </button>
          </div>

          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Event Image */}
            <div className="order-2 lg:order-1 w-full h-96 rounded-3xl shadow-xl overflow-hidden relative">
              <CropImage
                src={event.imageUrl}
                crop={event.imageCrop ?? null}
                alt={event.name}
                mode="block"
                className="w-full h-full"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAwIiBoZWlnaHQ9IjM4NCIgdmlld0JveD0iMCAwIDYwMCAzODQiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSI2MDAiIGhlaWdodD0iMzg0IiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0zMDAgMTkyQzMwNS41MjMgMTkyIDMxMCAxODcuNTIzIDMxMCAxODJTMzA1LjUyMyAxNzIgMzAwIDE3MlMyOTAgMTc2LjQ3NyAyOTAgMTgyUzI5NC40NzcgMTkyIDMwMCAxOTJaIiBmaWxsPSIjOUNBM0FGIi8+Cjwvc3ZnPg==';
                }}
              />
            </div>

            {/* Event Details */}
            <div className="order-1 lg:order-2">
              <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6 fade-in">
                {event.name}
              </h1>
              
              <div className="space-y-4 mb-8 fade-in-delay">
                <EventDualTimezoneDisplay
                  eventStart={event.date}
                  iconClassName="h-6 w-6 text-red-700 flex-shrink-0 mt-0.5"
                  textClassName="text-gray-700 text-lg"
                />
                <div className="flex items-center space-x-3 text-lg">
                  <MapPin className="h-6 w-6 text-red-700" />
                  <span className="text-gray-700">
                    {registration?.status === 'approved' && privateDetails
                      ? (privateDetails.locationText || event.location)
                      : registration?.status === 'pending' || (registration && registration.status !== 'rejected')
                        ? 'Location will be shared after your registration is approved.'
                        : event.location}
                  </span>
                </div>
                {registration?.status === 'approved' && privateDetails?.meetingUrl && (
                  <div className="flex items-center space-x-3 text-lg">
                    <LinkIcon className="h-6 w-6 text-brand-blue flex-shrink-0" />
                    <a href={privateDetails.meetingUrl} target="_blank" rel="noopener noreferrer" className="text-brand-blue hover:underline break-all">
                      Join meeting
                    </a>
                  </div>
                )}
                <div className="flex items-center space-x-3 text-lg">
                  <Users className="h-6 w-6 text-gray-500" />
                  <span className="text-gray-700">Exclusive Event</span>
                </div>
                
              </div>

              {/* Status Messages */}
              {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center space-x-3 animate-pulse">
                  <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
                  <p className="text-red-600 text-sm font-medium">{error}</p>
                </div>
              )}

              {success && (
                <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl flex items-center space-x-3 animate-pulse">
                  <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                  <p className="text-green-600 text-sm font-medium">{success}</p>
                </div>
              )}

              {/* Registration Button */}
              <div className="slide-up">
                {!user ? (
                  <div className="space-y-3">
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        navigate('/signup');
                      }}
                      className="w-full bg-gradient-to-r from-brand-blue-dark to-brand-blue-light text-white px-8 py-4 rounded-full hover:shadow-lg transition-all duration-300 font-semibold text-lg"
                    >
                      Join AlmaLinks to Register
                    </button>
                    <p className="text-center text-gray-600 text-sm">
                      Already have an account?{' '}
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          navigate('/login');
                        }}
                        className="text-red-600 hover:text-red-700 font-medium"
                      >
                        Sign in
                      </button>
                    </p>
                  </div>
                ) : registration?.status === 'pending' ? (
                  <div className="space-y-2 p-4 bg-amber-50 rounded-xl border border-amber-200">
                    <p className="text-amber-800 font-medium">Registration pending approval.</p>
                    <p className="text-sm text-amber-700">We&apos;ll email you the event details once confirmed.</p>
                  </div>
                ) : registration?.status === 'rejected' ? (
                  <div className="space-y-2 p-4 bg-red-50 rounded-xl border border-red-200">
                    <p className="text-red-800 font-medium">Registration not approved.</p>
                    {registration.rejectionReason && (
                      <p className="text-sm text-red-700">{registration.rejectionReason}</p>
                    )}
                  </div>
                ) : registration?.status === 'approved' ? (
                  <div className="space-y-4">
                    <div className="flex items-center space-x-3 p-4 bg-green-50 rounded-xl border border-green-200">
                      <CheckCircle className="h-6 w-6 text-green-600" />
                      <span className="text-lg font-semibold text-green-600">Approved — you&apos;re in</span>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          setShowTicket(!showTicket);
                        }}
                        className="bg-gradient-to-r from-brand-blue-dark to-brand-blue-light text-white px-6 py-3 rounded-full hover:shadow-lg transition-all duration-300 font-semibold flex items-center justify-center space-x-2"
                      >
                        <Ticket className="h-5 w-5" />
                        <span>{showTicket ? 'Hide Ticket' : 'View Ticket'}</span>
                      </button>
                      <a
                        href={createGoogleCalendarUrl()}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-white text-brand-blue border border-blue-200 px-6 py-3 rounded-full hover:bg-blue-50 transition-all duration-300 font-semibold flex items-center justify-center space-x-2"
                      >
                        <CalendarPlus className="h-5 w-5" />
                        <span>Add to calendar</span>
                      </a>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={handleRegister}
                    disabled={!statusInfo.canRegister || registering}
                    className={`text-white px-8 py-4 rounded-full transition-all duration-300 font-semibold text-lg disabled:opacity-50 disabled:cursor-not-allowed ${statusInfo.buttonClass} ${
                      registering ? 'animate-pulse' : ''
                    }`}
                  >
                    {registering ? (
                      <div className="flex items-center space-x-2">
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Submitting...</span>
                      </div>
                    ) : (
                      statusInfo.buttonText
                    )}
                  </button>
                )}
                
                {!statusInfo.canRegister && (
                  <p className="text-gray-600 mt-2">{statusInfo.message}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Digital Ticket - site-style card (approved only) */}
      {showTicket && registration?.status === 'approved' && registration && event && (
        <section className="py-16 bg-gray-50" aria-label="Your ticket">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center">
            <EventTicketCard
              eventName={event.name}
              eventStartIso={event.date}
              eventDate=""
              eventTime=""
              eventLocation={(privateDetails?.locationText || event.location) || ''}
              attendeeName={registration.name}
              attendeeEmail={registration.email}
              attendeePhone={registration.phone}
              attendeeWork={registration.work}
              ticketId={(registration.userId || 'TEMP').slice(-8).toUpperCase()}
              isExpired={event?.status === 'completed'}
            />
            <a
              href={createGoogleCalendarUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-2 text-brand-blue-dark hover:text-brand-blue-light font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-blue focus:ring-offset-2"
            >
              <CalendarPlus className="h-5 w-5" />
              <span>Add to Google Calendar</span>
            </a>
          </div>
        </section>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid md:grid-cols-3 gap-8">
          {/* Event Description */}
          <div className="md:col-span-2">
            <section className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100">
              <h2 className="text-3xl font-bold text-gray-900 mb-8">
                About This Event
              </h2>
              <div className="prose prose-lg max-w-none">
                <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                  {event.description}
                </p>
              </div>
            </section>
            
            {/* Position Analytics Chart - Only show for active events */}
            {event.status !== 'non-active' && (
              <div className="mt-8">
                <EventPositionChart eventId={event.id} />
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="md:col-span-1 space-y-8">
            {/* Event Details Summary */}
            <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Event Details</h3>
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <Calendar className="h-5 w-5 text-red-700 flex-shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <div className="text-sm text-gray-500">When</div>
                    <EventDualTimezoneDisplay
                      layout="plain"
                      eventStart={event.date}
                      textClassName="font-medium text-gray-900 text-sm"
                    />
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <MapPin className="h-5 w-5 text-red-700" />
                  <div>
                    <div className="text-sm text-gray-500">Location</div>
                    <div className="font-medium text-gray-900">
                      {registration?.status === 'approved' && privateDetails
                        ? (privateDetails.locationText || event.location)
                        : registration?.status === 'pending'
                          ? 'Shared after approval'
                          : event.location}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <Users className="h-5 w-5 text-gray-500" />
                  <div>
                    <div className="text-sm text-gray-500">Type</div>
                    <div className="font-medium text-gray-900">Exclusive Event</div>
                  </div>
                </div>
              </div>
              
              {/* Add to Calendar Button */}
              {registration?.status === 'approved' && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <a
                    href={createGoogleCalendarUrl()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center space-x-2 w-full justify-center bg-brand-dark text-white px-4 py-2 rounded-lg hover:bg-brand-mid transition-colors duration-200 font-medium"
                  >
                    <CalendarPlus className="h-5 w-5" />
                    <span>Add to Google Calendar</span>
                  </a>
                </div>
              )}
            </div>

            {/* Event link / Resources (approved only) */}
            {registration?.status === 'approved' && privateDetails?.resourceLinkUrl && (
              <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Event link</h3>
                <ResourceLinkCard
                  url={privateDetails.resourceLinkUrl}
                  label={privateDetails.resourceLinkLabel}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Reviews Section - Only show for completed events */}
      {isEventCompleted && (
        <ReviewSection
          eventId={event.id}
          isCompleted={isEventCompleted}
          userCheckedIn={registration?.checkedIn === true}
        />
      )}

      <Footer />
    </div>
  );
};

export default EventDetailPage;