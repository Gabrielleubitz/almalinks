import { formatEventDateAndTime } from './eventDisplayTime';

const MAX_EVENT_TITLE_CHARS = 48;

/** Compact event label for registration lists (date-first; never the full long title). */
export function shortEventRegistrationLabel(
  eventName?: string,
  eventDateIso?: string
): string {
  if (eventDateIso?.trim()) {
    const { dateLine } = formatEventDateAndTime(eventDateIso, {});
    if (dateLine && dateLine !== '—') return dateLine;
  }
  const name = eventName?.trim();
  if (!name) return 'Event';
  if (name.length <= MAX_EVENT_TITLE_CHARS) return name;
  return `${name.slice(0, MAX_EVENT_TITLE_CHARS).trimEnd()}…`;
}
