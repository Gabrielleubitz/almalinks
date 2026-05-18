import ProfileAvatarPlaceholder from '../profile/ProfileAvatarPlaceholder';
import React, { useState, useMemo } from 'react';
import { X, User, Mail, Phone, CheckCircle, Clock, Calendar, Search, ChevronDown, UserCheck } from 'lucide-react';
import { EventService } from '../../services/eventService';

interface UserData {
  userId: string;
  name: string;
  email: string;
  phone: string;
  work: string;
  checkedIn?: boolean;
  registeredAt: any;
  checkedInAt?: any;
  profileImage?: string | null;
}

interface UserListModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: UserData[];
  title: string;
  eventName: string;
  eventId?: string;
  onUserUpdate?: (userId: string, updatedUser: UserData) => void;
}

const UserListModal: React.FC<UserListModalProps> = ({
  isOpen,
  onClose,
  users,
  title,
  eventName,
  eventId,
  onUserUpdate
}) => {
  // All hooks at the top level - NEVER conditional
  const [searchTerm, setSearchTerm] = useState('');
  const [checkingInUsers, setCheckingInUsers] = useState<Set<string>>(new Set());

  // Memoized values - also at top level
  const isAwaitingCheckInList = useMemo(() => 
    title.toLowerCase().includes('awaiting'), 
    [title]
  );

  // Filter users based on search term (case-insensitive, real-time)
  const filteredUsers = useMemo(() => {
    if (!searchTerm.trim()) return users;
    
    const searchLower = searchTerm.toLowerCase();
    return users.filter(user => 
      user.name.toLowerCase().includes(searchLower)
    );
  }, [users, searchTerm]);

  // Early return AFTER all hooks
  if (!isOpen) return null;

  const formatDate = (timestamp: any) => {
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

  const handleManualCheckIn = async (user: UserData) => {
    if (!eventId || checkingInUsers.has(user.userId)) return;

    setCheckingInUsers(prev => new Set(prev).add(user.userId));

    try {
      console.log('🔄 Manually checking in user:', user.userId, 'for event:', eventId);
      
      // Update check-in status in Firebase
      await EventService.updateCheckInStatus(eventId, user.userId, true);
      
      // Create updated user object
      const updatedUser: UserData = {
        ...user,
        checkedIn: true,
        checkedInAt: new Date()
      };

      // Notify parent component of the update
      if (onUserUpdate) {
        onUserUpdate(user.userId, updatedUser);
      }

      console.log('✅ User checked in successfully:', user.name);
      
    } catch (error) {
      console.error('❌ Error checking in user:', error);
      alert('Failed to check in user. Please try again.');
    } finally {
      setCheckingInUsers(prev => {
        const newSet = new Set(prev);
        newSet.delete(user.userId);
        return newSet;
      });
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
            <p className="text-gray-600 mt-1">
              {eventName} • {filteredUsers.length} of {users.length} {users.length === 1 ? 'user' : 'users'}
              {searchTerm && ` matching "${searchTerm}"`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors duration-200 p-2 rounded-full hover:bg-gray-100"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Search Bar - Only show for awaiting check-in list */}
        {isAwaitingCheckInList && users.length > 0 && (
          <div className="p-6 border-b border-gray-200 bg-gray-50">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search users by name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
              />
            </div>
          </div>
        )}

        {/* User List */}
        <div className="overflow-y-auto max-h-[calc(90vh-200px)]">
          {filteredUsers.length === 0 ? (
            <div className="text-center py-12">
              <User className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">
                {searchTerm ? `No users found matching "${searchTerm}"` : 'No users found in this category'}
              </p>
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="mt-2 text-brand-light hover:text-blue-700 font-medium"
                >
                  Clear search
                </button>
              )}
            </div>
          ) : (
            <div className="p-6">
              <div className="space-y-4">
                {filteredUsers.map((user, index) => (
                  <div
                    key={user.userId}
                    className="bg-gray-50 rounded-2xl p-6 hover:bg-gray-100 transition-colors duration-200"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="grid md:grid-cols-2 gap-4">
                          {/* Left Column */}
                          <div className="space-y-3">
                            <div className="flex items-center space-x-3">
                              <div className="w-10 h-10 rounded-full overflow-hidden">
                                {user.profileImage ? (
                                  <img 
                                    src={user.profileImage} 
                                    alt={user.name} 
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      const target = e.target as HTMLImageElement;
                                      target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjRjNGNEY2Ii8+CjxjaXJjbGUgY3g9IjEwMCIgY3k9IjgwIiByPSIzMCIgZmlsbD0iIzlDQTNBRiIvPgo8ZWxsaXBzZSBjeD0iMTAwIiBjeT0iMTQwIiByeD0iNDAiIHJ5PSIyMCIgZmlsbD0iIzlDQTNBRiIvPgo8L3N2Zz4=';
                                    }}
                                  />
                                ) : (
                                  <div className="w-full h-full bg-brand-dark flex items-center justify-center text-white font-bold">
                                    {user.name.charAt(0)}
                                  </div>
                                )}
                              </div>
                              <div>
                                <div className="text-sm text-gray-500">Name</div>
                                <div className="font-semibold text-gray-900">{user.name}</div>
                              </div>
                            </div>
                            
                            <div className="flex items-center space-x-3">
                              <Mail className="h-5 w-5 text-gray-400" />
                              <div>
                                <div className="text-sm text-gray-500">Email</div>
                                <div className="font-medium text-gray-900">{user.email}</div>
                              </div>
                            </div>
                          </div>

                          {/* Right Column */}
                          <div className="space-y-3">
                            <div className="flex items-center space-x-3">
                              <Phone className="h-5 w-5 text-gray-400" />
                              <div>
                                <div className="text-sm text-gray-500">Phone</div>
                                <div className="font-medium text-gray-900">{user.phone || 'Not provided'}</div>
                              </div>
                            </div>
                            
                            <div className="flex items-center space-x-3">
                              <Calendar className="h-5 w-5 text-gray-400" />
                              <div>
                                <div className="text-sm text-gray-500">Registered</div>
                                <div className="font-medium text-gray-900">{formatDate(user.registeredAt)}</div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Work Info */}
                        <div className="mt-4 pt-4 border-t border-gray-200">
                          <div className="text-sm text-gray-500 mb-1">Work</div>
                          <div className="font-medium text-gray-900">{user.work}</div>
                        </div>
                      </div>

                      {/* Status Badge and Actions */}
                      <div className="ml-4 flex flex-col items-end space-y-3">
                        {user.checkedIn ? (
                          <div className="flex flex-col items-center space-y-2">
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Checked In
                            </span>
                            {user.checkedInAt && (
                              <div className="text-xs text-gray-500 text-center">
                                {formatDate(user.checkedInAt)}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="flex flex-col items-end space-y-2">
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
                              <Clock className="h-4 w-4 mr-1" />
                              Awaiting Check-in
                            </span>
                            
                            {/* Manual Check-in Button - Only show for awaiting check-in users */}
                            {isAwaitingCheckInList && eventId && (
                              <button
                                onClick={() => handleManualCheckIn(user)}
                                disabled={checkingInUsers.has(user.userId)}
                                className="bg-gradient-to-r from-green-600 to-green-700 text-white px-4 py-2 rounded-xl hover:shadow-lg transition-all duration-300 font-medium text-sm flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {checkingInUsers.has(user.userId) ? (
                                  <>
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    <span>Checking In...</span>
                                  </>
                                ) : (
                                  <>
                                    <UserCheck className="h-4 w-4" />
                                    <span>Check In</span>
                                  </>
                                )}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-6">
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-600">
              {isAwaitingCheckInList && eventId && (
                <span>💡 Tip: Use the check-in buttons above to manually mark users as checked in</span>
              )}
            </div>
            <button
              onClick={onClose}
              className="bg-gray-100 text-gray-700 px-6 py-2 rounded-xl hover:bg-gray-200 transition-colors duration-200 font-medium"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserListModal;