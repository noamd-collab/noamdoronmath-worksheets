/**
 * Real `lastmod` dates for /sitemap-pages.xml, from the bundled page JSON only
 * (static imports — Worker-safe, no filesystem, never the request date).
 *
 * - Topic pages: the visible "עודכן D.M.YYYY" line, else the capture date.
 * - Grade hubs: capture date (fetchedAt).
 * - Site pages: source.capturedAt.
 * Paths with no recorded date (home, /worksheets) get no lastmod at all.
 */
import { loadAllGradeHubs } from './gradeHubs';
import { SITE_PAGE_M24_SLUGS, loadSitePage } from './sitePages';
import { loadAllTopicPages } from './topicPages';

const ISO_DAY = /^\d{4}-\d{2}-\d{2}/;

/** "נועם דורון מתמטיקה · עודכן 12.9.2026" → "2026-09-12". */
export function dayFromUpdatedLine(line: string | null | undefined): string | null {
  const m = (line || '').match(/עודכן\s+(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (!m) return null;
  const [, d, mo, y] = m;
  return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

function isoDay(value: string | null | undefined): string | null {
  const m = (value || '').match(ISO_DAY);
  return m ? m[0] : null;
}

let cache: Map<string, string> | null = null;

export function pageLastmodMap(): Map<string, string> {
  if (cache) return cache;
  const map = new Map<string, string>();
  for (const page of loadAllTopicPages()) {
    const day = dayFromUpdatedLine(page.updatedLine) ?? isoDay(page.fetchedAt);
    if (day) map.set(page.path, day);
  }
  for (const hub of loadAllGradeHubs()) {
    const day = isoDay(hub.fetchedAt);
    if (day) map.set(hub.path, day);
  }
  for (const slug of SITE_PAGE_M24_SLUGS) {
    const day = isoDay(loadSitePage(slug).source?.capturedAt);
    if (day) map.set(`/${slug}`, day);
  }
  cache = map;
  return map;
}

export function pageLastmod(path: string): string | null {
  return pageLastmodMap().get(path) ?? null;
}

export function latestDay(days: Iterable<string | null | undefined>): string | null {
  let best: string | null = null;
  for (const day of days) if (day && (!best || day > best)) best = day;
  return best;
}
