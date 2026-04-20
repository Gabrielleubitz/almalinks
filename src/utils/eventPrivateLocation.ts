import type { EventPrivateDetails } from '../types/event';

function trim(s: unknown): string {
  return typeof s === 'string' ? s.trim() : '';
}

/** Venue / area line (private locationText overrides public card location when set). */
export function approvedEventPrimaryLocation(
  publicLocation: string | undefined,
  privateDetails: EventPrivateDetails | null | undefined
): string {
  return trim(privateDetails?.locationText) || trim(publicLocation) || '';
}

/** Street / full venue address — stored in private details only. */
export function approvedEventVenueAddress(
  privateDetails: EventPrivateDetails | null | undefined
): string {
  return trim(privateDetails?.venueAddress);
}

/** Google Calendar `location` parameter (single line). */
export function approvedEventCalendarLocation(
  publicLocation: string | undefined,
  privateDetails: EventPrivateDetails | null | undefined
): string {
  const venue = approvedEventVenueAddress(privateDetails);
  const primary = approvedEventPrimaryLocation(publicLocation, privateDetails);
  if (venue && primary) return `${venue}, ${primary}`;
  return venue || primary || '';
}
