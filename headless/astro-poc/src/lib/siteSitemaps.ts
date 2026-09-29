/**
 * Site page + index sitemaps for Headless cut-over.
 *
 * Cloudflare / Wix Workers have no `src/pages` tree. The route must pass Vite
 * `import.meta.glob` keys — never read the pages directory from disk here
 * (even as a fallback), or the Worker chunk may fail to load.
 */
import redirectsMap from '../data/redirects.json';
import { BLOG_SITEMAP_PATH, listBlogSitemapEntries } from './blogSitemap';
import { latestDay, pageLastmod, pageLastmodMap } from './pageLastmod';
import { REDIRECT_RULES } from './redirects';
import { SITE_CANONICAL_ORIGIN } from './siteSeo';

/** Non-public / noise slugs — never appear in /sitemap-pages.xml. */
const SKIP_SLUGS = new Set(['404', 'index', 'learning', 'dev-loops']);

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
  return pathsFromAstroModuleKeys(pageModuleKeys);
}

const lastmodTag = (day: string | null) => (day ? `<lastmod>${day}</lastmod>` : '');

/** lastmod comes from the page JSON (lib/pageLastmod.ts); omitted when unknown, never "today". */
export function renderPagesSitemapXml(pageModuleKeys: readonly string[]): string {
  const urls = listMainPagePaths(pageModuleKeys)
    .map(
      (path) =>
        `  <url><loc>${SITE_CANONICAL_ORIGIN}${path === '/' ? '/' : path}</loc>${lastmodTag(pageLastmod(path))}</url>`
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

/** Each child's lastmod is the newest lastmod inside it. */
export function renderSitemapIndexXml(): string {
  const children: Array<[string, string | null]> = [
    ['/sitemap-pages.xml', latestDay(pageLastmodMap().values())],
    [BLOG_SITEMAP_PATH, latestDay(listBlogSitemapEntries().map((e) => e.lastmod))],
  ];
  const body = children
    .map(
      ([p, day]) => `  <sitemap><loc>${SITE_CANONICAL_ORIGIN}${p}</loc>${lastmodTag(day)}</sitemap>`
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</sitemapindex>\n`;
}
