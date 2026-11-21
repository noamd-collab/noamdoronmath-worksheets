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

/**
 * A real page slug: lowercase a-z and digits joined by single hyphens, at least
 * one hyphen and one letter, no spaces (every match also fits the repo's slug
 * pattern /^[a-z0-9-]+$/). 'triangle-area-grade-7' is a slug; 'COVID-19',
 * 'Wi-Fi' and '2024-2025' are not, so they stay in the title.
 */
function isEnglishSlug(value: string): boolean {
  return /^(?=[a-z0-9-]*[a-z])[a-z0-9]+(?:-[a-z0-9]+)+$/.test(value);
}

function hasHebrew(value: string): boolean {
  return /[\u0590-\u05FF]/.test(value);
}

/** Title separators: '|', '–', '—', '·' with any spacing, or a spaced hyphen. */
const TITLE_SEPARATOR = /(\s*[|–—·]\s*|\s+-\s+)/;

function titleParts(title: string): string[] {
  return title
    .split(TITLE_SEPARATOR)
    .filter((_, index) => index % 2 === 0)
    .map((part) => part.trim())
    .filter(Boolean);
}

/**
 * Keeps only the title parts that pass `keep`, each with the separator that
 * originally stood before it ('·', '–', '|', …). A dropped part takes its own
 * leading separator with it; the first kept part loses its leading one.
 * Returns the text unchanged when no non-empty part is dropped.
 */
function keepTitleParts(title: string, keep: (part: string) => boolean): string {
  const tokens = title.split(TITLE_SEPARATOR);
  const parts: Array<{ separator: string; text: string }> = [];
  let dropped = false;
  for (let index = 0; index < tokens.length; index += 2) {
    const text = tokens[index].trim();
    if (!text) continue;
    if (!keep(text)) {
      dropped = true;
      continue;
    }
    parts.push({ separator: index > 0 ? tokens[index - 1] : '', text });
  }
  if (!dropped) return title;
  return parts.map((part, index) => (index === 0 ? part.text : part.separator + part.text)).join('').trim();
}

/**
 * One short Hebrew document title. Drops a trailing site name (keeping any
 * descriptor after it) and any part that is an English page slug; the parts
 * that remain keep their original separators.
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

  text = keepTitleParts(text, (part) => !isEnglishSlug(part));
  text = text.replace(/\s*[|–—·-]+\s*$/u, '').trim();
  if (BRAND_ONLY.has(text)) text = '';

  if (!hasHebrew(text)) {
    const hebrewParts = titleParts(original).filter((part) => hasHebrew(part) && !BRAND_ONLY.has(part));
    text = hebrewParts.length
      ? keepTitleParts(original, (part) => hasHebrew(part) && !BRAND_ONLY.has(part))
      : '';
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
