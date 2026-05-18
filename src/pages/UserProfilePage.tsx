import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { User, ChevronLeft, Edit3, X } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { UserService } from '../services/userService';
import { ConnectionService } from '../services/connectionService';
import { ConnectionRequestService } from '../services/connectionRequestService';
import {
  getDailyRequestCount,
  isOverDailyLimit,
  DAILY_LIMIT_MESSAGE,
} from '../services/connectionRequestLimitService';
import { UserProfile } from '../types/user';
import { FilteredProfile } from '../utils/privacy';
import Header from '../components/Header';
import Footer from '../components/Footer';
import LoadingSpinner from '../components/common/LoadingSpinner';
import MemberPublicProfileCard from '../components/profile/MemberPublicProfileCard';
import { isSafeImageUrl } from '../utils/imageUrl';
import { linkedInProfileHref } from '../utils/linkedInUrl';
import { getTrusteeMentorFromHubspot } from '../utils/hubspotMemberRoles';
import { formatChapterDisplayLabel } from '../utils/memberDirectoryChapters';
import {
  resolveDirectoryAvatarUrl,
  resolveProfileBioTitleLine,
} from '../utils/memberHubspotDisplay';

interface Connection {
  id: string;
  reasons?: string[];
  createdAt?: any;
  updatedAt?: any;
}

