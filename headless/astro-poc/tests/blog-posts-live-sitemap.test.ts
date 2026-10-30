/** Live parity of all served posts and archives against the owned sitemap route. */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BLOG_SITEMAP_ORIGIN, BLOG_SITEMAP_PATH, listBlogSitemapEntries } from '../src/lib/blogSitemap';
import { diffBlogSitemap, fetchBlogSitemap } from '../scripts/lib/blog-live-sitemap.mjs';

describe('live blog sitemap parity', () => {
  it('the current sitemap contains exactly the served posts and archive routes', async () => {
    const expected = listBlogSitemapEntries();
    assert.ok(expected.filter((entry) => new URL(entry.loc).pathname.startsWith('/post/')).length >= 60);
    const live = await fetchBlogSitemap(BLOG_SITEMAP_ORIGIN + BLOG_SITEMAP_PATH);
    assert.deepEqual(diffBlogSitemap(live, expected), []);
    assert.equal(live.length, expected.length);
  });
});
