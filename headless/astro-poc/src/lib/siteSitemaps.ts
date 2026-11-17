/**
 * Site page + index sitemaps for Headless cut-over.
 *
 * Cloudflare / Wix Workers have no `src/pages` tree. The route must pass Vite
 * `import.meta.glob` keys — never read the pages directory from disk here
 * (even as a fallback), or the Worker chunk may fail to load.
 *
 * lastmod is the page's own dateModified, never the build or request time.
 * A page with no known date gets no <lastmod> (the tag is optional, and a
 * wrong date teaches crawlers to ignore every lastmod on the site).
 */
import redirectsMap from '../data/redirects.json';
import { BLOG_SITEMAP_PATH, listBlogSitemapEntries } from './blogSitemap';
import { listGamePaths } from './eliyahuGames';
import { PUBLIC_LESSON_PATH } from './publicLesson';
import { PYTHAGORAS_GAME_PATH } from './pythagorasGame';
import { REDIRECT_RULES } from './redirects';
import { SITE_CANONICAL_ORIGIN } from './siteSeo';
import { topicPageDateModifiedByPath } from './topicPages';

/**
 * Non-public / noise slugs — never appear in /sitemap-pages.xml.
 */
const SKIP_SLUGS = new Set(['404', 'index', 'learning', 'dev-loops', 'search']);

export const PAGES_SITEMAP_PATH = '/sitemap-pages.xml';

export type PageSitemapEntry = {
  path: string;
  /** YYYY-MM-DD from the page data, or null when the page declares no date. */
  lastmod: string | null;
};

function excludePath(path: string): boolean {
  if (path !== '/' && REDIRECT_RULES.some((r) => r.from === path)) return true;
  const flagged = redirectsMap.flaggedDoNotAutoRedirect ?? [];
  if (flagged.some((r) => r.from === path)) return true;
  return false;
}

/** Turn `import.meta.glob('./*.astro')` keys (or `./file.astro` names) into URL paths. */
export function pathsFromAstroModuleKeys(moduleKeys: readonly string[]): string[] {
  const out = new Set<string>(['/']);
  for (const modulePath of moduleKeys) {
    const file = modulePath.split('/').pop() || '';
    if (!file.endsWith('.astro')) continue;
    const slug = file.replace(/\.astro$/, '');
    if (!slug || SKIP_SLUGS.has(slug) || slug.startsWith('_') || slug.includes('[')) continue;
    const path = `/${slug}`;
    if (!excludePath(path)) out.add(path);
  }
  return [...out].sort((a, b) => a.localeCompare(b));
}

/**
 * @param pageModuleKeys - keys from `import.meta.glob('./*.astro')` in the route
 *   (required). Unit tests pass the same shape built from a local readdir.
 */
export function listMainPagePaths(pageModuleKeys: readonly string[]): string[] {
  if (!pageModuleKeys.length) {
    throw new Error('listMainPagePaths requires Vite glob module keys (no filesystem on Workers)');
  }
  const paths = pathsFromAstroModuleKeys(pageModuleKeys);
  // Nested routes are outside the top-level pages glob. /math-tools is in that
  // glob; the public lesson lives under it in the menu, so it is listed too.
  if (!paths.includes(PUBLIC_LESSON_PATH)) paths.push(PUBLIC_LESSON_PATH);
  if (!paths.includes(PYTHAGORAS_GAME_PATH)) paths.push(PYTHAGORAS_GAME_PATH);
  // The games corner and every engine game live under /games/**, also nested.
  for (const gamePath of listGamePaths()) {
    if (!paths.includes(gamePath)) paths.push(gamePath);
  }
  return paths.sort((a, b) => a.localeCompare(b));
}

/**
 * Real page dates the pages sitemap can use, keyed by path. Today these are
 * the topic pages with a visible "עודכן D.M.YYYY" line (the JSON-LD
 * dateModified). Redirect sources are never listed, so they are dropped.
 */
function pageDateModifiedByPath(): Map<string, string> {
  const out = new Map<string, string>();
  for (const [path, date] of topicPageDateModifiedByPath()) {
    if (!excludePath(path)) out.set(path, date);
  }
  return out;
}

/** Newest YYYY-MM-DD in the list, or null when none is a date. */
export function newestLastmod(values: readonly (string | null | undefined)[]): string | null {
  let newest: string | null = null;
  for (const value of values) {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) continue;
    if (newest === null || value > newest) newest = value;
  }
  return newest;
}

export function listPagesSitemapEntries(pageModuleKeys: readonly string[]): PageSitemapEntry[] {
  const dates = pageDateModifiedByPath();
  return listMainPagePaths(pageModuleKeys).map((path) => ({
    path,
    lastmod: dates.get(path) ?? null,
  }));
}

function lastmodTag(lastmod: string | null): string {
  return lastmod ? `<lastmod>${lastmod}</lastmod>` : '';
}

export function renderPagesSitemapXml(pageModuleKeys: readonly string[]): string {
  const urls = listPagesSitemapEntries(pageModuleKeys)
    .map(
      ({ path, lastmod }) =>
        `  <url><loc>${SITE_CANONICAL_ORIGIN}${path === '/' ? '/' : path}</loc>${lastmodTag(lastmod)}</url>`
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

/**
 * Each child's lastmod is the newest lastmod inside that child sitemap.
 * The routes call this without glob keys, so the pages child uses every
 * dated topic page. tests/site-sitemaps.test.ts checks that this equals the
 * newest date in /sitemap-pages.xml.
 */
export function renderSitemapIndexXml(): string {
  const children = [
    { path: PAGES_SITEMAP_PATH, lastmod: newestLastmod([...pageDateModifiedByPath().values()]) },
    { path: BLOG_SITEMAP_PATH, lastmod: newestLastmod(listBlogSitemapEntries().map((e) => e.lastmod)) },
  ];
  const body = children
    .map(
      ({ path, lastmod }) =>
        `  <sitemap><loc>${SITE_CANONICAL_ORIGIN}${path}</loc>${lastmodTag(lastmod)}</sitemap>`
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</sitemapindex>\n`;
}
