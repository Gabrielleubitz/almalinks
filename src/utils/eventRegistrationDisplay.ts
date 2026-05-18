/** ~width of a typical date line, e.g. "Tuesday, April 21st". */
export const EVENT_REGISTRATION_LABEL_MAX_CHARS = 26;

/** Truncated event name for registration lists (matches compact date-line width). */
export function shortEventRegistrationLabel(eventName?: string): string {
  const name = eventName?.trim();
  if (!name) return 'Event';
  if (name.length <= EVENT_REGISTRATION_LABEL_MAX_CHARS) return name;
  return `${name.slice(0, EVENT_REGISTRATION_LABEL_MAX_CHARS).trimEnd()}…`;
}
