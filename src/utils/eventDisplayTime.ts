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
  /** Second timezone for virtual / hybrid (Israel when primary is US Eastern). */
  timeSecondaryLine?: string;
  /** In-person: Israel and New York hub times. */
  timeHubLine?: string;
  /** When the viewer’s timezone differs from the event’s primary zone. */
  timezoneBanner?: string;
  primaryTimezoneId?: string;
}

function toInstant(iso: string): Date | null {
  if (!iso?.trim()) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

function viewerTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return '';
  }
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

/** Short time without timezone name (for parenthetical / hub lines). */
export function formatShortTimeInZone(iso: string, timeZone: string): string {
  const d = toInstant(iso);
  if (!d) return '—';
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone,
  }).format(d);
}

function buildInPersonHubLine(iso: string): string {
  const israel = formatShortTimeInZone(iso, EVENT_TZ_ISRAEL);
  const ny = formatShortTimeInZone(iso, EVENT_TZ_US_EASTERN);
  return `Israel: ${israel} · New York: ${ny}`;
}

function timezoneBannerFor(primaryTz: string): string | undefined {
  const viewer = viewerTimezone();
  if (!viewer || viewer === primaryTz) return undefined;
  return `This event is in another timezone: ${primaryTz}.`;
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
  const timeFull = formatTimeLineInZone(iso, primaryTz);

  if (mode === 'in_person') {
    const nyShort = formatShortTimeInZone(iso, EVENT_TZ_US_EASTERN);
    const primaryShort = formatShortTimeInZone(iso, primaryTz);
    const timeLine =
      primaryTz === EVENT_TZ_US_EASTERN
        ? timeFull
        : `${primaryShort} (${nyShort})`;

    return {
      dateLine,
      timeLine,
      timeHubLine: buildInPersonHubLine(iso),
      timezoneBanner: timezoneBannerFor(primaryTz),
      primaryTimezoneId: primaryTz,
    };
  }

  if (mode === 'virtual' || mode === 'hybrid') {
    const timeLine = formatTimeLineInZone(iso, EVENT_TZ_US_EASTERN);
    const israelTime = formatTimeLineInZone(iso, EVENT_TZ_ISRAEL);
    if (israelTime !== timeLine) {
      return {
        dateLine,
        timeLine,
        timeSecondaryLine: israelTime,
        primaryTimezoneId: EVENT_TZ_US_EASTERN,
      };
    }
    return { dateLine, timeLine, primaryTimezoneId: EVENT_TZ_US_EASTERN };
  }

  return { dateLine, timeLine: timeFull, primaryTimezoneId: primaryTz };
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
  const { dateLine, timeLine, timeSecondaryLine, timeHubLine } = formatEventDateAndTime(iso, opts);
  const parts = [dateLine, timeLine];
  if (timeSecondaryLine) parts.push(timeSecondaryLine);
  if (timeHubLine) parts.push(timeHubLine);
  return parts.join(' · ');
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

  const { dateLine, timeLine, timeSecondaryLine, timeHubLine } = formatEventDateAndTime(iso, opts);
  const parts = [dateLine, timeLine];
  if (timeSecondaryLine) parts.push(timeSecondaryLine);
  if (timeHubLine) parts.push(timeHubLine);
  return parts.join(' · ');
}
