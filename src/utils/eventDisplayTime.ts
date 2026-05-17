import {
  formatEventInstantInZone,
  EVENT_TZ_ISRAEL,
  EVENT_TZ_US_EASTERN,
} from './eventDateTimeZones';
import { timezoneForChapter } from './eventChapterTimezones';

export type EventFormat = 'in_person' | 'virtual' | 'hybrid';

export interface EventDateTimeLines {
  dateLine: string;
  timeLine: string;
  /** Second timezone line for virtual / hybrid (e.g. Israel). */
  timeSecondaryLine?: string;
}

function toInstant(iso: string): Date | null {
  if (!iso?.trim()) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

function dayWithOrdinal(day: number): string {
  if (day >= 11 && day <= 13) return `${day}th`;
  switch (day % 10) {
    case 1:
      return `${day}st`;
    case 2:
      return `${day}nd`;
    case 3:
      return `${day}rd`;
    default:
      return `${day}th`;
  }
}

function formatDateLineInZone(iso: string, timeZone: string): string {
  const d = toInstant(iso);
  if (!d) return '—';
  const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone }).format(d);
  const month = new Intl.DateTimeFormat('en-US', { month: 'long', timeZone }).format(d);
  const dayNum = Number(
    new Intl.DateTimeFormat('en-US', { day: 'numeric', timeZone }).format(d)
  );
  return `${weekday}, ${month} ${dayWithOrdinal(dayNum)}`;
}

function formatTimeLineInZone(iso: string, timeZone: string): string {
  const d = toInstant(iso);
  if (!d) return '—';
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone,
    timeZoneName: 'short',
  }).format(d);
}

function primaryZoneForEvent(opts: {
  eventFormat?: EventFormat | null;
  chapter?: string | null;
  displayTimezone?: string | null;
}): string {
  const mode = opts.eventFormat ?? null;
  if (mode === 'virtual' || mode === 'hybrid') return EVENT_TZ_US_EASTERN;
  if (mode === 'in_person') {
    return opts.displayTimezone?.trim() || timezoneForChapter(opts.chapter) || EVENT_TZ_US_EASTERN;
  }
  const tzOverride = opts.displayTimezone?.trim() || null;
  const tzFromChapter = timezoneForChapter(opts.chapter);
  return tzOverride || tzFromChapter || EVENT_TZ_US_EASTERN;
}

/** Split date + time lines for member-facing event UI. */
export function formatEventDateAndTime(
  iso: string,
  opts: {
    eventFormat?: EventFormat | null;
    chapter?: string | null;
    displayTimezone?: string | null;
  }
): EventDateTimeLines {
  const primaryTz = primaryZoneForEvent(opts);
  const mode = opts.eventFormat ?? null;
  const dateLine = formatDateLineInZone(iso, primaryTz);
  const timeLine = formatTimeLineInZone(iso, primaryTz);

  if (mode === 'virtual' || mode === 'hybrid') {
    const israelTime = formatTimeLineInZone(iso, EVENT_TZ_ISRAEL);
    if (israelTime !== timeLine) {
      return { dateLine, timeLine, timeSecondaryLine: israelTime };
    }
  }

  return { dateLine, timeLine };
}

/** @deprecated Prefer formatEventDateAndTime — kept for any legacy single-line usage. */
export function formatEventStartForMembers(
  iso: string,
  opts: {
    eventFormat?: EventFormat | null;
    chapter?: string | null;
    displayTimezone?: string | null;
  }
): string {
  const { dateLine, timeLine, timeSecondaryLine } = formatEventDateAndTime(iso, opts);
  if (timeSecondaryLine) {
    return `${dateLine} · ${timeLine} · ${timeSecondaryLine}`;
  }
  return `${dateLine} · ${timeLine}`;
}

/** Single-line fallback using chapter-local formatting for admin previews. */
export function formatEventStartCompactLegacy(
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

  if (mode === 'in_person') {
    const tz = tzOverride || tzFromChapter || EVENT_TZ_US_EASTERN;
    return formatEventInstantInZone(iso, tz);
  }

  const { dateLine, timeLine, timeSecondaryLine } = formatEventDateAndTime(iso, opts);
  if (timeSecondaryLine) return `${dateLine} · ${timeLine} · ${timeSecondaryLine}`;
  return `${dateLine} · ${timeLine}`;
}
