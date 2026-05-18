import React from 'react';
import { MapPin, Mail, Linkedin, Globe, Twitter, Clock, Shield, Eye, Users, EyeOff } from 'lucide-react';
import { UserProfile } from '../../types/user';
import { getVisibilityDescription } from '../../utils/privacy';
import Favicon from '../ui/Favicon';
import BioHtml from './BioHtml';
import { formatBioTitleForDisplay } from '../../utils/bioDisplay';
import ProfileAvatarPlaceholder from './ProfileAvatarPlaceholder';

interface ProfilePreviewCardProps {
  profile: UserProfile;
  showEditMode?: boolean;
}

const ProfilePreviewCard: React.FC<ProfilePreviewCardProps> = ({
  profile,
  showEditMode = false
}) => {
  const displayName = profile.displayName || 'Your Name';
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
      <div className="px-5 py-4 border-b border-gray-100 bg-gray-50">
        <h3 className="font-semibold text-gray-900 flex items-center text-sm">
          <Eye className="h-4 w-4 mr-2 text-gray-500" />
          {showEditMode ? 'Live Preview' : 'Profile Preview'}
        </h3>
        <p className="text-gray-500 text-xs mt-1">
          How others will see your profile
        </p>
      </div>

      {/* Profile Content */}
      <div className="p-5 space-y-4">
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
              <ProfileAvatarPlaceholder name={displayName} className="w-full h-full" textClassName="font-bold text-2xl" />
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
        {formatBioTitleForDisplay(profile.bioTitle, profile.bio) ? (
          <div className="bg-blue-50 rounded-lg p-3">
            <p className="text-blue-800 font-medium text-sm text-center line-clamp-2">
              {formatBioTitleForDisplay(profile.bioTitle, profile.bio)}
            </p>
          </div>
        ) : null}

        {/* Bio */}
        {profile.bio && (
          <div>
            <h5 className="text-sm font-semibold text-gray-900 mb-2">About</h5>
            <BioHtml html={profile.bio} className="text-gray-700 text-sm" />
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
                  <Favicon url={profile.website} size={16} iconClassName="text-gray-500" className="mr-3" />
                  <span className="truncate">{profile.website.replace(/^https?:\/\//, '')}</span>
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