import React from 'react';
import { Link } from 'react-router-dom';
import {
  MapPin,
  Linkedin,
  Mail,
  Users,
  Shield,
  Globe,
  Twitter,
  UserPlus,
} from 'lucide-react';
import ImageWithCrop from './ImageWithCrop';
import ProfileAvatarPlaceholder from './ProfileAvatarPlaceholder';
import BioHtml from './BioHtml';
import { TrusteeMentorStar } from '../common/TrusteeMentorStar';
import { linkedInProfileHref } from '../../utils/linkedInUrl';
import { chapterQueryParamForFilter } from '../../utils/memberDirectoryChapters';
import { ConnectionService } from '../../services/connectionService';
import { DAILY_LIMIT_MESSAGE } from '../../services/connectionRequestLimitService';
import type { UserProfile } from '../../types/user';
import type { FilteredProfile } from '../../utils/privacy';

export interface MemberPublicProfileCardProps {
  profile: FilteredProfile;
  displayName: string;
  profileImageUrl: string;
  bioTitleLine?: string;
  userTitle: string;
  userCompany: string;
  userLinkedin: string;
  chapterLabel: string;
  storedChapter: string | null;
  isTrustee: boolean;
  isMentor: boolean;
  showConnect: boolean;
  connectDisabled: boolean;
  connectLabel: string;
  atDailyLimit: boolean;
  outgoingPending: boolean;
  connections: { id: string; reasons?: string[] }[];
  connectError?: string | null;
  onConnect: () => void;
  onOpenAvatar?: () => void;
  canOpenAvatarLightbox: boolean;
}

