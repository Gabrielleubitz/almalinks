import React from 'react';
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

  const looksLikeHtml = /<[a-z][\s\S]*>/i.test(html);
  if (!looksLikeHtml) {
    return (
      <p className={`text-gray-600 leading-relaxed whitespace-pre-wrap ${className}`}>
        {html}
      </p>
    );
  }

  const sanitized = sanitizeBioHtml(html);
  if (!sanitized) {
    return (
      <p className={`text-gray-600 leading-relaxed whitespace-pre-wrap ${className}`}>
        {html.replace(/<[^>]+>/g, '')}
      </p>
    );
  }

  return (
    <div
      className={`bio-content text-gray-600 leading-relaxed ${className}`}
      dangerouslySetInnerHTML={{ __html: sanitized }}
    />
  );
};

export default BioHtml;
