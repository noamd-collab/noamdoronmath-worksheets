import { BLOG_ARCHIVE_SITEMAP_LASTMOD, listBlogArchives } from './blogArchives';
import { listServedBlogPosts } from './blogPosts';

/** Production origin. Never a preview host or the request host. */
export const BLOG_SITEMAP_ORIGIN = 'https://www.noamdoronmath.co.il';

/**
 * Served at /sitemap-blog.xml.
 * Must not be /sitemap.xml and must not end in -sitemap.xml (Wix reserves that suffix).
 */
export const BLOG_SITEMAP_PATH = '/sitemap-blog.xml';

export type BlogSitemapEntry = {
  loc: string;
  /** Post: UTC date of dateModified. Archive: BLOG_ARCHIVE_SITEMAP_LASTMOD. */
  lastmod: string;
};

function productionLoc(pathname: string): string {
  let path = pathname;
  try {
    path = decodeURIComponent(pathname);
  } catch {
    path = pathname;
  }
  if (!path.startsWith('/')) {
    throw new Error(`Blog sitemap path must be absolute: ${pathname}`);
  }
  return `${BLOG_SITEMAP_ORIGIN}${path}`;
}

/** Live sitemap lastmod values are YYYY-MM-DD and match dateModified's UTC date. */
export function lastmodFromDateModified(dateModified: string | undefined, path: string): string {
  const day = (dateModified || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    throw new Error(`Blog post ${path} is missing dateModified`);
  }
  return day;
}

function archiveLastmod(path: string): string {
  if (!Object.prototype.hasOwnProperty.call(BLOG_ARCHIVE_SITEMAP_LASTMOD, path)) {
    throw new Error(`Missing sitemap lastmod for archive ${path}`);
  }
  return BLOG_ARCHIVE_SITEMAP_LASTMOD[path as keyof typeof BLOG_ARCHIVE_SITEMAP_LASTMOD];
}

/**
 * 60 served posts plus the 4 archive routes.
 * Post paths are decoded so Hebrew slugs match the live sitemap strings.
 */
export function listBlogSitemapEntries(): BlogSitemapEntry[] {
  const archives = listBlogArchives().map((archive) => ({
    loc: productionLoc(archive.path),
    lastmod: archiveLastmod(archive.path),
  }));
  const posts = listServedBlogPosts().map((post) => ({
    loc: productionLoc(post.path),
    lastmod: lastmodFromDateModified(post.dateModified, post.path),
  }));
  return [...archives, ...posts];
}

function xmlEscape(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

/** Sitemap XML from the bundled blog JSON. Does not read the request URL. */
export function renderBlogSitemapXml(entries: BlogSitemapEntry[] = listBlogSitemapEntries()): string {
  const urls = entries
    .map((entry) => {
      const lastmod = entry.lastmod ? `\n<lastmod>${xmlEscape(entry.lastmod)}</lastmod>` : '';
      return `<url>\n<loc>${xmlEscape(entry.loc)}</loc>${lastmod}\n</url>`;
    })
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}
