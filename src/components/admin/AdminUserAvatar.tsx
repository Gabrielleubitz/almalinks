import React from 'react';
import ImageWithCrop from '../profile/ImageWithCrop';
import ProfileAvatarPlaceholder from '../profile/ProfileAvatarPlaceholder';
import { resolveDirectoryAvatarUrl } from '../../utils/memberHubspotDisplay';
import type { UserProfile } from '../../types/user';
import type { CropValue } from '../../types/crop';

export type AdminUserAvatarUser = Pick<
  UserProfile,
  'avatarUrl' | 'profileImage' | 'profileImageCrop' | 'hubspotContactProperties'
> & {
  name?: string;
  displayName?: string;
  email?: string;
};

type Props = {
  user: AdminUserAvatarUser;
  /** Tailwind size classes, e.g. `h-10 w-10` */
  sizeClass?: string;
  textClassName?: string;
};

/**
 * Member-directory-style avatar: Firestore + HubSpot URLs, blue initial fallback.
 */
export function AdminUserAvatar({
  user,
  sizeClass = 'h-8 w-8 sm:h-10 sm:w-10',
  textClassName = 'font-semibold text-xs sm:text-sm',
}: Props) {
  const avatarUrl = resolveDirectoryAvatarUrl(user as UserProfile);
  const label = user.displayName || user.name || user.email;

  return (
    <div className={`flex-shrink-0 rounded-full overflow-hidden border border-gray-100 relative bg-brand-dark ${sizeClass}`}>
      <ImageWithCrop
        src={avatarUrl}
        crop={(user.profileImageCrop as CropValue | null | undefined) ?? null}
        shape="circle"
        alt=""
        className="rounded-full w-full h-full"
        urlIsCropped={true}
        fallback={
          <ProfileAvatarPlaceholder
            name={label}
            email={user.email}
            textClassName={textClassName}
          />
        }
      />
    </div>
  );
}
