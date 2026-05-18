import React from 'react';
import { Calendar, Info } from 'lucide-react';
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
  /** Tighter spacing for event detail above-the-fold layout */
  dense?: boolean;
}

export const EventTimeDisplay: React.FC<EventTimeDisplayProps> = ({
  event,
  layout = 'split',
  textClassName = 'text-gray-700',
  iconClassName = 'h-4 w-4 sm:h-5 sm:w-5 text-red-700 flex-shrink-0 mt-0.5',
  showLabels = true,
  dense = false,
}) => {
  const { dateLine, timeLine, timeSecondaryLine, timeHubLine, timezoneBanner } =
    formatEventDateAndTime(event.date, {
      eventFormat: event.eventFormat,
      chapter: event.chapter,
      displayTimezone: event.displayTimezone,
    });

  const lines = (
    <div className={dense ? 'space-y-1' : 'space-y-1.5'}>
      {timezoneBanner ? (
        <div
          className={`flex items-start gap-1.5 rounded-lg border border-sky-200 bg-sky-50 text-sky-900 ${
            dense ? 'px-2 py-1.5 text-[11px] leading-snug' : 'px-2.5 py-2 text-xs'
          }`}
          role="note"
        >
          <Info className={`shrink-0 text-sky-700 ${dense ? 'h-3.5 w-3.5' : 'h-4 w-4 mt-0.5'}`} aria-hidden />
          <span>{timezoneBanner}</span>
        </div>
      ) : null}
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
          <p className={dense ? 'text-[11px] text-gray-600 leading-snug' : 'text-xs text-gray-600 leading-snug'}>
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
        {timeHubLine ? (
          <p className={dense ? 'text-[11px] text-gray-600 leading-snug' : 'text-xs text-gray-600 leading-snug'}>
            {showLabels ? (
              <>
                <span className="font-medium text-gray-700">Hub times: </span>
                {timeHubLine}
              </>
            ) : (
              timeHubLine
            )}
          </p>
        ) : null}
      </div>
    </div>
  );

  if (layout === 'plain' || layout === 'split') return lines;

  const legacyParts = [dateLine, timeLine];
  if (timeSecondaryLine) legacyParts.push(timeSecondaryLine);
  if (timeHubLine) legacyParts.push(timeHubLine);
  const legacyLine = legacyParts.join(' · ');
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
