/**
 * Reading time as captured from the old Wix blog ("זמן קריאה 4 דקות").
 * One minute reads "זמן קריאה דקה אחת", never "1 דקות".
 */
export function readingTimeLabel(stored: string | undefined | null): string | null {
  const text = (stored || '').trim();
  if (!text) return null;
  return text.replace(/(^|\s)1 דקות(?=$|\s|[.,])/u, '$1דקה אחת');
}
