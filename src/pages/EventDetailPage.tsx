import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import BackButton from '../components/ui/BackButton';
import {
  MapPin,
  AlertCircle,
  ExternalLink,
  Link as LinkIcon,
  User,
  Calendar,
  Tag,
  Sparkles,
} from 'lucide-react';
import { EventService, EventData } from '../services/eventService';
import { getMyRegistration, createPending } from '../services/registrationService';
import type { EventRegistrationWithStatus, EventPrivateDetails } from '../types/event';
import EventTicketCard from '../components/dashboard/EventTicketCard';
import { useAuth } from '../hooks/useAuth';
import { useActivityTracking } from '../hooks/useActivityTracking';
import Header from '../components/Header';
import Footer from '../components/Footer';
import ReviewSection from '../components/reviews/ReviewSection';
import CropImage from '../components/profile/CropImage';
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

const EVENT_IMAGE_PLACEHOLDER =
  'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIwMCIgaGVpZ2h0PSI2MDAiIHZpZXdCb3g9IjAgMCAxMjAwIDYwMCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48bGluZWFyR3JhZGllbnQgaWQ9ImciIHgxPSIwJSIgeTE9IjAlIiB4Mj0iMTAwJSIgeTI9IjEwMCUiPjxzdG9wIG9mZnNldD0iMCUiIHN0b3AtY29sb3I9IiMwQjJCNkIiLz48c3RvcCBvZmZzZXQ9IjEwMCUiIHN0b3AtY29sb3I9IiMyRTdGRUYiLz48L2xpbmVhckdyYWRpZW50PjwvZGVmcz48cmVjdCB3aWR0aD0iMTIwMCIgaGVpZ2h0PSI2MDAiIGZpbGw9InVybCgjZykiLz48L3N2Zz4=';

function speakerInitials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .map((w) => w[0])
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
      className="group flex items-center gap-3 p-4 rounded-xl border border-gray-200 bg-white hover:border-brand-blue-light/40 hover:shadow-md transition-all"
    >
      {faviconUrl ? (
        <img
          src={faviconUrl}
          alt=""
          className="w-8 h-8 rounded-lg flex-shrink-0 object-contain bg-gray-50 p-1"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
      ) : (
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100 text-gray-400">
          <LinkIcon className="h-4 w-4" />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <span className="font-semibold text-gray-900 block truncate group-hover:text-brand-blue-dark">
          {label}
        </span>
        <span className="text-xs text-gray-500 truncate block">{url}</span>
      </div>
      <ExternalLink className="h-4 w-4 text-gray-400 group-hover:text-brand-blue-dark flex-shrink-0" />
    </a>
  );
}

