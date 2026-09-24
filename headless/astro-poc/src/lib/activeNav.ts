/**
 * HEADLESS-MIGRATION-37 — resolve which primary-nav section is current.
 *
 * Home is exact `/` only (never a prefix match). Legal / unrelated routes
 * return null so nothing is falsely highlighted.
 */
import { TOPIC_PAGE_SLUGS } from './topicPages';

export type ActiveNavKey =
  | 'home'
  | 'worksheets'
  | 'learning'
  | 'about'
  | 'blog'
  | 'tools'
  | 'highschool';

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

/**
 * Map a request pathname to the primary nav key, or null when no item
 * should be marked active (e.g. terms / accessibility).
 */
export function resolveActiveNav(pathname: string): ActiveNavKey | null {
  const path = normalizeNavPath(pathname);

  if (path === '/') return 'home';
  if (path === '/aboutus') return 'about';
  if (path === '/math-tools') return 'tools';
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
