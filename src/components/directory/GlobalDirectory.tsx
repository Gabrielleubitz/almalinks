import React, { useState, useEffect, useRef } from 'react';
import { Search, Users, MapPin, Briefcase, Linkedin, Mail, UserPlus, Clock, Filter } from 'lucide-react';
import { DirectoryService } from '../../services/directoryService';
import { PrivacyService } from '../../services/privacyService';
import { ConnectionService } from '../../services/connectionService';
import { EventService } from '../../services/eventService';
import { UserDirectoryEntry } from '../../types/connection';
import { useAuth } from '../../hooks/useAuth';

interface GlobalDirectoryProps {
  eventId?: string; // Optional: filter to specific event
  className?: string;
}

const GlobalDirectory: React.FC<GlobalDirectoryProps> = ({ eventId, className = '' }) => {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState<UserDirectoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [connectingUsers, setConnectingUsers] = useState<Set<string>>(new Set());
  const [rateLimitStatus, setRateLimitStatus] = useState({
    requests: 0,
    remaining: 50,
    resetDate: ''
  });
  const [events, setEvents] = useState<any[]>([]);
  const [selectedEventFilter, setSelectedEventFilter] = useState<string>(eventId || '');
  
  const searchTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (user?.uid) {
      loadRateLimitStatus();
      loadEvents();
      performSearch();
    }
  }, [user, selectedEventFilter]);

  const loadRateLimitStatus = async () => {
    if (!user?.uid) return;
    
    try {
      const status = await PrivacyService.getRateLimitStatus(user.uid);
      setRateLimitStatus(status);
    } catch (error) {
      console.error('❌ Error loading rate limit status:', error);
    }
  };

  const loadEvents = async () => {
    if (!user?.uid) return;

    try {
      // Get all events the user is registered for
      const allEvents = await EventService.getPublicEvents();
      const userEvents = [];

      for (const event of allEvents) {
        const registration = await EventService.getUserRegistration(event.id, user.uid);
        if (registration) {
          userEvents.push(event);
        }
      }

      setEvents(userEvents);
    } catch (error) {
      console.error('❌ Error loading events:', error);
    }
  };

  const performSearch = async (query: string = searchQuery) => {
    if (!user?.uid) return;

    try {
      setLoading(true);

      let results: UserDirectoryEntry[];

      if (selectedEventFilter) {
        // Search within specific event
        results = await DirectoryService.getEventUsers(selectedEventFilter, user.uid, { limit: 50 });
        
        // Apply additional text filter if provided
        if (query.trim()) {
          const queryLower = query.toLowerCase();
          results = results.filter(userEntry =>
            userEntry.name.toLowerCase().includes(queryLower) ||
            userEntry.work.toLowerCase().includes(queryLower)
          );
        }
      } else {
        // Global search
        results = await DirectoryService.searchUsers(query, user.uid, {
          limit: 50,
          includeEventOnly: true // Include event-only users if we share events
        });
      }

      setUsers(results);
    } catch (error) {
      console.error('❌ Error searching users:', error);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);

    // Debounce search
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      performSearch(query);
    }, 300);
  };

  const handleConnect = async (targetUser: UserDirectoryEntry) => {
    if (!user?.uid || connectingUsers.has(targetUser.uid)) return;

    // Check rate limit
    if (rateLimitStatus.remaining <= 0) {
      alert('You\'ve reached your daily limit for connection requests (50/day). Please try again tomorrow.');
      return;
    }

    try {
      setConnectingUsers(prev => new Set([...prev, targetUser.uid]));

      // For now, create direct connection (we'll add connection requests later)
      // In the future, this would send a connection request instead
      await ConnectionService.createConnection(user.uid, targetUser.uid, selectedEventFilter || '');
      
      // Update rate limit status
      await loadRateLimitStatus();
      
      alert(`✅ Successfully connected with ${targetUser.name}!`);
      
      // Remove from search results or mark as connected
      setUsers(prevUsers => prevUsers.filter(u => u.uid !== targetUser.uid));

    } catch (error) {
      console.error('❌ Error connecting with user:', error);
      alert('Failed to connect. Please try again.');
    } finally {
      setConnectingUsers(prev => {
        const newSet = new Set(prev);
        newSet.delete(targetUser.uid);
        return newSet;
      });
    }
  };

  const formatPosition = (position?: string): string => {
    if (!position) return '';
    return ConnectionService.formatPosition(position);
  };

  const getAvatarColor = (name: string) => {
    const colors = [
      'from-red-500 to-red-600',
      'from-blue-500 to-blue-600',
      'from-green-500 to-green-600',
      'from-purple-500 to-purple-600',
      'from-yellow-500 to-yellow-600',
      'from-pink-500 to-pink-600'
    ];
    
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    return colors[Math.abs(hash) % colors.length];
  };

  const getEventName = (eventId: string) => {
    const event = events.find(e => e.id === eventId);
    return event ? event.name : 'Event';
  };

  return (
    <div className={`bg-white rounded-3xl shadow-xl p-6 border border-gray-100 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <Users className="h-6 w-6 text-blue-600" />
          <h3 className="text-xl font-bold text-gray-900">
            {selectedEventFilter ? `${getEventName(selectedEventFilter)} Directory` : 'Global Directory'}
          </h3>
        </div>
        
        {/* Rate Limit Display */}
        <div className="flex items-center space-x-2 text-sm">
          <Clock className="h-4 w-4 text-gray-500" />
          <span className="text-gray-600">
            Daily connections: {rateLimitStatus.requests}/50
          </span>
          {rateLimitStatus.remaining === 0 && (
            <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs">
              Limit reached
            </span>
          )}
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name or company..."
            value={searchQuery}
            onChange={handleSearchChange}
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Event Filter */}
        <div className="relative">
          <select
            value={selectedEventFilter}
            onChange={(e) => setSelectedEventFilter(e.target.value)}
            className="appearance-none bg-white border border-gray-300 rounded-xl px-4 py-3 pr-10 focus:ring-2 focus:ring-blue-500 focus:border-transparent min-w-[200px]"
          >
            <option value="">All Events</option>
            {events.map(event => (
              <option key={event.id} value={event.id}>
                {event.name}
              </option>
            ))}
          </select>
          <Filter className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="text-center py-8">
          <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Searching directory...</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && users.length === 0 && searchQuery.trim() && (
        <div className="text-center py-8 bg-gray-50 rounded-2xl">
          <Search className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h4 className="text-lg font-semibold text-gray-900 mb-2">No users found</h4>
          <p className="text-gray-600 mb-4">
            Try adjusting your search query or event filter.
          </p>
        </div>
      )}

      {/* User Results */}
      {!loading && users.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {users.map((userEntry) => {
            const isConnecting = connectingUsers.has(userEntry.uid);
            const avatarColor = getAvatarColor(userEntry.name);

            return (
              <div
                key={userEntry.uid}
                className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-all duration-300"
              >
                {/* User Info */}
                <div className="flex items-center space-x-3 mb-3">
                  <div className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0">
                    {userEntry.profileImage ? (
                      <img
                        src={userEntry.profileImage}
                        alt={userEntry.name}
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
                      className={`w-full h-full bg-gradient-to-br ${avatarColor} flex items-center justify-center text-white font-bold text-lg ${
                        userEntry.profileImage ? 'hidden' : 'flex'
                      }`}
                    >
                      {userEntry.name.charAt(0)}
                    </div>
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900 truncate">{userEntry.name}</h4>
                    <p className="text-sm text-gray-600 truncate">{userEntry.work}</p>
                  </div>
                </div>

                {/* Position */}
                {userEntry.position && (
                  <div className="flex items-center text-xs text-gray-600 mb-2">
                    <Briefcase className="h-3.5 w-3.5 mr-1.5 text-gray-500" />
                    <span className="truncate">{formatPosition(userEntry.position)}</span>
                  </div>
                )}

                {/* Shared Events */}
                {selectedEventFilter && (
                  <div className="flex items-center text-xs text-gray-600 mb-3">
                    <MapPin className="h-3.5 w-3.5 mr-1.5 text-gray-500" />
                    <span className="truncate">{getEventName(selectedEventFilter)}</span>
                  </div>
                )}

                {/* Connect Button */}
                <button
                  onClick={() => handleConnect(userEntry)}
                  disabled={isConnecting || rateLimitStatus.remaining <= 0}
                  className={`w-full py-2 px-4 rounded-lg font-medium text-sm transition-all duration-200 flex items-center justify-center space-x-2 ${
                    isConnecting
                      ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                      : rateLimitStatus.remaining <= 0
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-gradient-to-r from-red-700 to-blue-600 text-white hover:shadow-lg'
                  }`}
                >
                  {isConnecting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                      <span>Connecting...</span>
                    </>
                  ) : rateLimitStatus.remaining <= 0 ? (
                    <>
                      <Clock className="h-4 w-4" />
                      <span>Daily limit reached</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="h-4 w-4" />
                      <span>Connect</span>
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Info Footer */}
      {!loading && users.length > 0 && (
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
          <p className="text-sm text-blue-800">
            <strong>{users.length} user{users.length !== 1 ? 's' : ''} found.</strong>{' '}
            {selectedEventFilter 
              ? 'These users are registered for the same event as you.' 
              : 'You can connect with users based on your privacy settings.'
            }
          </p>
        </div>
      )}
    </div>
  );
};

export default GlobalDirectory;