function MetaChip({
  children,
  tone = 'neutral',
}: {
  children: React.ReactNode;
  tone?: 'neutral' | 'accent' | 'warning';
}) {
  const tones = {
    neutral: 'bg-white/90 text-gray-800 border-white/60 backdrop-blur-sm',
    accent: 'bg-brand-blue-dark/90 text-white border-white/20 backdrop-blur-sm',
    warning: 'bg-amber-500/95 text-white border-amber-400/30 backdrop-blur-sm',
  };
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] sm:text-xs font-semibold border shadow-sm ${tones[tone]}`}
    >
      {children}
    </span>
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
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);

  const topRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (slug) {
      loadEvent();
    }
  }, [slug, user]);

  useEffect(() => {
    topRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (event) {
      document.title = `${event.name} - AlmaLinks`;
    } else if (error) {
      document.title = 'Event Not Found - AlmaLinks';
    } else {
      document.title = 'Loading Event - AlmaLinks';
    }
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
      setLoading(true);
      setError(null);
      const eventData = await EventService.getEventBySlugOrId(slug);
      if (eventData) {
        setEvent(eventData);
        if (user?.uid) {
          checkRegistrationStatus(eventData.id);
        }
      } else {
        setError('Event not found');
      }
    } catch {
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
      console.error('Error checking registration status:', err);
    }
  };

  const handleRegister = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();

    if (!event || !user?.uid) {
      setError('You must be logged in to register for events');
      setTimeout(() => navigate('/login'), 2000);
      return;
    }

    if (!user.displayName || !user.phone || !user.work) {
      setError('Please complete your profile to register for events');
      setTimeout(() => navigate('/signup'), 2000);
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
      await createPending(event.id, user.uid, {
        name: user.displayName || '',
        email: user.email || '',
        phone: user.phone || '',
        work: user.work || '',
        profileImage: user.profileImage || null,
        position: user.position || 'other',
      });
      logEventRegistration(event.id, event.name);
      await checkRegistrationStatus(event.id);
      setSuccess("Registration pending approval. We'll email you the event details once confirmed.");
      setTimeout(() => setSuccess(null), 8000);

      // Notify admins — non-blocking, fire-and-forget
      fetch('/api/notify-event-registration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId: event.id,
          eventName: event.name,
          userId: user.uid,
          userName: user.displayName || '',
          userEmail: user.email || '',
        }),
      }).catch(() => {/* non-blocking */});
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to register for event. Please try again.';
      setError(message);
      setTimeout(() => setError(null), 5000);
    } finally {
      setRegistering(false);
    }
  };

  const formatGoogleCalendarDate = (dateString: string) => {
    const date = new Date(dateString);
    const formatDate = (d: Date) => d.toISOString().replace(/-|:|\.\d+/g, '');
    const startTime = formatDate(date);
    const endDate = new Date(date);
    endDate.setHours(endDate.getHours() + 3);
    return { startTime, endTime: formatDate(endDate) };
  };

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
      active: {
        canRegister: true,
        message: 'Registration is open',
        buttonText: 'Register for this event',
        buttonClass: 'bg-gradient-to-r from-brand-blue-dark to-brand-blue-light',
      },
      'sold-out': {
        canRegister: false,
        message: 'This event is sold out',
        buttonText: 'Sold out',
        buttonClass: 'bg-amber-600 cursor-not-allowed',
      },
      completed: {
        canRegister: false,
        message: 'This event has been completed',
        buttonText: 'Event completed',
        buttonClass: 'bg-gray-500 cursor-not-allowed',
      },
      'non-active': {
        canRegister: false,
        message: 'Registration is not available',
        buttonText: 'Registration closed',
        buttonClass: 'bg-gray-500 cursor-not-allowed',
      },
    };
    return statusInfo[status];
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8fafc] overflow-x-hidden">
        <Header />
        <div className="pt-[var(--content-offset-top)] pb-20">
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
            <div className="animate-pulse space-y-6">
              <div className="aspect-[21/9] max-h-[380px] rounded-2xl bg-gray-200" />
              <div className="h-8 w-2/3 rounded-lg bg-gray-200" />
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="h-24 rounded-xl bg-gray-100" />
                <div className="h-24 rounded-xl bg-gray-100" />
              </div>
            </div>
          </div>
        </div>
        <Footer compact />
      </div>
    );
  }

  if (error && !event) {
    return (
      <div className="min-h-screen bg-[#f8fafc] overflow-x-hidden">
        <Header />
        <div className="pt-[var(--content-offset-top)] pb-20">
          <div className="max-w-lg mx-auto px-4 text-center">
            <AlertCircle className="h-14 w-14 text-red-500 mx-auto mb-5" />
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">Event not found</h1>
            <p className="text-gray-600 mb-8 leading-relaxed">
              {error === 'Event not found'
                ? `We couldn't find an event called "${slug}". It may have been moved or removed.`
                : error}
            </p>
            <BackButton
              fallbackTo="/events"
              className="inline-flex items-center gap-2 bg-gray-900 text-white px-6 py-3 rounded-full font-semibold hover:bg-gray-800"
              iconClassName="h-4 w-4"
            />
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
  const costText = event.costNote?.trim() || 'Included with membership unless noted later.';
  const formatLabel = eventFormatLabel(event.eventFormat ?? null);
  const locationDisplay =
    registration?.status === 'approved' && privateDetails
      ? approvedEventPrimaryLocation(event.location, privateDetails)
      : registration?.status === 'pending' || (registration && registration.status !== 'rejected')
        ? 'Full address after approval'
        : event.location;

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
    onToggleTicket: () => setShowTicket((prev) => !prev),
    onSignup: () => navigate('/signup'),
    onLogin: () => navigate('/login'),
    calendarUrl: createGoogleCalendarUrl(),
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] overflow-x-hidden">
      <Header />
      <div ref={topRef} />

      {/* Hero */}
      <section className="pt-[var(--content-offset-top)]">
        <div className="relative w-full aspect-[16/9] sm:aspect-[21/9] max-h-[min(56vh,460px)] overflow-hidden bg-gradient-to-br from-[var(--brand-blue-dark)] to-[var(--brand-blue-light)]">
          <CropImage
            src={event.imageUrl || EVENT_IMAGE_PLACEHOLDER}
            crop={event.imageCrop ?? null}
            alt={event.name ? `${event.name} cover` : 'Event cover'}
            mode="fill"
            className="w-full h-full"
            onError={(e) => {
              (e.target as HTMLImageElement).src = EVENT_IMAGE_PLACEHOLDER;
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-gray-950/90 via-gray-950/35 to-gray-950/10" />

          <div className="absolute inset-x-0 top-0 px-4 sm:px-6 lg:px-8 pt-4">
            <div className="max-w-5xl mx-auto">
              <BackButton
                fallbackTo="/events"
                className="inline-flex items-center gap-2 text-white/90 hover:text-white text-sm font-medium bg-black/25 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10"
                iconClassName="h-4 w-4"
              />
            </div>
          </div>

          <div className="absolute inset-x-0 bottom-0 px-4 sm:px-6 lg:px-8 pb-6 sm:pb-8">
            <div className="max-w-5xl mx-auto">
              <div className="flex flex-wrap gap-2 mb-3">
                {ended ? <MetaChip tone="neutral">Event ended</MetaChip> : <MetaChip tone="accent">Upcoming</MetaChip>}
                <MetaChip>{formatLabel}</MetaChip>
                {event.chapter ? <MetaChip>{event.chapter}</MetaChip> : null}
                {accessLabel ? <MetaChip tone="warning">{accessLabel}</MetaChip> : null}
              </div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl xl:text-[2.75rem] font-bold text-white leading-[1.15] tracking-tight max-w-4xl">
                {event.name}
              </h1>
            </div>
          </div>
        </div>
      </section>

      {/* Body */}
      <main
        className={`max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 ${
          showStickyRegister ? 'pb-28 sm:pb-32 lg:pb-10' : ''
        }`}
      >
        <div className="grid lg:grid-cols-[minmax(0,1fr)_min(100%,20rem)] gap-8 xl:gap-10 items-start">
          <div className="min-w-0 space-y-8">
            {/* Quick facts */}
            <div className="grid sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="rounded-2xl border border-gray-200/80 bg-white p-4 sm:p-5 shadow-sm">
                <div className="flex items-center gap-2 text-brand-blue-dark mb-3">
                  <Calendar className="h-5 w-5 shrink-0" aria-hidden />
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-500">When</span>
                </div>
                <EventTimeDisplay event={event} layout="plain" showLabels={false} textClassName="text-gray-800" />
              </div>

              <div className="rounded-2xl border border-gray-200/80 bg-white p-4 sm:p-5 shadow-sm">
                <div className="flex items-center gap-2 text-brand-blue-dark mb-3">
                  <MapPin className="h-5 w-5 shrink-0" aria-hidden />
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Where</span>
                </div>
                <p className="text-sm sm:text-base font-medium text-gray-900 leading-snug">{locationDisplay}</p>
                {registration?.status === 'approved' && privateDetails && approvedEventVenueAddress(privateDetails) ? (
                  <p className="mt-1.5 text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">
                    {approvedEventVenueAddress(privateDetails)}
                  </p>
                ) : null}
                {registration?.status === 'approved' && privateDetails?.meetingUrl && !ended ? (
                  <a
                    href={privateDetails.meetingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 mt-3 text-sm font-semibold text-brand-blue-dark hover:underline"
                  >
                    <LinkIcon className="h-4 w-4" />
                    Join online
                  </a>
                ) : null}
              </div>

              <div className="rounded-2xl border border-gray-200/80 bg-white p-4 sm:p-5 shadow-sm sm:col-span-2">
                <div className="flex items-center gap-2 text-brand-blue-dark mb-2">
                  <Tag className="h-5 w-5 shrink-0" aria-hidden />
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Cost</span>
                </div>
                <p className="text-sm sm:text-base text-gray-800 leading-relaxed">{costText}</p>
              </div>
            </div>

            {/* Mobile registration */}
            <div className="lg:hidden">
              <EventRegistrationPanel variant="card" {...registrationPanelProps} />
            </div>

            {/* About */}
            <section className="rounded-2xl border border-gray-200/80 bg-white p-5 sm:p-6 shadow-sm">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-brand-blue-light" aria-hidden />
                About this event
              </h2>
              <div
                className={`text-gray-700 text-base leading-relaxed whitespace-pre-wrap ${
                  !descriptionExpanded && (event.description?.length ?? 0) > 360 ? 'line-clamp-6' : ''
                }`}
              >
                {event.description}
              </div>
              {(event.description?.length ?? 0) > 360 ? (
                <button
                  type="button"
                  onClick={() => setDescriptionExpanded((v) => !v)}
                  className="mt-4 text-sm font-semibold text-brand-blue-dark hover:underline"
                >
                  {descriptionExpanded ? 'Show less' : 'Read more'}
                </button>
              ) : null}
            </section>

            {/* Speaker */}
            {(event.speakerName?.trim() || event.speakerImageUrl?.trim()) ? (
              <section className="rounded-2xl border border-gray-200/80 bg-white p-5 sm:p-6 shadow-sm">
                <h2 className="text-lg font-bold text-gray-900 mb-4">Featured speaker</h2>
                <div className="flex items-center gap-4 sm:gap-5">
                  <div className="h-20 w-20 sm:h-24 sm:w-24 rounded-2xl overflow-hidden border border-gray-200 bg-gray-100 flex items-center justify-center shrink-0 shadow-inner">
                    {event.speakerImageUrl?.trim() ? (
                      <img
                        src={event.speakerImageUrl.trim()}
                        alt={event.speakerName?.trim() ? `${event.speakerName.trim()}` : 'Speaker'}
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : event.speakerName?.trim() ? (
                      <span className="text-xl font-bold text-gray-500">{speakerInitials(event.speakerName)}</span>
                    ) : (
                      <User className="h-10 w-10 text-gray-400" aria-hidden />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">Speaker</p>
                    <p className="text-lg sm:text-xl font-bold text-gray-900 leading-tight">
                      {event.speakerName?.trim() || 'TBA'}
                    </p>
                  </div>
                </div>
              </section>
            ) : null}

            {/* Resources */}
            {registration?.status === 'approved' && privateDetails?.resourceLinkUrl ? (
              <section className="rounded-2xl border border-gray-200/80 bg-white p-5 sm:p-6 shadow-sm">
                <h2 className="text-lg font-bold text-gray-900 mb-3">Resources</h2>
                <ResourceLinkCard
                  url={privateDetails.resourceLinkUrl}
                  label={privateDetails.resourceLinkLabel}
                />
              </section>
            ) : null}
          </div>

          {/* Desktop registration sidebar */}
          <aside className="hidden lg:block lg:sticky lg:top-[calc(var(--content-offset-top)+1rem)] self-start">
            <EventRegistrationPanel variant="card" {...registrationPanelProps} />
          </aside>
        </div>
      </main>

      {showTicket && !ended && registration?.status === 'approved' && registration && event && (
        <section className="py-8 sm:py-10 bg-white border-y border-gray-200" aria-label="Your ticket">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 flex flex-col items-center">
            <h2 className="text-lg font-bold text-gray-900 mb-5">Your ticket</h2>
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
              eventImageUrl={event.imageUrl}
              eventSlug={event.slug}
              registrationStatus={registration.status}
            />
          </div>
        </section>
      )}

      {(isEventCompleted || ended) && (
        <ReviewSection
          eventId={event.id}
          isCompleted={isEventCompleted || ended}
          userCheckedIn={registration?.checkedIn === true}
        />
      )}

      {showStickyRegister ? (
        <div
          className="fixed bottom-0 inset-x-0 z-50 lg:hidden border-t border-gray-200 bg-white/95 backdrop-blur-md px-4 py-3 shadow-[0_-8px_30px_rgba(0,0,0,0.1)]"
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
