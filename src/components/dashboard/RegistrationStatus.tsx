import React, { useState } from 'react';
import { Check, Calendar, MapPin, Clock, Ticket, User, Mail, Phone, Briefcase, Download, X, AlertTriangle, CalendarPlus } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useRegistration } from '../../hooks/useRegistration';
import { useAuth } from '../../hooks/useAuth';
import { EventService } from '../../services/eventService';
import { QRCodeService } from '../../services/qrCodeService';

interface RegistrationConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isProcessing: boolean;
}

const ConfirmationModal: React.FC<RegistrationConfirmationModalProps> = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  isProcessing 
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8" onClick={(e) => e.stopPropagation()}>
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
            <AlertTriangle className="h-8 w-8 text-red-600" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-2">
            Cancel Your Ticket?
          </h3>
          <p className="text-gray-600">
            Are you sure you want to cancel your ticket? This action cannot be undone.
          </p>
        </div>
        
        <div className="flex space-x-4">
          <button
            onClick={onClose}
            className="flex-1 bg-gray-100 text-gray-700 px-6 py-3 rounded-xl hover:bg-gray-200 transition-colors duration-200 font-semibold"
            disabled={isProcessing}
          >
            Keep Ticket
          </button>
          <button
            onClick={onConfirm}
            disabled={isProcessing}
            className="flex-1 bg-red-600 text-white px-6 py-3 rounded-xl hover:bg-red-700 transition-colors duration-200 font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
          >
            {isProcessing ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Cancelling...</span>
              </>
            ) : (
              <>
                <X className="h-5 w-5" />
                <span>Cancel Ticket</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

const RegistrationStatus: React.FC = () => {
  const { registration } = useRegistration();
  const { user } = useAuth();
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelSuccess, setCancelSuccess] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  if (!registration) return null;

  // Generate event-specific QR code
  const qrCodeValue = user?.uid && registration.eventId ? 
    QRCodeService.generateRegistrationQRUrl(user.uid, registration.eventId) : 
    `https://almalinks.com/connect?to=${user?.uid}`; // Fallback for legacy data

  const downloadQRCode = () => {
    const svg = document.getElementById('qr-code-svg-status');
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
        link.download = `alma-links-qr-${registration.name.replace(/\s+/g, '-').toLowerCase()}.png`;
        link.href = canvas.toDataURL();
        link.click();
      }
    };

    img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
  };

  const handleCancelTicket = async () => {
    if (!user?.uid || !registration.id) return;
    
    setIsCancelling(true);
    setCancelError(null);
    
    try {
      // Get the event ID from the registration
      const eventId = registration.eventId;
      
      if (!eventId) {
        throw new Error('Event ID not found in registration');
      }
      
      // Check if event has already started or passed
      const event = await EventService.getEventById(eventId);
      if (event) {
        const eventDate = new Date(event.date);
        const now = new Date();
        
        if (eventDate < now) {
          throw new Error('Cannot cancel ticket for an event that has already started or passed');
        }
      }
      
      // Remove user from event registrations
      await EventService.cancelRegistration(eventId, user.uid);
      
      setCancelSuccess(true);
      setShowCancelModal(false);
      
      // Reload page after 2 seconds to show updated state
      setTimeout(() => {
        window.location.reload();
      }, 2000);
      
    } catch (error: any) {
      console.error('❌ Error cancelling ticket:', error);
      setCancelError(error.message || 'Failed to cancel ticket. Please try again.');
    } finally {
      setIsCancelling(false);
    }
  };

  // Check if event date is in the future
  const isUpcomingEvent = () => {
    if (!registration.eventDate) return true; // Default to true if no date
    const eventDate = new Date(registration.eventDate);
    const now = new Date();
    return eventDate > now;
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
  const createGoogleCalendarUrl = (event: any) => {
    if (!event) return '';
    
    const { startTime, endTime } = formatGoogleCalendarDate(event.eventDate || event.date);
    
    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: event.eventName || event.name || 'Alma Links Event',
      dates: `${startTime}/${endTime}`,
      details: event.description || 'Join us for this exclusive Alma Links event!',
      location: event.location || 'Deli Vino, Netanya'
    });
    
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  };

  return (
    <div className="space-y-8">
      {/* Confirmation Modal */}
      <ConfirmationModal 
        isOpen={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        onConfirm={handleCancelTicket}
        isProcessing={isCancelling}
      />

      {/* Success Message */}
      {cancelSuccess && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center space-x-3">
          <Check className="h-5 w-5 text-green-600 flex-shrink-0" />
          <p className="text-green-600 font-medium">Your ticket has been successfully cancelled.</p>
        </div>
      )}

      {/* Error Message */}
      {cancelError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center space-x-3">
          <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0" />
          <p className="text-red-600 font-medium">{cancelError}</p>
        </div>
      )}

      {/* Registration Confirmation */}
      <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-500 rounded-full mb-4">
            <Check className="h-8 w-8 text-white" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            ✅ You're registered for Alma Links 4.0
          </h2>
          <p className="text-gray-600">
            Your spot at Alma Links 4.0 is confirmed
          </p>
        </div>

        {/* Registration Details with QR Code */}
        <div className="bg-gray-50 rounded-2xl p-6 mb-6">
          <h3 className="text-lg font-bold text-gray-900 mb-6 text-center">Your Registration Details</h3>
          
          <div className="grid md:grid-cols-2 gap-6">
            {/* Left Column - User Details */}
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-full overflow-hidden">
                  {user?.profileImage ? (
                    <img 
                      src={user.profileImage} 
                      alt={registration.name} 
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjRjNGNEY2Ii8+CjxjaXJjbGUgY3g9IjEwMCIgY3k9IjgwIiByPSIzMCIgZmlsbD0iIzlDQTNBRiIvPgo8ZWxsaXBzZSBjeD0iMTAwIiBjeT0iMTQwIiByeD0iNDAiIHJ5PSIyMCIgZmlsbD0iIzlDQTNBRiIvPgo8L3N2Zz4=';
                      }}
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-red-500 to-blue-500 flex items-center justify-center text-white font-bold text-lg">
                      {registration.name.charAt(0)}
                    </div>
                  )}
                </div>
                <div>
                  <div className="font-semibold text-gray-900">{registration.name}</div>
                  <div className="text-sm text-gray-600">{registration.work}</div>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Mail className="h-5 w-5 text-gray-400" />
                  <span className="text-gray-600">Email:</span>
                </div>
                <span className="font-medium text-gray-900 text-sm">{registration.email}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Phone className="h-5 w-5 text-gray-400" />
                  <span className="text-gray-600">Phone:</span>
                </div>
                <span className="font-medium text-gray-900">{registration.phone}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Briefcase className="h-5 w-5 text-gray-400" />
                  <span className="text-gray-600">Work:</span>
                </div>
                <span className="font-medium text-gray-900 text-sm">{registration.work}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Check className="h-5 w-5 text-gray-400" />
                  <span className="text-gray-600">Status:</span>
                </div>
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                  registration.status === 'attended' 
                    ? 'bg-blue-50 text-blue-800' 
                    : 'bg-green-100 text-green-800'
                }`}>
                  <Check className="h-4 w-4 mr-1" />
                  {registration.status === 'attended' ? 'Checked In' : 'Confirmed'}
                </span>
              </div>
            </div>

            {/* Right Column - QR Code */}
            <div className="flex flex-col items-center justify-center">
              <div className="text-sm text-gray-500 mb-3">Your Connection QR Code</div>
              <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                <QRCodeSVG
                  id="qr-code-svg-status"
                  value={qrCodeValue}
                  size={120}
                  bgColor="#ffffff"
                  fgColor="#000000"
                  level="M"
                  includeMargin={false}
                />
              </div>
              <div className="text-xs text-gray-400 mt-2 text-center mb-3">
                Scan to connect with other attendees
              </div>
              <button
                onClick={downloadQRCode}
                className="inline-flex items-center space-x-2 text-brand-light hover:text-blue-700 text-sm font-medium"
              >
                <Download className="h-4 w-4" />
                <span>Download QR Code</span>
              </button>
            </div>
          </div>
        </div>

        {/* Event Details */}
        <div className="bg-gradient-to-br from-red-50 to-blue-50 rounded-2xl p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Event Details</h3>
          <div className="space-y-3">
            <div className="flex items-center space-x-3">
              <Calendar className="h-5 w-5 text-red-700" />
              <span className="text-gray-700">June 28th, 2025</span>
            </div>
            <div className="flex items-center space-x-3">
              <Clock className="h-5 w-5 text-brand-light" />
              <span className="text-gray-700">18:30 - 22:00</span>
            </div>
            <div className="flex items-center space-x-3">
              <MapPin className="h-5 w-5 text-red-700" />
              <span className="text-gray-700">Deli Vino, Netanya</span>
            </div>
          </div>
          
          {/* Add to Calendar Button */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <a
              href={createGoogleCalendarUrl(registration)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center space-x-2 bg-white text-brand-light hover:text-blue-700 hover:bg-blue-50 border border-blue-200 px-4 py-2 rounded-lg transition-colors duration-200 font-medium"
            >
              <CalendarPlus className="h-5 w-5" />
              <span>Add to Google Calendar</span>
            </a>
          </div>
        </div>

        {/* Cancel Ticket Button - Only show for upcoming events */}
        {isUpcomingEvent() && (
          <div className="mt-6 text-center">
            <button
              onClick={() => setShowCancelModal(true)}
              className="bg-red-100 text-red-700 px-6 py-3 rounded-xl hover:bg-red-200 transition-colors duration-200 font-medium inline-flex items-center space-x-2"
            >
              <X className="h-5 w-5" />
              <span>Cancel Ticket</span>
            </button>
            <p className="text-xs text-gray-500 mt-2">
              You can cancel your ticket up until the event starts
            </p>
          </div>
        )}
      </div>

      {/* Digital Ticket */}
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
            <div className="text-2xl font-bold">Alma Links 4.0</div>
            <div className="opacity-90">June 28th, 2025 • 18:30</div>
            <div className="opacity-90">Deli Vino, Netanya</div>
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
                    value={qrCodeValue}
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

          {/* Cancel Ticket Button - Only show for upcoming events */}
          {isUpcomingEvent() && (
            <div className="mt-4 pt-4 border-t border-white/20 text-center">
              <button
                onClick={() => setShowCancelModal(true)}
                className="bg-white/20 hover:bg-white/30 text-white px-6 py-2 rounded-full transition-all duration-300 font-medium inline-flex items-center space-x-2 border border-white/30"
              >
                <X className="h-4 w-4" />
                <span>Cancel Ticket</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Additional Information */}
      <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100">
        <h3 className="text-xl font-bold text-gray-900 mb-4">What to Expect</h3>
        <div className="space-y-4">
          <div className="flex items-start space-x-3">
            <div className="w-2 h-2 bg-red-600 rounded-full mt-2"></div>
            <div>
              <div className="font-medium text-gray-900">Networking Reception</div>
              <div className="text-gray-600 text-sm">Connect with 250+ founders, investors, and tech leaders</div>
            </div>
          </div>
          <div className="flex items-start space-x-3">
            <div className="w-2 h-2 bg-brand-dark rounded-full mt-2"></div>
            <div>
              <div className="font-medium text-gray-900">Complimentary Wine</div>
              <div className="text-gray-600 text-sm">Enjoy premium wine selection upon arrival</div>
            </div>
          </div>
          <div className="flex items-start space-x-3">
            <div className="w-2 h-2 bg-red-600 rounded-full mt-2"></div>
            <div>
              <div className="font-medium text-gray-900">AI Agents Discussion</div>
              <div className="text-gray-600 text-sm">Deep dive into the future of AI in business</div>
            </div>
          </div>
          <div className="flex items-start space-x-3">
            <div className="w-2 h-2 bg-brand-dark rounded-full mt-2"></div>
            <div>
              <div className="font-medium text-gray-900">Food Available</div>
              <div className="text-gray-600 text-sm">Delicious food options available for purchase</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegistrationStatus;