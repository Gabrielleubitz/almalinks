import React, { useState } from 'react';
import {
  Mail,
  Phone,
  MapPin,
  Clock,
  Twitter,
  Linkedin,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { ConnectionService } from '../../services/connectionService';
import ImageWithCrop from '../profile/ImageWithCrop';
import ProfileAvatarPlaceholder from '../profile/ProfileAvatarPlaceholder';
import BioHtml from '../profile/BioHtml';
import { resolveDirectoryAvatarUrl } from '../../utils/memberHubspotDisplay';
import Favicon from '../ui/Favicon';
import AnnouncementsSidebar from '../announcements/AnnouncementsSidebar';
import { linkedInProfileHref } from '../../utils/linkedInUrl';
import type { CropValue } from '../../types/crop';
import type { UserProfile } from '../../types/user';

function splitMultiValue(value?: string | null): string[] {
  if (!value?.trim()) return [];
  return value
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
}

export interface DashboardProfileViewProps {
  user: UserProfile;
  profileImageUrl?: string | null;
  profileImageCrop?: CropValue | null;
  imageUploadError?: string | null;
  formatPosition: (value?: string) => string;
}

const DashboardProfileView: React.FC<DashboardProfileViewProps> = ({
  user,
  profileImageUrl,
  profileImageCrop,
  imageUploadError,
  formatPosition,
}) => {
  const [bioExpanded, setBioExpanded] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const avatarSrc =
    profileImageUrl ||
    resolveDirectoryAvatarUrl(user) ||
    user.profileImage ||
    user.avatarUrl ||
    '';
  const industryTags = splitMultiValue(user.industry);
  const specialtyTags = splitMultiValue(user.specialty);
  const hasDetails =
    user.work ||
    user.company ||
    user.position ||
    user.city ||
    user.country ||
    user.timezone ||
    user.website ||
    user.twitter ||
    user.linkedinUsername ||
    industryTags.length > 0 ||
    specialtyTags.length > 0 ||
    (user.skills && user.skills.length > 0);

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 pb-3 border-b border-gray-100">
        <div className="relative mx-auto sm:mx-0 h-16 w-16 flex-shrink-0 rounded-full overflow-hidden ring-2 ring-gray-100 bg-brand-dark text-white">
          <ImageWithCrop
            src={String(avatarSrc)}
            crop={
              profileImageCrop ??
              (user as { profileImageCrop?: CropValue | null }).profileImageCrop ??
              null
            }
            shape="circle"
            alt=""
            urlIsCropped={true}
            fallback={
              <ProfileAvatarPlaceholder
                name={user.displayName}
                email={user.email}
                textClassName="font-semibold text-base"
              />
            }
          />
        </div>
        <div className="flex-1 min-w-0 text-center sm:text-left">
          <h3 className="text-lg font-bold text-gray-900">{user.displayName || 'Your Name'}</h3>
          {user.bioTitle && (
            <p className="text-sm text-brand-dark font-medium mt-0.5">{user.bioTitle}</p>
          )}
          {(user.work || user.company) && (
            <p className="text-xs text-gray-600 mt-1">
              {[user.work, user.company].filter(Boolean).join(' · ')}
            </p>
          )}
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-3 gap-y-1 text-xs text-gray-600 mt-2">
            {user.email && (
              <span className="inline-flex items-center gap-1 min-w-0">
                <Mail className="h-3 w-3 flex-shrink-0" />
                <span className="truncate max-w-[14rem]">{user.email}</span>
              </span>
            )}
            {user.phone && (
              <span className="inline-flex items-center gap-1">
                <Phone className="h-3 w-3 flex-shrink-0" />
                {user.phone}
              </span>
            )}
            {(user.city || user.country) && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3 flex-shrink-0" />
                {[user.city, user.country].filter(Boolean).join(', ')}
              </span>
            )}
          </div>
          {imageUploadError && <p className="text-red-600 text-xs mt-1">{imageUploadError}</p>}
        </div>
      </div>

      {user.bio && (
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">About</h4>
          <div
            className={`text-sm text-gray-700 leading-relaxed ${bioExpanded ? '' : 'line-clamp-3'}`}
          >
            <BioHtml html={user.bio} />
          </div>
          {user.bio.replace(/<[^>]+>/g, '').length > 200 && (
            <button
              type="button"
              onClick={() => setBioExpanded((v) => !v)}
              className="mt-1 text-xs font-medium text-brand-blue hover:text-brand-blue-hover"
            >
              {bioExpanded ? 'Show less' : 'Read more'}
            </button>
          )}
        </div>
      )}

      <div>
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Announcements</h4>
        <AnnouncementsSidebar compact />
      </div>

      {hasDetails && (
        <div className="border-t border-gray-100 pt-2">
          <button
            type="button"
            onClick={() => setDetailsOpen((v) => !v)}
            className="flex w-full items-center justify-between py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
          >
            <span>More profile details</span>
            {detailsOpen ? (
              <ChevronUp className="h-4 w-4 text-gray-400" />
            ) : (
              <ChevronDown className="h-4 w-4 text-gray-400" />
            )}
          </button>
          {detailsOpen && (
            <div className="space-y-3 pb-2 text-sm">
              {(user.work || user.company || user.position) && (
                <div className="grid sm:grid-cols-2 gap-3">
                  {user.work && (
                    <div>
                      <span className="text-xs text-gray-500">Job title</span>
                      <p className="font-medium text-gray-900">{user.work}</p>
                    </div>
                  )}
                  {user.company && (
                    <div>
                      <span className="text-xs text-gray-500">Company</span>
                      <p className="font-medium text-gray-900">{user.company}</p>
                    </div>
                  )}
                  {user.position && (
                    <div>
                      <span className="text-xs text-gray-500">Position</span>
                      <p className="font-medium text-gray-900">{formatPosition(user.position)}</p>
                    </div>
                  )}
                </div>
              )}

              {industryTags.length > 0 && (
                <div>
                  <span className="text-xs text-gray-500">Industry</span>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {industryTags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 bg-gray-100 text-gray-800 rounded-full text-xs"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {specialtyTags.length > 0 && (
                <div>
                  <span className="text-xs text-gray-500">Specialties</span>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {specialtyTags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 bg-blue-50 text-blue-800 rounded-full text-xs"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {user.skills && user.skills.length > 0 && (
                <div>
                  <span className="text-xs text-gray-500">Skills</span>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {user.skills.map((skill, index) => (
                      <span
                        key={index}
                        className="px-2 py-0.5 bg-blue-50 text-blue-800 rounded-full text-xs"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {(user.timezone || user.website || user.twitter || user.linkedinUsername) && (
                <div className="space-y-2 pt-1">
                  {user.timezone && (
                    <div className="flex items-center gap-2 text-gray-700">
                      <Clock className="h-4 w-4 text-gray-400" />
                      {user.timezone}
                    </div>
                  )}
                  {user.linkedinUsername && (
                    <div className="flex items-center gap-2">
                      <Linkedin className="h-4 w-4 text-gray-400" />
                      <a
                        href={linkedInProfileHref(user.linkedinUsername)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-brand-blue hover:underline truncate"
                      >
                        {ConnectionService.formatLinkedinUrl(user.linkedinUsername)}
                      </a>
                    </div>
                  )}
                  {user.website && (
                    <div className="flex items-center gap-2 min-w-0">
                      <Favicon url={user.website} size={16} iconClassName="text-gray-400" />
                      <a
                        href={user.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-brand-blue hover:underline truncate"
                      >
                        {user.website.replace(/^https?:\/\//, '')}
                      </a>
                    </div>
                  )}
                  {user.twitter && (
                    <div className="flex items-center gap-2">
                      <Twitter className="h-4 w-4 text-gray-400" />
                      <a
                        href={`https://twitter.com/${user.twitter}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-brand-blue hover:underline"
                      >
                        @{user.twitter}
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DashboardProfileView;
