import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, 
  ArrowLeft, 
  AlertCircle, 
  CheckCircle, 
  X, 
  ChevronDown, 
  Calendar,
  Mic
} from 'lucide-react';
import { SpeakerService, EventSpeaker } from '../../services/speakerService';
import { EventService, EventData } from '../../services/eventService';
import { useAuth } from '../../hooks/useAuth';
import AdminHeader from '../../components/admin/AdminHeader';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '../../firebase/config';
import Toast from '../../components/ui/Toast';
import SpeakerAssignModal from '../../components/admin/SpeakerAssignModal';


const SpeakerManagement: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [events, setEvents] = useState<EventData[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [eventSpeakers, setEventSpeakers] = useState<EventSpeaker[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [speakersLoading, setSpeakersLoading] = useState(false);
  
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Toast state
  const [toast, setToast] = useState<{
    visible: boolean;
    message: string;
    type: 'success' | 'error';
  }>({
    visible: false,
    message: '',
    type: 'success'
  });
  
  
  // Speaker assignment state
  const [showAssignModal, setShowAssignModal] = useState(false);

  useEffect(() => {
    loadEvents();
  }, []);

  useEffect(() => {
    if (selectedEventId) {
      loadEventSpeakers();
    }
  }, [selectedEventId]);

  const loadEvents = async () => {
    try {
      const eventsData = await EventService.getAllEvents();
      setEvents(eventsData);
      
      // Auto-select the first event if none selected
      if (!selectedEventId && eventsData.length > 0) {
        setSelectedEventId(eventsData[0].id);
      }
    } catch (error) {
      console.error('❌ Error loading events:', error);
      setError('Failed to load events');
    } finally {
      setLoading(false);
    }
  };

  const loadEventSpeakers = async () => {
    if (!selectedEventId) return;
    
    try {
      setSpeakersLoading(true);
      console.log('🔍 Loading speakers for event:', selectedEventId);
      
      // Test collection access first
      await SpeakerService.testSpeakersCollection();
      
      console.log('🔄 Testing inline speaker retrieval...');
      
      // Inline test - bypass service entirely
      try {
        alert('About to fetch speakers inline for eventId: ' + selectedEventId);
        const { collection, getDocs } = await import('firebase/firestore');
        const { db } = await import('../../firebase/config');
        
        const speakersRef = collection(db, 'speakers');
        const allSnapshot = await getDocs(speakersRef);
        console.error('📊 INLINE: Found ' + allSnapshot.docs.length + ' speakers total');
        
        const allSpeakers = allSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        const eventSpeakers = allSpeakers.filter(speaker => speaker.eventId === selectedEventId);
        console.error('📊 INLINE: Found ' + eventSpeakers.length + ' speakers for event ' + selectedEventId);
        console.error('📊 INLINE: Speakers:', eventSpeakers);
        
        setEventSpeakers(eventSpeakers as any);
        return;
      } catch (inlineError) {
        console.error('❌ Inline error:', inlineError);
      }
      
      console.log('🔄 About to call SpeakerService.getEventSpeakersNew directly...');
      const speakers = await SpeakerService.getEventSpeakersNew(selectedEventId);
      console.log('🔄 SpeakerService.getEventSpeakersNew completed directly');
      console.log('📄 Speakers received:', speakers);
      console.log('📄 Speakers type:', typeof speakers, 'Array?', Array.isArray(speakers));
      
      setEventSpeakers(speakers);
    } catch (error) {
      console.error('❌ Error loading event speakers:', error);
      console.error('❌ Error details:', error);
    } finally {
      setSpeakersLoading(false);
    }
  };


  const handleOpenAssignModal = () => {
    if (!selectedEventId) {
      setError('Please select an event first');
      return;
    }
    
    setShowAssignModal(true);
  };

  const handleRemoveSpeaker = async (speakerId: string) => {
    if (!selectedEventId) return;
    
    if (!confirm('Are you sure you want to remove this speaker from the event?')) {
      return;
    }
    
    try {
      await SpeakerService.deleteSpeaker(speakerId);
      
      // Reload speakers
      await loadEventSpeakers();
      
      showToast('Speaker removed successfully!', 'success');
    } catch (error: any) {
      console.error('❌ Error removing speaker:', error);
      showToast(error.message || 'Failed to remove speaker', 'error');
    }
  };

  const formatDate = (timestamp: any): string => {
    if (!timestamp) return 'N/A';
    
    let date;
    if (timestamp?.toDate) {
      date = timestamp.toDate();
    } else if (timestamp instanceof Date) {
      date = timestamp;
    } else {
      date = new Date(timestamp);
    }
    
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({
      visible: true,
      message,
      type
    });
    
    // Auto-hide after 3 seconds
    setTimeout(() => {
      setToast(prev => ({ ...prev, visible: false }));
    }, 3000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
        <AdminHeader title="Speaker Management" />
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">Loading speaker management...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
      <AdminHeader 
        title="Speaker Management" 
        subtitle="Manage speakers and their uploaded files"
      />

      {/* Toast Notification */}
      {toast.visible && (
        <Toast 
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(prev => ({ ...prev, visible: false }))}
        />
      )}

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Back Button */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/admin')}
            className="inline-flex items-center space-x-2 text-gray-600 hover:text-gray-800 transition-colors duration-200 font-medium"
          >
            <ArrowLeft className="h-5 w-5" />
            <span>Back to Admin Tools</span>
          </button>
        </div>


        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center space-x-3">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
            <p className="text-red-600 text-sm">{error}</p>
            <button
              onClick={() => setError(null)}
              className="text-red-600 hover:text-red-700 ml-auto"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Success Message */}
        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl flex items-center space-x-3">
            <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
            <p className="text-green-600 text-sm">{success}</p>
            <button
              onClick={() => setSuccess(null)}
              className="text-green-600 hover:text-green-700 ml-auto"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Event Selection */}
        <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100 mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Event Selection</h2>
            <Calendar className="h-6 w-6 text-gray-400" />
          </div>
          
          {events.length === 0 ? (
            <div className="text-center py-8">
              <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 mb-4">No events found</p>
              <button
                onClick={() => navigate('/admin/events/create')}
                className="bg-gradient-to-r from-brand-blue-dark to-brand-blue-light text-white px-6 py-3 rounded-xl hover:shadow-lg transition-all duration-300 font-semibold inline-flex items-center space-x-2"
              >
                <span>Create First Event</span>
              </button>
            </div>
          ) : (
            <div>
              <label htmlFor="event-select" className="block text-sm font-medium text-gray-700 mb-3">
                Select Event to Manage:
              </label>
              <div className="relative">
                <select
                  id="event-select"
                  value={selectedEventId}
                  onChange={(e) => setSelectedEventId(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 appearance-none bg-white pr-10"
                >
                  <option value="">Select an event...</option>
                  {events.map(event => (
                    <option key={event.id} value={event.id}>
                      {event.name} - {new Date(event.date).toLocaleDateString()} ({event.status})
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
              </div>
              
              {selectedEventId && (
                <div className="mt-4 p-4 bg-purple-50 rounded-xl border border-purple-200">
                  <div className="flex items-center space-x-3">
                    <Calendar className="h-5 w-5 text-brand-dark" />
                    <div>
                      <div className="font-semibold text-purple-900">
                        {events.find(e => e.id === selectedEventId)?.name}
                      </div>
                      <div className="text-sm text-purple-700">
                        {new Date(events.find(e => e.id === selectedEventId)?.date || '').toLocaleDateString()} • 
                        {events.find(e => e.id === selectedEventId)?.location}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {selectedEventId && (
          <>
            {/* Speakers Section */}
            <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100 mb-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Event Speakers</h2>
                <button
                  onClick={handleOpenAssignModal}
                  className="bg-gradient-to-r from-brand-blue-dark to-brand-blue-light text-white px-4 py-2 rounded-xl hover:shadow-lg transition-all duration-300 font-medium flex items-center space-x-2"
                >
                  <Users className="h-4 w-4" />
                  <span>Assign Speaker</span>
                </button>
              </div>
              
              {speakersLoading ? (
                <div className="text-center py-8">
                  <div className="w-8 h-8 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-gray-600">Loading speakers...</p>
                </div>
              ) : eventSpeakers.length === 0 ? (
                <div className="text-center py-8 bg-gray-50 rounded-2xl">
                  <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 mb-2">No speakers assigned to this event</p>
                  <p className="text-gray-500 text-sm">Assign speakers using the button above.</p>
                </div>
              ) : (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {eventSpeakers.map((speaker) => (
                    <div 
                      key={speaker.id}
                      className="p-4 rounded-xl border border-gray-200 hover:border-blue-200 bg-white hover:shadow-md transition-all duration-200"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 rounded-full overflow-hidden">
                            {speaker.imageUrl ? (
                              <img 
                                src={speaker.imageUrl} 
                                alt={speaker.name} 
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjRjNGNEY2Ii8+CjxjaXJjbGUgY3g9IjEwMCIgY3k9IjgwIiByPSIzMCIgZmlsbD0iIzlDQTNBRiIvPgo8ZWxsaXBzZSBjeD0iMTAwIiBjeT0iMTQwIiByeD0iNDAiIHJ5PSIyMCIgZmlsbD0iIzlDQTNBRiIvPgo8L3N2Zz4=';
                                }}
                              />
                            ) : (
                              <div className="w-full h-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white font-bold">
                                {speaker.name.charAt(0)}
                              </div>
                            )}
                          </div>
                          <div>
                            <h4 className="font-medium text-gray-900">{speaker.name}</h4>
                            <p className="text-sm text-gray-600">{speaker.title || speaker.company || 'Speaker'}</p>
                            {speaker.email && <p className="text-xs text-gray-500">{speaker.email}</p>}
                            <p className="text-xs text-gray-500 mt-1">
                              Created {formatDate(speaker.createdAt)}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex justify-end">
                          <button
                            onClick={() => handleRemoveSpeaker(speaker.id)}
                            className="text-xs px-3 py-1 rounded-full bg-red-100 text-red-700 hover:bg-red-200 font-medium"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Speaker Information Note */}
            <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100">
              <div className="text-center py-12">
                <Mic className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Speaker Management Complete</h3>
                <p className="text-gray-600 max-w-md mx-auto">
                  Speakers are now managed as content records. You can create, edit, and remove speakers using the controls above.
                </p>
              </div>
            </div>
          </>
        )}
      </div>


      {/* Speaker Assignment Modal */}
      <SpeakerAssignModal
        isOpen={showAssignModal}
        onClose={() => setShowAssignModal(false)}
        eventId={selectedEventId}
        selectedEventName={events.find(e => e.id === selectedEventId)?.name}
        onSpeakerCreated={loadEventSpeakers}
      />
    </div>
  );
};

export default SpeakerManagement;