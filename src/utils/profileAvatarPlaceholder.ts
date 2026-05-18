/** AlmaLinks standard avatar when no profile image is available. */
export const PROFILE_AVATAR_PLACEHOLDER_BG = 'bg-brand-dark';

export function profileAvatarInitial(
  name?: string | null,
  email?: string | null
): string {
  const source = name?.trim() || email?.trim() || '?';
  const letter = source.charAt(0);
  return letter ? letter.toUpperCase() : '?';
}

export function profileAvatarPlaceholderClassName(extra?: string): string {
  return [
    PROFILE_AVATAR_PLACEHOLDER_BG,
    'text-white flex items-center justify-center',
    extra?.trim() || '',
  ]
    .filter(Boolean)
    .join(' ');
}
