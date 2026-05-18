import type { AuthUser } from '../hooks/useAuth';

export const MEMBER_HOME_PATH = '/members';
export const PROFILE_SETUP_PATH = '/complete-profile';

/** Routes reachable while profile setup is incomplete */
export const PROFILE_SETUP_ALLOWLIST = new Set([
  PROFILE_SETUP_PATH,
  '/change-password',
  '/help',
  '/terms',
]);

export function isMemberProfileSetupComplete(user: AuthUser | null | undefined): boolean {
  if (!user) return false;

  const displayName =
    user.displayName?.trim() ||
    [user.firstName, user.lastName].filter(Boolean).join(' ').trim();

  return !!(
    displayName &&
    user.phone?.trim() &&
    user.company?.trim() &&
    user.work?.trim() &&
    user.linkedinUsername?.trim() &&
    user.position?.trim()
  );
}

export function isProfileSetupAllowlistedPath(pathname: string): boolean {
  return PROFILE_SETUP_ALLOWLIST.has(pathname);
}
