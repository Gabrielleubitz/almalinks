import React, { useState, useEffect } from 'react';
import { Search, MapPin, Briefcase, Plus, Linkedin, User, Filter, Grid, List, ExternalLink } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { UserService } from '../services/userService';
import { ConnectionService } from '../services/connectionService';
import { UserCard as UserCardType } from '../types/user';
import Header from '../components/Header';
import Footer from '../components/Footer';
import LoadingSpinner from '../components/common/LoadingSpinner';

interface MemberCard extends UserCardType {
  firstName?: string;
  lastName?: string;
  bioTitle?: string;
  bio?: string;
  linkedin?: string;
  isConnected?: boolean;
  connectionPending?: boolean;
}

const MembersPage: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [members, setMembers] = useState<MemberCard[]>([]);
  const [filteredMembers, setFilteredMembers] = useState<MemberCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [connectingUsers, setConnectingUsers] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadMembers();
  }, [currentUser]);

  useEffect(() => {
    filterMembers();
  }, [searchQuery, members]);

  const loadMembers = async () => {
    try {
      setLoading(true);
      console.log('👥 === LOADING ALL MEMBERS (ADMIN MODE) ===');
      console.log(`👤 Current user: ${currentUser?.displayName} (${currentUser?.uid})`);
      console.log(`🎭 User role: ${currentUser?.role}`);
      
      // Get ALL users - no filtering
      const allUsers = await UserService.getAllMembersForDirectory(
        currentUser?.uid || null,
        currentUser?.role
      );

      console.log(`📊 Raw users from service: ${allUsers.length}`);
      
      // Debug: Check if bio data is being received
      allUsers.forEach(user => {
        if (user.bio) {
          console.log(`👤 User ${user.displayName} has bio: ${user.bio.substring(0, 50)}...`);
        }
      });
      console.log('👥 First few users:', allUsers.slice(0, 3).map(u => ({ uid: u.uid, name: u.displayName, status: u.profileVisibility })));

      // DON'T filter out current user - show everyone
      const membersWithConnections = await Promise.all(
        allUsers.map(async (member) => {
          let isConnected = false;
          let connectionPending = false;

          // Check connection status (but don't let this block showing users)
          if (currentUser?.uid && member.uid !== currentUser.uid) {
            try {
              const connection = await ConnectionService.checkExistingConnection(
                currentUser.uid,
                member.uid
              );
              isConnected = !!connection;
            } catch (error) {
              // Don't log this error - it's not critical for showing users
            }
          }

          return {
            ...member,
            isConnected,
            connectionPending
          } as MemberCard;
        })
      );

      console.log(`✅ Final members list: ${membersWithConnections.length}`);
      console.log('👥 Sample members:', membersWithConnections.slice(0, 3).map(u => ({ 
        uid: u.uid.substring(0, 8), 
        name: u.displayName || u.firstName || 'No Name', 
        company: u.company || 'No Company'
      })));
      
      setMembers(membersWithConnections);
    } catch (error) {
      console.error('❌ CRITICAL: Error loading members:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterMembers = () => {
    if (!searchQuery.trim()) {
      setFilteredMembers(members);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = members.filter(member => {
      const fullName = `${member.firstName || ''} ${member.lastName || ''}`.toLowerCase();
      const displayName = (member.displayName || '').toLowerCase();
      const work = (member.company || '').toLowerCase();
      const title = (member.title || '').toLowerCase();
      const bioTitle = (member.bioTitle || '').toLowerCase();
      const bio = (member.bio || '').toLowerCase();
      const city = (member.city || '').toLowerCase();
      const country = (member.country || '').toLowerCase();

      return (
        fullName.includes(query) ||
        displayName.includes(query) ||
        work.includes(query) ||
        title.includes(query) ||
        bioTitle.includes(query) ||
        bio.includes(query) ||
        city.includes(query) ||
        country.includes(query)
      );
    });

    setFilteredMembers(filtered);
  };

  const handleConnect = async (memberId: string) => {
    if (!currentUser?.uid || connectingUsers.has(memberId)) return;

    try {
      setConnectingUsers(prev => new Set([...prev, memberId]));

      await ConnectionService.createConnection(
        currentUser.uid,
        memberId,
        ['platform_connection'] // Default reason for member page connections
      );

      // Update local state
      setMembers(prev => 
        prev.map(member => 
          member.uid === memberId 
            ? { ...member, isConnected: true }
            : member
        )
      );

      console.log('✅ Connection created successfully');
    } catch (error) {
      console.error('❌ Error creating connection:', error);
    } finally {
      setConnectingUsers(prev => {
        const newSet = new Set(prev);
        newSet.delete(memberId);
        return newSet;
      });
    }
  };

  const getAvatarColor = (name: string) => {
    const colors = [
      'from-red-500 to-red-600',
      'from-blue-500 to-blue-600',
      'from-green-500 to-green-600',
      'from-purple-500 to-purple-600',
      'from-yellow-500 to-yellow-600',
      'from-pink-500 to-pink-600',
      'from-indigo-500 to-indigo-600',
      'from-teal-500 to-teal-600'
    ];
    
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    const index = Math.abs(hash) % colors.length;
    return colors[index];
  };

  const renderMemberCard = (member: MemberCard) => {
    // More robust name handling
    const displayName = member.displayName || 
                       `${member.firstName || ''} ${member.lastName || ''}`.trim() || 
                       'Member';
    
    const isSelf = member.uid === currentUser?.uid;
    
    console.log(`🎨 Rendering card for: "${displayName}" (${member.uid.substring(0, 8)})`);
    console.log(`   📋 Member data: displayName="${member.displayName}", firstName="${member.firstName}", lastName="${member.lastName}"`);  
    console.log(`   👤 Is self: ${isSelf} (currentUser.uid: ${currentUser?.uid?.substring(0, 8) || 'none'})`);
    const avatarColor = getAvatarColor(displayName);
    const isConnecting = connectingUsers.has(member.uid);

    if (viewMode === 'list') {
      return (
        <div
          key={member.uid}
          className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-all duration-200 group"
        >
          <div className="flex items-center space-x-4">
            {/* Avatar */}
            <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-gray-100 flex-shrink-0">
              {member.avatarUrl ? (
                <img 
                  src={member.avatarUrl} 
                  alt={displayName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className={`w-full h-full bg-gradient-to-br ${avatarColor} flex items-center justify-center text-white font-bold text-lg`}>
                  {displayName.charAt(0).toUpperCase()}
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 truncate">{displayName}</h3>
                  
                  {member.bioTitle && (
                    <p className="text-blue-600 font-medium text-sm mb-1">{member.bioTitle}</p>
                  )}
                  
                  {member.company && (
                    <div className="flex items-center text-gray-600 text-sm mb-1">
                      <Briefcase className="h-4 w-4 mr-1 flex-shrink-0" />
                      <span className="truncate">{member.company}</span>
                    </div>
                  )}
                  
                  {(member.city || member.country) && (
                    <div className="flex items-center text-gray-500 text-sm">
                      <MapPin className="h-4 w-4 mr-1 flex-shrink-0" />
                      <span className="truncate">{[member.city, member.country].filter(Boolean).join(', ')}</span>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center space-x-2 flex-shrink-0 ml-4">
                  {/* View Profile Button */}
                  <button
                    onClick={() => window.location.href = `/profile/${member.uid}`}
                    className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                    title="View Profile"
                  >
                    <ExternalLink className="h-5 w-5" />
                  </button>
                  {member.linkedin && (
                    <a
                      href={`https://linkedin.com/in/${member.linkedin}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                      title="LinkedIn Profile"
                    >
                      <Linkedin className="h-5 w-5" />
                    </a>
                  )}
                  
                  {currentUser && !member.isConnected && !isSelf && (
                    <button
                      onClick={() => handleConnect(member.uid)}
                      disabled={isConnecting}
                      className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Connect"
                    >
                      {isConnecting ? (
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Plus className="h-5 w-5" />
                      )}
                    </button>
                  )}
                  
                  {member.isConnected && (
                    <div className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
                      Connected
                    </div>
                  )}
                  
                  {isSelf && (
                    <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                      You
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div
        key={member.uid}
        className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-all duration-200"
      >
        {/* Avatar */}
        <div className="flex justify-center mb-4">
          <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-gray-100">
            {member.avatarUrl ? (
              <img 
                src={member.avatarUrl} 
                alt={displayName}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className={`w-full h-full bg-gradient-to-br ${avatarColor} flex items-center justify-center text-white font-bold text-xl`}>
                {displayName.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
        </div>

        {/* Info */}
        <div className="text-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-1">{displayName}</h3>
          
          {member.bioTitle && (
            <p className="text-blue-600 font-medium text-sm mb-2">{member.bioTitle}</p>
          )}
          
          {member.company && (
            <div className="flex items-center justify-center text-gray-600 text-sm mb-1">
              <Briefcase className="h-4 w-4 mr-1" />
              <span>{member.company}</span>
            </div>
          )}
          
          {(member.city || member.country) && (
            <div className="flex items-center justify-center text-gray-500 text-sm">
              <MapPin className="h-4 w-4 mr-1" />
              <span>{[member.city, member.country].filter(Boolean).join(', ')}</span>
            </div>
          )}
        </div>

        {/* Skills Preview */}
        {member.skills && member.skills.length > 0 && (
          <div className="mb-4">
            <div className="flex flex-wrap gap-1 justify-center">
              {member.skills.slice(0, 3).map((skill, index) => (
                <span
                  key={index}
                  className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs"
                >
                  {skill}
                </span>
              ))}
              {member.skills.length > 3 && (
                <span className="px-2 py-1 bg-gray-100 text-gray-500 rounded text-xs">
                  +{member.skills.length - 3} more
                </span>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-center space-x-2">
          {/* View Profile Button */}
          <button
            onClick={() => window.location.href = `/profile/${member.uid}`}
            className="p-2 text-gray-400 hover:text-blue-600 transition-colors border border-gray-200 rounded-lg hover:border-blue-200"
            title="View Full Profile"
          >
            <ExternalLink className="h-5 w-5" />
          </button>
          {member.linkedin && (
            <a
              href={`https://linkedin.com/in/${member.linkedin}`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 text-gray-400 hover:text-blue-600 transition-colors border border-gray-200 rounded-lg hover:border-blue-200"
              title="LinkedIn Profile"
            >
              <Linkedin className="h-5 w-5" />
            </a>
          )}
          
          {currentUser && !member.isConnected && !isSelf && (
            <button
              onClick={() => handleConnect(member.uid)}
              disabled={isConnecting}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {isConnecting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Connecting...</span>
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  <span>Connect</span>
                </>
              )}
            </button>
          )}
          
          {member.isConnected && (
            <div className="bg-green-100 text-green-800 px-4 py-2 rounded-lg font-medium flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span>Connected</span>
            </div>
          )}
          
          {isSelf && (
            <div className="bg-blue-100 text-blue-800 px-4 py-2 rounded-lg font-medium flex items-center space-x-2">
              <User className="h-4 w-4" />
              <span>Your Profile</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
        <Header />
        <div className="pt-32 pb-16 flex items-center justify-center">
          <div className="text-center">
            <LoadingSpinner size="lg" color="border-blue-600" />
            <p className="text-gray-600 mt-4">Loading members...</p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
      <Header />
      
      {/* Hero Section */}
      <section className="pt-32 pb-12 bg-gradient-to-br from-blue-50 to-indigo-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              Meet Our <span className="gradient-text">Community</span>
            </h1>
            <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
              Connect with fellow entrepreneurs, investors, and innovators. Build meaningful relationships that drive your success.
            </p>
            
            {/* Search and Filters */}
            <div className="max-w-2xl mx-auto">
              <div className="flex flex-col md:flex-row gap-4 items-center">
                {/* Search Bar */}
                <div className="relative flex-1 w-full">
                  <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search by name, company, bio, or location..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white shadow-sm"
                  />
                </div>
                
                {/* View Toggle */}
                <div className="flex bg-white rounded-2xl p-1 shadow-sm border border-gray-200">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-2 rounded-xl transition-all ${
                      viewMode === 'grid' 
                        ? 'bg-blue-600 text-white shadow-sm' 
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <Grid className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-2 rounded-xl transition-all ${
                      viewMode === 'list' 
                        ? 'bg-blue-600 text-white shadow-sm' 
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <List className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Members Grid */}
      <section className="py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Results Info */}
          <div className="flex justify-between items-center mb-8">
            <div>
              <p className="text-gray-600">
                {searchQuery ? (
                  <>Showing {filteredMembers.length} results for "{searchQuery}"</>
                ) : (
                  <>{filteredMembers.length} members in our community</>
                )}
              </p>
            </div>
          </div>

          {/* Members List */}
          {filteredMembers.length > 0 ? (
            <div className={
              viewMode === 'grid' 
                ? "grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" 
                : "space-y-4"
            }>
              {filteredMembers.map(renderMemberCard)}
            </div>
          ) : (
            <div className="text-center py-16">
              <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <User className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                {searchQuery ? 'No members found' : 'No members yet'}
              </h3>
              <p className="text-gray-600 mb-6">
                {searchQuery 
                  ? `Try adjusting your search terms or browse all members.`
                  : 'Be the first to join our community!'
                }
              </p>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700 transition-colors"
                >
                  Clear Search
                </button>
              )}
            </div>
          )}
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default MembersPage;