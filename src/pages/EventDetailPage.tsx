import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import BackButton from '../components/ui/BackButton';
import { MapPin, CheckCircle, AlertCircle, CalendarPlus, ExternalLink, Link as LinkIcon, User } from 'lucide-react';
import { EventService, EventData } from '../services/eventService';
import { getMyRegistration, createPending } from '../services/registrationService';
import type { EventRegistrationWithStatus, EventPrivateDetails } from '../types/event';
import EventTicketCard from '../components/dashboard/EventTicketCard';
import { useAuth } from '../hooks/useAuth';
import { useActivityTracking } from '../hooks/useActivityTracking';
import Header from '../components/Header';
import Footer from '../components/Footer';
import ReviewSection from '../components/reviews/ReviewSection';
import { EventTimeDisplay, eventFormatLabel } from '../components/EventTimeDisplay';
import { EventRegistrationPanel } from '../components/events/EventRegistrationPanel';
import { getRestrictedEventAccessLabel } from '../utils/eventAccessLabel';
import {
  approvedEventCalendarLocation,
  approvedEventPrimaryLocation,
  approvedEventVenueAddress,
} from '../utils/eventPrivateLocation';
import { isEventEnded } from '../utils/eventStatus';

const HOSTNAME_LABELS: Record<string, string> = {
  'zoom.us': 'Zoom',
  'meet.google.com': 'Google Meet',
  'docs.google.com': 'Google Docs',
  'calendar.google.com': 'Google Calendar',
  'notion.so': 'Notion',
  'notion.tech': 'Notion',
};

function speakerInitials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .map(w => w[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase() || '?'
  );
}

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

    if (event.status !== 'active' || isEventEnded(event)) {
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
    const location =
      registration?.status === 'approved' && privateDetails
        ? approvedEventCalendarLocation(event.location, privateDetails)
        : event.location || '';
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
        <Footer compact />
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
              <BackButton fallbackTo="/events" className="bg-gradient-to-r from-brand-blue-dark to-brand-blue-light text-white px-8 py-4 rounded-full hover:shadow-lg transition-all duration-300 font-semibold" iconClassName="h-5 w-5" />
              <div className="text-sm text-gray-500">
                <p>Looking for a specific event? Try browsing our events page or contact us for assistance.</p>
              </div>
            </div>
          </div>
        </div>
        <Footer compact />
      </div>
    );
  }

  if (!event) return null;

  const statusInfo = getStatusInfo(event.status);
  const ended = isEventEnded(event);
  const canRegister = statusInfo.canRegister && !ended;
  const accessLabel = getRestrictedEventAccessLabel(event.eventAudience ?? null);
  const showStickyRegister = !ended && canRegister && !registration;

  const registrationPanelProps = {
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
    onRegister: handleRegister,
    onToggleTicket: () => setShowTicket(prev => !prev),
    onSignup: () => navigate('/signup'),
    onLogin: () => navigate('/login'),
    calendarUrl: createGoogleCalendarUrl(),
  };

  return (
    <div className="min-h-screen bg-white overflow-x-hidden w-full max-w-full">
      <Header />

      <div ref={topRef} />

      <section
        className={`pt-[var(--content-offset-top)] bg-white border-b border-gray-100 ${showStickyRegister ? 'pb-28 sm:pb-32 md:pb-8' : 'pb-6 sm:pb-8'}`}
      >
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-4"><BackButton fallbackTo="/events" className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 text-sm font-medium" iconClassName="h-4 w-4" /></div>

          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 leading-tight mb-3">{event.name}</h1>

          {ended ? (
            <span className="inline-flex items-center px-3 py-1 rounded-lg text-sm font-semibold bg-gray-100 text-gray-700 border border-gray-200 mb-4">
              Event Ended
            </span>
          ) : null}

          <div className="rounded-xl border border-gray-200 bg-gray-50/60 p-4 sm:p-5 space-y-3 text-sm sm:text-base text-gray-800">
                  <EventTimeDisplay event={event} layout="split" textClassName="text-gray-800" />
                  <div className="flex items-start gap-2">
                    <MapPin className="h-5 w-5 text-red-700 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <span className="font-semibold text-gray-800">Location: </span>
                      {registration?.status === 'approved' && privateDetails ? (
                        <>
                          <span className="font-medium">
                            {approvedEventPrimaryLocation(event.location, privateDetails)}
                          </span>
                          {approvedEventVenueAddress(privateDetails) ? (
                            <span className="block text-gray-600 text-sm mt-1 whitespace-pre-wrap">
                              {approvedEventVenueAddress(privateDetails)}
                            </span>
                          ) : null}
                        </>
                      ) : registration?.status === 'pending' ||
                        (registration && registration.status !== 'rejected') ? (
                        <span className="text-gray-600">Full address after approval.</span>
                      ) : (
                        <span className="font-medium">{event.location}</span>
                      )}
                    </div>
                  </div>
                  {registration?.status === 'approved' && privateDetails?.meetingUrl && !ended && (
                    <div className="flex items-center gap-2">
                      <LinkIcon className="h-5 w-5 text-brand-blue shrink-0" />
                      <a
                        href={privateDetails.meetingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-brand-blue font-medium hover:underline break-all"
                      >
                        Join online
                      </a>
                    </div>
                  )}
            <div className="flex flex-wrap items-center gap-2 pt-0.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-600 bg-white border border-gray-200 px-2 py-1 rounded-md">
                {eventFormatLabel(event.eventFormat ?? null)}
              </span>
              {event.chapter ? (
                <span className="text-xs font-medium text-gray-700 bg-white border border-gray-200 px-2 py-1 rounded-md">
                  {event.chapter}
                </span>
              ) : null}
              {accessLabel ? (
                <span className="text-xs font-semibold text-amber-900 bg-amber-50 border border-amber-100 px-2 py-1 rounded-md">
                  {accessLabel}
                </span>
              ) : null}
            </div>
          </div>

          <EventRegistrationPanel variant="card" {...registrationPanelProps} />

          <div className="mt-4 rounded-xl border border-gray-200 bg-white px-4 py-3 sm:px-5 sm:py-4 text-sm sm:text-base text-gray-800">
            <span className="font-semibold text-gray-900">Cost: </span>
            {event.costNote?.trim()
              ? event.costNote.trim()
              : 'Included with membership unless noted later.'}
          </div>

          <div className="mt-8 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-6 md:gap-8 items-start">
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-gray-900 mb-3">About this event</h2>
              <div className="text-gray-700 text-sm sm:text-base leading-relaxed whitespace-pre-wrap">
                {event.description}
              </div>
            </div>
            {(event.speakerName?.trim() || event.speakerImageUrl?.trim()) ? (
              <aside className="flex flex-col items-center gap-2 md:pt-8 shrink-0 mx-auto md:mx-0">
                <div className="h-20 w-20 sm:h-24 sm:w-24 rounded-full overflow-hidden border-2 border-gray-200 shadow-sm bg-gray-100 flex items-center justify-center">
                  {event.speakerImageUrl?.trim() ? (
                    <img
                      src={event.speakerImageUrl.trim()}
                      alt={event.speakerName?.trim() ? `${event.speakerName.trim()} headshot` : 'Speaker'}
                      className="h-full w-full object-cover"
                      onError={e => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : event.speakerName?.trim() ? (
                    <span className="text-lg font-bold text-gray-600" aria-hidden>
                      {speakerInitials(event.speakerName)}
                    </span>
                  ) : (
                    <User className="h-10 w-10 text-gray-400" aria-hidden />
                  )}
                </div>
                {event.speakerName?.trim() ? (
                  <p className="text-sm font-semibold text-gray-900 text-center max-w-[9rem] leading-snug">
                    {event.speakerName.trim()}
                  </p>
                ) : (
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Speaker</p>
                )}
                {registration?.status === 'approved' && privateDetails?.resourceLinkUrl ? (
                  <div className="mt-4 w-full max-w-[220px] rounded-xl border border-gray-200 p-3 bg-white">
                    <h3 className="text-xs font-bold text-gray-900 mb-2">Resources</h3>
                    <ResourceLinkCard
                      url={privateDetails.resourceLinkUrl}
                      label={privateDetails.resourceLinkLabel}
                    />
                  </div>
                ) : null}
              </aside>
            ) : registration?.status === 'approved' && privateDetails?.resourceLinkUrl ? (
              <aside className="md:pt-8 shrink-0 w-full max-w-sm mx-auto md:mx-0">
                <div className="rounded-xl border border-gray-200 p-4 bg-white">
                  <h3 className="text-sm font-bold text-gray-900 mb-2">Resources</h3>
                  <ResourceLinkCard
                    url={privateDetails.resourceLinkUrl}
                    label={privateDetails.resourceLinkLabel}
                  />
                </div>
              </aside>
            ) : null}
          </div>
        </div>
      </section>

      {showTicket && !ended && registration?.status === 'approved' && registration && event && (
        <section className="py-8 bg-gray-50 border-b border-gray-100" aria-label="Your ticket">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center">
            <EventTicketCard
              eventName={event.name}
              eventStartIso={event.date}
              eventDate=""
              eventTime=""
              eventLocation={approvedEventPrimaryLocation(event.location, privateDetails)}
              venueAddress={approvedEventVenueAddress(privateDetails)}
              attendeeName={registration.name}
              attendeeEmail={registration.email}
              attendeePhone={registration.phone}
              attendeeWork={registration.work}
              ticketId={(registration.userId || 'TEMP').slice(-8).toUpperCase()}
              isExpired={ended}
            />
          </div>
        </section>
      )}


      {/* Reviews Section - Only show for completed events */}
      {(isEventCompleted || ended) && (
        <ReviewSection
          eventId={event.id}
          isCompleted={isEventCompleted || ended}
          userCheckedIn={registration?.checkedIn === true}
        />
      )}

      {showStickyRegister ? (
        <div
          className="fixed bottom-0 inset-x-0 z-50 md:hidden border-t border-gray-200 bg-white/95 backdrop-blur-md px-4 py-3 shadow-[0_-8px_30px_rgba(0,0,0,0.12)]"
          style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
          aria-label="Register for event"
        >
          <EventRegistrationPanel variant="sticky" {...registrationPanelProps} />
        </div>
      ) : null}

      <Footer compact />
    </div>
  );
};

export default EventDetailPage;