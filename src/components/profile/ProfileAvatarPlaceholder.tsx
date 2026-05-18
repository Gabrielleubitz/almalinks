import React from 'react';
import {
  profileAvatarInitial,
  profileAvatarPlaceholderClassName,
} from '../../utils/profileAvatarPlaceholder';

export interface ProfileAvatarPlaceholderProps {
  name?: string | null;
  email?: string | null;
  /** Applied to the outer placeholder container (expects w-full h-full or explicit size). */
  className?: string;
  textClassName?: string;
  children?: React.ReactNode;
}

/**
 * Default member avatar when no profile image URL is available.
 */
const ProfileAvatarPlaceholder: React.FC<ProfileAvatarPlaceholderProps> = ({
  name,
  email,
  className = 'w-full h-full',
  textClassName = 'font-semibold',
  children,
}) => (
  <div
    className={profileAvatarPlaceholderClassName(`${className} ${textClassName}`)}
    aria-hidden={children === undefined}
  >
    {children ?? profileAvatarInitial(name, email)}
  </div>
);

export default ProfileAvatarPlaceholder;
