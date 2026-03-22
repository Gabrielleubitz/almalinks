import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, User, Briefcase, MapPin, Calendar, Linkedin, Mail, Users, Shield, Clock, ChevronLeft,
  Phone, Globe, Twitter, MessageCircle, UserPlus, Share, MoreHorizontal, Edit3, Copy, X
} from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db, retryOnNetworkFailure } from '../firebase/config';
import { useAuth } from '../hooks/useAuth';
import { UserService } from '../services/userService';
import { ConnectionService } from '../services/connectionService';
import { UserProfile } from '../types/user';
import { FilteredProfile } from '../utils/privacy';
import { getVisibilityDescription } from '../utils/privacy';
import Header from '../components/Header';
import Footer from '../components/Footer';
import LoadingSpinner from '../components/common/LoadingSpinner';
import Favicon from '../components/ui/Favicon';
import ImageWithCrop from '../components/profile/ImageWithCrop';
import BioHtml from '../components/profile/BioHtml';
import { isSafeImageUrl } from '../utils/imageUrl';

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

  useEffect(() => {
    if (userId) {
      loadUserProfile();
      if (currentUser?.uid) {
        loadMutualConnections();
      }
    }
  }, [userId, currentUser?.uid]);

  const loadUserProfile = async () => {
    if (!userId) return;

    try {
      // Pass null if user is not logged in, the service can handle anonymous viewing with privacy filtering
      const userProfile = await UserService.getUser(userId, currentUser?.uid || null, currentUser?.role);
      if (userProfile) {
        console.log('👤 Profile data received:', userProfile);
        console.log('👤 Name fields:', { 
          displayName: userProfile.displayName,
          name: (userProfile as any).name,
          firstName: userProfile.firstName,
          lastName: userProfile.lastName
        });
        console.log('👤 Work fields:', { 
          title: userProfile.title,
          work: (userProfile as any).work,
          company: userProfile.company,
          position: (userProfile as any).position
        });
        console.log('👤 Social links:', { 
          linkedin: userProfile.linkedin, 
          linkedinUsername: (userProfile as any).linkedinUsername,
          website: userProfile.website, 
          twitter: userProfile.twitter 
        });
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
      }
    } catch (err) {
      console.error('❌ Error loading connections:', err);
    }
  };

  // Generate avatar color based on name
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

  const formatPosition = (position: string | undefined): string => {
    if (!position) return '';
    
    const positionMap: Record<string, string> = {
      'investor': 'Investor',
      'c_level': 'C-Level Executive',
      'vp_level': 'VP Level',
      'director': 'Director',
      'senior_manager': 'Senior Manager',
      'manager': 'Manager',
      'senior_contributor': 'Senior Contributor',
      'individual_contributor': 'Individual Contributor',
      'junior_level': 'Junior Level',
      'founder': 'Founder',
      'consultant': 'Consultant',
      'student': 'Student',
      'other': 'Other'
    };
    
    return positionMap[position] || position;
  };

  const closeAvatarModal = useCallback(() => setShowAvatarModal(false), []);
  useEffect(() => {
    if (!showAvatarModal) return;
    const onEscape = (e: KeyboardEvent) => { if (e.key === 'Escape') closeAvatarModal(); };
    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, [showAvatarModal, closeAvatarModal]);

  const formatDate = (timestamp: any): string => {
    if (!timestamp) return '';
    
    let date;
    if (timestamp?.toDate) {
      date = timestamp.toDate();
    } else if (timestamp instanceof Date) {
      date = timestamp;
    } else {
      date = new Date(timestamp);
    }
    
    return date.toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric'
    });
  };

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
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </button>
            </div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  // Handle different name field variations (legacy compatibility)
  const displayName = profile.displayName || 
    (profile as any).name || 
    `${profile.firstName || ''} ${profile.lastName || ''}`.trim() ||
    'Member';
  
  // Handle legacy work/title field mapping
  const userTitle = profile.title || (profile as any).work || '';
  const userCompany = profile.company || '';
  const userLinkedin = profile.linkedin || (profile as any).linkedinUsername || '';
  const userPosition = (profile as any).position || '';
  const avatarColor = getAvatarColor(displayName);

  const profileImageUrl = profile.profileImage || profile.avatarUrl;
  const avatarFallback = (
    <div className={`w-full h-full bg-gradient-to-br ${avatarColor} flex items-center justify-center text-white font-bold text-3xl`}>
      {displayName.charAt(0)}
    </div>
  );
  const canOpenAvatarLightbox = isSafeImageUrl(profileImageUrl || null);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white overflow-x-hidden w-full max-w-full">
      <Header />

      {/* Avatar lightbox */}
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
      
      {/* Profile Header */}
      <div className="pt-[var(--content-offset-top)] pb-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Back Button */}
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center text-brand-dark hover:text-purple-700 mb-8 font-medium transition-colors duration-200"
          >
            <ChevronLeft className="h-5 w-5 mr-1" />
            Back
          </button>

          {/* Profile Card */}
          <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
            {/* Cover / banner: custom photo or blue gradient */}
            <div className="relative z-0 aspect-[3/1] w-full min-h-[140px] sm:min-h-[160px] bg-gradient-to-r from-brand-blue-dark to-brand-blue-light overflow-hidden">
              <ImageWithCrop
                src={String((profile as any).coverPhotoUrl || '')}
                crop={(profile as any).coverCrop ?? null}
                shape="rect"
                alt=""
                urlIsCropped={true}
              />
              <div className="absolute inset-0 bg-black bg-opacity-20 pointer-events-none" />
            </div>
            
            <div className="relative z-10 px-8 pb-8 bg-white">
              {/* Avatar - click to enlarge when image present */}
              <div className="flex items-start justify-between -mt-16 mb-6">
                <div
                  role={canOpenAvatarLightbox ? 'button' : undefined}
                  tabIndex={canOpenAvatarLightbox ? 0 : undefined}
                  onClick={() => canOpenAvatarLightbox && setShowAvatarModal(true)}
                  onKeyDown={(e) => canOpenAvatarLightbox && (e.key === 'Enter' || e.key === ' ') && setShowAvatarModal(true)}
                  className={`relative w-32 h-32 rounded-full overflow-hidden border-4 border-white shadow-lg bg-white flex-shrink-0 ${canOpenAvatarLightbox ? 'cursor-pointer hover:ring-4 hover:ring-brand-blue/30 transition-all' : ''}`}
                >
                  <ImageWithCrop
                    src={String(profileImageUrl || '')}
                    crop={(profile as any).profileImageCrop ?? null}
                    shape="circle"
                    alt={displayName}
                    className="rounded-full"
                    urlIsCropped={true}
                    fallback={avatarFallback}
                  />
                </div>
                
                <div className="mt-4 flex flex-col items-end space-y-2">
                  {/* Edit Button - Show if viewing own profile or if admin */}
                  {(currentUser?.uid === userId || currentUser?.role === 'admin') && (
                    <div className="flex space-x-2">
                      {/* Regular Edit Button - Always show for own profile */}
                      {currentUser?.uid === userId && (
                        <button
                          onClick={() => navigate('/dashboard')}
                          className="inline-flex items-center px-4 py-2 bg-brand-dark text-white rounded-lg hover:bg-brand-mid transition-colors duration-200 text-sm font-medium"
                        >
                          <Edit3 className="h-4 w-4 mr-2" />
                          Dashboard
                        </button>
                      )}
                      
                      {/* Admin Edit Button - Only show for admins viewing other profiles */}
                      {currentUser?.role === 'admin' && currentUser?.uid !== userId && (
                        <button
                          onClick={() => navigate(`/admin/users/${userId}/edit`)}
                          className="inline-flex items-center px-4 py-2 bg-brand-dark text-white rounded-lg hover:bg-brand-mid transition-colors duration-200 text-sm font-medium"
                        >
                          <Edit3 className="h-4 w-4 mr-2" />
                          Admin Edit
                        </button>
                      )}
                    </div>
                  )}
                  
                  {/* Connection Status */}
                  {connections.length > 0 && (
                    <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                      <Users className="h-4 w-4 mr-1" />
                      Connected
                    </div>
                  )}
                </div>
              </div>

              {/* Name and Role */}
              <div className="mb-6">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">{displayName}</h1>
                
                {/* Bio Title */}
                {profile.bioTitle && (
                  <div className="bg-blue-50 rounded-lg p-3 mb-3">
                    <p className="text-blue-800 font-medium text-center">
                      {profile.bioTitle}
                    </p>
                  </div>
                )}

                {(userTitle || userCompany) && (
                  <div className="mb-2">
                    {userTitle && (
                      <p className="text-lg text-gray-600 mb-1">{userTitle}</p>
                    )}
                    {userCompany && (
                      <p className="text-gray-500">{userCompany}</p>
                    )}
                  </div>
                )}

                {userPosition && (
                  <div className="mb-2">
                    <p className="text-sm text-gray-600">{formatPosition(userPosition)}</p>
                  </div>
                )}

                {/* Location */}
                {(profile.city || profile.country) && (
                  <div className="flex items-center text-gray-600 mb-2">
                    <MapPin className="h-4 w-4 mr-2" />
                    <span>{[profile.city, profile.country].filter(Boolean).join(', ')}</span>
                  </div>
                )}

                {profile.role === 'admin' && (
                  <div className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 mt-2">
                    <Shield className="h-3 w-3 mr-1" />
                    Admin
                  </div>
                )}
              </div>

              {/* Contact & Social Links */}
              <div className="grid md:grid-cols-2 gap-6 mb-8">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Contact Information</h3>
                  <div className="space-y-3">
                    {profile.email && (
                      <div className="flex items-center text-gray-600">
                        <Mail className="h-5 w-5 mr-3 text-gray-400" />
                        <a href={`mailto:${profile.email}`} className="hover:text-brand-dark transition-colors">
                          {profile.email}
                        </a>
                      </div>
                    )}
                    
                    {profile.phone && (
                      <div className="flex items-center text-gray-600">
                        <Phone className="h-5 w-5 mr-3 text-gray-400" />
                        <span>{profile.phone}</span>
                      </div>
                    )}

                    {profile.timezone && (
                      <div className="flex items-center text-gray-600">
                        <Clock className="h-5 w-5 mr-3 text-gray-400" />
                        <span>{profile.timezone}</span>
                      </div>
                    )}
                    
                    {(profile.joinedAt || profile.createdAt) && (
                      <div className="flex items-center text-gray-600">
                        <Calendar className="h-5 w-5 mr-3 text-gray-400" />
                        Joined {formatDate(profile.joinedAt ?? profile.createdAt)}
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Social Links</h3>
                  <div className="space-y-3">
                    {userLinkedin && (
                      <div className="flex items-center text-gray-600">
                        <Linkedin className="h-5 w-5 mr-3 text-gray-400" />
                        <a 
                          href={`https://linkedin.com/in/${userLinkedin.replace(/^(https?:\/\/)?(www\.)?linkedin\.com\/in\//i, '').replace(/\/$/, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-brand-dark transition-colors"
                        >
                          LinkedIn Profile
                        </a>
                      </div>
                    )}

                    {profile.website && (
                      <div className="flex items-center text-gray-600">
                        <Favicon url={profile.website} size={20} iconClassName="text-gray-400" className="mr-3" />
                        <a 
                          href={profile.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-brand-dark transition-colors"
                        >
                          {profile.website.replace(/^https?:\/\//, '')}
                        </a>
                      </div>
                    )}

                    {profile.twitter && (
                      <div className="flex items-center text-gray-600">
                        <Twitter className="h-5 w-5 mr-3 text-gray-400" />
                        <a 
                          href={`https://twitter.com/${profile.twitter}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-brand-dark transition-colors"
                        >
                          @{profile.twitter}
                        </a>
                      </div>
                    )}

                    {!userLinkedin && !profile.website && !profile.twitter && (
                      <div className="text-gray-500 italic">
                        No social links available
                      </div>
                    )}

                  </div>
                </div>
              </div>

              {/* Bio Section */}
              {profile.bio && (
                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">About</h3>
                  <BioHtml html={profile.bio} />
                </div>
              )}

              {/* Skills Section */}
              {profile.skills && profile.skills.length > 0 && (
                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Skills & Expertise</h3>
                  <div className="flex flex-wrap gap-2">
                    {profile.skills.map((skill, index) => (
                      <span
                        key={index}
                        className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm font-medium"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Connection History */}
              {connections.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Connection Details</h3>
                  <div className="bg-gray-50 rounded-xl p-4">
                    {connections.map((connection) => (
                      <div key={connection.id} className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <Users className="h-5 w-5 text-gray-400" />
                          <div>
                            <p className="font-medium text-gray-900">Connected</p>
                            <p className="text-sm text-gray-500">
                              via {connection.reasons ? 
                                ConnectionService.formatReasons(connection.reasons) : 
                                'Network Connection'
                              }
                            </p>
                          </div>
                        </div>
                        <div className="text-sm text-gray-500">
                          {ConnectionService.formatTimestamp(connection.createdAt || connection.updatedAt)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default UserProfilePage;