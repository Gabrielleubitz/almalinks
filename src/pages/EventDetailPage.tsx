import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Calendar, MapPin, Clock, ArrowLeft, Users, CheckCircle, AlertCircle, Ticket, Download, User, Mic, Linkedin, Briefcase, CalendarPlus } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { EventService, EventData } from '../services/eventService';
import { SpeakerService, EventSpeaker } from '../services/speakerService';
import { useAuth } from '../hooks/useAuth';
import { useActivityTracking } from '../hooks/useActivityTracking';
import Header from '../components/Header';
import Footer from '../components/Footer';
import EventSpeakers from '../components/EventSpeakers';
import EventPositionChart from '../components/analytics/EventPositionChart';
import ReviewSection from '../components/reviews/ReviewSection';

const EventDetailPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { logEventRegistration } = useActivityTracking();
  
  const [event, setEvent] = useState<EventData | null>(null);
  const [speakers, setSpeakers] = useState<EventSpeaker[]>([]);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);
  const [registration, setRegistration] = useState<any>(null);
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
      document.title = `${event.name} - Alma Links`;
    } else if (error) {
      document.title = 'Event Not Found - Alma Links';
    } else {
      document.title = 'Loading Event - Alma Links';
    }

    // Cleanup: Reset title when component unmounts
    return () => {
      document.title = 'Alma Links - Where Bold Ideas Meet Real Conversations';
    };
  }, [event, error]);

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
        
        // Load speakers separately using inline method (bypassing cache issues)
        try {
          console.log('🔍 Loading speakers for event:', eventData.id);
          const { collection, getDocs } = await import('firebase/firestore');
          const { db } = await import('../firebase/config');
          
          const speakersRef = collection(db, 'speakers');
          const allSnapshot = await getDocs(speakersRef);
          console.log('📊 Found', allSnapshot.docs.length, 'total speakers');
          
          const allSpeakers = allSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          
          const eventSpeakers = allSpeakers.filter(speaker => speaker.eventId === eventData.id);
          console.log('✅ Found', eventSpeakers.length, 'speakers for this event');
          
          setSpeakers(eventSpeakers as EventSpeaker[]);
        } catch (speakerError) {
          console.error('❌ Error loading event speakers:', speakerError);
          // Don't fail the whole page if speakers fail to load
          setSpeakers([]);
        }
        
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
      const userRegistration = await EventService.getUserRegistration(eventId, user.uid);
      if (userRegistration) {
        setIsRegistered(true);
        setRegistration(userRegistration);
      }
    } catch (error) {
      console.error('❌ Error checking registration status:', error);
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

    if (isRegistered) {
      setError('You are already registered for this event');
      return;
    }

    setRegistering(true);
    setError(null);
    setSuccess(null);

    try {
      console.log('🎯 Starting registration process...');
      
      await EventService.registerForEvent(event.id, user.uid, {
        name: user.displayName || '',
        email: user.email || '',
        phone: user.phone || '',
        work: user.work || '',
        registeredAt: new Date(),
        profileImage: user.profileImage || null,
        position: user.position || 'other' // Add position for analytics
      });

      console.log('✅ Registration successful');

      // Log event registration activity
      logEventRegistration(event.id, event.name);

      // Reload registration status
      await checkRegistrationStatus(event.id);

      // Show success message
      setSuccess('✅ You\'re all set! Your spot is confirmed.');
      setShowTicket(true);

      // Clear success message after 5 seconds
      setTimeout(() => {
        setSuccess(null);
      }, 5000);

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

  // Create Google Calendar URL
  const createGoogleCalendarUrl = () => {
    if (!event) return '';
    
    const { startTime, endTime } = formatGoogleCalendarDate(event.date);
    
    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: event.name,
      dates: `${startTime}/${endTime}`,
      details: event.description,
      location: event.location
    });
    
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  };

  const downloadQRCode = () => {
    if (!registration?.qrCodeUrl) return;

    const svg = document.getElementById('event-qr-code');
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    canvas.width = 200;
    canvas.height = 200;

    img.onload = () => {
      if (ctx) {
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, 200, 200);
        ctx.drawImage(img, 0, 0, 200, 200);
        
        const link = document.createElement('a');
        link.download = `${event?.name.replace(/\s+/g, '-').toLowerCase()}-ticket.png`;
        link.href = canvas.toDataURL();
        link.click();
      }
    };

    img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
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

  const isEventCompleted = event?.status === 'completed';

  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <Header />
        <div className="pt-32 pb-16">
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
      <div className="min-h-screen bg-white">
        <Header />
        <div className="pt-32 pb-16">
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
  const formattedDate = formatDate(event.date);
  const hasSpeakers = speakers && speakers.length > 0;

  return (
    <div className="min-h-screen bg-white">
      <Header />
      
      {/* Reference for scrolling to top */}
      <div ref={topRef}></div>
      
      {/* Hero Section */}
      <section className="pt-32 pb-16 bg-gradient-to-br from-gray-50 to-white">
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
            <div className="order-2 lg:order-1">
              <img
                src={event.imageUrl}
                alt={event.name}
                className="w-full h-96 object-cover rounded-3xl shadow-xl"
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
                <div className="flex items-center space-x-3 text-lg">
                  <Calendar className="h-6 w-6 text-red-700" />
                  <span className="text-gray-700">{formattedDate.date}</span>
                </div>
                <div className="flex items-center space-x-3 text-lg">
                  <Clock className="h-6 w-6 text-brand-light" />
                  <span className="text-gray-700">{formattedDate.time}</span>
                </div>
                <div className="flex items-center space-x-3 text-lg">
                  <MapPin className="h-6 w-6 text-red-700" />
                  <span className="text-gray-700">{event.location}</span>
                </div>
                <div className="flex items-center space-x-3 text-lg">
                  <Users className="h-6 w-6 text-gray-500" />
                  <span className="text-gray-700">Exclusive Event</span>
                </div>
                
                {/* Speaker Badge */}
                {hasSpeakers && (
                  <div className="flex items-center space-x-3 text-lg">
                    <Mic className="h-6 w-6 text-orange-600" />
                    <span className="text-gray-700">{speakers.length} {speakers.length === 1 ? 'Speaker' : 'Speakers'}</span>
                  </div>
                )}
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
                      Join Alma Links to Register
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
                ) : isRegistered ? (
                  <div className="space-y-4">
                    <div className="flex items-center space-x-3 p-4 bg-green-50 rounded-xl border border-green-200">
                      <CheckCircle className="h-6 w-6 text-green-600" />
                      <span className="text-lg font-semibold text-green-600">Registered</span>
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
                        className="bg-white text-brand-light border border-blue-200 px-6 py-3 rounded-full hover:bg-blue-50 transition-all duration-300 font-semibold flex items-center justify-center space-x-2"
                      >
                        <CalendarPlus className="h-5 w-5" />
                        <span>Add to Google Calendar</span>
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
                        <span>Registering...</span>
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

      {/* Digital Ticket */}
      {showTicket && isRegistered && registration && (
        <section className="py-16 bg-gray-50">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="bg-gradient-to-br from-brand-blue-dark to-brand-blue-light rounded-3xl p-8 text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16"></div>
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full translate-y-12 -translate-x-12"></div>
              
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center space-x-2">
                    <Ticket className="h-6 w-6" />
                    <span className="font-semibold">Digital Ticket</span>
                  </div>
                  <div className="text-sm opacity-90">
                    #{(registration.id || 'TEMP').slice(-8).toUpperCase()}
                  </div>
                </div>
                
                <div className="space-y-3 mb-6">
                  <div className="text-2xl font-bold">{event.name}</div>
                  <div className="opacity-90">{formattedDate.date} • {formattedDate.time}</div>
                  <div className="opacity-90">{event.location}</div>
                </div>
                
                <div className="pt-4 border-t border-white/20">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm opacity-90">Attendee</div>
                      <div className="font-semibold">{registration.name}</div>
                      <div className="text-sm opacity-75">{registration.email}</div>
                      <div className="text-sm opacity-75">{registration.phone}</div>
                      <div className="text-sm opacity-75">{registration.work}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm opacity-90">QR Code</div>
                      <div className="bg-white p-2 rounded-lg mt-1">
                        <QRCodeSVG
                          id="event-qr-code"
                          value={registration.qrCodeUrl || event.id + '-' + user?.uid}
                          size={60}
                          bgColor="#ffffff"
                          fgColor="#000000"
                          level="M"
                          includeMargin={false}
                        />
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="mt-6 text-center">
                  <p className="text-sm opacity-90">
                    Present this ticket at the event entrance
                  </p>
                </div>
                
                {/* Add to Calendar Button */}
                <div className="mt-4 pt-4 border-t border-white/20 flex justify-center">
                  <a
                    href={createGoogleCalendarUrl()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-white/20 hover:bg-white/30 text-white px-6 py-2 rounded-full transition-all duration-300 font-medium inline-flex items-center space-x-2 border border-white/30"
                  >
                    <CalendarPlus className="h-4 w-4" />
                    <span>Add to Google Calendar</span>
                  </a>
                </div>
              </div>
            </div>
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
            {/* Event Speakers */}
            {hasSpeakers ? (
              <EventSpeakers 
                speakers={speakers} 
                className="bg-gradient-to-br from-red-50 to-blue-50"
              />
            ) : (
              /* Speaker Application CTA */
              <div className="bg-gradient-to-br from-red-50 to-blue-50 rounded-2xl p-6 border border-gray-100">
                <div className="flex items-center space-x-3 mb-4">
                  <Mic className="h-5 w-5 text-red-700" />
                  <h3 className="text-lg font-bold text-gray-900">Become a Speaker</h3>
                </div>
                <p className="text-gray-700 mb-4">
                  Interested in sharing your expertise at this event? Apply to become a speaker and showcase your knowledge to our exclusive audience.
                </p>
                <button
                  onClick={handleApplyToSpeak}
                  className="inline-flex items-center space-x-2 text-red-600 hover:text-red-700 font-medium"
                >
                  <span>Apply now</span>
                  <ArrowLeft className="h-4 w-4 rotate-180" />
                </button>
              </div>
            )}

            {/* Event Details Summary */}
            <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Event Details</h3>
              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <Calendar className="h-5 w-5 text-red-700" />
                  <div>
                    <div className="text-sm text-gray-500">Date</div>
                    <div className="font-medium text-gray-900">{formattedDate.date}</div>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <Clock className="h-5 w-5 text-brand-light" />
                  <div>
                    <div className="text-sm text-gray-500">Time</div>
                    <div className="font-medium text-gray-900">{formattedDate.time}</div>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <MapPin className="h-5 w-5 text-red-700" />
                  <div>
                    <div className="text-sm text-gray-500">Location</div>
                    <div className="font-medium text-gray-900">{event.location}</div>
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
              {isRegistered && (
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
          </div>
        </div>
      </div>

      {/* Reviews Section - Only show for completed events */}
      {isEventCompleted && (
        <ReviewSection eventId={event.id} isCompleted={isEventCompleted} />
      )}

      <Footer />
    </div>
  );
};

export default EventDetailPage;