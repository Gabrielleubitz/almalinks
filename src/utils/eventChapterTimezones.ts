/** AlmaLinks chapter labels (HubSpot / admin) → IANA timezone for “local event time” display. */
const CHAPTER_TO_IANA: Record<string, string> = {
  'Tel Aviv': 'Asia/Jerusalem',
  'New York': 'America/New_York',
  London: 'Europe/London',
  Johannesburg: 'Africa/Johannesburg',
  'Mexico City': 'America/Mexico_City',
  Philadelphia: 'America/New_York',
  Sydney: 'Australia/Sydney',
  Toronto: 'America/Toronto',
  'Costa Rica': 'America/Costa_Rica',
};

export const ALMA_CHAPTER_SELECT_VALUES = [
  '',
  'Tel Aviv',
  'New York',
  'London',
  'Johannesburg',
  'Mexico City',
  'Philadelphia',
  'Sydney',
  'Toronto',
  'Costa Rica',
  'International',
] as const;

export function timezoneForChapter(chapter: string | null | undefined): string | null {
  if (!chapter?.trim()) return null;
  const key = chapter.trim();
  if (key === 'International') return null;
  return CHAPTER_TO_IANA[key] ?? null;
}
