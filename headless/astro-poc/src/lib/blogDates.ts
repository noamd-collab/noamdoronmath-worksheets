/**
 * Absolute Hebrew blog dates — never freeze Wix relative strings like "לפני 7 שעות".
 */

const RELATIVE_HE = /לפני/;

export function isFrozenRelativeDate(value: string | undefined | null): boolean {
  return Boolean(value && RELATIVE_HE.test(value));
}

/** Format ISO publish/update time as a stable he-IL calendar date. */
export function formatBlogDateDisplay(iso: string | undefined | null): string {
  if (!iso) return '';
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return '';
  return new Intl.DateTimeFormat('he-IL', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Jerusalem',
  }).format(new Date(ms));
}

/**
 * Prefer absolute calendar date from datePublished when the stored display
 * string is missing or a frozen relative snapshot.
 */
export function resolveBlogDateDisplay(
  datePublished: string | undefined | null,
  dateDisplay: string | undefined | null
): string {
  if (isFrozenRelativeDate(dateDisplay) || !dateDisplay) {
    return formatBlogDateDisplay(datePublished) || dateDisplay || '';
  }
  return dateDisplay;
}
