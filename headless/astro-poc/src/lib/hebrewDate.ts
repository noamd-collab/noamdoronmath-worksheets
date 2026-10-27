/**
 * Calendar dates for visible Hebrew copy, e.g. "20 בספטמבר 2026".
 * Uses Israel's calendar day; falls back to the UTC day if the runtime has no
 * time-zone data. No locale data needed for the month names.
 */
const HEBREW_MONTHS = [
  'בינואר',
  'בפברואר',
  'במרץ',
  'באפריל',
  'במאי',
  'ביוני',
  'ביולי',
  'באוגוסט',
  'בספטמבר',
  'באוקטובר',
  'בנובמבר',
  'בדצמבר',
];

export function hebrewDateLabel(iso: string | undefined | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  let year = date.getUTCFullYear();
  let month = date.getUTCMonth();
  let day = date.getUTCDate();
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Jerusalem',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    }).formatToParts(date);
    const part = (type: string) => Number(parts.find((p) => p.type === type)?.value);
    if (part('year') && part('month') && part('day')) {
      year = part('year');
      month = part('month') - 1;
      day = part('day');
    }
  } catch {
    // Keep the UTC day.
  }
  return `${day} ${HEBREW_MONTHS[month]} ${year}`;
}

/**
 * Visible date for a blog post. The stored dateDisplay was copied from the old
 * Wix blog at capture time ("לפני 4 ימים"), so relative values go stale; the
 * absolute date comes from datePublished instead.
 */
export function blogPostDateLabel(post: { datePublished?: string; dateDisplay?: string }): string | null {
  const fromIso = hebrewDateLabel(post.datePublished);
  if (fromIso) return fromIso;
  const stored = (post.dateDisplay || '').trim();
  if (!stored || stored.startsWith('לפני')) return null;
  return stored;
}
