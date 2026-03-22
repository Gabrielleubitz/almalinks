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
  Zap
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

  const getConnectionTypeIcon = (type: 'auto' | 'manual' | 'admin') => {
    switch (type) {
      case 'auto':
        return <Zap className="h-4 w-4 text-green-600" />;
      case 'manual':
        return <UserPlus className="h-4 w-4 text-purple-600" />;
      case 'admin':
      default:
        return <Link2 className="h-4 w-4 text-amber-600" />;
    }
  };

  return (
    <div className={`bg-white rounded-xl shadow-sm border border-gray-200 p-5 sm:p-6 ${className}`}>
      {/* Header */}
      <div className="mb-5">
        <div className="flex items-center space-x-2 min-w-0">
          <Users className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600 flex-shrink-0" />
          <h3 className="text-lg font-bold text-gray-900 truncate">Connection Management</h3>
        </div>
        <p className="mt-1 text-sm text-gray-600">User stats, connect two or more users, or bulk-connect event attendees.</p>
      </div>

      {/* Tabs */}
      <div className="flex bg-gray-100 rounded-xl p-1 mb-5 border border-gray-200">
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
              className={`flex-1 flex items-center justify-center space-x-2 py-2.5 px-4 rounded-lg transition-all text-sm font-semibold ${
                activeTab === tab.id
                  ? 'bg-gray-900 text-white shadow-sm'
                  : 'text-gray-700 hover:bg-gray-200'
              }`}
            >
              <IconComponent className="h-4 w-4 flex-shrink-0" />
              <span className="whitespace-nowrap">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Stats Tab */}
      {activeTab === 'stats' && (
        <div>
          {loading ? (
            <div className="text-center py-10">
              <div className="w-8 h-8 border-2 border-gray-200 border-t-gray-700 rounded-full animate-spin mx-auto mb-4" />
              <p className="text-sm font-medium text-gray-700">Loading user statistics...</p>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl">
                  <p className="text-sm font-medium text-blue-800">Members in table</p>
                  <p className="text-2xl font-bold text-blue-900 tabular-nums">{userStats.length}</p>
                  <p className="text-xs text-blue-700/80 mt-1">Most connected members (cap 50)</p>
                </div>
                <div className="bg-green-50 border border-green-100 p-4 rounded-xl">
                  <p className="text-sm font-medium text-green-800">By event</p>
                  <p className="text-2xl font-bold text-green-900 tabular-nums">
                    {userStats.reduce((sum, u) => sum + u.autoConnections, 0)}
                  </p>
                </div>
                <div className="bg-purple-50 border border-purple-100 p-4 rounded-xl">
                  <p className="text-sm font-medium text-purple-800">By request</p>
                  <p className="text-2xl font-bold text-purple-900 tabular-nums">
                    {userStats.reduce((sum, u) => sum + u.manualConnections, 0)}
                  </p>
                </div>
                <div className="bg-amber-50 border border-amber-100 p-4 rounded-xl">
                  <p className="text-sm font-medium text-amber-800">By admin</p>
                  <p className="text-2xl font-bold text-amber-900 tabular-nums">
                    {userStats.reduce((sum, u) => sum + u.adminConnections, 0)}
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl border border-gray-200">
                <table className="w-full min-w-[600px]">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-semibold text-gray-900 text-sm">User</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-900 text-sm">Total</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-900 text-sm">By event</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-900 text-sm">By request</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-900 text-sm">By admin</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-900 text-sm">Events</th>
                    </tr>
                  </thead>
                  <tbody>
                    {userStats.slice(0, 20).map((u) => (
                      <tr key={u.uid} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4">
                          <p className="font-medium text-gray-900 text-sm truncate">{u.name}</p>
                          <p className="text-xs text-gray-600 truncate">{u.work}</p>
                        </td>
                        <td className="py-3 px-4 font-semibold text-gray-900 text-sm">{u.totalConnections}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1">
                            {getConnectionTypeIcon('auto')}
                            <span className="text-sm font-medium text-gray-800">{u.autoConnections}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1">
                            {getConnectionTypeIcon('manual')}
                            <span className="text-sm font-medium text-gray-800">{u.manualConnections}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1">
                            {getConnectionTypeIcon('admin')}
                            <span className="text-sm font-medium text-gray-800">{u.adminConnections}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-1 bg-blue-100 text-blue-900 rounded-lg text-xs font-medium">
                            {u.registeredEvents.length} events
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
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-1.5">Event (optional)</label>
            <select
              value={selectedEvent}
              onChange={(e) => setSelectedEvent(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Global connection (no event)</option>
              {events.map(event => (
                <option key={event.id} value={event.id}>{event.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-1.5">Search users to connect</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500" />
              <input
                type="text"
                placeholder="Name, email, or company..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  handleUserSearch(e.target.value);
                }}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            {searchResults.length > 0 && (
              <div className="mt-2 border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100 max-h-56 overflow-y-auto">
                {searchResults.map((user) => (
                  <button
                    key={user.uid}
                    onClick={() => handleSelectUser(user.uid)}
                    className="w-full p-3 text-left hover:bg-gray-50"
                  >
                    <div className="flex justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 truncate">{user.name}</p>
                        <p className="text-sm text-gray-700 truncate">{user.work}</p>
                        <p className="text-xs text-gray-600 truncate">{user.email}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-medium text-gray-800">{user.connectionCount} connections</p>
                        {selectedEvent && (
                          <p className={`text-xs font-medium ${user.isRegisteredForEvent ? 'text-green-700' : 'text-gray-500'}`}>
                            {user.isRegisteredForEvent ? '✓ Registered' : 'Not registered'}
                          </p>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {selectedUsers.length > 0 && (
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-1.5">Selected ({selectedUsers.length})</label>
              <div className="flex flex-wrap gap-2">
                {selectedUsers.map((userId) => {
                  const userInfo = getSelectedUserInfo(userId);
                  return (
                    <div
                      key={userId}
                      className="flex items-center gap-2 bg-blue-100 text-blue-900 px-3 py-2 rounded-xl border border-blue-200"
                    >
                      <span className="text-sm font-medium">{userInfo?.name || 'Unknown'}</span>
                      <button
                        onClick={() => handleRemoveUser(userId)}
                        className="text-blue-700 hover:text-blue-900 p-0.5"
                        aria-label="Remove"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {selectedUsers.length > 0 && (
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-1.5">Reason (optional)</label>
              <input
                type="text"
                placeholder="e.g. Networking event, similar interests..."
                value={connectionReason}
                onChange={(e) => setConnectionReason(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          )}

          {selectedUsers.length >= 2 && (
            <button
              onClick={handleCreateConnections}
              disabled={connecting}
              className="w-full py-3 px-4 bg-gray-900 text-white rounded-xl hover:bg-gray-800 font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
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
        <div className="space-y-5">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold text-amber-900 mb-1">Bulk connect warning</p>
                <p className="text-sm text-amber-800">
                  This creates connections between all users registered for the selected event. This cannot be easily undone.
                </p>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-1.5">Select event</label>
            <select
              value={selectedEvent}
              onChange={(e) => setSelectedEvent(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Choose an event...</option>
              {events.map(event => (
                <option key={event.id} value={event.id}>{event.name}</option>
              ))}
            </select>
          </div>

          {selectedEvent && (
            <button
              onClick={handleBulkConnect}
              disabled={bulkConnecting}
              className="w-full py-3 px-4 bg-amber-600 text-white rounded-xl hover:bg-amber-700 font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
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

          {bulkResults && (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
              <h4 className="font-semibold text-gray-900 mb-3">Results</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="font-medium text-gray-800">Connections created</span>
                  <span className="font-bold text-green-700">{bulkResults.created}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-gray-800">Already connected</span>
                  <span className="font-bold text-amber-700">{bulkResults.skipped}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-gray-800">Errors</span>
                  <span className="font-bold text-red-700">{bulkResults.errors.length}</span>
                </div>
                {bulkResults.errors.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <p className="font-medium text-red-800 mb-1">Errors</p>
                    <ul className="text-red-700 text-xs space-y-1">
                      {bulkResults.errors.slice(0, 5).map((error: string, i: number) => (
                        <li key={i}>• {error}</li>
                      ))}
                      {bulkResults.errors.length > 5 && (
                        <li>…and {bulkResults.errors.length - 5} more</li>
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