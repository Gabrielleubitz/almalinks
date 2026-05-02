import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Search, MapPin, User, Check, X, Clock } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { UserService } from '../services/userService';
import { ConnectionService } from '../services/connectionService';
import { ConnectionRequestService } from '../services/connectionRequestService';
import { ConnectionRequest } from '../types/connection';
import { UserCard as UserCardType } from '../types/user';
import Header from '../components/Header';
import Footer from '../components/Footer';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ImageWithCrop from '../components/profile/ImageWithCrop';
import { TrusteeMentorStar } from '../components/common/TrusteeMentorStar';
import { compareMembersByDisplayName } from '../utils/memberSort';
import {
  CHAPTER_FILTER_ALL,
  DIRECTORY_CHAPTER_FILTER_ORDER,
  memberChapterMatchesFilter,
  formatChapterDisplayLabel,
  type ChapterFilterValue,
} from '../utils/memberDirectoryChapters';

interface MemberCard extends UserCardType {
  firstName?: string;
  lastName?: string;
  bioTitle?: string;
  bio?: string;
  isConnected?: boolean;
  connectionPending?: boolean;
}

const MembersPage: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [members, setMembers] = useState<MemberCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [chapterFilter, setChapterFilter] = useState<ChapterFilterValue>(CHAPTER_FILTER_ALL);

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

      membersWithConnections.sort(compareMembersByDisplayName);
      setMembers(membersWithConnections);
    } catch (error) {
      console.error('❌ CRITICAL: Error loading members:', error);
      // Set empty array on error so page still renders
      setMembers([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredMembers = useMemo(() => {
    let list = members.filter(m =>
      chapterFilter === CHAPTER_FILTER_ALL
        ? true
        : memberChapterMatchesFilter(m.chapter ?? null, chapterFilter)
    );

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      list = list.filter(member => {
        const fullName = `${member.firstName || ''} ${member.lastName || ''}`.toLowerCase();
        const displayName = (member.displayName || '').toLowerCase();
        const work = (member.company || '').toLowerCase();
        const title = (member.title || '').toLowerCase();
        const bioTitle = (member.bioTitle || '').toLowerCase();
        const bio = (member.bio || '').toLowerCase();
        const city = (member.city || '').toLowerCase();
        const country = (member.country || '').toLowerCase();
        const chapter = formatChapterDisplayLabel(member.chapter).toLowerCase();

        return (
          fullName.includes(query) ||
          displayName.includes(query) ||
          work.includes(query) ||
          title.includes(query) ||
          bioTitle.includes(query) ||
          bio.includes(query) ||
          city.includes(query) ||
          country.includes(query) ||
          chapter.includes(query)
        );
      });
    }

    return [...list].sort(compareMembersByDisplayName);
  }, [members, chapterFilter, searchQuery]);

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

  const renderMemberCard = (member: MemberCard) => {
    const displayName = member.displayName ||
                       `${member.firstName || ''} ${member.lastName || ''}`.trim() ||
                       'Member';

    const isSelf = member.uid === currentUser?.uid;
    const incomingReq = incomingRequests.find(r => (r.requesterId || r.fromUid) === member.uid);
    const hasIncomingRequest = !!incomingReq;
    const isRespondingToRequest = hasIncomingRequest && respondingRequestId === incomingReq!.id;

    const hasPendingRequest = member.connectionPending || sentRequestIds.has(member.uid);
    const chapterLabel = formatChapterDisplayLabel(member.chapter ?? null);

    const showCardFooter =
      hasIncomingRequest ||
      isSelf ||
      (member.isConnected && !isSelf) ||
      (hasPendingRequest && !member.isConnected && !isSelf);

    const cardOutlineClass = hasIncomingRequest ? 'ring-2 ring-blue-500 border-blue-500' : '';

    const avatarFallback = (
      <div className="w-full h-full bg-brand-dark flex items-center justify-center text-white/90 font-semibold text-sm">
        {displayName.charAt(0).toUpperCase()}
      </div>
    );

    return (
      <div
        key={member.uid}
        className={`bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col min-h-[140px] hover:border-brand-blue/30 hover:shadow transition-all ${cardOutlineClass}`}
      >
        <Link
          to={`/profile/${member.uid}`}
          className="block p-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:ring-inset"
        >
          <div className="flex gap-3">
            <div className="w-14 h-14 rounded-full overflow-hidden border border-gray-100 flex-shrink-0 relative bg-gray-50">
              <ImageWithCrop
                src={String(member.avatarUrl || '')}
                crop={member.profileImageCrop ?? null}
                shape="circle"
                alt=""
                className="rounded-full"
                urlIsCropped={true}
                fallback={avatarFallback}
              />
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                <span className="font-semibold text-gray-900 text-sm leading-snug line-clamp-2">{displayName}</span>
                <TrusteeMentorStar compact isTrustee={member.isTrustee} isMentor={member.isMentor} />
              </div>
              {member.bioTitle ? (
                <p className="text-xs text-brand-dark font-medium line-clamp-2 leading-snug">{member.bioTitle}</p>
              ) : null}
              {chapterLabel ? (
                <p className="text-xs text-gray-500">
                  <span className="text-gray-400">Chapter</span> · {chapterLabel}
                </p>
              ) : null}
              {(member.city || member.country) ? (
                <p className="text-xs text-gray-500 flex items-start gap-1">
                  <MapPin className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-gray-400" aria-hidden />
                  <span className="line-clamp-2">{[member.city, member.country].filter(Boolean).join(', ')}</span>
                </p>
              ) : null}
            </div>
          </div>
        </Link>

        {showCardFooter ? (
        <div className="mt-auto px-3 pb-3 pt-0 space-y-2 border-t border-gray-50 bg-gray-50/60">
          {hasIncomingRequest && incomingReq && (
            <div className="flex flex-wrap items-center gap-2 pt-2">
              <button
                type="button"
                disabled={isRespondingToRequest}
                onClick={() => handleRespondToRequest(incomingReq.id, 'accepted')}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-white bg-brand-dark hover:bg-brand-dark-hover rounded-lg transition-colors disabled:opacity-50"
              >
                {isRespondingToRequest ? '…' : <><Check className="h-3.5 w-3.5" /> Accept</>}
              </button>
              <button
                type="button"
                disabled={isRespondingToRequest}
                onClick={() => handleRespondToRequest(incomingReq.id, 'rejected')}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
              >
                {!isRespondingToRequest && <><X className="h-3.5 w-3.5" /> Reject</>}
              </button>
            </div>
          )}

          {!hasIncomingRequest && hasPendingRequest && !member.isConnected && !isSelf && (
            <div className="flex items-center gap-1.5 text-xs font-medium text-amber-800 bg-amber-50 rounded-md px-2 py-1.5 mt-2">
              <Clock className="h-3.5 w-3.5 flex-shrink-0" />
              Request pending
            </div>
          )}

          {!hasIncomingRequest && member.isConnected && !isSelf && (
            <div className="flex items-center gap-1.5 text-xs font-medium text-green-800 bg-green-50 rounded-md px-2 py-1.5 mt-2">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full flex-shrink-0" />
              Connected
            </div>
          )}

          {isSelf && (
            <div className="flex items-center gap-1.5 text-xs font-medium text-brand-dark bg-brand-light/80 rounded-md px-2 py-1.5 mt-2">
              <User className="h-3.5 w-3.5 flex-shrink-0" />
              Your profile
            </div>
          )}
        </div>
        ) : null}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white overflow-x-hidden w-full max-w-full">
        <Header />
        <div className="pt-[var(--content-offset-top)] pb-16 flex items-center justify-center">
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white overflow-x-hidden w-full max-w-full">
      <Header />
      
      {/* Hero Section - content below fixed header + safe area */}
      <section className="pt-[var(--content-offset-top)] sm:pt-24 pb-8 bg-gradient-to-br from-blue-50/80 to-indigo-50/60">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
              Members
            </h1>
            <p className="text-sm sm:text-base text-gray-600 mb-6">
              Browse by chapter or search the directory. Photos sync from HubSpot when available; otherwise upload yours in your profile.
            </p>

            <div className="w-full max-w-xl mx-auto space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                <input
                  type="search"
                  placeholder="Name, title, bio, city, chapter…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-3 py-2.5 text-sm border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-blue focus:border-brand-blue bg-white shadow-sm"
                  aria-describedby="members-search-hint"
                />
              </div>
              <p id="members-search-hint" className="text-left text-xs text-gray-500 px-0.5">
                Free text: matches if your words appear anywhere in those fields (case-insensitive), not fuzzy spelling.
              </p>
            </div>

            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <button
                type="button"
                onClick={() => setChapterFilter(CHAPTER_FILTER_ALL)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  chapterFilter === CHAPTER_FILTER_ALL
                    ? 'bg-brand-dark text-white border-brand-dark'
                    : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
                }`}
              >
                All chapters
              </button>
              {DIRECTORY_CHAPTER_FILTER_ORDER.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setChapterFilter(id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    chapterFilter === id
                      ? 'bg-brand-dark text-white border-brand-dark'
                      : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Members Grid */}
      <section className="py-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          {(searchQuery.trim() || chapterFilter !== CHAPTER_FILTER_ALL) ? (
            <div className="mb-6 text-sm text-gray-600">
              {filteredMembers.length} member{filteredMembers.length === 1 ? '' : 's'}
              {chapterFilter !== CHAPTER_FILTER_ALL ? (
                <> · Chapter: {DIRECTORY_CHAPTER_FILTER_ORDER.find((c) => c.id === chapterFilter)?.label ?? chapterFilter}</>
              ) : null}
              {searchQuery.trim() ? <> · Search: &quot;{searchQuery}&quot;</> : null}
            </div>
          ) : null}

          {filteredMembers.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
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
              {(searchQuery || chapterFilter !== CHAPTER_FILTER_ALL) && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setChapterFilter(CHAPTER_FILTER_ALL);
                  }}
                  className="bg-brand-dark text-white px-5 py-2.5 rounded-xl text-sm hover:bg-brand-dark-hover transition-colors"
                >
                  Clear filters
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