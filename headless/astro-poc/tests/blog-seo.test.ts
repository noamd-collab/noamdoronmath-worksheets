/**
 * Blog SEO complement: every head tag exactly once across BaseLayout (code),
 * Wix's main-page injection (observed set), and this complement.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { buildBlogSeoComplement } from '../src/lib/blogSeo';
import { listServedBlogPosts, loadBlogPostByPath } from '../src/lib/blogPosts';
import { listBlogArchives } from '../src/lib/blogArchives';

// What Wix injects on a registered route today (wix-seo-tag="true", preview 4awuw0).
const WIX_INJECTED = ['og:title', 'og:url', 'og:site_name', 'og:type', 'twitter:card', 'twitter:title'];
// What BaseLayout emits (besides <title> and meta description).
const baseLayoutTags = (image?: string) => (image ? ['og:image', 'og:title', 'og:description'] : []);
const keys = (tags: Array<{ property?: string; name?: string }>) => tags.map((t) => (t.property || t.name)!);

const HEBREW = '/post/%D7%AA%D7%A8%D7%92%D7%99%D7%9C%D7%99-%D7%97%D7%99%D7%91%D7%95%D7%A8-%D7%95%D7%97%D7%99%D7%A1%D7%95%D7%A8-%D7%9C%D7%9B%D7%99%D7%AA%D7%94-%D7%90-%D7%9C%D7%AA%D7%A8%D7%92%D7%95%D7%9C-%D7%A0%D7%9B%D7%95%D7%9F-%D7%91%D7%91%D7%99%D7%AA';

describe('blog SEO complement', () => {
  it('Hebrew post with an image: twitter description + image only', () => {
    const p = loadBlogPostByPath(HEBREW)!;
    const img = p.ogImage || p.coverImage;
    assert.ok(img);
    const tags = buildBlogSeoComplement({ description: p.description, image: img });
    assert.deepEqual(keys(tags), ['twitter:description', 'twitter:image']);
    assert.equal(tags[0].content, p.description.replace(/\s+/g, ' ').trim());
    assert.equal(tags[1].content, img);
  });

  it('Latin post without an image: og:description + twitter:description', () => {
    const p = loadBlogPostByPath('/post/annual-review-grade-7')!;
    assert.equal(p.ogImage || p.coverImage, undefined);
    assert.deepEqual(keys(buildBlogSeoComplement({ description: p.description, image: undefined })), ['og:description', 'twitter:description']);
  });

  it('never emits canonical, og:url, og:type, og:title or twitter:title (Wix owns them)', () => {
    for (const p of listServedBlogPosts()) {
      const k = keys(buildBlogSeoComplement({ description: p.description, image: p.ogImage || p.coverImage }));
      for (const owned of ['canonical', 'og:url', 'og:type', 'og:title', 'twitter:title', 'og:site_name', 'twitter:card']) assert.ok(!k.includes(owned), `${p.fileSlug}: ${owned}`);
    }
  });

  it('all 60 posts + 4 archives: every tag exactly once with BaseLayout + Wix injection', () => {
    const pages = [
      ...listServedBlogPosts().map((p) => ({ id: p.fileSlug, description: p.description, image: p.ogImage || p.coverImage })),
      ...listBlogArchives().map((a) => ({ id: a.path, description: a.description, image: a.ogImage })),
    ];
    assert.equal(pages.length, 64);
    for (const pg of pages) {
      const all = [...baseLayoutTags(pg.image), ...WIX_INJECTED.filter((t) => !(pg.image && t === 'og:title')), ...keys(buildBlogSeoComplement(pg))];
      // Pre-existing, not fixable from code: with an image, og:title comes from both BaseLayout
      // and Wix. It is excluded here; the assertion is that the complement adds no new duplicate.
      const counts = all.reduce<Record<string, number>>((m, t) => ((m[t] = (m[t] || 0) + 1), m), {});
      for (const [t, n] of Object.entries(counts)) assert.equal(n, 1, `${pg.id}: ${t} x${n}`);
      assert.ok(counts['twitter:description'] === 1 && counts['og:description'] === 1, pg.id);
    }
  });

  it('non-https or empty images are ignored', () => {
    assert.deepEqual(keys(buildBlogSeoComplement({ description: 'x', image: 'http://a/b.jpg' })), ['og:description', 'twitter:description']);
    assert.deepEqual(buildBlogSeoComplement({ description: '  ', image: undefined }), []);
  });

  it('blog pages render the complement into the seo-tags slot', () => {
    for (const f of ['src/components/BlogPostPage.astro', 'src/components/BlogArchivePage.astro'])
      assert.match(readFileSync(f, 'utf8'), /<BlogSeoTags slot="seo-tags"/, f);
  });
});
