import type { AudienceSelection } from '../services/eventService';

/**
 * Short label when the event is not visible to all members.
 * Returns null for public (all_users) events — do not show an “exclusive” badge.
 */
export function getRestrictedEventAccessLabel(
  audience: AudienceSelection | null | undefined
): string | null {
  if (!audience || !audience.mode || audience.mode === 'all_users') return null;
  switch (audience.mode) {
    case 'individuals':
      return 'Invitation only';
    case 'group':
      return 'Trustees / group';
    case 'event':
      return 'Selected events';
    case 'chat':
      return 'Chat members';
    case 'location':
      return 'Chapter members';
    default:
      return 'Limited access';
  }
}
