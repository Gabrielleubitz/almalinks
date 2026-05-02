import { formatEventInstantInZone, formatCompactDualTime } from './eventDateTimeZones';
import { timezoneForChapter } from './eventChapterTimezones';

export type EventFormat = 'in_person' | 'virtual' | 'hybrid';

export function formatEventStartForMembers(
  iso: string,
  opts: {
    eventFormat?: EventFormat | null;
    chapter?: string | null;
    displayTimezone?: string | null;
  }
): string {
  const mode = opts.eventFormat ?? null;
  const tzFromChapter = timezoneForChapter(opts.chapter);
  const tzOverride = opts.displayTimezone?.trim() || null;

  if (mode === 'virtual' || mode === 'hybrid') {
    return formatCompactDualTime(iso);
  }

  if (mode === 'in_person') {
    const tz = tzOverride || tzFromChapter || 'America/New_York';
    return formatEventInstantInZone(iso, tz);
  }

  // Legacy events (no eventFormat): single local line when chapter maps to a zone, else compact dual.
  if (tzOverride || tzFromChapter) {
    return formatEventInstantInZone(iso, tzOverride || tzFromChapter!);
  }
  return formatCompactDualTime(iso);
}
