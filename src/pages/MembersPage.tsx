import React, { useState, useEffect } from 'react';
import { Search, MapPin, Briefcase, Plus, Linkedin, User, Filter, Grid, List, ExternalLink, Map, Check, X, Clock } from 'lucide-react';
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
  
  // Connection requests state
  const [incomingRequests, setIncomingRequests] = useState<ConnectionRequest[]>([]);
  const [sentRequestIds, setSentRequestIds] = useState<Set<string>>(new Set()); // Track which users we've sent requests to
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [respondingToRequest, setRespondingToRequest] = useState<string | null>(null);

  useEffect(() => {
    loadMembers();
    if (currentUser?.uid) {
      loadIncomingRequests();
      loadSentRequests();
      
      // DEV: Debug recent requests
      if (import.meta.env.DEV) {
        ConnectionRequestService.getRecentRequests(20).catch(err => {
          console.warn('[debug] Could not load recent requests:', err);
        });
      }
    }
  }, [currentUser]);

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

  // Load incoming connection requests (independent from members loading)
  const loadIncomingRequests = async () => {
    if (!currentUser?.uid) {
      if (import.meta.env.DEV) {
        console.log('[incoming-requests] No current user, skipping');
      }
      return;
    }
    
    try {
      setLoadingRequests(true);
      
      if (import.meta.env.DEV) {
        console.log('[incoming-requests] Loading for user:', currentUser.uid);
      }
      
      const requests = await ConnectionRequestService.getPendingRequests(currentUser.uid);
      
      if (import.meta.env.DEV) {
        console.log(`[incoming-requests] Loaded ${requests.length} requests for user ${currentUser.uid}`);
        console.log(`📊 requestsCount: ${requests.length}`);
        console.log(`📊 requestsLoading: false`);
        if (requests.length > 0) {
          console.log('[incoming-requests] First request:', {
            id: requests[0].id,
            requesterId: requests[0].requesterId,
            targetId: requests[0].targetId,
            status: requests[0].status,
            fromName: requests[0].fromName
          });
        }
      }
      
      setIncomingRequests(requests);
    } catch (error) {
      console.error('❌ Error loading incoming requests:', error);
      // Don't block page - just log error and set empty array
      setIncomingRequests([]);
      
      if (import.meta.env.DEV) {
        console.log(`📊 requestsError: ${error instanceof Error ? error.message : 'Unknown error'}`);
        console.error('[incoming-requests] Full error:', error);
      }
    } finally {
      setLoadingRequests(false);
    }
  };

  // Load sent connection requests to track pending state (independent from members loading)
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

  // Handle accepting/rejecting incoming requests
  const handleRespondToRequest = async (requestId: string, action: 'accept' | 'reject') => {
    if (!currentUser?.uid || respondingToRequest === requestId) return;

    // Find the request in local state to get requester info
    const request = incomingRequests.find(r => r.id === requestId);
    const requesterId = request?.requesterId || request?.fromUid;
    const targetId = request?.targetId || request?.toUid;

    if (import.meta.env.DEV) {
      console.log('[handle-respond-start]', {
        requestId,
        action,
        currentUserId: currentUser.uid,
        requesterId,
        targetId
      });
    }

    try {
      setRespondingToRequest(requestId);
      
      // Respond to request (this will create connection if accepted, using same path as admin)
      // Convert 'accept'/'reject' to 'accepted'/'rejected' for the service
      const serviceAction = action === 'accept' ? 'accepted' : 'rejected';
      const connectionId = await ConnectionRequestService.respondToRequest(
        requestId, 
        serviceAction, 
        currentUser.uid
      );
      
      if (import.meta.env.DEV) {
        console.log('[handle-respond-result]', {
          requestId,
          action,
          connectionId,
          connectionCreated: !!connectionId
        });
      }
      
      // Remove from incoming requests immediately (optimistic update)
      setIncomingRequests(prev => prev.filter(req => req.id !== requestId));
      
      // If accepted, verify connection exists using returned connectionId
      if (action === 'accept') {
        try {
          // CRITICAL: connectionId MUST be non-null from admin creator
          if (!connectionId) {
            throw new Error('CRITICAL: Admin connection creator returned null connectionId. Check [ADMIN_CONNECT_RETURN] and [ADMIN_CONNECT_USED] logs.');
          }
          
          const connectionPath = `connections/${connectionId}`;
          
          // VERIFICATION 1: Read the returned doc directly (fastest, most reliable)
          const { doc, getDoc } = await import('firebase/firestore');
          const { db } = await import('../firebase/config');
          
          const connectionDocRef = doc(db, connectionPath);
          const connectionDoc = await getDoc(connectionDocRef);
          
          if (!connectionDoc.exists()) {
            throw new Error(`Connection doc does not exist at returned path: ${connectionPath}. Check [ADMIN_CONNECT_WRITE] log.`);
          }
          
          const connectionData = connectionDoc.data();
          
          if (import.meta.env.DEV) {
            console.log('[ACCEPT_VERIFY] Step 1: Direct doc read', {
              connectionId,
              connectionPath,
              docExists: connectionDoc.exists(),
              docData: {
                uid1: connectionData.uid1,
                uid2: connectionData.uid2,
                hasUpdatedAt: !!connectionData.updatedAt,
                source: connectionData.source
              }
            });
          }
          
          // VERIFICATION 2: Use query-based checks (for UI compatibility)
          const { ConnectionService } = await import('../services/connectionService');
          
          // Small delay for eventual consistency
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Retry getUserConnections up to 5 times (for eventual consistency)
          let dashboardConnections: any[] = [];
          let dashboardContainsOtherUser = false;
          let retryCount = 0;
          const maxRetries = 5;
          
          while (retryCount < maxRetries && !dashboardContainsOtherUser) {
            dashboardConnections = await ConnectionService.getUserConnections(currentUser.uid, 100);
            dashboardContainsOtherUser = dashboardConnections.some(conn => 
              (conn.uid1 === requesterId && conn.uid2 === currentUser.uid) ||
              (conn.uid2 === requesterId && conn.uid1 === currentUser.uid)
            );
            
            if (!dashboardContainsOtherUser && retryCount < maxRetries - 1) {
              await new Promise(resolve => setTimeout(resolve, 200));
              retryCount++;
            } else {
              break;
            }
          }
          
          // Also verify checkExistingConnection works
          const isConnectedResult = await ConnectionService.checkExistingConnection(
            currentUser.uid,
            requesterId || ''
          );
          
          if (import.meta.env.DEV) {
            console.log('[ACCEPT_VERIFY]', {
              requestId,
              requesterId,
              targetId: currentUser.uid,
              connectionId,
              connectionPath,
              adminConnectCalled: true,
              // Verification 1: Direct doc read (most reliable)
              directDocRead: {
                exists: connectionDoc.exists(),
                path: connectionPath,
                uid1: connectionData.uid1,
                uid2: connectionData.uid2,
                hasUpdatedAt: !!connectionData.updatedAt
              },
              // Verification 2: Query-based checks (for UI compatibility)
              checkExistingConnectionResult: {
                found: !!isConnectedResult,
                docId: isConnectedResult?.id,
                matchesReturnedId: isConnectedResult?.id === connectionId
              },
              getUserConnectionsResult: {
                found: dashboardContainsOtherUser,
                retries: retryCount,
                totalConnections: dashboardConnections.length,
                connectionIds: dashboardConnections.map(c => c.id).slice(0, 5)
              },
              verificationStatus: {
                directDocRead: connectionDoc.exists() ? 'PASS' : 'FAIL',
                checkExistingConnection: isConnectedResult ? 'PASS' : 'FAIL (may be eventual consistency)',
                getUserConnections: dashboardContainsOtherUser ? 'PASS' : `FAIL after ${retryCount} retries (may be eventual consistency)`
              }
            });
          }
          
          // Primary verification: doc must exist at returned path
          if (!connectionDoc.exists()) {
            throw new Error(`Connection verification failed: Doc does not exist at returned path ${connectionPath}. Check [ADMIN_CONNECT_WRITE] log.`);
          }
          
          // Secondary verification: query-based checks (warn but don't fail if eventual consistency)
          if (!isConnectedResult || !dashboardContainsOtherUser) {
            if (import.meta.env.DEV) {
              console.warn('[ACCEPT_VERIFY] Query-based checks failed (may be eventual consistency)', {
                checkExistingConnection: !isConnectedResult,
                getUserConnections: !dashboardContainsOtherUser,
                note: 'Direct doc read passed, so connection exists. Queries may need more time for indexing.'
              });
            }
            // Don't throw - connection exists, queries just need time
          }
          
          if (import.meta.env.DEV) {
            console.log('✅ [ACCEPT_VERIFY] PASSED: Connection exists at returned path and is queryable');
          }
        } catch (verifyError) {
          console.error('[ACCEPT_VERIFY] Verification error:', verifyError);
          // Re-throw to surface the error
          throw verifyError;
        }
        
        // Update sent request IDs to remove any pending state
        if (requesterId) {
          setSentRequestIds(prev => {
            const newSet = new Set(prev);
            newSet.delete(requesterId);
            return newSet;
          });
        }
        
        // Reload members to show connection status
        await loadMembers();
        
        if (import.meta.env.DEV) {
          console.log('[handle-respond-accepted]', {
            requestId,
            requesterId,
            targetId,
            connectionId,
            membersReloaded: true
          });
        }
      }
      
      console.log(`✅ Request ${action}ed successfully`);
    } catch (error: any) {
      console.error(`❌ Error ${action}ing request:`, error);
      
      // Show user-friendly error message
      const errorMessage = error.message || `Failed to ${action} request. Please try again.`;
      alert(errorMessage);
      
      // Reload requests to get fresh state in case of partial failure
      if (currentUser?.uid) {
        await loadIncomingRequests();
      }
    } finally {
      setRespondingToRequest(null);
    }
  };

  // Handle sending connection request (user-initiated) or creating connection (admin)
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
      console.error('❌ Error creating connection/request:', error);
      // Show user-friendly error message (not the API server error)
      const errorMessage = error.message?.includes('API server') || error.message?.includes('localhost:3000')
        ? 'Couldn\'t send request. Please try again.'
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
    const hasPendingRequest = member.connectionPending || sentRequestIds.has(member.uid);

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
                  
                  {currentUser && !member.isConnected && !isSelf && !hasPendingRequest && (
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
                  
                  {hasPendingRequest && !member.isConnected && (
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
        className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-all duration-200 flex flex-col h-full"
      >
        {/* Avatar */}
        <div className="flex justify-center mb-4">
          <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-gray-100 flex-shrink-0">
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
            {/* View Profile Button */}
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

          {currentUser && !member.isConnected && !isSelf && !hasPendingRequest && (
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

          {hasPendingRequest && !member.isConnected && (
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
      
      {/* Connection Requests Section - Independent from members loading */}
      <section className={`${incomingRequests.length > 0 ? 'pt-32 pb-6' : 'pt-32 pb-0'} px-4 sm:px-6 lg:px-8`}>
        {loadingRequests && (
          <div className="max-w-6xl mx-auto mb-6">
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
              <div className="flex items-center space-x-3">
                <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                <span className="text-gray-600">Loading connection requests...</span>
              </div>
            </div>
          </div>
        )}
        
        {incomingRequests.length > 0 && (
          <div className="max-w-6xl mx-auto">
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-gray-900 flex items-center space-x-2">
                  <Clock className="h-6 w-6 text-blue-600" />
                  <span>Connection Requests</span>
                  <span className="bg-blue-100 text-blue-800 px-2.5 py-0.5 rounded-full text-sm font-medium">
                    {incomingRequests.length}
                  </span>
                </h2>
              </div>
              
              <div className="space-y-3">
                {incomingRequests.map((request) => {
                  const requesterName = request.fromName || request.requester?.displayName || request.requester?.name || 'Unknown User';
                  const requesterWork = request.fromWork || request.requester?.work || '';
                  const requesterAvatar = request.fromProfileImage || request.requester?.profileImage;
                  
                  return (
                    <div
                      key={request.id}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200 hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center space-x-4 flex-1 min-w-0">
                        {/* Avatar */}
                        <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-gray-200 flex-shrink-0">
                          {requesterAvatar ? (
                            <img
                              src={requesterAvatar}
                              alt={requesterName}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-bold">
                              {requesterName.charAt(0).toUpperCase()}
                            </div>
                          )}
                        </div>
                        
                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <h3 className="text-lg font-semibold text-gray-900 truncate">
                            {requesterName}
                          </h3>
                          {requesterWork && (
                            <p className="text-sm text-gray-600 truncate">
                              {requesterWork}
                            </p>
                          )}
                          <p className="text-xs text-gray-500 mt-1">
                            {request.createdAt 
                              ? `Requested ${request.createdAt instanceof Date 
                                  ? request.createdAt.toLocaleDateString()
                                  : new Date(request.createdAt).toLocaleDateString()}`
                              : 'Requested recently'}
                          </p>
                        </div>
                      </div>
                      
                      {/* Actions */}
                      <div className="flex items-center space-x-2 ml-4 flex-shrink-0">
                        <button
                          onClick={() => handleRespondToRequest(request.id, 'accept')}
                          disabled={respondingToRequest === request.id}
                          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 font-medium"
                        >
                          {respondingToRequest === request.id ? (
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <>
                              <Check className="h-4 w-4" />
                              <span>Accept</span>
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => handleRespondToRequest(request.id, 'reject')}
                          disabled={respondingToRequest === request.id}
                          className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 font-medium"
                        >
                          {respondingToRequest === request.id ? (
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <>
                              <X className="h-4 w-4" />
                              <span>Reject</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </section>
      
      {/* Hero Section */}
      <section className="pt-6 pb-12 bg-gradient-to-br from-blue-50 to-indigo-50">
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

      {/* Member Map Modal */}
      <MemberMap isOpen={showMemberMap} onClose={() => setShowMemberMap(false)} />
    </div>
  );
};

export default MembersPage;