const MemberPublicProfileCard: React.FC<MemberPublicProfileCardProps> = ({
  profile,
  displayName,
  profileImageUrl,
  bioTitleLine,
  userTitle,
  userCompany,
  userLinkedin,
  chapterLabel,
  storedChapter,
  isTrustee,
  isMentor,
  showConnect,
  connectDisabled,
  connectLabel,
  atDailyLimit,
  outgoingPending,
  connections,
  connectError,
  onConnect,
  onOpenAvatar,
  canOpenAvatarLightbox,
}) => {
  const chapterParam = storedChapter
    ? chapterQueryParamForFilter(
        storedChapter.toLowerCase() === 'south africa' ? 'Johannesburg' : storedChapter
      )
    : null;
  const linkedinHref = userLinkedin ? linkedInProfileHref(userLinkedin) : null;

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="p-4 sm:p-6">
        <div className="flex flex-col md:flex-row md:gap-8">
          {/* Left: structured identity + contact */}
          <aside className="md:w-56 lg:w-64 flex-shrink-0 flex flex-col items-center md:items-stretch text-center md:text-left">
            <div
              role={canOpenAvatarLightbox ? 'button' : undefined}
              tabIndex={canOpenAvatarLightbox ? 0 : undefined}
              onClick={() => canOpenAvatarLightbox && onOpenAvatar?.()}
              onKeyDown={(e) =>
                canOpenAvatarLightbox && (e.key === 'Enter' || e.key === ' ') && onOpenAvatar?.()
              }
              className={`relative w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden border-2 border-gray-100 flex-shrink-0 bg-brand-dark mx-auto md:mx-0 ${
                canOpenAvatarLightbox ? 'cursor-pointer hover:ring-2 hover:ring-brand-blue/30' : ''
              }`}
            >
              <ImageWithCrop
                src={String(profileImageUrl || '')}
                crop={(profile as UserProfile).profileImageCrop ?? null}
                shape="circle"
                alt=""
                className="rounded-full"
                urlIsCropped={true}
                fallback={
                  <ProfileAvatarPlaceholder name={displayName} textClassName="font-bold text-2xl" />
                }
              />
            </div>

            <h1 className="mt-3 text-lg font-bold text-gray-900 leading-tight">{displayName}</h1>

            <div className="flex flex-wrap justify-center md:justify-start gap-1.5 mt-2">
              <TrusteeMentorStar compact isTrustee={isTrustee} isMentor={isMentor} />
              {profile.role === 'admin' && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-100 text-purple-800">
                  <Shield className="h-3 w-3 mr-0.5" />
                  Admin
                </span>
              )}
              {connections.length > 0 && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-100 text-green-800">
                  <Users className="h-3 w-3 mr-0.5" />
                  Connected
                </span>
              )}
            </div>

            {bioTitleLine ? (
              <p className="mt-3 text-sm font-medium text-brand-dark leading-snug">{bioTitleLine}</p>
            ) : null}

            <div className="mt-4 w-full space-y-2.5 text-sm border-t border-gray-100 pt-4">
              {profile.email ? (
                <a
                  href={`mailto:${profile.email}`}
                  className="flex items-center gap-2 text-gray-700 hover:text-brand-dark justify-center md:justify-start"
                >
                  <Mail className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  <span className="truncate">{profile.email}</span>
                </a>
              ) : null}
              {linkedinHref ? (
                <a
                  href={linkedinHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-gray-700 hover:text-brand-dark justify-center md:justify-start"
                >
                  <Linkedin className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  <span>LinkedIn</span>
                </a>
              ) : null}
            </div>
          </aside>

          {/* Right: connect + extended profile */}
          <div className="flex-1 min-w-0 mt-6 md:mt-0 flex flex-col">
            <div className="flex justify-end mb-4">
              {showConnect ? (
                <div className="flex flex-col items-end gap-1.5">
                  <button
                    type="button"
                    onClick={onConnect}
                    disabled={connectDisabled}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-brand-dark text-white text-sm font-medium hover:bg-brand-dark-hover disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <UserPlus className="h-4 w-4" />
                    {connectLabel}
                  </button>
                  {atDailyLimit && !outgoingPending && (
                    <p className="text-[11px] text-amber-700 text-right max-w-[14rem] leading-snug">
                      {DAILY_LIMIT_MESSAGE}
                    </p>
                  )}
                  {connectError ? (
                    <p className="text-[11px] text-red-600 text-right max-w-[14rem] leading-snug" role="alert">
                      {connectError}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="space-y-4 flex-1">
              {(userTitle || userCompany) && (
                <p className="text-sm text-gray-700 font-medium">
                  {[userTitle, userCompany].filter(Boolean).join(' · ')}
                </p>
              )}

              {chapterLabel && chapterParam ? (
                <Link
                  to={`/members?chapter=${encodeURIComponent(chapterParam)}`}
                  className="inline-block text-sm text-brand-blue hover:text-brand-blue-hover font-medium"
                >
                  {chapterLabel} chapter →
                </Link>
              ) : chapterLabel ? (
                <p className="text-sm text-gray-600">{chapterLabel}</p>
              ) : null}

              {(profile.city || profile.country) && (
                <p className="text-sm text-gray-500 flex items-center gap-1.5">
                  <MapPin className="h-4 w-4 flex-shrink-0" aria-hidden />
                  {[profile.city, profile.country].filter(Boolean).join(', ')}
                </p>
              )}

              <div>
                <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">About</h2>
                {profile.bio ? (
                  <div className="text-sm text-gray-700 leading-relaxed prose prose-sm max-w-none">
                    <BioHtml html={profile.bio} />
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No bio yet.</p>
                )}
              </div>

              {(profile.website || profile.twitter) && (
                <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm pt-1 border-t border-gray-100">
                  {profile.website && (
                    <a
                      href={profile.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-gray-700 hover:text-brand-dark"
                    >
                      <Globe className="h-4 w-4 text-gray-400" />
                      {profile.website.replace(/^https?:\/\//, '')}
                    </a>
                  )}
                  {profile.twitter && (
                    <a
                      href={`https://twitter.com/${profile.twitter}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-gray-700 hover:text-brand-dark"
                    >
                      <Twitter className="h-4 w-4 text-gray-400" />@{profile.twitter}
                    </a>
                  )}
                </div>
              )}

              {profile.skills && profile.skills.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {profile.skills.map((skill, index) => (
                    <span
                      key={index}
                      className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs font-medium"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              )}

              {connections.length > 0 && connections[0].reasons?.length ? (
                <p className="text-xs text-gray-500">
                  Connected · {ConnectionService.formatReasons(connections[0].reasons!)}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MemberPublicProfileCard;
