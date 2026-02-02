import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, MapPin, Briefcase, Plus, Linkedin, User, Grid, List, ExternalLink, Map, Check, X, Clock } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { UserService } from '../services/userService';
import { ConnectionService } from '../services/connectionService';
import { ConnectionRequestService } from '../services/connectionRequestService';
import { ConnectionRequest } from '../types/connection';
import { UserCard as UserCardType } from '../types/user';
import Header from '../components/Header';
import Footer from '../components/Footer';
import LoadingSpinner from '../components/common/LoadingSpinner';
import MemberMap from '../components/MemberMap';
import CropImage from '../components/profile/CropImage';

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
  const [showMemberMap, setShowMemberMap] = useState(false);
  
  const [sentRequestIds, setSentRequestIds] = useState<Set<string>>(new Set()); // Track which users we've sent requests to
  const [incomingRequests, setIncomingRequests] = useState<ConnectionRequest[]>([]);
  const [respondingRequestId, setRespondingRequestId] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser?.uid) return;
    loadSentRequests();
    loadIncomingRequests();
    if (import.meta.env.DEV) {
      ConnectionRequestService.getRecentRequests(20).catch(err => {
        console.warn('[debug] Could not load recent requests:', err);
      });
    }
  }, [currentUser?.uid]);

  // Load members when currentUser is set; sentRequestIds will sync into members when it loads
  useEffect(() => {
    if (currentUser?.uid) {
      loadMembers();
    }
  }, [currentUser?.uid]);

  // When sent requests or members change, ensure connectionPending is true for users we've sent requests to (never show Connected until they approve)
  useEffect(() => {
    if (sentRequestIds.size === 0) return;
    setMembers(prev => prev.map(m =>
      sentRequestIds.has(m.uid) && !m.isConnected
        ? { ...m, connectionPending: true }
        : m
    ));
  }, [sentRequestIds, members.length]);

  useEffect(() => {
    // Always filter members when search query or members list changes
    // Initialize filteredMembers even if members is empty
    if (!searchQuery.trim()) {
      setFilteredMembers(members);
    } else {
      filterMembers();
    }
    
    if (import.meta.env.DEV) {
      console.log(`📊 filteredMembers.length: ${filteredMembers.length}`);
      console.log(`📊 members.length: ${members.length}`);
    }
  }, [searchQuery, members]);

  const loadMembers = async () => {
    try {
      setLoading(true);
      
      if (import.meta.env.DEV) {
        console.log('👥 === LOADING ALL MEMBERS ===');
        console.log(`👤 Current user: ${currentUser?.displayName} (${currentUser?.uid})`);
        console.log(`🎭 User role: ${currentUser?.role}`);
      }
      
      // Get ALL users - no filtering
      const allUsers = await UserService.getAllMembersForDirectory(
        currentUser?.uid || null,
        currentUser?.role
      );

      if (import.meta.env.DEV) {
        console.log(`📊 Raw users from service: ${allUsers.length}`);
        console.log('👥 First few users:', allUsers.slice(0, 3).map(u => ({ 
          uid: u.uid.substring(0, 8), 
          name: u.displayName || u.firstName || 'No Name'
        })));
      }

      // DON'T filter out current user - show everyone
      // Check connection status (but don't let this block showing users)
      // Use sentRequestIds state (loaded separately) for pending check
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
              
              // Log UI connection check (DEV only)
              if (import.meta.env.DEV) {
                console.log('[CONN_UI_SOURCE] Green Connected button check', {
                  currentUser: currentUser.uid,
                  otherUser: member.uid,
                  source: 'ConnectionService.checkExistingConnection() -> queries connections where (uid1==currentUser AND uid2==otherUser) OR (uid1==otherUser AND uid2==currentUser)',
                  result: connection ? {
                    id: connection.id,
                    path: `connections/${connection.id}`,
                    uid1: connection.uid1,
                    uid2: connection.uid2
                  } : null,
                  isConnected
                });
              }
              
              // Check if we've sent a pending request to this member (from state)
              if (!isConnected) {
                connectionPending = sentRequestIds.has(member.uid);
              }
            } catch (error) {
              // Don't log this error - it's not critical for showing users
              // Silently continue - we'll show the member anyway
            }
          }

          return {
            ...member,
            isConnected,
            connectionPending
          } as MemberCard;
        })
      );

      if (import.meta.env.DEV) {
        console.log(`✅ Final members list: ${membersWithConnections.length}`);
        console.log(`📊 membersCount: ${membersWithConnections.length}`);
        console.log(`📊 membersLoading: false`);
      }
      
      setMembers(membersWithConnections);
    } catch (error) {
      console.error('❌ CRITICAL: Error loading members:', error);
      // Set empty array on error so page still renders
      setMembers([]);
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
    
    if (import.meta.env.DEV) {
      console.log(`📊 filterMembers: ${members.length} -> ${filtered.length} (query: "${searchQuery}")`);
    }
  };

  // Load sent connection requests to track pending state (independent from members loading)
  const loadIncomingRequests = async () => {
    if (!currentUser?.uid) return;
    try {
      const requests = await ConnectionRequestService.getPendingRequests(currentUser.uid);
      setIncomingRequests(requests);
    } catch (err) {
      console.error('Failed to load incoming connection requests', err);
      setIncomingRequests([]);
    }
  };

  const loadSentRequests = async () => {
    if (!currentUser?.uid) return;
    
    try {
      const sentRequests = await ConnectionRequestService.getSentRequests(currentUser.uid);
      const pendingTargetIds = new Set(
        sentRequests
          .filter(req => req.status === 'pending')
          .map(req => req.targetId || req.toUid)
      );
      setSentRequestIds(pendingTargetIds);
      
      if (import.meta.env.DEV) {
        console.log(`📊 sentRequestIds count: ${pendingTargetIds.size}`);
      }
    } catch (error) {
      console.error('❌ Error loading sent requests:', error);
      // Don't block page - just set empty set
      setSentRequestIds(new Set());
    }
  };

  // Handle sending connection request (user-initiated) or creating connection (admin)
  const handleRespondToRequest = async (requestId: string, response: 'accepted' | 'rejected') => {
    if (!currentUser?.uid) return;
    setRespondingRequestId(requestId);
    try {
      await ConnectionRequestService.respondToRequest(requestId, response, currentUser.uid);
      await loadIncomingRequests();
      if (response === 'accepted') await loadMembers();
    } catch (e) {
      console.error('Failed to respond to connection request', e);
      alert('Something went wrong. Please try again.');
    } finally {
      setRespondingRequestId(null);
    }
  };

  const handleConnect = async (memberId: string) => {
    if (!currentUser?.uid || connectingUsers.has(memberId)) return;

    try {
      setConnectingUsers(prev => new Set([...prev, memberId]));

      // Admins create connections immediately (no request workflow)
      if (currentUser.role === 'admin') {
        const { AdminConnectionService } = await import('../services/adminConnectionService');
        await AdminConnectionService.createAdminConnection(
          currentUser.uid,
          memberId,
          currentUser.uid,
          { reason: 'Admin connection from Members page' }
        );

        // Update local state to show connected
        setMembers(prev => 
          prev.map(member => 
            member.uid === memberId 
              ? { ...member, isConnected: true, connectionPending: false }
              : member
          )
        );

        console.log('✅ Admin connection created immediately');
      } else {
        // Regular users send connection request
        await ConnectionRequestService.sendConnectionRequest(
          currentUser.uid,
          memberId,
          {}
        );

        // Update local state to show pending
        setMembers(prev => 
          prev.map(member => 
            member.uid === memberId 
              ? { ...member, connectionPending: true }
              : member
          )
        );
        
        // Track sent request
        setSentRequestIds(prev => new Set([...prev, memberId]));

        console.log('✅ Connection request sent successfully');
      }
    } catch (error: any) {
      const msg = error?.message ?? '';
      const isAlreadySent =
        msg.includes('already sent') ||
        msg.includes('not yet responded') ||
        msg.includes('Connection request already exists');
      if (isAlreadySent) {
        // 409 / idempotent: request was already sent; show "Request sent" and don't error
        setMembers(prev =>
          prev.map(member =>
            member.uid === memberId ? { ...member, connectionPending: true } : member
          )
        );
        setSentRequestIds(prev => new Set([...prev, memberId]));
        return;
      }
      console.error('❌ Error creating connection/request:', error);
      const errorMessage =
        error.message?.includes('API server') || error.message?.includes('localhost:3000')
          ? "Couldn't send request. Please try again."
          : error.message || 'Failed to create connection. Please try again.';
      alert(errorMessage);
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
    const displayName = member.displayName ||
                       `${member.firstName || ''} ${member.lastName || ''}`.trim() ||
                       'Member';

    const isSelf = member.uid === currentUser?.uid;
    const incomingReq = incomingRequests.find(r => (r.requesterId || r.fromUid) === member.uid);
    const hasIncomingRequest = !!incomingReq;
    const isRespondingToRequest = hasIncomingRequest && respondingRequestId === incomingReq!.id;

    const avatarColor = getAvatarColor(displayName);
    const isConnecting = connectingUsers.has(member.uid);
    const hasPendingRequest = member.connectionPending || sentRequestIds.has(member.uid);

    const cardOutlineClass = hasIncomingRequest ? 'ring-2 ring-blue-500 border-blue-500' : '';

    if (viewMode === 'list') {
      return (
        <div
          key={member.uid}
          className={`bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-all duration-200 group ${cardOutlineClass}`}
        >
          <div className="flex items-center space-x-4">
            {/* Avatar - links to profile */}
            <Link to={`/profile/${member.uid}`} className="w-16 h-16 rounded-full overflow-hidden border-2 border-gray-100 flex-shrink-0 block shrink-0 relative">
              {member.avatarUrl ? (
                member.profileImageCrop ? (
                  <CropImage
                    src={member.avatarUrl}
                    crop={member.profileImageCrop}
                    alt={displayName}
                    mode="fill"
                    className="rounded-full"
                  />
                ) : (
                  <img
                    src={member.avatarUrl}
                    alt={displayName}
                    className="w-full h-full object-cover"
                  />
                )
              ) : (
                <div className={`w-full h-full bg-gradient-to-br ${avatarColor} flex items-center justify-center text-white font-bold text-lg`}>
                  {displayName.charAt(0).toUpperCase()}
                </div>
              )}
            </Link>

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

                  {hasIncomingRequest && incomingReq && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={isRespondingToRequest}
                        onClick={() => handleRespondToRequest(incomingReq.id, 'accepted')}
                        className="flex items-center gap-1 px-2 py-1.5 text-sm font-medium text-white bg-[#0B2B6B] hover:bg-[#0a2456] rounded-lg transition-colors disabled:opacity-50"
                        title="Accept"
                      >
                        {isRespondingToRequest ? '…' : <><Check className="h-4 w-4" /> Accept</>}
                      </button>
                      <button
                        type="button"
                        disabled={isRespondingToRequest}
                        onClick={() => handleRespondToRequest(incomingReq.id, 'rejected')}
                        className="flex items-center gap-1 px-2 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                        title="Reject"
                      >
                        {!isRespondingToRequest && <><X className="h-4 w-4" /> Reject</>}
                      </button>
                    </div>
                  )}

                  {!hasIncomingRequest && currentUser && !member.isConnected && !isSelf && !hasPendingRequest && (
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

                  {!hasIncomingRequest && hasPendingRequest && !member.isConnected && (
                    <div className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-medium flex items-center space-x-1">
                      <Clock className="h-4 w-4" />
                      <span>Pending</span>
                    </div>
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
        className={`bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-all duration-200 flex flex-col h-full ${cardOutlineClass}`}
      >
        {/* Avatar - links to profile */}
        <div className="flex justify-center mb-4">
          <Link to={`/profile/${member.uid}`} className="w-20 h-20 rounded-full overflow-hidden border-2 border-gray-100 flex-shrink-0 block relative">
            {member.avatarUrl ? (
              member.profileImageCrop ? (
                <CropImage
                  src={member.avatarUrl}
                  crop={member.profileImageCrop}
                  alt={displayName}
                  mode="fill"
                  className="rounded-full"
                />
              ) : (
                <img
                  src={member.avatarUrl}
                  alt={displayName}
                  className="w-full h-full object-cover"
                />
              )
            ) : (
              <div className={`w-full h-full bg-gradient-to-br ${avatarColor} flex items-center justify-center text-white font-bold text-xl`}>
                {displayName.charAt(0).toUpperCase()}
              </div>
            )}
          </Link>
        </div>

        {/* Info */}
        <div className="text-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-1 line-clamp-1">{displayName}</h3>

          {member.bioTitle && (
            <p className="text-blue-600 font-medium text-sm mb-2 line-clamp-2 leading-snug">{member.bioTitle}</p>
          )}

          {member.company && (
            <div className="flex items-center justify-center text-gray-600 text-sm mb-2">
              <Briefcase className="h-4 w-4 mr-1.5 flex-shrink-0" />
              <span className="line-clamp-1">{member.company}</span>
            </div>
          )}

          {(member.city || member.country) && (
            <div className="flex items-center justify-center text-gray-500 text-sm">
              <MapPin className="h-4 w-4 mr-1.5 flex-shrink-0" />
              <span className="line-clamp-1">{[member.city, member.country].filter(Boolean).join(', ')}</span>
            </div>
          )}
        </div>

        {/* Skills Preview */}
        {member.skills && member.skills.length > 0 && (
          <div className="mb-4">
            <div className="flex flex-wrap gap-1.5 justify-center">
              {member.skills.slice(0, 3).map((skill, index) => (
                <span
                  key={index}
                  className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-medium"
                >
                  {skill}
                </span>
              ))}
              {member.skills.length > 3 && (
                <span className="px-2 py-1 bg-gray-100 text-gray-500 rounded text-xs font-medium">
                  +{member.skills.length - 3} more
                </span>
              )}
            </div>
          </div>
        )}

        {/* Spacer to push footer to bottom */}
        <div className="flex-grow"></div>

        {/* Actions */}
        <div className="flex flex-col space-y-2 mt-auto pt-3 border-t border-gray-100">
          <div className="flex justify-center space-x-2">
            <button
              onClick={() => window.location.href = `/profile/${member.uid}`}
              className="p-2 text-gray-400 hover:text-brand-blue transition-colors border border-gray-200 rounded-lg hover:border-blue-200"
              title="View Full Profile"
            >
              <ExternalLink className="h-5 w-5" />
            </button>
            {member.linkedin && (
              <a
                href={`https://linkedin.com/in/${member.linkedin}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 text-gray-400 hover:text-brand-blue transition-colors border border-gray-200 rounded-lg hover:border-blue-200"
                title="LinkedIn Profile"
              >
                <Linkedin className="h-5 w-5" />
              </a>
            )}
          </div>

          {hasIncomingRequest && incomingReq && (
            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                disabled={isRespondingToRequest}
                onClick={() => handleRespondToRequest(incomingReq.id, 'accepted')}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-[#0B2B6B] hover:bg-[#0a2456] rounded-lg transition-colors disabled:opacity-50 min-h-[36px]"
                title="Accept"
              >
                {isRespondingToRequest ? '…' : <><Check className="h-4 w-4" /> Accept</>}
              </button>
              <button
                type="button"
                disabled={isRespondingToRequest}
                onClick={() => handleRespondToRequest(incomingReq.id, 'rejected')}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 min-h-[36px]"
                title="Reject"
              >
                {!isRespondingToRequest && <><X className="h-4 w-4" /> Reject</>}
              </button>
            </div>
          )}

          {!hasIncomingRequest && currentUser && !member.isConnected && !isSelf && !hasPendingRequest && (
            <button
              onClick={() => handleConnect(member.uid)}
              disabled={isConnecting}
              className="bg-brand-dark hover:bg-brand-dark-hover text-white px-4 py-2.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 font-medium"
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

          {!hasIncomingRequest && hasPendingRequest && !member.isConnected && (
            <div className="bg-yellow-100 text-yellow-800 px-4 py-2.5 rounded-lg font-medium flex items-center justify-center space-x-2">
              <Clock className="h-4 w-4" />
              <span>Pending</span>
            </div>
          )}

          {member.isConnected && (
            <div className="bg-green-100 text-green-800 px-4 py-2.5 rounded-lg font-medium flex items-center justify-center space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span>Connected</span>
            </div>
          )}

          {isSelf && (
            <div className="bg-blue-100 text-blue-800 px-4 py-2.5 rounded-lg font-medium flex items-center justify-center space-x-2">
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
      
      {/* Hero Section - pt-28 so content is below fixed header */}
      <section className="pt-28 pb-12 bg-gradient-to-br from-blue-50 to-indigo-50">
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

                {/* View Member Map Button */}
                <button
                  onClick={() => setShowMemberMap(true)}
                  className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-brand-blue-dark to-brand-blue-light text-white rounded-2xl hover:shadow-lg transition-all shadow-sm font-medium whitespace-nowrap"
                >
                  <Map className="h-5 w-5" />
                  <span>View Map</span>
                </button>

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

          {/* Members List - incoming request members first, then rest */}
          {filteredMembers.length > 0 ? (
            <div className={
              viewMode === 'grid' 
                ? "grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" 
                : "space-y-4"
            }>
              {(() => {
                const requesterIds = new Set(incomingRequests.map(r => r.requesterId || r.fromUid).filter(Boolean));
                const sorted = [...filteredMembers].sort((a, b) => {
                  const aFirst = requesterIds.has(a.uid);
                  const bFirst = requesterIds.has(b.uid);
                  if (aFirst && !bFirst) return -1;
                  if (!aFirst && bFirst) return 1;
                  return 0;
                });
                return sorted.map(renderMemberCard);
              })()}
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

      {/* Member Map Modal */}
      <MemberMap isOpen={showMemberMap} onClose={() => setShowMemberMap(false)} />
    </div>
  );
};

export default MembersPage;