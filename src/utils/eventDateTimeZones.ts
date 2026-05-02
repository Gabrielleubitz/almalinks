/** IANA zones used everywhere we show event start times to members. */
export const EVENT_TZ_US_EASTERN = 'America/New_York';
export const EVENT_TZ_ISRAEL = 'Asia/Jerusalem';

const DISPLAY_OPTIONS: Intl.DateTimeFormatOptions = {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZoneName: 'short',
};

function toInstant(iso: string | Date | null | undefined): Date | null {
  if (iso == null || iso === '') return null;
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatEventInstantInZone(iso: string | Date, timeZone: string): string {
  const d = toInstant(iso);
  if (!d) return '—';
  return new Intl.DateTimeFormat('en-US', { ...DISPLAY_OPTIONS, timeZone }).format(d);
}

export function formatEventDualTimezones(iso: string | Date): {
  usEasternLine: string;
  israelLine: string;
} {
  const d = toInstant(iso);
  if (!d) {
    return { usEasternLine: '—', israelLine: '—' };
  }
  return {
    usEasternLine: `US Eastern: ${formatEventInstantInZone(d, EVENT_TZ_US_EASTERN)}`,
    israelLine: `Israel: ${formatEventInstantInZone(d, EVENT_TZ_ISRAEL)}`,
  };
}

/**
 * Preview for &lt;input type="datetime-local" /&gt; values (parsed in the browser's local timezone).
 */
export function formatDualFromDatetimeLocal(localValue: string): {
  usEasternLine: string;
  israelLine: string;
} | null {
  if (!localValue?.trim()) return null;
  const d = new Date(localValue);
  if (Number.isNaN(d.getTime())) return null;
  return formatEventDualTimezones(d);
}

/** One line for virtual / hybrid: full date in US Eastern + short Israel time (less vertical clutter than two labeled lines). */
export function formatCompactDualTime(iso: string | Date): string {
  const d = toInstant(iso);
  if (!d) return '—';
  const primary = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: EVENT_TZ_US_EASTERN,
    timeZoneName: 'short',
  }).format(d);
  const israelShort = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: EVENT_TZ_ISRAEL,
    timeZoneName: 'short',
  }).format(d);
  return `${primary} · ${israelShort}`;
}
