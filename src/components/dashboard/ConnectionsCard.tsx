import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Users, User, Briefcase, Linkedin, Mail, ChevronRight, ChevronLeft, Calendar, ChevronDown, Eye, Shield, UserPlus, Zap } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { ConnectionService, LegacyConnection, Connection } from '../../services/connectionService';
import { EventService } from '../../services/eventService';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { linkedInProfileHref } from '../../utils/linkedInUrl';
import ImageWithCrop from '../profile/ImageWithCrop';
import ProfileAvatarPlaceholder from '../profile/ProfileAvatarPlaceholder';

interface EnrichedConnection extends LegacyConnection {
  partnerData?: {
    uid: string;
    name: string;
    work: string;
    position: string;
    linkedin: string;
    email: string;
    profileImage: string | null;
  };
  allEventIds?: string[]; // For tracking multiple events in "All Events" view
}

/** Get milliseconds from any timestamp shape (Firestore Timestamp, Date, ISO string, or number). */
function timestampToMs(t: unknown): number {
  if (t == null) return 0;
  const v = t as { toMillis?: () => number; toDate?: () => Date };
  if (typeof v.toMillis === 'function') return v.toMillis();
  if (typeof v.toDate === 'function') return v.toDate().getTime();
  if (t instanceof Date) return t.getTime();
  if (typeof t === 'number') return t;
  if (typeof t === 'string') return new Date(t).getTime();
  return 0;
}

export interface ConnectionsCardProps {
  /** Denser layout and brand-colored avatars for dashboard sidebar. */
  compact?: boolean;
  /** Vertical list for profile page sidebar — minimal rows, one screen. */
  sidebar?: boolean;
}

