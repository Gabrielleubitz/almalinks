import React from 'react';
import { normalizeBioHtmlForDisplay } from '../../utils/bioDisplay';
import { sanitizeBioHtml } from '../../utils/security';

interface BioHtmlProps {
  html: string | null | undefined;
  className?: string;
}

/**
 * Renders bio content as HTML. Plain text (no tags) is shown as-is with preserved line breaks.
 * Content that looks like HTML is sanitized and rendered with formatting (bold, italic, underline, highlight).
 */
export const BioHtml: React.FC<BioHtmlProps> = ({ html, className = '' }) => {
  if (!html || !html.trim()) return null;

  const normalized = normalizeBioHtmlForDisplay(html);
  const looksLikeHtml = /<[a-z][\s\S]*>/i.test(normalized);
  if (!looksLikeHtml) {
    return (
      <p className={`text-gray-700 leading-normal whitespace-pre-wrap ${className}`}>
        {normalized}
      </p>
    );
  }

  const sanitized = sanitizeBioHtml(normalized);
  if (!sanitized) {
    return (
      <p className={`text-gray-700 leading-normal whitespace-pre-wrap ${className}`}>
        {normalized.replace(/<[^>]+>/g, '')}
      </p>
    );
  }

  return (
    <div
      className={`bio-content text-gray-700 leading-normal ${className}`}
      dangerouslySetInnerHTML={{ __html: sanitized }}
    />
  );
};

export default BioHtml;
