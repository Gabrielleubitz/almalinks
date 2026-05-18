import React, { useState } from 'react';
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
import { isSafeImageUrl } from '../../utils/imageUrl';
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
  onConnect,
  onOpenAvatar,
  canOpenAvatarLightbox,
}) => {
  const [bioExpanded, setBioExpanded] = useState(false);
  const chapterParam = storedChapter
    ? chapterQueryParamForFilter(
        storedChapter.toLowerCase() === 'south africa' ? 'Johannesburg' : storedChapter
      )
    : null;

  const hasContact =
    profile.email ||
    (userLinkedin && linkedInProfileHref(userLinkedin)) ||
    profile.website ||
    profile.twitter;

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="p-4 sm:p-5 space-y-3 max-h-[min(calc(100dvh-var(--content-offset-top)-7rem),42rem)] overflow-y-auto">
        <div className="flex gap-3 sm:gap-4 items-start">
          <div
            role={canOpenAvatarLightbox ? 'button' : undefined}
            tabIndex={canOpenAvatarLightbox ? 0 : undefined}
            onClick={() => canOpenAvatarLightbox && onOpenAvatar?.()}
            onKeyDown={(e) =>
              canOpenAvatarLightbox && (e.key === 'Enter' || e.key === ' ') && onOpenAvatar?.()
            }
            className={`relative w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden border-2 border-gray-100 flex-shrink-0 bg-brand-dark ${
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
                <ProfileAvatarPlaceholder name={displayName} textClassName="font-bold text-xl" />
              }
            />
          </div>

          <div className="flex-1 min-w-0">
            <h1 className="text-lg sm:text-xl font-bold text-gray-900 leading-tight">{displayName}</h1>
            <div className="flex flex-wrap gap-1.5 mt-1">
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
              <p className="mt-1.5 text-sm font-medium text-brand-dark leading-snug line-clamp-2">
                {bioTitleLine}
              </p>
            ) : null}
            {(userTitle || userCompany) && (
              <p className="text-xs text-gray-600 mt-1">
                {[userTitle, userCompany].filter(Boolean).join(' · ')}
              </p>
            )}
            {chapterLabel && chapterParam ? (
              <Link
                to={`/members?chapter=${encodeURIComponent(chapterParam)}`}
                className="inline-block text-xs text-brand-blue hover:text-brand-blue-hover font-medium mt-1"
              >
                {chapterLabel} chapter →
              </Link>
            ) : chapterLabel ? (
              <p className="text-xs text-gray-600 mt-1">{chapterLabel}</p>
            ) : null}
            {(profile.city || profile.country) && (
              <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                <MapPin className="h-3 w-3 flex-shrink-0" aria-hidden />
                {[profile.city, profile.country].filter(Boolean).join(', ')}
              </p>
            )}
          </div>

          {showConnect && (
            <div className="flex flex-col items-end gap-1 shrink-0">
              <button
                type="button"
                onClick={onConnect}
                disabled={connectDisabled}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-brand-dark text-white text-xs font-medium hover:bg-brand-dark-hover disabled:opacity-50"
              >
                <UserPlus className="h-3.5 w-3.5" />
                {connectLabel}
              </button>
              {atDailyLimit && !outgoingPending && (
                <span className="text-[10px] text-amber-700 text-right max-w-[9rem] leading-snug">
                  {DAILY_LIMIT_MESSAGE}
                </span>
              )}
            </div>
          )}
        </div>

        {hasContact && (
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs border-t border-gray-100 pt-3">
            {profile.email && (
              <a
                href={`mailto:${profile.email}`}
                className="inline-flex items-center gap-1 text-gray-700 hover:text-brand-dark"
              >
                <Mail className="h-3.5 w-3.5 text-gray-400" />
                <span className="truncate max-w-[12rem]">{profile.email}</span>
              </a>
            )}
            {userLinkedin && linkedInProfileHref(userLinkedin) && (
              <a
                href={linkedInProfileHref(userLinkedin)!}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-gray-700 hover:text-brand-dark"
              >
                <Linkedin className="h-3.5 w-3.5 text-gray-400" />
                LinkedIn
              </a>
            )}
            {profile.website && (
              <a
                href={profile.website}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-gray-700 hover:text-brand-dark truncate max-w-[10rem]"
              >
                <Globe className="h-3.5 w-3.5 text-gray-400" />
                {profile.website.replace(/^https?:\/\//, '')}
              </a>
            )}
            {profile.twitter && (
              <a
                href={`https://twitter.com/${profile.twitter}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-gray-700 hover:text-brand-dark"
              >
                <Twitter className="h-3.5 w-3.5 text-gray-400" />
                @{profile.twitter}
              </a>
            )}
          </div>
        )}

        <div className="border-t border-gray-100 pt-3">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">About</h2>
          {profile.bio ? (
            <>
              <div className={`text-sm text-gray-700 leading-relaxed ${bioExpanded ? '' : 'line-clamp-4'}`}>
                <BioHtml html={profile.bio} />
              </div>
              {profile.bio.replace(/<[^>]+>/g, '').length > 280 && (
                <button
                  type="button"
                  onClick={() => setBioExpanded((v) => !v)}
                  className="mt-1 text-xs font-medium text-brand-blue hover:text-brand-blue-hover"
                >
                  {bioExpanded ? 'Show less' : 'Read more'}
                </button>
              )}
            </>
          ) : (
            <p className="text-sm text-gray-500">No bio yet.</p>
          )}
        </div>

        {profile.skills && profile.skills.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {profile.skills.slice(0, 10).map((skill, index) => (
              <span
                key={index}
                className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-[11px] font-medium"
              >
                {skill}
              </span>
            ))}
            {profile.skills.length > 10 && (
              <span className="text-[11px] text-gray-500 self-center">
                +{profile.skills.length - 10} more
              </span>
            )}
          </div>
        )}

        {connections.length > 0 && connections[0].reasons?.length ? (
          <p className="text-[11px] text-gray-500 pt-1">
            Connected · {ConnectionService.formatReasons(connections[0].reasons!)}
          </p>
        ) : null}
      </div>
    </div>
  );
};

export default MemberPublicProfileCard;
