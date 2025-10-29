import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, User, Briefcase, MapPin, Calendar, Linkedin, Mail, Users, Shield, Clock,
  Phone, Globe, Twitter, MessageCircle, UserPlus, Share, MoreHorizontal, Edit3, Copy,
  Eye, EyeOff, CheckCircle, ExternalLink
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { UserService } from '../services/userService';
import { ConnectionService } from '../services/connectionService';
import { FilteredProfile } from '../utils/privacy';
import { getVisibilityDescription, getContactPermissionExplanation } from '../utils/privacy';
import Header from '../components/Header';
import Footer from '../components/Footer';
import LoadingSpinner from '../components/common/LoadingSpinner';

const EnhancedUserProfilePage: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const [profile, setProfile] = useState<FilteredProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'none' | 'pending' | 'connected'>('none');
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  useEffect(() => {
    if (userId) {
      loadUserProfile();
      checkConnectionStatus();
    }
  }, [userId, currentUser]);

  const loadUserProfile = async () => {
    if (!userId) return;

    try {
      setLoading(true);
      const userProfile = await UserService.getUser(
        userId,
        currentUser?.uid || null,
        currentUser?.role
      );

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

  const checkConnectionStatus = async () => {
    if (!currentUser?.uid || !userId || currentUser.uid === userId) return;

    try {
      const connection = await ConnectionService.checkExistingConnection(currentUser.uid, userId);
      setConnectionStatus(connection ? 'connected' : 'none');
      
      // TODO: Check for pending connection requests
    } catch (error) {
      console.error('❌ Error checking connection status:', error);
    }
  };

  const handleConnect = async () => {
    if (!currentUser?.uid || !userId) return;
    
    try {
      // TODO: Implement connection request functionality
      console.log('🤝 Requesting connection with user:', userId);
    } catch (error) {
      console.error('❌ Error requesting connection:', error);
    }
  };

  const handleMessage = () => {
    // TODO: Implement messaging functionality
    console.log('💬 Opening message with user:', userId);
  };

  const handleShare = async () => {
    const profileUrl = `${window.location.origin}/profile/${userId}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${profile?.displayName}'s Profile`,
          text: `Check out ${profile?.displayName}'s profile`,
          url: profileUrl,
        });
      } catch (error) {
        // Fallback to copy
        copyToClipboard(profileUrl);
      }
    } else {
      copyToClipboard(profileUrl);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (error) {
      console.error('❌ Failed to copy to clipboard:', error);
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

  const isOwner = currentUser?.uid === userId;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
        <Header />
        <div className="pt-20 pb-16 flex items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
        <Footer />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
        <Header />
        <div className="pt-20 pb-16">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="text-center">
              <User className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Profile Not Found</h2>
              <p className="text-gray-600 mb-8">{error || 'The user profile you\'re looking for doesn\'t exist.'}</p>
              <button
                onClick={() => navigate(-1)}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700"
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

  const displayName = profile.displayName || 'Anonymous';
  const avatarColor = getAvatarColor(displayName);
  const hasProfileImage = profile.avatarUrl || profile.profileImage;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
      <Header />
      
      <div className="pt-20 pb-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Back Button */}
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center text-gray-600 hover:text-gray-800 mb-8 transition-colors duration-200"
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            Back
          </button>

          {/* Profile Header */}
          <div className="bg-white rounded-3xl shadow-xl overflow-hidden mb-8">
            {/* Cover Image */}
            <div className="relative h-48 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-500">
              <div className="absolute inset-0 bg-black bg-opacity-20"></div>
              
              {/* Edit Button for Owner */}
              {isOwner && (
                <Link
                  to={`/profile/edit`}
                  className="absolute top-6 right-6 inline-flex items-center space-x-2 px-4 py-2 bg-white bg-opacity-20 backdrop-blur-sm text-white rounded-xl hover:bg-opacity-30 transition-all duration-200"
                >
                  <Edit3 className="h-4 w-4" />
                  <span>Edit Profile</span>
                </Link>
              )}
            </div>

            <div className="relative px-8 pb-8">
              {/* Avatar and Action Bar */}
              <div className="flex items-start justify-between -mt-16 mb-6">
                <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-white shadow-xl bg-white">
                  {hasProfileImage ? (
                    <img 
                      src={profile.avatarUrl || profile.profileImage} 
                      alt={displayName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className={`w-full h-full bg-gradient-to-br ${avatarColor} flex items-center justify-center text-white font-bold text-4xl`}>
                      {displayName.charAt(0)}
                    </div>
                  )}
                </div>
                
                {/* Action Bar */}
                {!isOwner && (
                  <div className="flex items-center space-x-3 mt-4">
                    {profile.canConnect && connectionStatus === 'none' && (
                      <button
                        onClick={handleConnect}
                        className="inline-flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors duration-200 font-semibold"
                      >
                        <UserPlus className="h-5 w-5" />
                        <span>Connect</span>
                      </button>
                    )}
                    
                    {connectionStatus === 'connected' && (
                      <div className="inline-flex items-center space-x-2 px-6 py-3 bg-green-100 text-green-800 rounded-xl font-semibold">
                        <CheckCircle className="h-5 w-5" />
                        <span>Connected</span>
                      </div>
                    )}
                    
                    {profile.canMessage && (
                      <button
                        onClick={handleMessage}
                        className="inline-flex items-center space-x-2 px-6 py-3 bg-gray-100 text-gray-800 rounded-xl hover:bg-gray-200 transition-colors duration-200 font-semibold"
                      >
                        <MessageCircle className="h-5 w-5" />
                        <span>Message</span>
                      </button>
                    )}
                    
                    <div className="relative">
                      <button
                        onClick={() => setShowShareMenu(!showShareMenu)}
                        className="p-3 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 transition-colors duration-200"
                      >
                        <Share className="h-5 w-5" />
                      </button>
                      
                      {showShareMenu && (
                        <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-200 py-2 z-10">
                          <button
                            onClick={handleShare}
                            className="w-full px-4 py-2 text-left text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
                          >
                            <Share className="h-4 w-4" />
                            <span>Share Profile</span>
                          </button>
                          <button
                            onClick={() => copyToClipboard(`${window.location.origin}/profile/${userId}`)}
                            className="w-full px-4 py-2 text-left text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
                          >
                            <Copy className="h-4 w-4" />
                            <span>{copySuccess ? 'Copied!' : 'Copy Link'}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Name and Title */}
              <div className="mb-6">
                <h1 className="text-4xl font-bold text-gray-900 mb-2">{displayName}</h1>
                {(profile.title || profile.company) && (
                  <p className="text-xl text-gray-600 mb-2">
                    {profile.title && profile.company 
                      ? `${profile.title} @ ${profile.company}`
                      : profile.title || profile.company
                    }
                  </p>
                )}
                
                {(profile.city || profile.country) && (
                  <div className="flex items-center text-gray-500">
                    <MapPin className="h-5 w-5 mr-2" />
                    <span>{[profile.city, profile.country].filter(Boolean).join(', ')}</span>
                  </div>
                )}
                
                {profile.role === 'admin' && (
                  <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-purple-100 text-purple-800 mt-3">
                    <Shield className="h-4 w-4 mr-1" />
                    Admin
                  </div>
                )}
              </div>

              {/* Bio Title */}
              {profile.bioTitle && (
                <div className="bg-blue-50 rounded-2xl p-4 mb-6">
                  <p className="text-blue-900 font-semibold text-lg text-center">
                    {profile.bioTitle}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Main Content Grid */}
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Left Column - About & Details */}
            <div className="lg:col-span-2 space-y-8">
              {/* About Section */}
              {profile.bio && (
                <div className="bg-white rounded-2xl shadow-lg p-8">
                  <div className="flex items-center space-x-3 mb-6">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <User className="h-6 w-6 text-blue-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900">About</h2>
                  </div>
                  <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                    {profile.bio}
                  </p>
                </div>
              )}

              {/* Skills Section */}
              {profile.skills && profile.skills.length > 0 && (
                <div className="bg-white rounded-2xl shadow-lg p-8">
                  <div className="flex items-center space-x-3 mb-6">
                    <div className="p-2 bg-green-100 rounded-lg">
                      <Briefcase className="h-6 w-6 text-green-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900">Skills & Expertise</h2>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {profile.skills.map((skill, index) => (
                      <span
                        key={index}
                        className="px-4 py-2 bg-gray-100 text-gray-800 rounded-full text-sm font-medium hover:bg-gray-200 transition-colors duration-200"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Connection Information */}
              {connectionStatus === 'connected' && (
                <div className="bg-green-50 border border-green-200 rounded-2xl p-6">
                  <div className="flex items-center space-x-3">
                    <CheckCircle className="h-6 w-6 text-green-600" />
                    <div>
                      <h3 className="font-semibold text-green-900">You're Connected</h3>
                      <p className="text-green-700 text-sm">
                        You and {displayName} are connected on the platform
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Right Column - Contact & Info */}
            <div className="space-y-6">
              {/* Contact Information */}
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <div className="flex items-center space-x-3 mb-6">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <Mail className="h-6 w-6 text-purple-600" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">Contact</h3>
                </div>
                
                <div className="space-y-4">
                  {profile.canViewContact && profile.email && (
                    <a
                      href={`mailto:${profile.email}`}
                      className="flex items-center space-x-3 p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors duration-200 group"
                    >
                      <Mail className="h-5 w-5 text-gray-400 group-hover:text-gray-600" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">Email</p>
                        <p className="text-sm text-gray-600 truncate">{profile.email}</p>
                      </div>
                      <ExternalLink className="h-4 w-4 text-gray-400 group-hover:text-gray-600" />
                    </a>
                  )}
                  
                  {profile.canViewPhone && profile.phone && (
                    <a
                      href={`tel:${profile.phone}`}
                      className="flex items-center space-x-3 p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors duration-200 group"
                    >
                      <Phone className="h-5 w-5 text-gray-400 group-hover:text-gray-600" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">Phone</p>
                        <p className="text-sm text-gray-600">{profile.phone}</p>
                      </div>
                      <ExternalLink className="h-4 w-4 text-gray-400 group-hover:text-gray-600" />
                    </a>
                  )}
                  
                  {profile.timezone && (
                    <div className="flex items-center space-x-3 p-4 bg-gray-50 rounded-xl">
                      <Clock className="h-5 w-5 text-gray-400" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">Timezone</p>
                        <p className="text-sm text-gray-600">{profile.timezone}</p>
                      </div>
                    </div>
                  )}
                  
                  {!profile.canViewContact && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                      <p className="text-yellow-800 text-sm">
                        Contact information is not visible due to privacy settings.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Social Links */}
              {(profile.linkedin || profile.website || profile.twitter) && (
                <div className="bg-white rounded-2xl shadow-lg p-6">
                  <div className="flex items-center space-x-3 mb-6">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Globe className="h-6 w-6 text-blue-600" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900">Links</h3>
                  </div>
                  
                  <div className="space-y-3">
                    {profile.linkedin && (
                      <a
                        href={profile.linkedin}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center space-x-3 p-3 bg-blue-50 rounded-xl hover:bg-blue-100 transition-colors duration-200 group"
                      >
                        <Linkedin className="h-5 w-5 text-blue-600" />
                        <span className="text-blue-700 font-medium group-hover:text-blue-800">LinkedIn Profile</span>
                        <ExternalLink className="h-4 w-4 text-blue-500 group-hover:text-blue-600" />
                      </a>
                    )}
                    
                    {profile.website && (
                      <a
                        href={profile.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center space-x-3 p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors duration-200 group"
                      >
                        <Globe className="h-5 w-5 text-gray-600" />
                        <span className="text-gray-700 font-medium group-hover:text-gray-800">Website</span>
                        <ExternalLink className="h-4 w-4 text-gray-500 group-hover:text-gray-600" />
                      </a>
                    )}
                    
                    {profile.twitter && (
                      <a
                        href={profile.twitter}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center space-x-3 p-3 bg-sky-50 rounded-xl hover:bg-sky-100 transition-colors duration-200 group"
                      >
                        <Twitter className="h-5 w-5 text-sky-600" />
                        <span className="text-sky-700 font-medium group-hover:text-sky-800">Twitter/X</span>
                        <ExternalLink className="h-4 w-4 text-sky-500 group-hover:text-sky-600" />
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* Member Information */}
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <div className="flex items-center space-x-3 mb-6">
                  <div className="p-2 bg-gray-100 rounded-lg">
                    <Calendar className="h-6 w-6 text-gray-600" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">Member Info</h3>
                </div>
                
                <div className="space-y-4">
                  {profile.joinedAt && (
                    <div className="flex items-center space-x-3">
                      <Calendar className="h-5 w-5 text-gray-400" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">Member Since</p>
                        <p className="text-sm text-gray-600">{formatDate(profile.joinedAt)}</p>
                      </div>
                    </div>
                  )}
                  
                  <div className="flex items-center space-x-3">
                    <div className={`
                      h-5 w-5 rounded-full
                      ${profile.profileVisibility === 'public' ? 'bg-blue-500' : 
                        profile.profileVisibility === 'event_only' ? 'bg-green-500' : 'bg-purple-500'}
                    `} />
                    <div>
                      <p className="text-sm font-medium text-gray-900">Profile Visibility</p>
                      <p className="text-sm text-gray-600 capitalize">
                        {profile.profileVisibility?.replace('_', ' ') || 'Event Only'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Footer />
      
      {/* Click outside handler for share menu */}
      {showShareMenu && (
        <div 
          className="fixed inset-0 z-0" 
          onClick={() => setShowShareMenu(false)} 
        />
      )}
    </div>
  );
};

export default EnhancedUserProfilePage;