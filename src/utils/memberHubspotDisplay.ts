import type { UserProfile } from '../types/user';
import { formatBioTitleForDisplay } from './bioDisplay';
import { isSafeImageUrl } from './imageUrl';

function firstHubspotString(
  props: Record<string, string | number | boolean | null> | null | undefined,
  keys: string[]
): string {
  if (!props) return '';
  for (const k of keys) {
    const raw = props[k] ?? props[k.toLowerCase()];
    if (raw === undefined || raw === null) continue;
    const s = String(raw).trim();
    if (s && s !== 'undefined' && s !== 'null') return s;
  }
  return '';
}

const HUBSPOT_PICTURE_PROP_KEYS = [
  'hs_avatar_filemanager_url',
  'hs_avatar_url',
  'picture',
  'profile_picture',
  'photo_url',
  'profile_photo_url',
  'avatar_url',
  'facebook_avatar',
];

/**
 * Avatar for directory: prefer Firestore avatar/profile image, then HubSpot snapshot URLs.
 */
export function resolveDirectoryAvatarUrl(user: UserProfile): string {
  const primary = String(user.avatarUrl || user.profileImage || '').trim();
  if (primary && isSafeImageUrl(primary)) return primary;
  const fromProps = firstHubspotString(user.hubspotContactProperties || null, HUBSPOT_PICTURE_PROP_KEYS);
  if (fromProps && isSafeImageUrl(fromProps)) return fromProps;
  return '';
}

/** Short HubSpot fields only — not bio_25 / bio_paragraph (those belong in full bio). */
const HUBSPOT_BIO_TITLE_KEYS = ['bio_short', 'bio_one_liner'];

/**
 * Raw short line for cards: bio title fields first, then HubSpot one-liners, then title/company.
 */
export function resolveDirectoryBioTitle(user: UserProfile): string | undefined {
  const direct = (user.bioTitle || '').trim();
  if (direct) return direct;
  const fromHub = firstHubspotString(user.hubspotContactProperties || null, HUBSPOT_BIO_TITLE_KEYS);
  if (fromHub) return fromHub;
  const title = (user.title || (user as { work?: string }).work || '').trim();
  const company = (user.company || '').trim();
  if (title && company) return `${title}, ${company}`;
  if (title) return title;
  if (company) return company;
  return undefined;
}

/** Display-safe tagline (truncated, not duplicated in full bio). */
export function resolveProfileBioTitleLine(user: UserProfile): string | undefined {
  const raw = resolveDirectoryBioTitle(user);
  return formatBioTitleForDisplay(raw, user.bio);
}

export function resolveStoredChapter(user: UserProfile): string | null {
  const c = user.chapter;
  if (c == null) return null;
  const s = String(c).trim();
  return s || null;
}
