import React, { useState } from 'react';
import { Globe } from 'lucide-react';

/**
 * Get the domain from a URL for favicon lookup.
 */
function getDomain(url: string): string | null {
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

/**
 * Google's favicon service (no CORS, reliable).
 * sz can be 16, 32, 48, 64, 128, etc.
 */
export function getFaviconUrl(url: string, size: number = 32): string | null {
  const domain = getDomain(url);
  if (!domain) return null;
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=${size}`;
}

interface FaviconProps {
  /** Full website URL (e.g. https://example.com) */
  url: string;
  size?: number;
  className?: string;
  /** Icon size in pixels for fallback Globe icon */
  iconClassName?: string;
}

/**
 * Renders the favicon for a website URL, with Globe icon fallback if the favicon fails to load.
 */
export const Favicon: React.FC<FaviconProps> = ({
  url,
  size = 20,
  className = '',
  iconClassName = 'text-gray-500',
}) => {
  const [failed, setFailed] = useState(false);
  const faviconUrl = getFaviconUrl(url, Math.min(size * 2, 64));

  if (!faviconUrl || failed) {
    return (
      <Globe
        className={`flex-shrink-0 ${iconClassName}`}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <img
      src={faviconUrl}
      alt=""
      className={`flex-shrink-0 rounded-sm ${className}`}
      width={size}
      height={size}
      onError={() => setFailed(true)}
    />
  );
};

export default Favicon;
