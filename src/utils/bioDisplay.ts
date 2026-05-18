/** Matches signup validation — short tagline under member name. */
export const BIO_TITLE_MAX_LENGTH = 60;

function stripHtml(text: string): string {
  return text
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeComparable(text: string): string {
  return stripHtml(text).toLowerCase();
}

/**
 * True when the title field is effectively the same content as the full bio (HubSpot import mistake).
 */
export function isBioTitleDuplicateOfBio(
  bioTitle: string | null | undefined,
  bio: string | null | undefined
): boolean {
  const title = normalizeComparable(bioTitle || '');
  const body = normalizeComparable(bio || '');
  if (!title || !body) return false;
  if (title === body) return true;
  if (body.startsWith(title) && title.length >= 40) return true;
  if (title.startsWith(body.slice(0, Math.min(body.length, 120))) && body.length >= 40) return true;
  return false;
}

/**
 * Sidebar / card line: short tagline only; hide when duplicate of full bio; truncate long imports.
 */
export function formatBioTitleForDisplay(
  rawTitle: string | null | undefined,
  fullBio?: string | null | undefined
): string | undefined {
  const title = (rawTitle || '').trim();
  if (!title) return undefined;
  if (isBioTitleDuplicateOfBio(title, fullBio)) return undefined;

  const plain = stripHtml(title);
  if (!plain) return undefined;

  if (plain.length <= BIO_TITLE_MAX_LENGTH) return plain;
  return `${plain.slice(0, BIO_TITLE_MAX_LENGTH - 1).trimEnd()}…`;
}

/** Light cleanup so HubSpot / rich-text bios don't get huge gaps between lines. */
export function normalizeBioHtmlForDisplay(html: string): string {
  if (!html?.trim()) return html;
  return html
    .replace(/<p>\s*(?:&nbsp;|\u00a0)?\s*<\/p>/gi, '')
    .replace(/(<br\s*\/?>\s*){2,}/gi, '<br>')
    .trim();
}
