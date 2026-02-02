import React, { useState, useEffect } from 'react';
import { 
  Users, 
  UserPlus, 
  Search, 
  ArrowRight, 
  X, 
  Check, 
  AlertCircle, 
  Calendar,
  Link2,
  Zap,
  Handshake
} from 'lucide-react';
import { AdminConnectionService, UserConnectionStats } from '../../services/adminConnectionService';
import { EventService } from '../../services/eventService';
import { useAuth } from '../../hooks/useAuth';

interface AdminConnectionManagerProps {
  className?: string;
}

const AdminConnectionManager: React.FC<AdminConnectionManagerProps> = ({ className = '' }) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'stats' | 'connect' | 'bulk'>('stats');
  const [loading, setLoading] = useState(false);
  const [userStats, setUserStats] = useState<UserConnectionStats[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<string>('');
  
  // Connection creation state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [connecting, setConnecting] = useState(false);
  const [connectionReason, setConnectionReason] = useState('');

  // Bulk connection state
  const [bulkConnecting, setBulkConnecting] = useState(false);
  const [bulkResults, setBulkResults] = useState<any>(null);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const [stats, eventsList] = await Promise.all([
        AdminConnectionService.getUserConnectionStats(50),
        EventService.getPublicEvents()
      ]);
      
      setUserStats(stats);
      setEvents(eventsList);
    } catch (error) {
      console.error('❌ Error loading admin connection data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUserSearch = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      const results = await AdminConnectionService.searchUsersForConnection(
        query,
        selectedUsers, // Exclude already selected users
        selectedEvent || undefined
      );
      setSearchResults(results);
    } catch (error) {
      console.error('❌ Error searching users:', error);
      setSearchResults([]);
    }
  };

  const handleSelectUser = (userId: string) => {
    if (!selectedUsers.includes(userId)) {
      setSelectedUsers([...selectedUsers, userId]);
      // Remove from search results
      setSearchResults(prev => prev.filter(user => user.uid !== userId));
      setSearchQuery('');
    }
  };

  const handleRemoveUser = (userId: string) => {
    setSelectedUsers(prev => prev.filter(id => id !== userId));
  };

  const handleCreateConnections = async () => {
    if (selectedUsers.length < 2 || !user?.uid) return;

    try {
      setConnecting(true);
      const connections = [];

      // Create connections between all selected user pairs
      for (let i = 0; i < selectedUsers.length; i++) {
        for (let j = i + 1; j < selectedUsers.length; j++) {
          try {
            const connectionId = await AdminConnectionService.createAdminConnection(
              selectedUsers[i],
              selectedUsers[j],
              user.uid,
              {
                eventId: selectedEvent || undefined,
                reason: connectionReason || 'Admin manual connection'
              }
            );
            connections.push(connectionId);
          } catch (error) {
            console.error('❌ Error creating connection:', error);
          }
        }
      }

      alert(`✅ Successfully created ${connections.length} connections!`);
      
      // Reset form
      setSelectedUsers([]);
      setSearchQuery('');
      setSearchResults([]);
      setConnectionReason('');
      
      // Reload stats
      loadInitialData();

    } catch (error) {
      console.error('❌ Error creating admin connections:', error);
      alert('Failed to create connections. Please try again.');
    } finally {
      setConnecting(false);
    }
  };

  const handleBulkConnect = async () => {
    if (!selectedEvent || !user?.uid) return;

    try {
      setBulkConnecting(true);
      const results = await AdminConnectionService.bulkConnectEventUsers(
        selectedEvent,
        user.uid,
        {
          connectAll: true,
          reason: 'Admin bulk connection for event'
        }
      );
      
      setBulkResults(results);
      loadInitialData(); // Refresh stats

    } catch (error) {
      console.error('❌ Error in bulk connect:', error);
      alert('Failed to bulk connect users. Please try again.');
    } finally {
      setBulkConnecting(false);
    }
  };

  const getSelectedUserInfo = (userId: string) => {
    return userStats.find(user => user.uid === userId);
  };

  const getConnectionTypeIcon = (type: 'auto' | 'manual' | 'scan') => {
    switch (type) {
      case 'auto':
        return <Zap className="h-4 w-4 text-green-600" />;
      case 'manual':
        return <UserPlus className="h-4 w-4 text-brand-light" />;
      case 'scan':
      default:
        return <Handshake className="h-4 w-4 text-brand-dark" />;
    }
  };

  return (
    <div className={`bg-white rounded-2xl sm:rounded-3xl shadow-xl p-4 sm:p-6 border border-gray-100 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
          <Users className="h-5 w-5 sm:h-6 sm:w-6 text-brand-light flex-shrink-0" />
          <h3 className="text-lg sm:text-xl font-bold text-gray-900 truncate">Connection Management</h3>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 bg-gray-100 rounded-lg p-1 mb-4 sm:mb-6">
        {[
          { id: 'stats', label: 'User Stats', icon: Users },
          { id: 'connect', label: 'Connect Users', icon: UserPlus },
          { id: 'bulk', label: 'Bulk Connect', icon: Link2 }
        ].map(tab => {
          const IconComponent = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 flex items-center justify-center space-x-1 sm:space-x-2 py-2 sm:py-2 px-2 sm:px-4 rounded-lg transition-all min-h-[44px] sm:min-h-0 ${
                activeTab === tab.id
                  ? 'bg-white text-brand-light shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              <IconComponent className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
              <span className="font-medium text-xs sm:text-sm whitespace-nowrap">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Stats Tab */}
      {activeTab === 'stats' && (
        <div>
          {loading ? (
            <div className="text-center py-8">
              <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-600">Loading user statistics...</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
                <div className="bg-blue-50 p-3 sm:p-4 rounded-xl">
                  <div className="flex items-center space-x-2 sm:space-x-3">
                    <Users className="h-6 w-6 sm:h-8 sm:w-8 text-brand-light flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm text-brand-light font-medium">Total Users</p>
                      <p className="text-xl sm:text-2xl font-bold text-blue-900">{userStats.length}</p>
                    </div>
                  </div>
                </div>
                <div className="bg-green-50 p-3 sm:p-4 rounded-xl">
                  <div className="flex items-center space-x-2 sm:space-x-3">
                    <Zap className="h-6 w-6 sm:h-8 sm:w-8 text-green-600 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm text-green-600 font-medium">Auto Connections</p>
                      <p className="text-xl sm:text-2xl font-bold text-green-900">
                        {userStats.reduce((sum, user) => sum + user.autoConnections, 0)}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="bg-purple-50 p-3 sm:p-4 rounded-xl">
                  <div className="flex items-center space-x-2 sm:space-x-3">
                    <UserPlus className="h-6 w-6 sm:h-8 sm:w-8 text-brand-dark flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm text-brand-dark font-medium">Manual Connections</p>
                      <p className="text-xl sm:text-2xl font-bold text-purple-900">
                        {userStats.reduce((sum, user) => sum + user.manualConnections, 0)}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="bg-orange-50 p-3 sm:p-4 rounded-xl">
                  <div className="flex items-center space-x-2 sm:space-x-3">
                    <Handshake className="h-6 w-6 sm:h-8 sm:w-8 text-orange-600 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm text-orange-600 font-medium">Scan Connections</p>
                      <p className="text-xl sm:text-2xl font-bold text-orange-900">
                        {userStats.reduce((sum, user) => sum + user.scanConnections, 0)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto -mx-4 sm:mx-0">
                <table className="w-full min-w-[600px] sm:min-w-0">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 sm:py-3 px-3 sm:px-4 font-semibold text-gray-900 text-xs sm:text-sm">User</th>
                      <th className="text-left py-2 sm:py-3 px-3 sm:px-4 font-semibold text-gray-900 text-xs sm:text-sm">Total</th>
                      <th className="text-left py-2 sm:py-3 px-3 sm:px-4 font-semibold text-gray-900 text-xs sm:text-sm">Auto</th>
                      <th className="text-left py-2 sm:py-3 px-3 sm:px-4 font-semibold text-gray-900 text-xs sm:text-sm">Manual</th>
                      <th className="text-left py-2 sm:py-3 px-3 sm:px-4 font-semibold text-gray-900 text-xs sm:text-sm">Scan</th>
                      <th className="text-left py-2 sm:py-3 px-3 sm:px-4 font-semibold text-gray-900 text-xs sm:text-sm">Events</th>
                    </tr>
                  </thead>
                  <tbody>
                    {userStats.slice(0, 20).map((user) => (
                      <tr key={user.uid} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-2 sm:py-3 px-3 sm:px-4">
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900 text-xs sm:text-sm truncate">{user.name}</p>
                            <p className="text-xs sm:text-sm text-gray-600 truncate">{user.work}</p>
                          </div>
                        </td>
                        <td className="py-2 sm:py-3 px-3 sm:px-4 font-semibold text-gray-900 text-xs sm:text-sm">
                          {user.totalConnections}
                        </td>
                        <td className="py-2 sm:py-3 px-3 sm:px-4">
                          <div className="flex items-center space-x-1">
                            {getConnectionTypeIcon('auto')}
                            <span className="text-xs sm:text-sm">{user.autoConnections}</span>
                          </div>
                        </td>
                        <td className="py-2 sm:py-3 px-3 sm:px-4">
                          <div className="flex items-center space-x-1">
                            {getConnectionTypeIcon('manual')}
                            <span className="text-xs sm:text-sm">{user.manualConnections}</span>
                          </div>
                        </td>
                        <td className="py-2 sm:py-3 px-3 sm:px-4">
                          <div className="flex items-center space-x-1">
                            {getConnectionTypeIcon('scan')}
                            <span className="text-xs sm:text-sm">{user.scanConnections}</span>
                          </div>
                        </td>
                        <td className="py-2 sm:py-3 px-3 sm:px-4">
                          <span className="px-2 py-1 bg-blue-50 text-blue-800 rounded-full text-xs sm:text-sm whitespace-nowrap">
                            {user.registeredEvents.length} events
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Connect Users Tab */}
      {activeTab === 'connect' && (
        <div className="space-y-6">
          {/* Event Filter */}
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
          </div>

          {/* User Search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Search Users to Connect
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
            {searchResults.length > 0 && (
              <div className="mt-2 bg-white border border-gray-200 rounded-lg max-h-60 overflow-y-auto">
                {searchResults.map((user) => (
                  <button
                    key={user.uid}
                    onClick={() => handleSelectUser(user.uid)}
                    className="w-full p-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900">{user.name}</p>
                        <p className="text-sm text-gray-600">{user.work}</p>
                        <p className="text-xs text-gray-500">{user.email}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-600">{user.connectionCount} connections</p>
                        {selectedEvent && (
                          <p className="text-xs text-brand-light">
                            {user.isRegisteredForEvent ? '✓ Registered' : '○ Not registered'}
                          </p>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Selected Users */}
          {selectedUsers.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Selected Users ({selectedUsers.length})
              </label>
              <div className="flex flex-wrap gap-2">
                {selectedUsers.map((userId) => {
                  const userInfo = getSelectedUserInfo(userId);
                  return (
                    <div
                      key={userId}
                      className="flex items-center space-x-2 bg-blue-50 text-blue-800 px-3 py-2 rounded-lg"
                    >
                      <span className="text-sm font-medium">
                        {userInfo?.name || 'Unknown User'}
                      </span>
                      <button
                        onClick={() => handleRemoveUser(userId)}
                        className="text-brand-light hover:text-brand-mid"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Connection Reason */}
          {selectedUsers.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reason (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g., Similar interests, networking event..."
                value={connectionReason}
                onChange={(e) => setConnectionReason(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          )}

          {/* Create Connections Button */}
          {selectedUsers.length >= 2 && (
            <button
              onClick={handleCreateConnections}
              disabled={connecting}
              className="w-full py-3 px-4 bg-gradient-to-r from-brand-blue-dark to-brand-blue-light text-white rounded-lg hover:shadow-lg transition-all duration-300 font-semibold disabled:opacity-50 flex items-center justify-center space-x-2"
            >
              {connecting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Creating Connections...</span>
                </>
              ) : (
                <>
                  <UserPlus className="h-5 w-5" />
                  <span>
                    Create {Math.floor((selectedUsers.length * (selectedUsers.length - 1)) / 2)} Connections
                  </span>
                </>
              )}
            </button>
          )}
        </div>
      )}

      {/* Bulk Connect Tab */}
      {activeTab === 'bulk' && (
        <div className="space-y-6">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <p className="text-yellow-800 font-medium mb-1">Bulk Connection Warning</p>
                <p className="text-yellow-700">
                  This will create connections between ALL users registered for the selected event.
                  Use with caution as this cannot be easily undone.
                </p>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Event
            </label>
            <select
              value={selectedEvent}
              onChange={(e) => setSelectedEvent(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Choose an event...</option>
              {events.map(event => (
                <option key={event.id} value={event.id}>
                  {event.name}
                </option>
              ))}
            </select>
          </div>

          {selectedEvent && (
            <button
              onClick={handleBulkConnect}
              disabled={bulkConnecting}
              className="w-full py-3 px-4 bg-gradient-to-r from-orange-600 to-red-600 text-white rounded-lg hover:shadow-lg transition-all duration-300 font-semibold disabled:opacity-50 flex items-center justify-center space-x-2"
            >
              {bulkConnecting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Connecting All Users...</span>
                </>
              ) : (
                <>
                  <Link2 className="h-5 w-5" />
                  <span>Bulk Connect All Event Users</span>
                </>
              )}
            </button>
          )}

          {/* Bulk Results */}
          {bulkResults && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h4 className="font-semibold text-gray-900 mb-2">Bulk Connection Results</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-green-700">✅ Connections Created:</span>
                  <span className="font-medium">{bulkResults.created}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-yellow-700">⏭️ Already Connected:</span>
                  <span className="font-medium">{bulkResults.skipped}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-red-700">❌ Errors:</span>
                  <span className="font-medium">{bulkResults.errors.length}</span>
                </div>
                {bulkResults.errors.length > 0 && (
                  <div className="mt-3">
                    <p className="text-red-700 font-medium mb-1">Errors:</p>
                    <ul className="text-red-600 space-y-1">
                      {bulkResults.errors.slice(0, 5).map((error: string, index: number) => (
                        <li key={index} className="text-xs">• {error}</li>
                      ))}
                      {bulkResults.errors.length > 5 && (
                        <li className="text-xs">• ...and {bulkResults.errors.length - 5} more</li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminConnectionManager;