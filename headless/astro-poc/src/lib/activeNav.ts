/**
 * HEADLESS-MIGRATION-37 — resolve which primary-nav section is current.
 *
 * Home is exact `/` only (never a prefix match). Legal / unrelated routes
 * return null so nothing is falsely highlighted.
 */
import {
  isGradeNum,
  parseLevelParam,
  schoolFamilyOf,
  type SchoolLevelParam,
} from './grades';
import { TOPIC_PAGE_SLUGS } from './topicPages';

export type ActiveNavKey =
  | 'home'
  | 'worksheets'
  | 'learning'
  | 'about'
  | 'blog'
  | 'tools'
  | 'highschool';

/** Which of the two worksheets nav items should be `aria-current`. */
export type WorksheetsNavBand = SchoolLevelParam;

const TOPIC_PATHS = new Set(TOPIC_PAGE_SLUGS.map((s) => `/${s}`));

/** Strip trailing slash except for root. */
export function normalizeNavPath(pathname: string): string {
  if (!pathname) return '/';
  let path = pathname;
  try {
    path = decodeURIComponent(pathname);
  } catch {
    path = pathname;
  }
  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
  return path || '/';
}

function bandFromGrade(n: number): WorksheetsNavBand {
  return schoolFamilyOf(n) === 'elementary' ? 'ysodi' : 'hatzava';
}

/**
 * Map a request pathname to the primary nav key, or null when no item
 * should be marked active (e.g. terms / accessibility).
 */
export function resolveActiveNav(pathname: string): ActiveNavKey | null {
  const path = normalizeNavPath(pathname);

  if (path === '/') return 'home';
  if (path === '/aboutus') return 'about';
  if (path === '/math-tools' || path === '/games/kefel-mekutsar-2') return 'tools';
  if (path === '/high-school-math' || path === '/high-school-math-1') {
    return 'highschool';
  }
  if (path === '/learning.html' || path === '/learning') return 'learning';

  if (path === '/worksheets' || /^\/grade-[1-9]$/.test(path)) {
    return 'worksheets';
  }
  if (TOPIC_PATHS.has(path) || path === '/equations-grade-7') {
    return 'worksheets';
  }
  // Viewer is catalog-adjacent but not a primary nav destination — no highlight
  if (path === '/worksheet-viewer-noam.html') return null;

  if (path === '/blog' || path.startsWith('/blog/') || path.startsWith('/post/')) {
    return 'blog';
  }

  // Legal / policy / other site pages — do not fake "home"
  return null;
}

/**
 * Which worksheets band link is current. At most one of ysodi / hatzava.
 * Prefer explicit `?grade=`, then `?level=`, then `/grade-N` / `*-grade-N` path;
 * bare `/worksheets` defaults to hatzava (catalog default grade 7).
 */
export function resolveWorksheetsNavBand(
  pathname: string,
  searchParams?: URLSearchParams | null
): WorksheetsNavBand | null {
  if (resolveActiveNav(pathname) !== 'worksheets') return null;

  const params = searchParams ?? new URLSearchParams();
  const gradeRaw = params.get('grade');
  if (gradeRaw != null && /^[1-9]$/.test(gradeRaw) && isGradeNum(Number(gradeRaw))) {
    return bandFromGrade(Number(gradeRaw));
  }

  const level = parseLevelParam(params.get('level'));
  if (level) return level;

  const path = normalizeNavPath(pathname);
  const hub = path.match(/^\/grade-([1-9])$/);
  if (hub) return bandFromGrade(Number(hub[1]));

  const topicGrade = path.match(/-grade-([1-9])$/);
  if (topicGrade) return bandFromGrade(Number(topicGrade[1]));

  if (path === '/worksheets') return 'hatzava';
  return null;
}
