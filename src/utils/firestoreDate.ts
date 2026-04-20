/**
 * Coerce Firestore Timestamp, serialized timestamp object, ISO string, millis, or Date to a valid Date.
 * Plain objects like `{ seconds, nanoseconds }` (e.g. after some JSON paths) do not work with `new Date(obj)`.
 */
export function toDateFromFirestore(value: unknown): Date | null {
  if (value == null) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof (value as { toDate?: () => Date }).toDate === 'function') {
    try {
      const d = (value as { toDate: () => Date }).toDate();
      return d instanceof Date && !Number.isNaN(d.getTime()) ? d : null;
    } catch {
      return null;
    }
  }
  const o = value as Record<string, unknown>;
  const sec =
    typeof o.seconds === 'number'
      ? o.seconds
      : typeof o._seconds === 'number'
        ? o._seconds
        : null;
  if (sec != null) {
    const d = new Date(sec * 1000);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/** First candidate that yields a valid date (e.g. prefer joinedAt, then createdAt). */
export function firstValidFirestoreDate(...candidates: unknown[]): Date | null {
  for (const c of candidates) {
    const d = toDateFromFirestore(c);
    if (d) return d;
  }
  return null;
}

/** "January 2024" for member profile; empty string if no valid input. */
export function formatMemberMonthYear(...candidates: unknown[]): string {
  const d = firstValidFirestoreDate(...candidates);
  if (!d) return '';
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}
