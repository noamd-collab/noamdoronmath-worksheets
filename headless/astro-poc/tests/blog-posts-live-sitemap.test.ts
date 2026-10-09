/**
 * OPEN-07-FIX (live, network): every post in the live blog sitemap is served by the
 * POC. The 8 classic-gap posts may be ahead of the published sitemap until release.
 * Runs in the live-SSR suite only (`npm run test:live-ssr`).
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BLOG_POST_CLASSIC_GAP_PATHS, BLOG_POST_SERVED_PATHS } from '../src/lib/blogPosts';

const norm = (p: string) => decodeURIComponent(p.replace(/^https:\/\/www\.noamdoronmath\.co\.il/, '')).replace(/\/$/, '');

describe('OPEN-07-FIX live blog sitemap parity', () => {
  it('served posts cover blog-posts-sitemap.xml', async () => {
    const res = await fetch('https://www.noamdoronmath.co.il/blog-posts-sitemap.xml', { headers: { accept: 'application/xml' } });
    assert.equal(res.status, 200);
    const live = [...(await res.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => norm(m[1]));
    assert.ok(live.length >= 60, `live sitemap has ${live.length} posts`);
    const served = new Set(BLOG_POST_SERVED_PATHS.map(norm));
    const allowedAhead = new Set(BLOG_POST_CLASSIC_GAP_PATHS.map(norm));
    const missing = live.filter((p) => !served.has(p));
    const extra = [...served].filter((p) => !live.includes(p));
    const unexpected = extra.filter((p) => !allowedAhead.has(p));
    assert.deepEqual({ missing, unexpected }, { missing: [], unexpected: [] });
    assert.equal(served.size, live.length + extra.length);
  });
});