const UserProfilePage: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const [profile, setProfile] = useState<FilteredProfile | null>(null);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [outgoingPending, setOutgoingPending] = useState(false);
  const [dailyRequestCount, setDailyRequestCount] = useState<number | null>(null);

  const refreshConnectionUi = useCallback(async () => {
    if (!userId || !currentUser?.uid || userId === currentUser.uid) return;
    try {
      const [sent, daily] = await Promise.all([
        ConnectionRequestService.getSentRequests(currentUser.uid),
        getDailyRequestCount(currentUser.uid),
      ]);
      setDailyRequestCount(daily);
      const pendingToThis = sent.some(
        (r) =>
          r.status === 'pending' &&
          (r.targetId === userId || r.toUid === userId)
      );
      setOutgoingPending(pendingToThis);
    } catch {
      setOutgoingPending(false);
    }
  }, [userId, currentUser?.uid]);

  useEffect(() => {
    if (userId) {
      loadUserProfile();
      if (currentUser?.uid) {
        loadMutualConnections();
      }
    }
  }, [userId, currentUser?.uid]);

  useEffect(() => {
    if (!userId || !currentUser?.uid) return;
    refreshConnectionUi();
  }, [userId, currentUser?.uid, refreshConnectionUi]);

  const loadUserProfile = async () => {
    if (!userId) return;

    try {
      // Pass null if user is not logged in, the service can handle anonymous viewing with privacy filtering
      const userProfile = await UserService.getUser(userId, currentUser?.uid || null, currentUser?.role);
      if (userProfile) {
        setProfile(userProfile);
      } else {
        setError('User not found');
      }
    } catch (err) {
      console.error('❌ Error loading user profile:', err);
      setError('Failed to load user profile');
    } finally {
      setLoading(false);
    }
  };

  const loadMutualConnections = async () => {
    if (!userId || !currentUser?.uid) return;

    try {
      // Check if there's a connection between current user and viewed user
      const connection = await ConnectionService.checkExistingConnection(
        currentUser.uid, 
        userId
      );
      
      if (connection) {
        setConnections([connection]);
      } else {
        setConnections([]);
      }
      await refreshConnectionUi();
    } catch (err) {
      console.error('❌ Error loading connections:', err);
    }
  };

  const handleConnect = async () => {
    if (!userId || !currentUser?.uid || connecting) return;
    if (userId === currentUser.uid) return;

    try {
      setConnecting(true);

      if (currentUser.role === 'admin') {
        const { AdminConnectionService } = await import('../services/adminConnectionService');
        await AdminConnectionService.createAdminConnection(
          currentUser.uid,
          userId,
          currentUser.uid,
          { reason: 'Admin connection from profile' }
        );
        await loadMutualConnections();
      } else {
        await ConnectionRequestService.sendConnectionRequest(currentUser.uid, userId, {});
        setOutgoingPending(true);
        await refreshConnectionUi();
        getDailyRequestCount(currentUser.uid).then(setDailyRequestCount);
      }
    } catch (error: any) {
      const msg = error?.message ?? '';
      const isAlreadySent =
        msg.includes('already sent') ||
        msg.includes('not yet responded') ||
        msg.includes('Connection request already');
      if (isAlreadySent) {
        setOutgoingPending(true);
        return;
      }
      alert(msg || 'Could not send connection request. Please try again.');
    } finally {
      setConnecting(false);
    }
  };

  const closeAvatarModal = useCallback(() => setShowAvatarModal(false), []);
  useEffect(() => {
    if (!showAvatarModal) return;
    const onEscape = (e: KeyboardEvent) => { if (e.key === 'Escape') closeAvatarModal(); };
    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, [showAvatarModal, closeAvatarModal]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white overflow-x-hidden w-full max-w-full">
        <Header />
        <div className="pt-[var(--content-offset-top)] pb-16 flex items-center justify-center">
          <div className="text-center">
            <LoadingSpinner size="lg" color="border-purple-600" />
            <p className="text-gray-600 mt-4">Loading profile...</p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white overflow-x-hidden w-full max-w-full">
        <Header />
        <div className="pt-[var(--content-offset-top)] pb-16">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="text-center">
              <User className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Profile Not Found</h2>
              <p className="text-gray-600 mb-8">{error || 'The user profile you\'re looking for doesn\'t exist.'}</p>
              <button
                onClick={() => navigate(-1)}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-brand-dark hover:bg-brand-mid"
              >
                <ChevronLeft className="h-4 w-4 mr-2" />
                Back
              </button>
            </div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  const displayName =
    profile.displayName ||
    (profile as any).name ||
    `${profile.firstName || ''} ${profile.lastName || ''}`.trim() ||
    'Member';

  const userTitle = profile.title || (profile as any).work || '';
  const userCompany = profile.company || '';
  const userLinkedin = profile.linkedin || (profile as any).linkedinUsername || '';
  const fullProfile = profile as UserProfile;
  const bioTitleLine = resolveProfileBioTitleLine(fullProfile);
  const profileImageUrl =
    resolveDirectoryAvatarUrl(fullProfile) ||
    profile.profileImage ||
    profile.avatarUrl ||
    '';
  const canOpenAvatarLightbox = isSafeImageUrl(profileImageUrl || null);
  const { isTrustee, isMentor } = getTrusteeMentorFromHubspot(fullProfile);
  const chapterLabel = formatChapterDisplayLabel(profile.chapter ?? null);
  const storedChapter = (profile.chapter ?? '').trim() || null;

  const isOwner = currentUser?.uid === userId;
  const showConnect =
    !!currentUser?.uid &&
    !isOwner &&
    userId &&
    connections.length === 0 &&
    profile.canConnect !== false;
  const atDailyLimit = dailyRequestCount !== null && isOverDailyLimit(dailyRequestCount);
  const connectDisabled =
    connecting || outgoingPending || atDailyLimit || !showConnect;

  let connectLabel = 'Connect';
  if (connecting) connectLabel = 'Sending…';
  else if (outgoingPending) connectLabel = 'Request sent';
  else if (connections.length > 0) connectLabel = 'Connected';
  else if (atDailyLimit) connectLabel = 'Daily limit';

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white overflow-x-hidden w-full max-w-full">
      <Header />

      {showAvatarModal && profileImageUrl && canOpenAvatarLightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={closeAvatarModal}
          role="dialog"
          aria-modal="true"
          aria-label="Profile picture"
        >
          <button
            type="button"
            onClick={closeAvatarModal}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
            aria-label="Close"
          >
            <X className="h-6 w-6" />
          </button>
          <img
            src={profileImageUrl}
            alt={displayName}
            className="max-w-full max-h-[90vh] w-auto h-auto object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      <div className="pt-[var(--content-offset-top)] pb-6">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="inline-flex items-center text-brand-dark hover:text-brand-blue font-medium text-sm"
            >
              <ChevronLeft className="h-5 w-5 mr-0.5" />
              Back
            </button>
            {(isOwner || currentUser?.role === 'admin') && (
              <div className="flex flex-wrap gap-2">
                {isOwner && (
                  <button
                    type="button"
                    onClick={() => navigate('/dashboard')}
                    className="inline-flex items-center px-3 py-1.5 bg-brand-dark text-white rounded-lg hover:bg-brand-mid text-sm font-medium"
                  >
                    <Edit3 className="h-4 w-4 mr-1.5" />
                    Edit profile
                  </button>
                )}
                {currentUser?.role === 'admin' && !isOwner && userId && (
                  <button
                    type="button"
                    onClick={() => navigate(`/admin/users/${userId}/edit`)}
                    className="inline-flex items-center px-3 py-1.5 bg-brand-dark text-white rounded-lg hover:bg-brand-mid text-sm font-medium"
                  >
                    <Edit3 className="h-4 w-4 mr-1.5" />
                    Admin edit
                  </button>
                )}
              </div>
            )}
          </div>

          <MemberPublicProfileCard
            profile={profile}
            displayName={displayName}
            profileImageUrl={profileImageUrl}
            bioTitleLine={bioTitleLine}
            userTitle={userTitle}
            userCompany={userCompany}
            userLinkedin={userLinkedin}
            chapterLabel={chapterLabel}
            storedChapter={storedChapter}
            isTrustee={isTrustee}
            isMentor={isMentor}
            showConnect={showConnect}
            connectDisabled={connectDisabled}
            connectLabel={connectLabel}
            atDailyLimit={atDailyLimit}
            outgoingPending={outgoingPending}
            connections={connections}
            onConnect={() => void handleConnect()}
            onOpenAvatar={() => setShowAvatarModal(true)}
            canOpenAvatarLightbox={canOpenAvatarLightbox}
          />
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default UserProfilePage;