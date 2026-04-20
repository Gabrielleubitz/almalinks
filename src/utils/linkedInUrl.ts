const LINKEDIN_IN_PREFIX = /^https?:\/\/(www\.)?linkedin\.com\/in\//i;

/**
 * Extract the profile vanity/slug from stored user input: plain username, full URL,
 * or corrupted values like https://www.linkedin.com/in/https://linkedin.com/in/slug/
 */
export function extractLinkedInVanity(input: string | undefined | null): string {
  if (input == null || typeof input !== 'string') return '';
  let s = input.trim();
  if (!s) return '';

  if (!/^https?:\/\//i.test(s) && /^linkedin\.com\//i.test(s)) {
    s = `https://${s}`;
  }

  let guard = 0;
  while (LINKEDIN_IN_PREFIX.test(s) && guard++ < 16) {
    s = s.replace(LINKEDIN_IN_PREFIX, '');
  }

  s = s.split('?')[0].split('#')[0].replace(/\/+$/, '').trim();

  const nested = s.match(/linkedin\.com\/in\/([^/?#]+)/i);
  if (nested?.[1]) {
    let inner = nested[1];
    try {
      inner = decodeURIComponent(inner);
    } catch {
      /* keep raw */
    }
    guard = 0;
    while (LINKEDIN_IN_PREFIX.test(inner) && guard++ < 16) {
      inner = inner.replace(LINKEDIN_IN_PREFIX, '');
    }
    return inner.split('?')[0].split('#')[0].replace(/\/+$/, '').trim();
  }

  return s.replace(/^\/+/, '');
}

/** Canonical profile URL for anchors, or empty string if nothing usable. */
export function linkedInProfileHref(input: string | undefined | null): string {
  const v = extractLinkedInVanity(input);
  if (!v) return '';
  return `https://www.linkedin.com/in/${v}`;
}
