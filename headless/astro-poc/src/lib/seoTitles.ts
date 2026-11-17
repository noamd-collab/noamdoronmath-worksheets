/**
 * Document titles: short Hebrew, without a repeated site name or an English slug.
 *
 * Re-applies the title part of PR #449 (cursor/seo-titles-sitemap-541d) on the
 * current baseline, with one deliberate difference: descriptors such as
 * 'דפי עבודה במתמטיקה' or 'דפי עבודה חינם' stay in the title, because they carry
 * the search term people type ('דף עבודה <נושא> כיתה <x>'). Only the site name,
 * which og:site_name and the Organization schema already carry, is removed.
 * The stale /angles-grade-7 override from #449 is not carried over: that URL
 * now answers 301 to /adjacent-vertical-angles-grade-7.
 */

const SITE_NAME = 'נועם דורון';

/**
 * Site-name tails that older title templates appended, longest first so a short
 * tail is never cut out of a longer one. The replacement keeps any descriptor
 * that followed the name ('… | נועם דורון - מתמטיקה דפי מתמטיקה בחינם').
 */
const SITE_NAME_TAILS: ReadonlyArray<readonly [tail: string, replacement: string]> = [
  [' | נועם דורון - מתמטיקה דפי מתמטיקה בחינם', ' | דפי מתמטיקה בחינם'],
  [' | נועם דורון מתמטיקה', ''],
  [' – נועם דורון מתמטיקה', ''],
  [' - נועם דורון מתמטיקה', ''],
  [' · נועם דורון מתמטיקה', ''],
  [' | נועם דורון', ''],
  [' – נועם דורון', ''],
  [' - נועם דורון', ''],
  [' · נועם דורון', ''],
];

const BRAND_ONLY = new Set([SITE_NAME, `${SITE_NAME} מתמטיקה`]);
const FALLBACK_TITLE = 'דפי עבודה במתמטיקה';

function isEnglishSlug(value: string): boolean {
  return /^(?=.*[A-Za-z])[A-Za-z0-9]+(?:-[A-Za-z0-9]+)+$/.test(value);
}

function hasHebrew(value: string): boolean {
  return /[\u0590-\u05FF]/.test(value);
}

function titleParts(title: string): string[] {
  return title
    .split(/\s*[|–—·]\s*|\s+-\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

/**
 * One short Hebrew document title. Drops a trailing site name (keeping any
 * descriptor after it) and any part that is an English page slug.
 */
export function shortHebrewTitle(title: string): string {
  const original = (title || '').replace(/\s+/g, ' ').trim();
  if (!original) return original;

  let text = original;
  let changed = true;
  while (changed) {
    changed = false;
    for (const [tail, replacement] of SITE_NAME_TAILS) {
      if (text.endsWith(tail) && text.length > tail.length) {
        text = (text.slice(0, -tail.length) + replacement).trim();
        changed = true;
      }
    }
  }

  const parts = titleParts(text);
  const kept = parts.filter((part) => !isEnglishSlug(part));
  if (kept.length !== parts.length) text = kept.join(' | ');
  text = text.replace(/\s*[|–—·-]+\s*$/u, '').trim();
  if (BRAND_ONLY.has(text)) text = '';

  if (!hasHebrew(text)) {
    text = titleParts(original)
      .filter((part) => hasHebrew(part) && !BRAND_ONLY.has(part))
      .join(' | ')
      .trim();
  }
  return text || FALLBACK_TITLE;
}

/**
 * Catalog title for /worksheets: the Hebrew topic when one is open, otherwise
 * the grade. Ships only together with the canonical in worksheetsSeo.ts, so a
 * topic title never turns a catalog URL into a rival of the topic landing page.
 */
export function worksheetsDocumentTitle(gradeLabel: string, topicTitle?: string | null): string {
  const grade = (gradeLabel || '').trim();
  const topic = (topicTitle || '').replace(/\s+/g, ' ').trim();
  if (topic && grade) return `${topic} · ${grade}`;
  if (grade) return `דפי עבודה · ${grade}`;
  return topic || 'דפי עבודה';
}
