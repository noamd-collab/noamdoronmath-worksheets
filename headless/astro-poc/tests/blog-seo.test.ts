/**
 * Blog SEO complement: every head tag exactly once across BaseLayout (code),
 * Wix's main-page injection (observed set), and this complement.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { buildBlogSeoComplement } from '../src/lib/blogSeo';
import { listServedBlogPosts, loadBlogPostByPath } from '../src/lib/blogPosts';
import { listBlogArchives } from '../src/lib/blogArchives';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// What Wix injects on a registered route today (wix-seo-tag="true", preview 4awuw0).
const WIX_INJECTED = ['og:title', 'og:url', 'og:site_name', 'og:type', 'twitter:card', 'twitter:title'];
// What BaseLayout emits (besides <title> and meta description).
const baseLayoutTags = (image?: string) => (image ? ['og:image', 'og:title', 'og:description'] : []);
const keys = (tags: Array<{ property?: string; name?: string }>) => tags.map((t) => (t.property || t.name)!);

const HEBREW = '/post/%D7%AA%D7%A8%D7%92%D7%99%D7%9C%D7%99-%D7%97%D7%99%D7%91%D7%95%D7%A8-%D7%95%D7%97%D7%99%D7%A1%D7%95%D7%A8-%D7%9C%D7%9B%D7%99%D7%AA%D7%94-%D7%90-%D7%9C%D7%AA%D7%A8%D7%92%D7%95%D7%9C-%D7%A0%D7%9B%D7%95%D7%9F-%D7%91%D7%91%D7%99%D7%AA';

describe('blog SEO complement', () => {
  it('Hebrew post with an image: twitter description + image, plus stored dimensions', () => {
    const p = loadBlogPostByPath(HEBREW)!;
    const img = p.ogImage || p.coverImage;
    assert.ok(img);
    const tags = buildBlogSeoComplement({ description: p.description, image: img, jsonLd: p.jsonLd });
    assert.deepEqual(keys(tags), ['twitter:description', 'twitter:image', 'og:image:width', 'og:image:height']);
    assert.equal(tags[0].content, p.description.replace(/\s+/g, ' ').trim());
    assert.equal(tags[1].content, img);
    const stored = (p.jsonLd as Array<{ image?: { width?: string; height?: string } }>)?.[0]?.image;
    assert.equal(tags[2].content, stored?.width);
    assert.equal(tags[3].content, stored?.height);
  });

  it('Latin post without an image: og:description + twitter:description', () => {
    const p = loadBlogPostByPath('/post/annual-review-grade-7')!;
    assert.equal(p.ogImage || p.coverImage, undefined);
    assert.deepEqual(
      keys(buildBlogSeoComplement({ description: p.description, image: undefined, jsonLd: p.jsonLd })),
      ['og:description', 'twitter:description'],
    );
  });

  it('never emits canonical, og:url, og:type, og:title or twitter:title (Wix owns them)', () => {
    for (const p of listServedBlogPosts()) {
      const k = keys(buildBlogSeoComplement({ description: p.description, image: p.ogImage || p.coverImage, jsonLd: p.jsonLd }));
      for (const owned of ['canonical', 'og:url', 'og:type', 'og:title', 'twitter:title', 'og:site_name', 'twitter:card']) assert.ok(!k.includes(owned), `${p.fileSlug}: ${owned}`);
    }
  });

  it('all 60 posts + 4 archives: every tag exactly once with BaseLayout + Wix injection', () => {
    const pages = [
      ...listServedBlogPosts().map((p) => ({ id: p.fileSlug, description: p.description, image: p.ogImage || p.coverImage, jsonLd: p.jsonLd })),
      ...listBlogArchives().map((a) => ({ id: a.path, description: a.description, image: a.ogImage, jsonLd: a.jsonLd })),
    ];
    assert.equal(pages.length, 64);
    for (const pg of pages) {
      const all = [
        ...baseLayoutTags(pg.image),
        ...WIX_INJECTED.filter((t) => !(pg.image && t === 'og:title')),
        ...keys(buildBlogSeoComplement({ description: pg.description, image: pg.image, jsonLd: pg.jsonLd })),
      ];
      // Pre-existing, not fixable from code: with an image, og:title comes from both BaseLayout
      // and Wix. It is excluded here; the assertion is that the complement adds no new duplicate.
      const counts = all.reduce<Record<string, number>>((m, t) => ((m[t] = (m[t] || 0) + 1), m), {});
      for (const [t, n] of Object.entries(counts)) assert.equal(n, 1, `${pg.id}: ${t} x${n}`);
      assert.ok(counts['twitter:description'] === 1 && counts['og:description'] === 1, pg.id);
    }
  });

  it('non-https or empty images are ignored', () => {
    assert.deepEqual(
      keys(
        buildBlogSeoComplement({
          description: 'x',
          image: 'http://a/b.jpg',
          jsonLd: [{ image: { url: 'http://a/b.jpg', width: '100', height: '80' } }],
        }),
      ),
      ['og:description', 'twitter:description'],
    );
    assert.deepEqual(buildBlogSeoComplement({ description: '  ', image: undefined }), []);
  });

  it('emits og:image width and height only from stored JSON, never from the URL', () => {
    const url = 'https://static.wixstatic.com/media/x/v1/fill/w_1000,h_667,al_c/x.webp';
    const skipped = buildBlogSeoComplement({
      description: 'x',
      image: url,
      jsonLd: [{ image: { '@type': 'ImageObject', url } }],
    });
    assert.deepEqual(keys(skipped), ['twitter:description', 'twitter:image']);
    assert.ok(!keys(skipped).includes('og:image:width'), 'JSON has no image dimensions; skipped');
    assert.ok(!keys(skipped).includes('og:image:height'), 'JSON has no image dimensions; skipped');

    const stored = buildBlogSeoComplement({
      description: 'x',
      image: url,
      jsonLd: [{ image: { '@type': 'ImageObject', url, width: '1536', height: '1024' } }],
    });
    assert.deepEqual(keys(stored), ['twitter:description', 'twitter:image', 'og:image:width', 'og:image:height']);
    assert.equal(stored[2].content, '1536');
    assert.equal(stored[3].content, '1024');
  });

  it('archive with an image URL but no stored dimensions skips og:image width and height', () => {
    const archive = listBlogArchives().find((a) => a.ogImage);
    assert.ok(archive?.ogImage);
    assert.match(archive.ogImage, /w_\d+,h_\d+/);
    assert.equal(archive.jsonLd, undefined);
    const tags = keys(buildBlogSeoComplement({ description: archive.description, image: archive.ogImage, jsonLd: archive.jsonLd }));
    assert.ok(!tags.includes('og:image:width'), `${archive.path}: JSON has no image dimensions; skipped`);
    assert.ok(!tags.includes('og:image:height'), `${archive.path}: JSON has no image dimensions; skipped`);
    for (const owned of [...baseLayoutTags(archive.ogImage), ...WIX_INJECTED]) {
      assert.ok(owned !== 'og:image:width' && owned !== 'og:image:height', owned);
    }
  });

  it('blog pages render the complement into the seo-tags slot', () => {
    for (const f of ['src/components/BlogPostPage.astro', 'src/components/BlogArchivePage.astro']) {
      const src = readFileSync(join(root, f), 'utf8');
      assert.match(src, /<BlogSeoTags slot="seo-tags"/, f);
      assert.match(src, /jsonLd=/, f);
    }
  });
});
