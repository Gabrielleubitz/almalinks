import React from 'react';
import { Calendar } from 'lucide-react';
import type { EventData } from '../services/eventService';
import { formatEventDateAndTime } from '../utils/eventDisplayTime';

type EventTimeFields = Pick<EventData, 'date'> &
  Partial<Pick<EventData, 'chapter' | 'eventFormat' | 'displayTimezone'>>;

interface EventTimeDisplayProps {
  event: EventTimeFields;
  layout?: 'withIcon' | 'plain' | 'split';
  textClassName?: string;
  iconClassName?: string;
  showLabels?: boolean;
}

export const EventTimeDisplay: React.FC<EventTimeDisplayProps> = ({
  event,
  layout = 'split',
  textClassName = 'text-gray-700',
  iconClassName = 'h-4 w-4 sm:h-5 sm:w-5 text-red-700 flex-shrink-0 mt-0.5',
  showLabels = true,
}) => {
  const { dateLine, timeLine, timeSecondaryLine } = formatEventDateAndTime(event.date, {
    eventFormat: event.eventFormat,
    chapter: event.chapter,
    displayTimezone: event.displayTimezone,
  });

  const lines = (
    <div className={`space-y-0.5 ${textClassName}`}>
      <p className="text-sm leading-snug">
        {showLabels ? (
          <>
            <span className="font-semibold text-gray-800">Date: </span>
            {dateLine}
          </>
        ) : (
          dateLine
        )}
      </p>
      <p className="text-sm leading-snug">
        {showLabels ? (
          <>
            <span className="font-semibold text-gray-800">Time: </span>
            {timeLine}
          </>
        ) : (
          timeLine
        )}
      </p>
      {timeSecondaryLine ? (
        <p className="text-xs text-gray-600 leading-snug">
          {showLabels ? (
            <>
              <span className="font-medium text-gray-700">Also: </span>
              {timeSecondaryLine}
            </>
          ) : (
            timeSecondaryLine
          )}
        </p>
      ) : null}
    </div>
  );

  if (layout === 'plain' || layout === 'split') return lines;

  const legacyLine = timeSecondaryLine
    ? `${dateLine} · ${timeLine} · ${timeSecondaryLine}`
    : `${dateLine} · ${timeLine}`;
  return (
    <div className="flex items-start gap-2 sm:gap-3">
      <Calendar className={iconClassName} aria-hidden />
      <div className={`text-sm leading-snug min-w-0 ${textClassName}`}>{legacyLine}</div>
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