import React, { useState, useRef, useEffect } from 'react';
import AvatarStack, { type ReactionUser } from './AvatarStack';

const MAX_TOOLTIP_NAMES = 10;

interface ReactionPillProps {
  emoji: string;
  userIds: string[];
  currentUserId: string | null;
  usersById: Record<string, ReactionUser>;
  onToggle: (emoji: string) => void;
  disabled?: boolean;
}

const ReactionPill: React.FC<ReactionPillProps> = ({
  emoji,
  userIds,
  currentUserId,
  usersById,
  onToggle,
  disabled = false,
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const count = userIds.length;
  const isActive = !!currentUserId && userIds.includes(currentUserId);

  const names = userIds
    .map((uid) => usersById[uid]?.name ?? 'Unknown')
    .filter(Boolean);
  const tooltipLines =
    names.length <= MAX_TOOLTIP_NAMES
      ? names
      : [...names.slice(0, MAX_TOOLTIP_NAMES), `and ${names.length - MAX_TOOLTIP_NAMES} more…`];

  useEffect(() => {
    if (!showTooltip) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (tooltipRef.current && !tooltipRef.current.contains(e.target as Node)) {
        setShowTooltip(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showTooltip]);

  return (
    <div className="relative inline-flex" ref={tooltipRef}>
      <button
        type="button"
        onClick={() => !disabled && onToggle(emoji)}
        disabled={disabled}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        aria-label={`Reacted with ${emoji} by ${count} user${count !== 1 ? 's' : ''}`}
        className={`inline-flex items-center gap-1.5 pl-2 pr-2 py-1 rounded-full text-sm transition-all duration-200 min-h-[28px] ${
          disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
        } ${
          isActive
            ? 'bg-blue-50 text-blue-800 border border-blue-200 font-semibold hover:bg-blue-100'
            : 'bg-gray-100 text-gray-700 border border-transparent hover:bg-gray-200 hover:border-gray-200'
        }`}
      >
        <span className="text-base leading-none">{emoji}</span>
        {count > 0 && (
          <span className="font-medium tabular-nums">{count}</span>
        )}
        {count > 0 && (
          <span className="flex items-center -mr-0.5">
            <AvatarStack
              userIds={userIds}
              usersById={usersById}
              maxVisible={3}
              size={18}
            />
          </span>
        )}
      </button>
      {showTooltip && count > 0 && (
        <div
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2.5 py-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg z-50 whitespace-nowrap max-w-[200px]"
          role="tooltip"
        >
          <div className="font-medium text-gray-300 mb-0.5">
            Reacted with {emoji}
          </div>
          <ul className="list-none space-y-0.5">
            {tooltipLines.map((line, i) =>
              line.startsWith('and ') ? (
                <li key={i} className="text-gray-400 italic">
                  {line}
                </li>
              ) : (
                <li key={i}>{line}</li>
              )
            )}
          </ul>
        </div>
      )}
    </div>
  );
};

export default ReactionPill;
export type { ReactionUser } from './AvatarStack';