const ConnectionsCard: React.FC<ConnectionsCardProps> = ({ compact = false, sidebar = false }) => {
  const { user } = useAuth();
  const [connections, setConnections] = useState<EnrichedConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [scrollPosition, setScrollPosition] = useState(0);
  const [events, setEvents] = useState<any[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>('all');
  const [loadingEvents, setLoadingEvents] = useState(true);
  
  // Scroll container ref
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  
  // Load events and connections
  useEffect(() => {
    if (user?.uid) {
      loadUserRegisteredEvents();
      loadConnections();
    }
  }, [user]);
  
  // Load events where user has registered OR has connections
  const loadUserRegisteredEvents = async () => {
    if (!user?.uid) return;
    
    try {
      setLoadingEvents(true);
      
      // Get all user connections first to find events they're connected to
      const userConnections = await ConnectionService.getUserConnectionsLegacy(user.uid);
      const connectedEventIds = new Set(userConnections.map(conn => conn.eventId).filter(Boolean));
      
      // Get all events - getPublicEvents already filters out non-active ones
      const allEvents = await EventService.getPublicEvents();
      
      // Filter to include events the user has registered for OR has connections in
      const userRelevantEvents = [];
      
      for (const event of allEvents) {
        const registration = await EventService.getUserRegistration(event.id, user.uid);
        const hasConnections = connectedEventIds.has(event.id);
        
        if (registration || hasConnections) {
          userRelevantEvents.push(event);
        }
      }
      
      console.log('🎯 User relevant events (registered + connected):', userRelevantEvents.length);
      setEvents(userRelevantEvents);
    } catch (error) {
      console.error('❌ Error loading user registered events:', error);
    } finally {
      setLoadingEvents(false);
    }
  };

  // Fetch user data if not available in connection
  const fetchUserData = async (userId: string) => {
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        console.log('🔍 Fetched user data for', userId, ':', {
          profileImage: userData.profileImage,
          photoURL: userData.photoURL,
          avatar: userData.avatar,
          profilePicture: userData.profilePicture
        });
        
        return {
          name: userData.displayName || userData.name || 'Unknown User',
          work: userData.work || 'Not specified',
          position: userData.position || '',
          linkedin: userData.linkedinUsername || '',
          email: userData.email || '',
          // Try multiple possible field names for profile image
          profileImage: userData.profileImage || userData.photoURL || userData.avatar || userData.profilePicture || null
        };
      }
    } catch (error) {
      console.error('❌ Error fetching user data:', error);
    }
    return null;
  };

  // Get connection partner data (the other user in the connection)
  const getConnectionPartner = (connection: Connection) => {
    if (!user) return null;
    
    // If current user is the "from" user, return the "to" user data
    if (connection.fromUid === user.uid) {
      console.log('🖼️ Connection partner (TO):', connection.toName, 'Profile image:', connection.toProfileImage);
      return {
        uid: connection.toUid,
        name: connection.toName || 'Unknown User',
        work: connection.toWork || 'Not specified',
        position: connection.toPosition || '',
        linkedin: connection.toLinkedin || '',
        email: connection.toEmail || '',
        profileImage: connection.toProfileImage || null
      };
    }
    
    // Otherwise return the "from" user data
    console.log('🖼️ Connection partner (FROM):', connection.fromName, 'Profile image:', connection.fromProfileImage);
    return {
      uid: connection.fromUid,
      name: connection.fromName || 'Unknown User',
      work: connection.fromWork || 'Not specified',
      position: connection.fromPosition || '',
      linkedin: connection.fromLinkedin || '',
      email: connection.fromEmail || '',
      profileImage: connection.fromProfileImage || null
    };
  };
  
  // Load connections based on selected event
  const loadConnections = async () => {
    if (!user?.uid) return;
    
    try {
      setLoading(true);
      
      let userConnections;
      if (selectedEventId === 'all') {
        // Load all connections
        userConnections = await ConnectionService.getUserConnectionsLegacy(user.uid);
        
        // Log UI connection source (DEV only)
        if (import.meta.env.DEV) {
          console.log('[CONN_UI_SOURCE] My Connections list', {
            currentUser: user.uid,
            source: 'ConnectionService.getUserConnectionsLegacy() -> queries connections where (uid1==currentUser OR uid2==currentUser) orderBy updatedAt desc',
            count: userConnections.length,
            sample: userConnections[0] ? {
              id: userConnections[0].id,
              fromUid: userConnections[0].fromUid,
              toUid: userConnections[0].toUid,
              eventId: userConnections[0].eventId
            } : null
          });
        }
        
        // Deduplicate users when showing "All Events"
        // Keep only the most recent connection with each unique user
        // But also track all events where they connected
        const deduplicatedConnections = [];
        const seenUsers = new Map<string, string[]>(); // userId -> eventIds[]
        
        // Sort by timestamp descending (most recent first)
        userConnections.sort((a, b) => timestampToMs(b.timestamp) - timestampToMs(a.timestamp));
        
        for (const connection of userConnections) {
          // Get the partner user ID
          const partnerUid = connection.fromUid === user.uid ? connection.toUid : connection.fromUid;
          
          if (!seenUsers.has(partnerUid)) {
            // First time seeing this user - add them
            seenUsers.set(partnerUid, [connection.eventId].filter(Boolean));
            
            // Add metadata about all their events for display
            const connectionWithMeta = {
              ...connection,
              allEventIds: [connection.eventId].filter(Boolean)
            };
            
            deduplicatedConnections.push(connectionWithMeta);
            console.log('✅ Added unique connection with:', partnerUid, 'from event:', connection.eventId);
          } else {
            // Already seen this user - just track their event
            const existingEvents = seenUsers.get(partnerUid) || [];
            if (connection.eventId && !existingEvents.includes(connection.eventId)) {
              existingEvents.push(connection.eventId);
              seenUsers.set(partnerUid, existingEvents);
              
              // Update the existing connection's event list
              const existingConnection = deduplicatedConnections.find(conn => {
                const existingPartnerUid = conn.fromUid === user.uid ? conn.toUid : conn.fromUid;
                return existingPartnerUid === partnerUid;
              });
              if (existingConnection && existingConnection.allEventIds) {
                existingConnection.allEventIds = existingEvents;
              }
            }
            console.log('⏭️ Tracked additional event for:', partnerUid, 'event:', connection.eventId);
          }
        }
        
        userConnections = deduplicatedConnections;
        console.log('🔄 Deduplicated connections (All Events):', userConnections.length);
      } else {
        // Load connections for specific event (no deduplication needed)
        userConnections = await ConnectionService.getUserConnectionsByEventLegacy(user.uid, selectedEventId);
        console.log('🔄 Event-specific connections:', userConnections.length);
      }
      
      console.log('🔄 Final connections to display:', userConnections);
      
      // Load detailed connection reasons
      await loadConnectionReasons(userConnections);
      
      // Enrich connections with fresh user data if profile image is missing
      const enrichedConnections: EnrichedConnection[] = [];
      const userDataCache = new Map<string, any>(); // Cache to avoid duplicate fetches
      
      for (const connection of userConnections) {
        const partner = getConnectionPartner(connection);
        let enrichedConnection = { ...connection };
        
        if (partner && !partner.profileImage) {
          // Check cache first to avoid duplicate API calls
          let freshUserData = userDataCache.get(partner.uid);
          if (!freshUserData) {
            console.log('🔄 Profile image missing for', partner.name, '- fetching fresh user data');
            freshUserData = await fetchUserData(partner.uid);
            if (freshUserData) {
              userDataCache.set(partner.uid, freshUserData);
            }
          }
          
          if (freshUserData) {
            enrichedConnection.partnerData = {
              uid: partner.uid,
              ...freshUserData
            };
            console.log('✅ Enriched connection with fresh data:', freshUserData);
          }
        }
        
        enrichedConnections.push(enrichedConnection);
      }
      
      setConnections(enrichedConnections);
    } catch (error) {
      console.error('❌ Error loading connections:', error);
    } finally {
      setLoading(false);
    }
  };
  
  // Reload connections when event selection changes
  useEffect(() => {
    if (user?.uid) {
      loadConnections();
    }
  }, [selectedEventId, user]);
  
  // Handle scroll buttons
  const scrollLeft = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: -300, behavior: 'smooth' });
      setScrollPosition(scrollContainerRef.current.scrollLeft - 300);
    }
  };
  
  const scrollRight = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: 300, behavior: 'smooth' });
      setScrollPosition(scrollContainerRef.current.scrollLeft + 300);
    }
  };
  
  // Update scroll position on scroll
  const handleScroll = () => {
    if (scrollContainerRef.current) {
      setScrollPosition(scrollContainerRef.current.scrollLeft);
    }
  };
  
  // Add scroll event listener
  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', handleScroll);
      return () => scrollContainer.removeEventListener('scroll', handleScroll);
    }
  }, []);
  
  // Check if scroll buttons should be visible
  const canScrollLeft = scrollPosition > 0;
  const canScrollRight = scrollContainerRef.current 
    ? scrollPosition < scrollContainerRef.current.scrollWidth - scrollContainerRef.current.clientWidth - 10
    : false;
  
  // Get connection reason badge with clearer text
  const getConnectionReasonBadge = (connectionType: string) => {
    switch (connectionType) {
      case 'auto':
        return {
          icon: Zap,
          label: 'Connected at event check-in',
          bgColor: 'bg-green-100',
          textColor: 'text-green-800',
          iconColor: 'text-green-600'
        };
      case 'admin':
        return {
          icon: Shield,
          label: 'Connected by Admin',
          bgColor: 'bg-purple-100',
          textColor: 'text-purple-800',
          iconColor: 'text-brand-dark'
        };
      case 'manual':
      default:
        return {
          icon: UserPlus,
          label: 'Connected by Request',
          bgColor: 'bg-blue-50',
          textColor: 'text-blue-800',
          iconColor: 'text-brand-blue'
        };
    }
  };

  // Get all connection reasons for a user pair
  const [connectionReasons, setConnectionReasons] = useState<Map<string, Connection>>(new Map());

  // Load detailed connection info for better reason display
  const loadConnectionReasons = async (connections: EnrichedConnection[]) => {
    if (!user?.uid) return;
    
    const reasonsMap = new Map<string, Connection>();
    
    for (const connection of connections) {
      try {
        // Get the other user's UID
        const otherUid = connection.fromUid === user.uid ? connection.toUid : connection.fromUid;
        
        // Check if there's a new-format connection with multiple reasons
        const detailedConnection = await ConnectionService.checkExistingConnection(user.uid, otherUid);
        
        if (detailedConnection) {
          reasonsMap.set(otherUid, detailedConnection);
        }
      } catch (error) {
        console.error('Error loading connection reasons for:', connection.id, error);
      }
    }
    
    setConnectionReasons(reasonsMap);
  };

  // Get all reasons for a connection
  const getConnectionReasons = (connection: EnrichedConnection): string[] => {
    const otherUid = connection.fromUid === user?.uid ? connection.toUid : connection.fromUid;
    const detailedConnection = connectionReasons.get(otherUid);
    
    if (detailedConnection && detailedConnection.reasons) {
      return detailedConnection.reasons.map(reason => {
        switch (reason.type) {
          case 'event':
            return 'Connected at event check-in';
          case 'admin':
            return reason.context ? `Connected by Admin: "${reason.context}"` : 'Connected by Admin';
          case 'user':
            return 'Connected by Request';
          default:
            return 'Connected';
        }
      });
    }
    
    // Fallback to legacy reason
    switch (connection.connectionType) {
      case 'auto':
        return ['Connected at event check-in'];
      case 'admin':
        return ['Connected by Admin'];
      case 'manual':
      default:
        return ['Connected by Request'];
    }
  };
  
  // Handle event selection
  const handleEventChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedEventId(e.target.value);
  };
  
  // Get event name by ID
  const getEventName = (eventId: string) => {
    const event = events.find(e => e.id === eventId);
    return event ? event.name : 'Unknown Event';
  };

  // Get final partner data (prioritizing enriched data)
  const getFinalPartnerData = (connection: EnrichedConnection) => {
    const basePartner = getConnectionPartner(connection);
    if (!basePartner) return null;

    // Use enriched data if available, otherwise use base partner data
    if (connection.partnerData) {
      return connection.partnerData;
    }

    return basePartner;
  };

  if (sidebar) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-brand-blue shrink-0" />
            Connections
          </h3>
          <Link
            to="/members"
            className="text-[10px] font-medium text-brand-blue hover:text-brand-blue-hover whitespace-nowrap"
          >
            View all
          </Link>
        </div>
        <div className="p-2">
          {loading || loadingEvents ? (
            <p className="text-xs text-gray-500 py-2 text-center">Loading…</p>
          ) : connections.length === 0 ? (
            <p className="text-xs text-gray-600 text-center py-2 leading-snug">
              No connections yet.{' '}
              <Link to="/members" className="text-brand-blue font-medium hover:underline">
                Browse members
              </Link>
            </p>
          ) : (
            <ul className="space-y-1 max-h-[12rem] overflow-y-auto">
              {connections.map((connection) => {
                const partner = getFinalPartnerData(connection);
                if (!partner) return null;
                return (
                  <li key={connection.id}>
                    <Link
                      to={`/profile/${partner.uid}`}
                      className="flex items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-gray-50 transition-colors group"
                    >
                      <div className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0 bg-brand-dark">
                        <ImageWithCrop
                          src={String(partner.profileImage || '')}
                          crop={null}
                          shape="circle"
                          alt=""
                          className="rounded-full w-full h-full"
                          urlIsCropped={true}
                          fallback={
                            <ProfileAvatarPlaceholder
                              name={partner.name}
                              textClassName="font-semibold text-[10px]"
                            />
                          }
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-900 group-hover:text-brand-dark truncate">
                          {partner.name}
                        </p>
                        {partner.work && (
                          <p className="text-[10px] text-gray-500 truncate">{partner.work}</p>
                        )}
                      </div>
                      <ChevronRight className="h-3 w-3 text-gray-400 group-hover:text-brand-dark shrink-0" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={
        compact
          ? 'bg-transparent rounded-none shadow-none p-0 border-0'
          : 'bg-white rounded-2xl sm:rounded-3xl shadow-xl p-4 sm:p-6 border border-gray-100'
      }
    >
      {/* Header - Stacked on mobile, horizontal on desktop */}
      <div
        className={
          compact
            ? 'flex flex-col sm:flex-row sm:items-center sm:justify-between mb-2 gap-2 sm:gap-0'
            : 'flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 sm:mb-6 gap-3 sm:gap-0'
        }
      >
        {/* Title Row - Full width on mobile */}
        <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-shrink-0">
          <Users className={compact ? 'h-4 w-4 text-brand-blue flex-shrink-0' : 'h-5 w-5 sm:h-6 sm:w-6 text-brand-blue flex-shrink-0'} />
          <h3 className={compact ? 'text-sm font-bold text-gray-900 whitespace-nowrap' : 'text-lg sm:text-xl font-bold text-gray-900 whitespace-nowrap'}>
            My Connections
          </h3>
        </div>
        
        {/* Controls Row - Full width on mobile, auto on desktop */}
        <div className="flex items-center justify-between sm:justify-end space-x-3 sm:space-x-4 w-full sm:w-auto flex-shrink-0">
          {/* Event Filter Dropdown */}
          <div className="relative flex-1 sm:flex-none min-w-0">
            <select
              value={selectedEventId}
              onChange={handleEventChange}
              className={
                compact
                  ? 'w-full sm:w-auto appearance-none bg-white border border-gray-300 rounded-md px-2 py-1.5 pr-7 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-xs min-h-[40px] sm:min-h-0'
                  : 'w-full sm:w-auto appearance-none bg-white border border-gray-300 rounded-lg px-3 py-2 pr-8 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm min-h-[44px] sm:min-h-0'
              }
              disabled={loadingEvents || events.length === 0}
            >
              <option value="all">All Events</option>
              {events.map(event => (
                <option key={event.id} value={event.id}>
                  {event.name}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          </div>
          
          {/* Pagination Arrows */}
          {connections.length > 0 && (
            <div className="flex items-center space-x-2 flex-shrink-0">
              <button
                onClick={scrollLeft}
                disabled={!canScrollLeft}
                className={`p-2 rounded-full min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 flex items-center justify-center ${
                  canScrollLeft 
                    ? 'bg-gray-100 text-gray-700 hover:bg-gray-200' 
                    : 'bg-gray-50 text-gray-400 cursor-not-allowed'
                }`}
                aria-label="Scroll left"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                onClick={scrollRight}
                disabled={!canScrollRight}
                className={`p-2 rounded-full min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 flex items-center justify-center ${
                  canScrollRight 
                    ? 'bg-gray-100 text-gray-700 hover:bg-gray-200' 
                    : 'bg-gray-50 text-gray-400 cursor-not-allowed'
                }`}
                aria-label="Scroll right"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          )}
        </div>
      </div>
      
      {loading ? (
        <div className={compact ? 'text-center py-4' : 'text-center py-8'}>
          <div className={`border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto ${compact ? 'mb-2 h-6 w-6' : 'mb-4 h-8 w-8'}`}></div>
          <p className={compact ? 'text-xs text-gray-600' : 'text-gray-600'}>Loading your connections...</p>
        </div>
      ) : loadingEvents ? (
        <div className={compact ? 'text-center py-4' : 'text-center py-8'}>
          <div className={`border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto ${compact ? 'mb-2 h-6 w-6' : 'mb-4 h-8 w-8'}`}></div>
          <p className={compact ? 'text-xs text-gray-600' : 'text-gray-600'}>Loading your events...</p>
        </div>
      ) : connections.length === 0 ? (
        <div className={compact ? 'text-center py-4 bg-gray-50 rounded-lg px-2' : 'text-center py-8 bg-gray-50 rounded-2xl'}>
          <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h4 className="text-lg font-semibold text-gray-900 mb-2">No Connections Yet</h4>
          <p className="text-gray-600 mb-4">
            {selectedEventId === 'all'
              ? 'Connect with other members at events or through the Members directory.'
              : events.length > 0
                ? `No connections found for this event. Try selecting "All Events" to see all your connections.`
                : 'Start by registering for events and connecting with other members.'}
          </p>
          <div className="flex flex-col items-center space-y-2">
            <Link
              to="/members"
              className="inline-flex items-center space-x-2 text-brand-blue hover:text-brand-blue-hover font-medium"
            >
              <Users className="h-4 w-4" />
              <span>Browse members</span>
              <ChevronRight className="h-4 w-4" />
            </Link>
            <Link
              to="/events"
              className="inline-flex items-center space-x-2 text-brand-blue hover:text-brand-blue-hover font-medium"
            >
              <Calendar className="h-4 w-4" />
              <span>View upcoming events</span>
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      ) : (
        <div className="relative">
          {/* Gradient fade on left edge */}
          {canScrollLeft && (
            <div className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-white to-transparent z-10 pointer-events-none"></div>
          )}
          
          {/* Scrollable container */}
          <div 
            ref={scrollContainerRef}
            className={compact ? 'flex overflow-x-auto pb-2 space-x-2 scrollbar-hide' : 'flex overflow-x-auto pb-4 space-x-4 scrollbar-hide'}
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {connections.map((connection) => {
              const partner = getFinalPartnerData(connection);
              if (!partner) return null;
              
              // Handle event name display - show multiple events in "All Events" view
              let eventName = 'AlmaLinks Event';
              let eventCount = 1;
              
              if (selectedEventId === 'all' && connection.allEventIds && connection.allEventIds.length > 0) {
                // Show all events this user connected at
                const eventNames = connection.allEventIds.map(id => getEventName(id)).filter(Boolean);
                eventCount = eventNames.length;
                
                if (eventNames.length === 1) {
                  eventName = eventNames[0];
                } else if (eventNames.length === 2) {
                  eventName = eventNames.join(' & ');
                } else {
                  eventName = `${eventNames[0]} & ${eventNames.length - 1} more`;
                }
              } else if (connection.eventId) {
                eventName = getEventName(connection.eventId);
              }
              
              console.log('🎨 Rendering partner:', partner.name, 'Profile image:', partner.profileImage);
              
              return (
                <div
                  key={connection.id}
                  className={
                    compact
                      ? 'flex-shrink-0 w-[11.5rem] bg-white rounded-lg border border-gray-200 hover:shadow-sm transition-all duration-200 overflow-hidden flex flex-col'
                      : 'flex-shrink-0 w-64 bg-white rounded-xl border border-gray-200 hover:shadow-md transition-all duration-300 overflow-hidden flex flex-col'
                  }
                >
                  <div className={compact ? 'p-3 flex flex-col h-full' : 'p-5 flex flex-col h-full'}>
                    {/* Header Section - Avatar and Name */}
                    <div className={compact ? 'flex items-start space-x-2 mb-2' : 'flex items-start space-x-3 mb-4'}>
                      <div className={compact ? 'w-9 h-9 rounded-full overflow-hidden flex-shrink-0 bg-brand-dark' : 'w-12 h-12 rounded-full overflow-hidden flex-shrink-0 bg-brand-dark'}>
                        <ImageWithCrop
                          src={String(partner.profileImage || '')}
                          crop={null}
                          shape="circle"
                          alt=""
                          className="rounded-full w-full h-full"
                          urlIsCropped={true}
                          fallback={
                            <ProfileAvatarPlaceholder
                              name={partner.name}
                              textClassName={compact ? 'font-semibold text-sm' : 'font-semibold text-lg'}
                            />
                          }
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className={compact ? 'text-sm font-semibold text-gray-900 line-clamp-1 mb-0.5' : 'font-semibold text-gray-900 line-clamp-1 mb-1'}>{partner.name}</h4>
                        <p className={compact ? 'text-xs text-gray-600 line-clamp-2 leading-snug' : 'text-sm text-gray-600 line-clamp-2 leading-snug'}>{partner.work}</p>
                      </div>
                    </div>

                    {/* Position Section */}
                    {partner.position && (
                      <div className="flex items-center text-xs text-gray-600 mb-3">
                        <Briefcase className="h-3.5 w-3.5 mr-1.5 text-gray-500 flex-shrink-0" />
                        <span className="line-clamp-1">{ConnectionService.formatPosition(partner.position)}</span>
                      </div>
                    )}

                    {/* Connection Reason Badges and Event Count */}
                    <div className="mb-3">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex-1 min-w-0">
                          {(() => {
                            const reasons = getConnectionReasons(connection);

                            return (
                              <div className="flex flex-wrap gap-1.5">
                                {reasons.map((reason, index) => {
                                  const isAdminReason = reason.includes('Connected by Admin');
                                  const isEventReason =
                                    /connected at event check-in|connected by event/i.test(reason);
                                  const isUserReason = reason.includes('Connected by Request');

                                  let badge;
                                  if (isEventReason) {
                                    badge = {
                                      icon: Zap,
                                      bgColor: 'bg-green-100',
                                      textColor: 'text-green-800',
                                      iconColor: 'text-green-600'
                                    };
                                  } else if (isAdminReason) {
                                    badge = {
                                      icon: Shield,
                                      bgColor: 'bg-purple-100',
                                      textColor: 'text-purple-800',
                                      iconColor: 'text-brand-dark'
                                    };
                                  } else {
                                    badge = {
                                      icon: UserPlus,
                                      bgColor: 'bg-blue-50',
                                      textColor: 'text-blue-800',
                                      iconColor: 'text-brand-blue'
                                    };
                                  }

                                  const IconComponent = badge.icon;
                                  const displayText = isAdminReason && reason.includes(':')
                                    ? reason.split(': ')[0] // Show just "Connected by Admin" in badge
                                    : reason;
                                  const adminNote = isAdminReason && reason.includes(':')
                                    ? reason.split(': ')[1] // Extract the admin note
                                    : null;

                                  return (
                                    <div key={index} className="flex flex-col">
                                      <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${badge.bgColor} ${badge.textColor}`}>
                                        <IconComponent className={`h-3 w-3 mr-1 flex-shrink-0 ${badge.iconColor}`} />
                                        <span className="truncate">{displayText}</span>
                                      </div>
                                      {adminNote && (
                                        <div className="mt-1 text-xs text-gray-600 italic line-clamp-2">
                                          {adminNote.replace(/['"]/g, '')}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          })()}
                        </div>
                        {selectedEventId === 'all' && eventCount > 1 && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 whitespace-nowrap flex-shrink-0">
                            {eventCount} events
                          </span>
                        )}
                      </div>

                      {/* Event Name */}
                      <div className="flex items-center text-xs text-gray-600">
                        <Calendar className="h-3.5 w-3.5 mr-1.5 text-gray-500 flex-shrink-0" />
                        <span className="line-clamp-1">{eventName}</span>
                      </div>
                    </div>

                    {/* Spacer to push footer to bottom */}
                    <div className="flex-grow"></div>

                    {/* Footer Section - Contact and Actions */}
                    <div className="pt-3 border-t border-gray-100 space-y-2 mt-auto">
                      {partner.linkedin && linkedInProfileHref(partner.linkedin) && (
                        <a
                          href={linkedInProfileHref(partner.linkedin)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center text-xs text-brand-blue hover:text-brand-blue-hover transition-colors"
                        >
                          <Linkedin className="h-3.5 w-3.5 mr-1.5 flex-shrink-0" />
                          <span className="line-clamp-1">LinkedIn Profile</span>
                        </a>
                      )}

                      {partner.email && (
                        <a
                          href={`mailto:${partner.email}`}
                          className="flex items-center text-xs text-gray-600 hover:text-gray-800 transition-colors"
                        >
                          <Mail className="h-3.5 w-3.5 mr-1.5 text-gray-500 flex-shrink-0" />
                          <span className="line-clamp-1">{partner.email}</span>
                        </a>
                      )}

                      {/* View Profile Button */}
                      <Link
                        to={`/profile/${partner.uid}`}
                        className="flex items-center justify-center text-xs font-medium text-white bg-brand-dark hover:bg-brand-dark-hover py-2.5 px-3 rounded-lg transition-colors duration-200 mt-3"
                      >
                        <Eye className="h-3.5 w-3.5 mr-1.5" />
                        View Profile
                      </Link>

                      <div className="text-xs text-gray-500 text-center pt-2">
                        Connected on {ConnectionService.formatTimestamp(connection.timestamp)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          
          {/* Gradient fade on right edge */}
          {canScrollRight && (
            <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-white to-transparent z-10 pointer-events-none"></div>
          )}
        </div>
      )}
    </div>
  );
};

export default ConnectionsCard;