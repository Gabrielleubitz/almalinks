import React, { useState, useEffect } from 'react';
import { 
  X, 
  UserPlus, 
  Search, 
  Users, 
  ArrowRight, 
  AlertCircle,
  CheckCircle,
  Link2,
  Calendar
} from 'lucide-react';
import { AdminConnectionService } from '../../services/adminConnectionService';
import { EventService } from '../../services/eventService';
import { useAuth } from '../../hooks/useAuth';

interface UserConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedUser: {
    uid: string;
    name: string;
    email: string;
    work?: string;
  } | null;
}

const UserConnectionModal: React.FC<UserConnectionModalProps> = ({
  isOpen,
  onClose,
  selectedUser
}) => {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedTargetUser, setSelectedTargetUser] = useState<any | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<string>('');
  const [connectionReason, setConnectionReason] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadEvents();
      setSearchQuery('');
      setSearchResults([]);
      setSelectedTargetUser(null);
      setSuccess(null);
      setError(null);
      setConnectionReason('');
      setSelectedEvent('');
    }
  }, [isOpen]);

  const loadEvents = async () => {
    try {
      const eventsList = await EventService.getPublicEvents();
      setEvents(eventsList);
    } catch (error) {
      console.error('❌ Error loading events:', error);
    }
  };

  const handleUserSearch = async (query: string) => {
    if (!query.trim() || !selectedUser) {
      setSearchResults([]);
      return;
    }

    try {
      setLoading(true);
      const results = await AdminConnectionService.searchUsersForConnection(
        query,
        [selectedUser.uid], // Exclude the selected user
        selectedEvent || undefined
      );
      setSearchResults(results);
    } catch (error) {
      console.error('❌ Error searching users:', error);
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    if (!selectedUser || !selectedTargetUser || !user?.uid) return;

    try {
      setConnecting(true);
      setError(null);

      const connectionId = await AdminConnectionService.createAdminConnection(
        selectedUser.uid,
        selectedTargetUser.uid,
        user.uid,
        {
          eventId: selectedEvent || undefined,
          reason: connectionReason || 'Admin manual connection via user management'
        }
      );

      setSuccess(`✅ Successfully connected ${selectedUser.name} with ${selectedTargetUser.name}!`);
      
      // Clear form
      setSelectedTargetUser(null);
      setSearchQuery('');
      setSearchResults([]);
      setConnectionReason('');

    } catch (error: any) {
      console.error('❌ Error creating connection:', error);
      setError(error.message || 'Failed to create connection');
    } finally {
      setConnecting(false);
    }
  };


  if (!isOpen || !selectedUser) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50">
      <div className="flex min-h-screen items-center justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="inline-block align-bottom bg-white rounded-2xl px-6 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full sm:p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-50 rounded-lg">
                <UserPlus className="h-6 w-6 text-brand-light" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Connect User
                </h3>
                <p className="text-sm text-gray-600">
                  Connect <strong>{selectedUser.name}</strong> with another user
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Success Message */}
          {success && (
            <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center space-x-3">
              <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
              <p className="text-green-800 text-sm">{success}</p>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center space-x-3">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}

          <div className="space-y-6">
            {/* Event Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Event (Optional)
              </label>
              <select
                value={selectedEvent}
                onChange={(e) => setSelectedEvent(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Global Connection (No Event)</option>
                {events.map(event => (
                  <option key={event.id} value={event.id}>
                    {event.name}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-500">
                Leave empty for a global connection not tied to any specific event
              </p>
            </div>

            {/* User Search */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search for User to Connect With
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by name, email, or company..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    handleUserSearch(e.target.value);
                  }}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Search Results */}
              {loading && (
                <div className="mt-2 p-4 text-center">
                  <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                  <p className="text-sm text-gray-600">Searching users...</p>
                </div>
              )}

              {!loading && searchResults.length > 0 && (
                <div className="mt-2 bg-white border border-gray-200 rounded-lg max-h-60 overflow-y-auto">
                  {searchResults.map((userResult) => {
                    
                    
                    return (
                      <button
                        key={userResult.uid}
                        onClick={() => {
                          setSelectedTargetUser(userResult);
                          setSearchQuery('');
                          setSearchResults([]);
                        }}
                        className="w-full p-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0 transition-colors"
                      >
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0">
                            {userResult.profileImage ? (
                              <img
                                src={userResult.profileImage}
                                alt={userResult.name}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.style.display = 'none';
                                  const fallback = target.nextElementSibling as HTMLElement;
                                  if (fallback) fallback.style.display = 'flex';
                                }}
                              />
                            ) : null}
                            <div
                              className={`w-full h-full bg-brand-dark flex items-center justify-center text-white font-bold text-sm ${
                                userResult.profileImage ? 'hidden' : 'flex'
                              }`}
                            >
                              {userResult.name.charAt(0)}
                            </div>
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-gray-900">{userResult.name}</p>
                            <p className="text-sm text-gray-600">{userResult.work}</p>
                            <div className="flex items-center justify-between mt-1">
                              <p className="text-xs text-gray-500">{userResult.email}</p>
                              <div className="flex items-center space-x-2 text-xs text-gray-500">
                                <Users className="h-3 w-3" />
                                <span>{userResult.connectionCount} connections</span>
                                {selectedEvent && (
                                  <span className={`px-1 rounded ${
                                    userResult.isRegisteredForEvent 
                                      ? 'bg-green-100 text-green-700' 
                                      : 'bg-gray-100 text-gray-600'
                                  }`}>
                                    {userResult.isRegisteredForEvent ? '✓ Event' : '○ No event'}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {!loading && searchQuery.trim() && searchResults.length === 0 && (
                <div className="mt-2 p-4 text-center text-gray-500">
                  <Users className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm">No users found for "{searchQuery}"</p>
                </div>
              )}
            </div>

            {/* Selected Target User */}
            {selectedTargetUser && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-blue-900 mb-2">Connection Preview</h4>
                <div className="flex items-center justify-center space-x-4">
                  <div className="text-center">
                    <div className="w-12 h-12 rounded-full bg-brand-dark flex items-center justify-center text-white font-bold mx-auto mb-2">
                      {selectedUser.name.charAt(0)}
                    </div>
                    <p className="text-sm font-medium text-gray-900">{selectedUser.name}</p>
                    <p className="text-xs text-gray-600">{selectedUser.work}</p>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <ArrowRight className="h-5 w-5 text-brand-light" />
                    <Link2 className="h-4 w-4 text-brand-light" />
                    <ArrowRight className="h-5 w-5 text-brand-light" />
                  </div>
                  
                  <div className="text-center">
                    <div className={`w-12 h-12 rounded-full bg-brand-dark flex items-center justify-center text-white font-bold mx-auto mb-2`}>
                      {selectedTargetUser.name.charAt(0)}
                    </div>
                    <p className="text-sm font-medium text-gray-900">{selectedTargetUser.name}</p>
                    <p className="text-xs text-gray-600">{selectedTargetUser.work}</p>
                  </div>
                </div>
                
                {selectedEvent && (
                  <div className="mt-3 pt-3 border-t border-blue-200">
                    <div className="flex items-center justify-center space-x-2 text-sm text-blue-700">
                      <Calendar className="h-4 w-4" />
                      <span>Event: {events.find(e => e.id === selectedEvent)?.name}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Connection Reason */}
            {selectedTargetUser && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Connection Reason (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g., Similar business interests, networking introduction..."
                  value={connectionReason}
                  onChange={(e) => setConnectionReason(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="mt-1 text-xs text-gray-500">
                  This will be logged for audit purposes
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="mt-8 flex justify-end space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors font-medium"
            >
              Cancel
            </button>
            
            {selectedTargetUser && (
              <button
                onClick={handleConnect}
                disabled={connecting}
                className="px-6 py-2 bg-gradient-to-r from-brand-blue-dark to-brand-blue-light text-white rounded-lg hover:shadow-lg transition-all duration-300 font-semibold disabled:opacity-50 flex items-center space-x-2"
              >
                {connecting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Connecting...</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4" />
                    <span>Create Connection</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserConnectionModal;