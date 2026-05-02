import React from 'react';
import { Calendar } from 'lucide-react';
import type { EventData } from '../services/eventService';
import { formatEventStartForMembers } from '../utils/eventDisplayTime';

type EventTimeFields = Pick<EventData, 'date'> &
  Partial<Pick<EventData, 'chapter' | 'eventFormat' | 'displayTimezone'>>;

interface EventTimeDisplayProps {
  event: EventTimeFields;
  layout?: 'withIcon' | 'plain';
  textClassName?: string;
  iconClassName?: string;
}

export const EventTimeDisplay: React.FC<EventTimeDisplayProps> = ({
  event,
  layout = 'withIcon',
  textClassName = 'text-gray-700',
  iconClassName = 'h-4 w-4 sm:h-5 sm:w-5 text-red-700 flex-shrink-0 mt-0.5',
}) => {
  const line = formatEventStartForMembers(event.date, {
    eventFormat: event.eventFormat,
    chapter: event.chapter,
    displayTimezone: event.displayTimezone,
  });
  const text = <div className={`text-sm leading-snug ${textClassName}`}>{line}</div>;
  if (layout === 'plain') return text;
  return (
    <div className="flex items-start gap-2 sm:gap-3">
      <Calendar className={iconClassName} aria-hidden />
      <div className="min-w-0">{text}</div>
    </div>
  );
};

export function eventFormatLabel(format: EventData['eventFormat'] | null | undefined): string {
  switch (format) {
    case 'in_person':
      return 'In person';
    case 'virtual':
      return 'Zoom / online';
    case 'hybrid':
      return 'Hybrid';
    default:
      return 'Event';
  }
}
