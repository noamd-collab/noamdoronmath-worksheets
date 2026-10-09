/**
 * Blog SEO complement: image dimensions only.
 * BaseLayout owns title, description, canonical, robots, and social tags.
 * Wix copies of those tags are removed by stripWixSeoDupes.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { buildBlogSeoComplement } from '../src/lib/blogSeo';
import { listServedBlogPosts, loadBlogPostByPath } from '../src/lib/blogPosts';
import { listBlogArchives } from '../src/lib/blogArchives';
import { buildSocialMeta } from '../src/lib/siteSeo';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const keys = (tags: Array<{ property?: string; name?: string }>) => tags.map((t) => (t.property || t.name)!);
const baseLayoutTags = (image?: string) =>
  keys(buildSocialMeta({ title: 't', description: 'd', url: 'https://www.noamdoronmath.co.il/post/x', image }));

const HEBREW = '/post/%D7%AA%D7%A8%D7%92%D7%99%D7%9C%D7%99-%D7%97%D7%99%D7%91%D7%95%D7%A8-%D7%95%D7%97%D7%99%D7%A1%D7%95%D7%A8-%D7%9C%D7%9B%D7%99%D7%AA%D7%94-%D7%90-%D7%9C%D7%AA%D7%A8%D7%92%D7%95%D7%9C-%D7%A0%D7%9B%D7%95%D7%9F-%D7%91%D7%91%D7%99%D7%AA';

describe('blog SEO complement', () => {
  it('Hebrew post with an image: stored dimensions only (social tags are in BaseLayout)', () => {
    const p = loadBlogPostByPath(HEBREW)!;
    const img = p.ogImage || p.coverImage;
    assert.ok(img);
    const tags = buildBlogSeoComplement({ description: p.description, image: img, jsonLd: p.jsonLd });
    assert.deepEqual(keys(tags), ['og:image:width', 'og:image:height']);
    const stored = (p.jsonLd as Array<{ image?: { width?: string; height?: string } }>)?.[0]?.image;
    assert.equal(tags[0].content, stored?.width);
    assert.equal(tags[1].content, stored?.height);
  });

  it('Latin post without an image: complement adds nothing', () => {
    const p = loadBlogPostByPath('/post/annual-review-grade-7')!;
    assert.equal(p.ogImage || p.coverImage, undefined);
    assert.deepEqual(
      keys(buildBlogSeoComplement({ description: p.description, image: undefined, jsonLd: p.jsonLd })),
      [],
    );
  });

  it('never emits canonical, og:url, og:type, og:title or twitter:title (Wix owns them)', () => {
    for (const p of listServedBlogPosts()) {
      const k = keys(buildBlogSeoComplement({ description: p.description, image: p.ogImage || p.coverImage, jsonLd: p.jsonLd }));
      for (const owned of ['canonical', 'og:url', 'og:type', 'og:title', 'twitter:title', 'og:site_name', 'twitter:card']) assert.ok(!k.includes(owned), `${p.fileSlug}: ${owned}`);
    }
  });

  it('all 60 posts + 4 archives: complement does not duplicate BaseLayout social tags', () => {
    const pages = [
      ...listServedBlogPosts().map((p) => ({ id: p.fileSlug, description: p.description, image: p.ogImage || p.coverImage, jsonLd: p.jsonLd })),
      ...listBlogArchives().map((a) => ({ id: a.path, description: a.description, image: a.ogImage, jsonLd: a.jsonLd })),
    ];
    assert.equal(pages.length, 64);
    for (const pg of pages) {
      const layout = baseLayoutTags(pg.image);
      const extra = keys(buildBlogSeoComplement({ description: pg.description, image: pg.image, jsonLd: pg.jsonLd }));
      const all = [...layout, ...extra];
      const counts = all.reduce<Record<string, number>>((m, t) => ((m[t] = (m[t] || 0) + 1), m), {});
      for (const [t, n] of Object.entries(counts)) assert.equal(n, 1, `${pg.id}: ${t} x${n}`);
      assert.equal(counts['twitter:description'], 1, pg.id);
      assert.equal(counts['og:description'], 1, pg.id);
      assert.equal(counts['og:url'], 1, pg.id);
      assert.equal(counts['twitter:title'], 1, pg.id);
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
      [],
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
    assert.deepEqual(keys(skipped), []);
    assert.ok(!keys(skipped).includes('og:image:width'), 'JSON has no image dimensions; skipped');
    assert.ok(!keys(skipped).includes('og:image:height'), 'JSON has no image dimensions; skipped');

    const stored = buildBlogSeoComplement({
      description: 'x',
      image: url,
      jsonLd: [{ image: { '@type': 'ImageObject', url, width: '1536', height: '1024' } }],
    });
    assert.deepEqual(keys(stored), ['og:image:width', 'og:image:height']);
    assert.equal(stored[0].content, '1536');
    assert.equal(stored[1].content, '1024');
  });

  it('archive with an image URL but no stored dimensions skips og:image width and height', () => {
    const archive = listBlogArchives().find((a) => a.ogImage);
    assert.ok(archive?.ogImage);
    assert.match(archive.ogImage, /w_\d+,h_\d+/);
    assert.equal(archive.jsonLd, undefined);
    const tags = keys(buildBlogSeoComplement({ description: archive.description, image: archive.ogImage, jsonLd: archive.jsonLd }));
    assert.ok(!tags.includes('og:image:width'), `${archive.path}: JSON has no image dimensions; skipped`);
    assert.ok(!tags.includes('og:image:height'), `${archive.path}: JSON has no image dimensions; skipped`);
    for (const owned of baseLayoutTags(archive.ogImage)) {
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
