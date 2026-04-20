import React from 'react';
import { Calendar } from 'lucide-react';
import { formatEventDualTimezones, formatDualFromDatetimeLocal } from '../utils/eventDateTimeZones';

type Layout = 'withIcon' | 'plain';

interface EventDualTimezoneDisplayProps {
  /** Stored event start (ISO string from Firestore). */
  eventStart: string;
  layout?: Layout;
  textClassName?: string;
  iconClassName?: string;
}

/**
 * Two lines: US Eastern and Israel, same calendar instant (for cards, detail, lists).
 */
export const EventDualTimezoneDisplay: React.FC<EventDualTimezoneDisplayProps> = ({
  eventStart,
  layout = 'withIcon',
  textClassName = 'text-gray-700',
  iconClassName = 'h-4 w-4 sm:h-5 sm:w-5 text-red-700 flex-shrink-0 mt-0.5',
}) => {
  const { usEasternLine, israelLine } = formatEventDualTimezones(eventStart);
  const lines = (
    <div className={`space-y-1 ${textClassName}`}>
      <div className="leading-snug">{usEasternLine}</div>
      <div className="leading-snug">{israelLine}</div>
    </div>
  );
  if (layout === 'plain') return lines;
  return (
    <div className="flex items-start gap-2 sm:gap-3">
      <Calendar className={iconClassName} aria-hidden />
      <div className="min-w-0">{lines}</div>
    </div>
  );
};

interface EventDatetimeLocalDualPreviewProps {
  value: string;
}

/**
 * Live preview under admin datetime-local: how the same instant reads in US Eastern and Israel.
 */
export const EventDatetimeLocalDualPreview: React.FC<EventDatetimeLocalDualPreviewProps> = ({ value }) => {
  const dual = formatDualFromDatetimeLocal(value);
  if (!dual) return null;
  return (
    <div className="mt-2 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5 text-xs text-gray-700 space-y-1.5">
      <p className="font-medium text-gray-600">How members will see this time</p>
      <p className="leading-snug">{dual.usEasternLine}</p>
      <p className="leading-snug">{dual.israelLine}</p>
      <p className="text-gray-500 pt-1 border-t border-gray-200/80">
        The picker uses your device’s local timezone; we store one exact start time.
      </p>
    </div>
  );
};
