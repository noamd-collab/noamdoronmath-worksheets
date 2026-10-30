/** Strict reader for this site's owned /sitemap-blog.xml contract. */
import { parseHTML } from 'linkedom';
import { PROD } from './blog-archive-ssr.mjs';

function canonicalPath(loc) {
  const url = new URL(loc);
  const pathname = decodeURIComponent(url.pathname).replace(/\/$/, '');
  if (url.origin !== PROD || url.username || url.password || url.search || url.hash ||
      !/^\/(?:post\/[^/]+|blog(?:\/categories\/[^/]+)?)$/.test(pathname)) {
    throw new Error(`Invalid blog sitemap location: ${loc}`);
  }
  return pathname;
}

export function parseBlogSitemap(xml) {
  const root = xml.trim().match(/^(?:<\?xml[^?]*\?>\s*)?<urlset\s+xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9"\s*>([\s\S]*)<\/urlset>$/);
  if (!root) throw new Error('Expected a complete sitemap urlset');
  const entries = [];
  const seen = new Set();
  const remaining = root[1].replace(/<url>\s*<loc>([^<]+)<\/loc>\s*<lastmod>(\d{4}-\d{2}-\d{2})<\/lastmod>\s*<\/url>/g,
    (_match, encodedLoc, lastmod) => {
      if (/&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/.test(encodedLoc)) {
        throw new Error('Invalid XML entity in sitemap location');
      }
      const loc = parseHTML(`<span>${encodedLoc}</span>`).document.querySelector('span').textContent;
      const pathname = canonicalPath(loc);
      if (seen.has(pathname)) throw new Error(`Duplicate sitemap location: ${pathname}`);
      seen.add(pathname);
      entries.push({ pathname, lastmod });
      return '';
    });
  if (remaining.trim() || !entries.length) throw new Error('Empty or malformed blog sitemap entries');
  return entries;
}

export function diffBlogSitemap(live, expected) {
  const issues = [];
  const want = new Map(expected.map((entry) => [canonicalPath(entry.loc), entry.lastmod]));
  const got = new Map(live.map((entry) => [entry.pathname, entry.lastmod]));
  if (!live.length || !expected.length) issues.push('Empty sitemap comparison');
  if (want.size !== expected.length || got.size !== live.length) issues.push('Duplicate sitemap entries');
  for (const [path, lastmod] of want) {
    if (!got.has(path)) issues.push(`Missing sitemap entry: ${path}`);
    else if (got.get(path) !== lastmod) issues.push(`Sitemap lastmod mismatch: ${path}`);
  }
  for (const path of got.keys()) if (!want.has(path)) issues.push(`Unexpected sitemap entry: ${path}`);
  return issues;
}

export async function fetchBlogSitemap(url, fetchPage = fetch) {
  const response = await fetchPage(url, {
    headers: { accept: 'application/xml' },
    signal: AbortSignal.timeout(30000),
  });
  if (response.status !== 200) {
    throw new Error(`HTTP ${response.status} fetching blog sitemap; retry-after=${response.headers.get('retry-after') || 'none'}`);
  }
  const contentType = response.headers.get('content-type') || '';
  if (!/^(?:application|text)\/xml\b/i.test(contentType)) throw new Error(`Expected XML, got ${contentType}`);
  return parseBlogSitemap(await response.text());
}
