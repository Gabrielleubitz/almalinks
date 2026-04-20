import React from 'react';
import { Star } from 'lucide-react';

type Props = {
  isTrustee?: boolean;
  isMentor?: boolean;
  className?: string;
};

/**
 * Small visual marker for members flagged as trustee and/or mentor in HubSpot.
 */
export function TrusteeMentorStar({ isTrustee, isMentor, className = '' }: Props) {
  if (!isTrustee && !isMentor) return null;

  const parts: string[] = [];
  if (isTrustee) parts.push('Trustee');
  if (isMentor) parts.push('Mentor');
  const title = parts.join(' · ');

  return (
    <span
      className={`inline-flex items-center justify-center ${className}`.trim()}
      title={title}
    >
      <Star
        className="h-4 w-4 text-amber-500 fill-amber-400 flex-shrink-0"
        aria-label={title}
      />
    </span>
  );
}
