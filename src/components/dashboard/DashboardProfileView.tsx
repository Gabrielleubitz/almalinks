import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Mail,
  Phone,
  MapPin,
  Clock,
  Twitter,
  Linkedin,
  ChevronDown,
  ChevronUp,
  Calendar,
  ArrowRight,
} from 'lucide-react';
import { EventData } from '../../services/eventService';
import { ConnectionService } from '../../services/connectionService';
import ImageWithCrop from '../profile/ImageWithCrop';
import ProfileAvatarPlaceholder from '../profile/ProfileAvatarPlaceholder';
import BioHtml from '../profile/BioHtml';
import { resolveDirectoryAvatarUrl } from '../../utils/memberHubspotDisplay';
import Favicon from '../ui/Favicon';
import AnnouncementsSidebar from '../announcements/AnnouncementsSidebar';
import { linkedInProfileHref } from '../../utils/linkedInUrl';
import { formatEventDateAndTime } from '../../utils/eventDisplayTime';
import type { CropValue } from '../../types/crop';
import type { UserProfile } from '../../types/user';

type RegistrationRow = {
  eventId: string;
  eventName?: string;
  registrationStatus?: string;
  eventSlug?: string;
};

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
  events: EventData[];
  upcomingRsvpRegistrations: RegistrationRow[];
  registrationsLoading: boolean;
  formatPosition: (value?: string) => string;
}

const DashboardProfileView: React.FC<DashboardProfileViewProps> = ({
  user,
  profileImageUrl,
  profileImageCrop,
  imageUploadError,
  events,
  upcomingRsvpRegistrations,
  registrationsLoading,
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
    <div className="space-y-4">
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
            className="absolute inset-0 h-full w-full"
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
            className={`text-sm text-gray-700 leading-relaxed ${bioExpanded ? '' : 'line-clamp-4'}`}
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

      <div className="rounded-xl border border-gray-100 bg-gray-50/80 p-3">
        <div className="flex items-center justify-between gap-2 mb-2">
          <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
            <Calendar className="h-4 w-4 text-brand-dark" />
            Your upcoming events
          </h4>
          <Link
            to="/events"
            className="text-xs font-medium text-brand-blue hover:text-brand-blue-hover whitespace-nowrap"
          >
            Browse all
          </Link>
        </div>
        {registrationsLoading ? (
          <p className="text-xs text-gray-500 py-2">Loading events…</p>
        ) : upcomingRsvpRegistrations.length === 0 ? (
          <p className="text-xs text-gray-600 py-1">
            No upcoming RSVPs.{' '}
            <Link to="/events" className="text-brand-blue font-medium hover:underline">
              Explore events
            </Link>
          </p>
        ) : (
          <ul className="space-y-2">
            {upcomingRsvpRegistrations.map((reg) => {
              const ev = events.find((e) => e.id === reg.eventId);
              const slug = reg.eventSlug || ev?.slug;
              if (!slug) return null;
              const dt =
                ev?.date &&
                formatEventDateAndTime(ev.date, {
                  eventFormat: ev.eventFormat ?? null,
                  chapter: ev.chapter ?? null,
                  displayTimezone: ev.displayTimezone ?? null,
                });
              return (
                <li key={reg.eventId}>
                  <Link
                    to={`/events/${slug}`}
                    className="flex items-start gap-3 rounded-lg bg-white border border-gray-100 px-3 py-2 hover:border-brand-dark/20 hover:shadow-sm transition-all group"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 group-hover:text-brand-dark line-clamp-2">
                        {reg.eventName || ev?.name}
                      </p>
                      {dt && (
                        <p className="text-xs text-gray-600 mt-0.5">
                          {dt.dateLine}
                          {dt.timeLine ? ` · ${dt.timeLine}` : ''}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span
                        className={`text-[10px] uppercase font-medium px-1.5 py-0.5 rounded ${
                          reg.registrationStatus === 'approved'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-amber-50 text-amber-800'
                        }`}
                      >
                        {reg.registrationStatus === 'approved' ? 'RSVP' : 'Pending'}
                      </span>
                      <ArrowRight className="h-3.5 w-3.5 text-gray-400 group-hover:text-brand-dark" />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div>
        <h4 className="text-sm font-semibold text-gray-900 mb-2">Announcements</h4>
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
