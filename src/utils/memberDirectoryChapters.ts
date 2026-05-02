/**
 * Members directory: chapter filter chips and display labels.
 * Stored values follow HubSpot / admin (see ALMA_CHAPTER_SELECT_VALUES); Johannesburg maps to "South Africa" in UI.
 */

export const CHAPTER_FILTER_ALL = 'all' as const;

export type ChapterFilterValue = typeof CHAPTER_FILTER_ALL | string;

/** Order matches product request; "all" is handled separately in UI. */
export const DIRECTORY_CHAPTER_FILTER_ORDER: { id: string; label: string }[] = [
  { id: 'Philadelphia', label: 'Philadelphia' },
  { id: 'New York', label: 'New York' },
  { id: 'Sydney', label: 'Sydney' },
  { id: 'Tel Aviv', label: 'Tel Aviv' },
  { id: 'Toronto', label: 'Toronto' },
  { id: 'Costa Rica', label: 'Costa Rica' },
  { id: 'Mexico City', label: 'Mexico City' },
  { id: 'London', label: 'London' },
  { id: 'Johannesburg', label: 'South Africa' },
  { id: 'International', label: 'International' },
];

function normChapter(raw: string | null | undefined): string {
  return (raw || '').trim().toLowerCase();
}

/** User-facing chapter line on cards and profile (Johannesburg → South Africa). */
export function formatChapterDisplayLabel(chapter: string | null | undefined): string {
  const c = (chapter || '').trim();
  if (!c) return '';
  if (c.toLowerCase() === 'johannesburg') return 'South Africa';
  return c;
}

/**
 * Whether a member's stored chapter value belongs under the selected filter chip.
 * `filterId` is the chip `id` (e.g. "Johannesburg" for South Africa hub).
 */
export function memberChapterMatchesFilter(
  storedChapter: string | null | undefined,
  filterId: ChapterFilterValue
): boolean {
  if (filterId === CHAPTER_FILTER_ALL) return true;
  const n = normChapter(storedChapter);
  if (!n) return false;
  if (filterId === 'Johannesburg') {
    return n === 'johannesburg' || n === 'south africa';
  }
  return n === normChapter(filterId);
}
