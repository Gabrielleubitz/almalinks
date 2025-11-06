import React from 'react';
import { MapPin, Mail, Phone, Linkedin, Globe, Twitter, Clock, Calendar, Shield, Eye, Users, EyeOff } from 'lucide-react';
import { UserProfile } from '../../types/user';
import { getVisibilityDescription } from '../../utils/privacy';

interface ProfilePreviewCardProps {
  profile: UserProfile;
  showEditMode?: boolean;
}

const ProfilePreviewCard: React.FC<ProfilePreviewCardProps> = ({
  profile,
  showEditMode = false
}) => {
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

  const displayName = profile.displayName || 'Your Name';
  const avatarColor = getAvatarColor(displayName);
  const hasProfileImage = profile.avatarUrl || profile.profileImage;

  const getVisibilityIcon = (visibility: string) => {
    switch (visibility) {
      case 'public': return <Eye className="h-4 w-4" />;
      case 'event_only': return <Users className="h-4 w-4" />;
      case 'hidden': return <EyeOff className="h-4 w-4" />;
      default: return <Users className="h-4 w-4" />;
    }
  };

  const getVisibilityColor = (visibility: string) => {
    switch (visibility) {
      case 'public': return 'text-brand-blue bg-blue-50';
      case 'event_only': return 'text-green-600 bg-green-100';
      case 'hidden': return 'text-brand-dark bg-purple-100';
      default: return 'text-green-600 bg-green-100';
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-4 text-white">
        <h3 className="font-semibold flex items-center">
          <Eye className="h-5 w-5 mr-2" />
          {showEditMode ? 'Live Preview' : 'Profile Preview'}
        </h3>
        <p className="text-blue-100 text-sm mt-1">
          How others will see your profile
        </p>
      </div>

      {/* Profile Content */}
      <div className="p-6 space-y-6">
        {/* Avatar & Basic Info */}
        <div className="flex items-start space-x-4">
          <div className="w-20 h-20 rounded-full overflow-hidden flex-shrink-0">
            {hasProfileImage ? (
              <img 
                src={profile.avatarUrl || profile.profileImage} 
                alt={displayName}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className={`w-full h-full bg-gradient-to-br ${avatarColor} flex items-center justify-center text-white font-bold text-2xl`}>
                {displayName.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          
          <div className="flex-1 min-w-0">
            <h4 className="text-lg font-bold text-gray-900 truncate">
              {displayName}
            </h4>
            
            {(profile.title || profile.company) && (
              <p className="text-gray-600 text-sm mt-1">
                {profile.title && profile.company 
                  ? `${profile.title} @ ${profile.company}`
                  : profile.title || profile.company
                }
              </p>
            )}
            
            {(profile.city || profile.country) && (
              <div className="flex items-center text-gray-500 text-sm mt-2">
                <MapPin className="h-3 w-3 mr-1 flex-shrink-0" />
                <span className="truncate">
                  {[profile.city, profile.country].filter(Boolean).join(', ')}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Bio Title */}
        {profile.bioTitle && (
          <div className="bg-blue-50 rounded-lg p-3">
            <p className="text-blue-800 font-medium text-sm text-center">
              {profile.bioTitle}
            </p>
          </div>
        )}

        {/* Bio */}
        {profile.bio && (
          <div>
            <h5 className="text-sm font-semibold text-gray-900 mb-2">About</h5>
            <p className="text-gray-700 text-sm leading-relaxed">
              {profile.bio}
            </p>
          </div>
        )}

        {/* Contact Information */}
        <div>
          <h5 className="text-sm font-semibold text-gray-900 mb-3">Contact</h5>
          <div className="space-y-2">
            {profile.email && (
              <div className="flex items-center text-gray-600 text-sm">
                <Mail className="h-4 w-4 mr-3 text-gray-400 flex-shrink-0" />
                <span className="truncate">{profile.email}</span>
              </div>
            )}
            
            {profile.phone && profile.showPhone && (
              <div className="flex items-center text-gray-600 text-sm">
                <Phone className="h-4 w-4 mr-3 text-gray-400 flex-shrink-0" />
                <span>{profile.phone}</span>
              </div>
            )}
            
            {profile.timezone && (
              <div className="flex items-center text-gray-600 text-sm">
                <Clock className="h-4 w-4 mr-3 text-gray-400 flex-shrink-0" />
                <span>{profile.timezone}</span>
              </div>
            )}
          </div>
        </div>

        {/* Social Links */}
        {(profile.linkedin || profile.website || profile.twitter) && (
          <div>
            <h5 className="text-sm font-semibold text-gray-900 mb-3">Links</h5>
            <div className="space-y-2">
              {profile.linkedin && (
                <div className="flex items-center text-brand-blue text-sm">
                  <Linkedin className="h-4 w-4 mr-3 flex-shrink-0" />
                  <span className="truncate">LinkedIn Profile</span>
                </div>
              )}

              {profile.website && (
                <div className="flex items-center text-brand-blue text-sm">
                  <Globe className="h-4 w-4 mr-3 flex-shrink-0" />
                  <span className="truncate">Website</span>
                </div>
              )}

              {profile.twitter && (
                <div className="flex items-center text-brand-blue text-sm">
                  <Twitter className="h-4 w-4 mr-3 flex-shrink-0" />
                  <span className="truncate">Twitter/X</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Skills */}
        {profile.skills && profile.skills.length > 0 && (
          <div>
            <h5 className="text-sm font-semibold text-gray-900 mb-3">Skills</h5>
            <div className="flex flex-wrap gap-2">
              {profile.skills.slice(0, 8).map((skill, index) => (
                <span
                  key={index}
                  className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs"
                >
                  {skill}
                </span>
              ))}
              {profile.skills.length > 8 && (
                <span className="px-2 py-1 bg-gray-100 text-gray-500 rounded-full text-xs">
                  +{profile.skills.length - 8} more
                </span>
              )}
            </div>
          </div>
        )}

        {/* Privacy Setting */}
        <div className="pt-4 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Shield className="h-4 w-4 text-gray-400" />
              <span className="text-sm text-gray-600">Privacy</span>
            </div>
            
            <div className={`inline-flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium ${getVisibilityColor(profile.profileVisibility)}`}>
              {getVisibilityIcon(profile.profileVisibility)}
              <span className="capitalize">
                {profile.profileVisibility?.replace('_', ' ') || 'Event Only'}
              </span>
            </div>
          </div>
          
          <p className="text-xs text-gray-500 mt-2">
            {getVisibilityDescription(profile.profileVisibility)}
          </p>
        </div>

        {/* Member Since */}
        {profile.joinedAt && (
          <div className="flex items-center text-gray-500 text-xs">
            <Calendar className="h-3 w-3 mr-2" />
            <span>
              Member since {new Date(profile.joinedAt.toDate ? profile.joinedAt.toDate() : profile.joinedAt).toLocaleDateString('en-US', {
                month: 'long',
                year: 'numeric'
              })}
            </span>
          </div>
        )}

        {/* Completion Percentage */}
        {showEditMode && profile.profileCompletionPercentage !== undefined && (
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Profile Complete</span>
              <span className="font-semibold text-gray-900">
                {profile.profileCompletionPercentage}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div 
                className="bg-gradient-to-r from-green-400 to-green-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${profile.profileCompletionPercentage}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfilePreviewCard;