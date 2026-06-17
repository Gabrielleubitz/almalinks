import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, User, Check, X, Clock, UserPlus } from 'lucide-react';
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
import ProfileAvatarPlaceholder from '../components/profile/ProfileAvatarPlaceholder';
import { TrusteeMentorStar } from '../components/common/TrusteeMentorStar';
import { compareMembersByDisplayName } from '../utils/memberSort';
import {
  CHAPTER_FILTER_ALL,
  DIRECTORY_CHAPTER_FILTER_ORDER,
  memberChapterMatchesFilter,
  formatChapterDisplayLabel,
  chapterFilterFromQueryParam,
  chapterFilterLabel,
  chapterQueryParamForFilter,
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
  const [searchParams, setSearchParams] = useSearchParams();
  const [members, setMembers] = useState<MemberCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const chapterFilter: ChapterFilterValue = useMemo(
    () => chapterFilterFromQueryParam(searchParams.get('chapter')) ?? CHAPTER_FILTER_ALL,
    [searchParams]
  );

  const applyChapterFilter = useCallback(
    (id: ChapterFilterValue) => {
      const next = new URLSearchParams(searchParams);
      const q = chapterQueryParamForFilter(id);
      if (q) next.set('chapter', q);
      else next.delete('chapter');
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  const [sentRequestIds, setSentRequestIds] = useState<Set<string>>(new Set()); // Track which users we've sent requests to
  const [incomingRequests, setIncomingRequests] = useState<ConnectionRequest[]>([]);
  const [respondingRequestId, setRespondingRequestId] = useState<string | null>(null);
  const [showConnectionRequestsPanel, setShowConnectionRequestsPanel] = useState(false);

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

  const requesterDisplayName = useCallback((req: ConnectionRequest) => {
    const r = req.requester;
    if (r?.displayName?.trim()) return r.displayName.trim();
    if (r?.name?.trim()) return r.name.trim();
    if (req.fromName?.trim()) return req.fromName.trim();
    return 'Member';
  }, []);

  const requesterImage = (req: ConnectionRequest) =>
    req.requester?.profileImage || req.fromProfileImage || '';

  const requesterUid = (req: ConnectionRequest) => req.requesterId || req.fromUid;

  useEffect(() => {
    if (!showConnectionRequestsPanel) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowConnectionRequestsPanel(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showConnectionRequestsPanel]);

  const renderMemberCard = (member: MemberCard) => {
    const displayName = member.displayName ||
                       `${member.firstName || ''} ${member.lastName || ''}`.trim() ||
                       'Member';

    const isSelf = member.uid === currentUser?.uid;
    const incomingReq = incomingRequests.find(r => (r.requesterId || r.fromUid) === member.uid);
    const hasIncomingRequest = !!incomingReq;
    const hasPendingRequest = member.connectionPending || sentRequestIds.has(member.uid);
    const chapterLabel = formatChapterDisplayLabel(member.chapter ?? null);

    const cardOutlineClass = hasIncomingRequest ? 'ring-2 ring-blue-500 border-blue-500' : '';
    const statusLabel = isSelf
      ? 'Your profile'
      : hasIncomingRequest
        ? 'Wants to connect'
        : member.isConnected
          ? 'Connected'
          : hasPendingRequest
            ? 'Request pending'
            : null;

    const avatarFallback = (
      <ProfileAvatarPlaceholder name={displayName} textClassName="font-semibold text-sm" />
    );

    return (
      <Link
        key={member.uid}
        to={`/profile/${member.uid}`}
        className={`bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden block p-2.5 text-left hover:border-brand-blue/40 hover:shadow transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue ${cardOutlineClass}`}
      >
        <div className="flex gap-2">
          <div className="w-10 h-10 rounded-full overflow-hidden border border-gray-100 flex-shrink-0 relative bg-brand-dark">
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
          <div className="min-w-0 flex-1 space-y-0.5">
            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
              <span className="font-semibold text-gray-900 text-xs leading-snug line-clamp-2">{displayName}</span>
              <TrusteeMentorStar compact isTrustee={member.isTrustee} isMentor={member.isMentor} />
            </div>
            {member.bioTitle ? (
              <p className="text-[11px] text-brand-dark font-medium line-clamp-1 leading-snug">{member.bioTitle}</p>
            ) : null}
            {chapterLabel ? (
              <p className="text-[11px] text-gray-500 line-clamp-1">{chapterLabel}</p>
            ) : null}
            {statusLabel ? (
              <p className="text-[10px] font-medium text-gray-500 pt-0.5">{statusLabel}</p>
            ) : null}
          </div>
        </div>
      </Link>
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
      
      <section className="pt-[var(--content-offset-top)] sm:pt-20 pb-4 border-b border-gray-100 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Members</h1>
            <p className="text-xs text-gray-500 mt-0.5 mb-3">
              Browse members by global chapter, or search across the directory.
            </p>

            <form role="search" className="w-full max-w-xl" onSubmit={(e) => e.preventDefault()}>
              <label htmlFor="members-search" className="block text-xs font-medium text-gray-700 mb-1">
                Search members
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" aria-hidden />
                <input
                  id="members-search"
                  type="search"
                  placeholder="Name, company, title, city, chapter…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-3 py-3 text-sm border border-gray-300 rounded-lg bg-white shadow-sm ring-1 ring-gray-200/80 placeholder:text-gray-400 focus:ring-2 focus:ring-brand-blue focus:border-brand-blue"
                  aria-describedby="members-search-hint"
                  autoComplete="off"
                />
              </div>
              <p id="members-search-hint" className="mt-1.5 text-[11px] text-gray-500 leading-snug">
                Free-text search: your words must appear in the profile (name, title, bio, city, country, or chapter). Case-insensitive; not spell-check or fuzzy match.
              </p>
            </form>

            <div className="mt-4">
              <p className="text-xs font-semibold text-gray-700 mb-2">Chapters</p>
              <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => applyChapterFilter(CHAPTER_FILTER_ALL)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                  chapterFilter === CHAPTER_FILTER_ALL
                    ? 'bg-brand-dark text-white border-brand-dark'
                    : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
                }`}
              >
                All
              </button>
              {DIRECTORY_CHAPTER_FILTER_ORDER.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => applyChapterFilter(id)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
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

            {currentUser?.uid ? (
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowConnectionRequestsPanel(true);
                    void loadIncomingRequests();
                  }}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-white text-xs font-semibold text-gray-900 shadow-sm hover:border-brand-blue hover:bg-blue-50/40 transition-colors"
                >
                  <UserPlus className="h-4 w-4 text-brand-dark shrink-0" aria-hidden />
                  <span>Connection requests</span>
                  {incomingRequests.length > 0 ? (
                    <span className="min-w-[1.35rem] rounded-full bg-brand-dark px-1.5 py-0.5 text-xs font-bold leading-none text-white tabular-nums">
                      {incomingRequests.length}
                    </span>
                  ) : null}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {/* Members Grid */}
      <section className="py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {(searchQuery.trim() || chapterFilter !== CHAPTER_FILTER_ALL) ? (
            <div className="mb-4 text-xs text-gray-600">
              {filteredMembers.length} member{filteredMembers.length === 1 ? '' : 's'}
              {chapterFilter !== CHAPTER_FILTER_ALL ? (
                <> · Chapter: {chapterFilterLabel(chapterFilter)}</>
              ) : null}
              {searchQuery.trim() ? <> · Search: &quot;{searchQuery}&quot;</> : null}
            </div>
          ) : null}

          {filteredMembers.length > 0 ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 gap-1.5 sm:gap-2">
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
                    applyChapterFilter(CHAPTER_FILTER_ALL);
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

      {showConnectionRequestsPanel && currentUser?.uid ? (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="members-conn-req-title"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Close connection requests"
            onClick={() => setShowConnectionRequestsPanel(false)}
          />
          <div className="relative z-10 flex max-h-[min(90dvh,32rem)] w-full flex-col rounded-t-2xl border border-gray-200 bg-white shadow-xl sm:max-h-[min(85dvh,28rem)] sm:max-w-lg sm:rounded-2xl">
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-100 px-4 py-3">
              <h2 id="members-conn-req-title" className="text-lg font-bold text-gray-900">
                Connection requests
              </h2>
              <button
                type="button"
                onClick={() => setShowConnectionRequestsPanel(false)}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
              {incomingRequests.length === 0 ? (
                <p className="py-10 text-center text-sm text-gray-600">
                  No pending connection requests right now.
                </p>
              ) : (
                <ul className="space-y-3">
                  {incomingRequests.map((req) => {
                    const uid = requesterUid(req);
                    const name = requesterDisplayName(req);
                    const img = requesterImage(req);
                    const note = (req.message || req.note || '').trim();
                    const busy = respondingRequestId === req.id;
                    return (
                      <li
                        key={req.id}
                        className="rounded-xl border border-gray-100 bg-gray-50/80 p-3"
                      >
                        <div className="flex gap-3">
                          <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full border border-gray-100 bg-brand-dark">
                            {img ? (
                              <img src={img} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <ProfileAvatarPlaceholder name={name} textClassName="text-sm font-semibold" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-gray-900 leading-snug">{name}</p>
                            {(req.fromWork || req.requester?.work) ? (
                              <p className="mt-0.5 text-xs text-gray-600 line-clamp-2">
                                {req.requester?.work || req.fromWork}
                              </p>
                            ) : null}
                            {note ? (
                              <p className="mt-2 text-xs text-gray-700 line-clamp-4 whitespace-pre-wrap">
                                {note}
                              </p>
                            ) : null}
                            <Link
                              to={`/profile/${uid}`}
                              className="mt-2 inline-block text-xs font-medium text-brand-blue hover:text-brand-blue-hover"
                              onClick={() => setShowConnectionRequestsPanel(false)}
                            >
                              View profile
                            </Link>
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => handleRespondToRequest(req.id, 'accepted')}
                            className="inline-flex items-center gap-1 rounded-lg bg-brand-dark px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-brand-dark-hover disabled:opacity-50"
                          >
                            {busy ? '…' : (
                              <>
                                <Check className="h-3.5 w-3.5" />
                                Accept
                              </>
                            )}
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => handleRespondToRequest(req.id, 'rejected')}
                            className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
                          >
                            {busy ? (
                              '…'
                            ) : (
                              <>
                                <X className="h-3.5 w-3.5" />
                                Reject
                              </>
                            )}
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      ) : null}

      <Footer />
    </div>
  );
};

export default MembersPage;