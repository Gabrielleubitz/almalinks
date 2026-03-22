/**
 * True if the string is a usable http(s) image URL for <img src>.
 * Rejects empty, whitespace, literal "undefined"/"null", and non-URLs.
 * Protocol-relative URLs (//cdn.example/...) are resolved as https.
 */
export function isSafeImageUrl(url: string | null | undefined): url is string {
  if (url == null || typeof url !== 'string') return false;
  const t = url.trim();
  if (!t || t === 'undefined' || t === 'null') return false;
  try {
    const u = new URL(t, 'https://placeholder.invalid');
    if (!u.hostname || u.hostname === 'placeholder.invalid') return false;
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}
