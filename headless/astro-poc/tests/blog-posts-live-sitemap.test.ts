/**
 * OPEN-07-FIX (live, network): every post in the live blog sitemap is served by the
 * candidate. The canonical Astro sitemap also contains the four archive routes.
 * Runs in the live-SSR suite only (`npm run test:live-ssr`).
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BLOG_POST_SERVED_PATHS } from '../src/lib/blogPosts';
import { BLOG_SITEMAP_ORIGIN, BLOG_SITEMAP_PATH, listBlogSitemapEntries } from '../src/lib/blogSitemap';
import { diffBlogSitemap, fetchBlogSitemap } from '../scripts/lib/blog-live-sitemap.mjs';
import { BLOG_ARCHIVE_M26_PATHS } from '../src/lib/blogArchives';

const norm = (p: string) => decodeURIComponent(p.replace(/^https:\/\/www\.noamdoronmath\.co\.il/, '')).replace(/\/$/, '');

describe('OPEN-07-FIX live blog sitemap parity', () => {
  it('the canonical live blog sitemap covers every served post and archive', async () => {
    // Wix reserves the old *-sitemap.xml route. The deployed sitemap index and
    // robots.txt point crawlers to /sitemap-blog.xml after the Astro migration.
    const sitemapUrl = BLOG_SITEMAP_ORIGIN + BLOG_SITEMAP_PATH;
    const index = await fetch(BLOG_SITEMAP_ORIGIN + '/sitemap-index.xml', { headers: { accept: 'application/xml' }, signal: AbortSignal.timeout(30000) });
    assert.equal(index.status, 200);
    assert.match(index.headers.get('content-type') || '', /(?:application|text)\/xml/i);
    const children = [...(await index.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    assert.ok(children.includes(sitemapUrl), 'The canonical blog sitemap must be advertised in the live index');
    const entries = await fetchBlogSitemap(sitemapUrl);
    const expected = listBlogSitemapEntries();
    assert.deepEqual(diffBlogSitemap(entries, expected), [], 'Paths and lastmod must match the current served sitemap');
    assert.equal(entries.length, expected.length);
    const paths = entries.map((entry) => entry.pathname);
    assert.equal(new Set(paths).size, paths.length, 'The sitemap must not contain duplicate paths');
    const live = paths.filter((path) => path.startsWith('/post/'));
    assert.deepEqual(paths.filter((path) => !path.startsWith('/post/')).sort(), [...BLOG_ARCHIVE_M26_PATHS].sort());
    assert.ok(live.length >= 60, `live sitemap has ${live.length} posts`);
    const served = new Set(BLOG_POST_SERVED_PATHS.map(norm));
    const missing = live.filter((p) => !served.has(p));
    const extra = [...served].filter((p) => !live.includes(p));
    assert.deepEqual({ missing, extra }, { missing: [], extra: [] });
    assert.equal(served.size, live.length);
  });
});
