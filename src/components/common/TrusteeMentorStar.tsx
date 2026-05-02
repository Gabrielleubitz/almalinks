import React from 'react';

type Props = {
  isTrustee?: boolean;
  isMentor?: boolean;
  className?: string;
  /** When true, use compact pills suitable for dense member cards. */
  compact?: boolean;
};

/**
 * Visible markers for members flagged as trustee and/or mentor in HubSpot.
 */
export function TrusteeMentorStar({ isTrustee, isMentor, className = '', compact = false }: Props) {
  if (!isTrustee && !isMentor) return null;

  const base =
    compact
      ? 'text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded'
      : 'text-xs font-semibold px-2 py-0.5 rounded-md';

  return (
    <span className={`inline-flex flex-wrap items-center gap-1 ${className}`.trim()}>
      {isTrustee && (
        <span
          className={`${base} bg-amber-100 text-amber-900 border border-amber-200`}
          title="Trustee"
        >
          Trustee
        </span>
      )}
      {isMentor && (
        <span
          className={`${base} bg-sky-100 text-sky-900 border border-sky-200`}
          title="Mentor"
        >
          Mentor
        </span>
      )}
    </span>
  );
}
