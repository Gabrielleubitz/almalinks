import type { EventData } from '../services/eventService';

/** True when the event should be treated as over for member-facing CTAs. */
export function isEventEnded(event: Pick<EventData, 'date' | 'status'>): boolean {
  if (event.status === 'completed' || event.status === 'non-active') return true;
  const start = new Date(event.date);
  if (Number.isNaN(start.getTime())) return false;
  return Date.now() > start.getTime();
}
