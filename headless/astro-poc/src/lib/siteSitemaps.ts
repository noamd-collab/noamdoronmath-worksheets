/**
 * Site page + index sitemaps for Headless cut-over.
 *
 * Cloudflare / Wix Workers have no `src/pages` tree. The route must pass Vite
 * `import.meta.glob` keys — never read the pages directory from disk here
 * (even as a fallback), or the Worker chunk may fail to load.
 */
import redirectsMap from '../data/redirects.json';
import { BLOG_SITEMAP_PATH } from './blogSitemap';
import { REDIRECT_RULES } from './redirects';
import { SITE_CANONICAL_ORIGIN } from './siteSeo';

const SKIP_SLUGS = new Set(['404', 'index', 'learning']);

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

export function renderPagesSitemapXml(pageModuleKeys: readonly string[]): string {
  const today = new Date().toISOString().slice(0, 10);
  const urls = listMainPagePaths(pageModuleKeys)
    .map(
      (path) =>
        `  <url><loc>${SITE_CANONICAL_ORIGIN}${path === '/' ? '/' : path}</loc><lastmod>${today}</lastmod></url>`
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

export function renderSitemapIndexXml(): string {
  const today = new Date().toISOString().slice(0, 10);
  const children = ['/sitemap-pages.xml', BLOG_SITEMAP_PATH];
  const body = children
    .map(
      (p) =>
        `  <sitemap><loc>${SITE_CANONICAL_ORIGIN}${p}</loc><lastmod>${today}</lastmod></sitemap>`
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</sitemapindex>\n`;
}
