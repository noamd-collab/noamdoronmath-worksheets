import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { SITE_CANONICAL_ORIGIN } from './siteSeo';
import { BLOG_SITEMAP_PATH } from './blogSitemap';

const SKIP = new Set(['404.astro', 'index.astro', 'learning.astro']);

export function listMainPagePaths(): string[] {
  const dir = join(process.cwd(), 'src/pages');
  const out = ['/'];
  for (const name of readdirSync(dir)) {
    if (!name.endsWith('.astro')) continue;
    if (SKIP.has(name) || name.startsWith('_')) continue;
    out.push('/' + name.replace(/\.astro$/, ''));
  }
  return out.sort();
}

export function renderPagesSitemapXml(): string {
  const today = new Date().toISOString().slice(0, 10);
  const urls = listMainPagePaths()
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
