import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import {
  BLOG_POST_M25_PILOT_PATHS,
  BLOG_POST_SERVED_PATHS,
  BLOG_M25_DEFERRED,
  LIVE_CHROME_BASELINE,
  listPilotBlogPosts,
  loadBlogPostByPath,
  isPilotBlogPath,
  isLocallyServedPath,
  skimBlogBody,
  localizeBlogHref,
  expectedChromeFlags,
  collectBlogPostHrefs,
} from '../src/lib/blogPosts';
import { loadBlogArchiveByPath } from '../src/lib/blogArchives';

describe('M25 blog pilot', () => {
  it('selects exactly 8 pilot posts spanning feature clusters', () => {
    assert.equal(BLOG_POST_M25_PILOT_PATHS.length, 8);
    const posts = listPilotBlogPosts();
    assert.equal(posts.length, 8);
    const keys = new Set(posts.map((p) => p.featureKey));
    assert.equal(keys.size, 8, 'one distinct feature cluster per pilot');
  });

  it('defers 0 remaining posts after M29 (M30 closed topic gaps)', () => {
    assert.deepEqual([...BLOG_M25_DEFERRED], []);
    assert.equal(BLOG_POST_SERVED_PATHS.length, 60);
  });

  it('each pilot has title, description, h1, ordered body, author, schema', () => {
    for (const post of listPilotBlogPosts()) {
      assert.ok(post.title.length > 5, post.path);
      assert.ok(post.description.length > 10, post.path);
      assert.ok(post.h1.length > 2, post.path);
      assert.ok(post.blocks.length >= 3, post.path);
      assert.ok(post.author.length > 0, post.path);
      assert.ok(Array.isArray(post.jsonLd) && post.jsonLd.length >= 1, post.path);
      const types = JSON.stringify(post.jsonLd);
      assert.ok(/BlogPosting/.test(types), post.path);
      const paras = post.blocks.filter((b) => b.type === 'p');
      assert.ok(paras.length >= 1, post.path);
    }
  });

  it('preserves Wix Media image URLs when cover/body images exist', () => {
    let withWix = 0;
    for (const post of listPilotBlogPosts()) {
      if (post.coverImage && /wixstatic|wixmp|static\.wix/.test(post.coverImage)) withWix++;
      for (const b of post.blocks) {
        if ((b.type === 'img' || b.type === 'figure') && /wixstatic|wixmp/.test(b.src)) withWix++;
      }
    }
    assert.ok(withWix >= 5, `expected several Wix Media URLs, got ${withWix}`);
  });

  it('annual-review preserves author/editor, FAQ, WhatsApp, category, recent, reading time', () => {
    const post = loadBlogPostByPath('/post/annual-review-grade-7');
    assert.ok(post);
    const flags = expectedChromeFlags(post!);
    assert.deepEqual(flags, {
      readingTime: true,
      authorEditor: true,
      faq: true,
      whatsapp: true,
      postCategory: true,
      recentPosts: true,
    });
    assert.ok(post!.readingTime?.includes('זמן קריאה'));
    assert.ok(post!.authorEditor?.text.includes('נכתב ונערך'));
    assert.ok(/aboutus/.test(post!.authorEditor?.aboutHref || ''));
    assert.equal(post!.faq?.items.length, 3);
    assert.ok(post!.whatsapp?.ctaHref?.includes('whatsapp'));
    assert.equal(post!.postCategory?.text, 'חטיבת הביניים');
    assert.equal(post!.recentPosts?.items.length, 3);
    assert.ok(post!.recentPosts!.items.every((i) => (i.description || '').length > 20));
    assert.ok(post!.authorAvatar?.src);
    assert.ok(/תמונת הסופר/.test(post!.authorAvatar?.alt || ''));
    assert.ok(post!.related.some((r) => r.href.includes('grade-7')));
    assert.ok(post!.related.some((r) => r.href.includes('signed-numbers')));
  });

  it('fixtures match frozen live chrome baseline (no silently dropped sections)', () => {
    for (const post of listPilotBlogPosts()) {
      const baseline = LIVE_CHROME_BASELINE[post.fileSlug];
      assert.ok(baseline, `missing LIVE_CHROME_BASELINE for ${post.fileSlug}`);
      assert.deepEqual(
        expectedChromeFlags(post),
        baseline,
        `chrome flags drifted for ${post.fileSlug}`
      );
      if (baseline.readingTime) assert.ok(post.readingTime);
      if (baseline.authorEditor) {
        assert.ok(post.authorEditor?.text);
        assert.ok(/aboutus/.test(post.authorEditor?.aboutHref || ''));
      }
      if (baseline.faq) {
        assert.ok(post.faq?.items?.length);
        for (const item of post.faq!.items) {
          assert.ok(item.question.length > 5);
          assert.ok(item.answer.length > 5);
        }
      }
      if (baseline.whatsapp) {
        assert.ok(post.whatsapp?.heading);
        assert.ok(post.whatsapp?.body);
        assert.ok(post.whatsapp?.ctaHref?.includes('whatsapp'));
      }
      if (baseline.postCategory) {
        assert.ok(post.postCategory?.text);
        assert.ok(/blog\/categories/.test(post.postCategory?.href || ''));
      }
      if (baseline.recentPosts) {
        assert.ok(post.recentPosts?.items?.length >= 3);
        for (const item of post.recentPosts!.items) {
          assert.ok(item.title.length > 5);
          assert.ok(/\/post\//.test(item.href));
          // Descriptions appear on some live layouts (e.g. annual-review) but not all.
          if (item.description) assert.ok(item.description.length > 10, item.title);
        }
      }
    }
  });

  it('geometry post preserves HowTo + BlogPosting JSON-LD when present on source', () => {
    const post = listPilotBlogPosts().find((p) => p.h1.includes('גאומטריה'));
    assert.ok(post);
    const blob = JSON.stringify(post!.jsonLd);
    assert.ok(/BlogPosting/.test(blob));
    assert.ok(/HowTo/.test(blob));
  });

  it('body skim is ordered and includes H2 from long-body pilots', () => {
    const long = listPilotBlogPosts().find((p) => (p.featureKey || '').includes('long-body'));
    assert.ok(long);
    const skim = skimBlogBody(long!.blocks);
    assert.ok(skim.some((s) => s.startsWith('h2:')));
    assert.ok(skim.some((s) => s.startsWith('p:')));
  });

  it('resolves encoded and decoded post paths', () => {
    for (const path of BLOG_POST_M25_PILOT_PATHS) {
      assert.ok(isPilotBlogPath(path), path);
      assert.ok(loadBlogPostByPath(path), path);
      try {
        const decoded = decodeURIComponent(path);
        assert.ok(loadBlogPostByPath(decoded), decoded);
      } catch {
        /* ignore */
      }
    }
  });

  it('BlogPostPage template renders post chrome hooks (not generic related only)', () => {
    assert.ok(existsSync('src/components/BlogPostPage.astro'));
    assert.ok(existsSync('src/pages/post/[...slug].astro'));
    const tpl = readFileSync('src/components/BlogPostPage.astro', 'utf8');
    assert.ok(tpl.includes('data-blog-body'));
    assert.ok(tpl.includes('application/ld+json'));
    assert.ok(tpl.includes('data-blog-reading-time'));
    assert.ok(tpl.includes('data-blog-author-editor'));
    assert.ok(tpl.includes('data-blog-faq'));
    assert.ok(tpl.includes('data-blog-whatsapp'));
    assert.ok(tpl.includes('data-blog-category'));
    assert.ok(tpl.includes('data-blog-recent'));
    assert.ok(!tpl.includes('data-blog-related>') && !tpl.includes('data-blog-related"'));
    assert.ok(tpl.includes('data-blog-related-topics'));
    assert.ok(existsSync('scripts/lib/blog-chrome-extractor.js'));
    const capture = readFileSync('scripts/m25-capture-blog-posts.mjs', 'utf8');
    assert.ok(capture.includes('BLOG_CHROME_EXTRACTOR'));
    assert.ok(capture.includes('readingTime'));
    assert.ok(capture.includes('recentPosts'));
  });

  it('localizeBlogHref keeps unmigrated blog/post links on production', () => {
    assert.equal(localizeBlogHref('https://www.noamdoronmath.co.il/grade-7'), '/grade-7');
    assert.equal(
      localizeBlogHref('https://www.noamdoronmath.co.il/post/annual-review-grade-7'),
      '/post/annual-review-grade-7'
    );
    // M26: archives are locally served
    assert.equal(
      localizeBlogHref('https://www.noamdoronmath.co.il/blog/categories/elementary-math'),
      '/blog/categories/elementary-math'
    );
    assert.equal(localizeBlogHref('https://www.noamdoronmath.co.il/blog'), '/blog');
    // M30: formerly unmigrated topic SEO pages now localize
    assert.equal(
      localizeBlogHref('https://www.noamdoronmath.co.il/patterns-and-graphs-grade-7'),
      '/patterns-and-graphs-grade-7'
    );
    assert.equal(
      localizeBlogHref('https://www.noamdoronmath.co.il/equations-grade-7'),
      // OPEN-15: an old path is linked straight to its 301 target
      '/equations-basics-grade-7'
    );
    // All /post/* bodies are now served (M29)
    assert.equal(
      localizeBlogHref(
        'https://www.noamdoronmath.co.il/post/substitution-in-algebraic-expressions-grade-7'
      ),
      '/post/substitution-in-algebraic-expressions-grade-7'
    );
    assert.equal(
      localizeBlogHref(
        'https://www.noamdoronmath.co.il/post/simplify-then-solve-equations-grade-7'
      ),
      '/post/simplify-then-solve-equations-grade-7'
    );
    assert.equal(
      isLocallyServedPath('/post/substitution-in-algebraic-expressions-grade-7'),
      true
    );
    assert.equal(isLocallyServedPath('/signed-numbers-grade-7'), true);
    assert.ok(localizeBlogHref('https://noamd-collab.github.io/x').startsWith('https://'));
    assert.equal(
      localizeBlogHref('https://noamd-collab.github.io/noamdoronmath-worksheets/?grade=7&topic=2'),
      '/worksheets?grade=7&topic=2'
    );
    assert.equal(
      localizeBlogHref('http://noamd-collab.github.io/noamdoronmath-worksheets/?topic=31&grade=9'),
      '/worksheets?topic=31&grade=9'
    );
    assert.equal(
      localizeBlogHref('https://noamd-collab.github.io/noamdoronmath-worksheets/index.html?grade=8&topic=11#top'),
      '/worksheets?grade=8&topic=11#top'
    );
    assert.equal(
      localizeBlogHref('https://noamd-collab.github.io/noamdoronmath-worksheets/learning.html?code=abc'),
      'https://noamd-collab.github.io/noamdoronmath-worksheets/learning.html?code=abc'
    );
  });

  it('every href in all 8 pilots localizes only when the route is served', () => {
    for (const post of listPilotBlogPosts()) {
      for (const { where, href } of collectBlogPostHrefs(post)) {
        const out = localizeBlogHref(href);
        let path = '';
        try {
          path = new URL(href, 'https://www.noamdoronmath.co.il').pathname.replace(/\/$/, '') || '/';
        } catch {
          continue;
        }
        const own =
          /^https?:\/\/(www\.)?noamdoronmath\.co\.il/i.test(href) ||
          href.startsWith('/');
        if (!own) {
          if (/^https?:\/\/noamd-collab\.github\.io\/noamdoronmath-worksheets\/?(?:index\.html)?(?:[?#]|$)/i.test(href)) {
            assert.match(out, /^\/worksheets(?:[?#]|$)/, `${post.fileSlug} ${where} ${href} -> ${out}`);
          } else {
            assert.equal(out, href, `${post.fileSlug} ${where} external`);
          }
          continue;
        }
        if (isLocallyServedPath(path)) {
          assert.ok(
            out.startsWith('/') && !out.startsWith('//'),
            `${post.fileSlug} ${where}: expected local for served ${path}, got ${out}`
          );
        } else {
          assert.ok(
            out.startsWith('https://www.noamdoronmath.co.il'),
            `${post.fileSlug} ${where}: expected absolute prod for ${path}, got ${out}`
          );
          if (path.startsWith('/post/') && !isPilotBlogPath(path)) {
            assert.ok(
              out.includes('/post/'),
              `${post.fileSlug} recent/unmigrated post must stay on prod: ${out}`
            );
          }
        }
      }
    }
  });

  it('captures and templates author avatar with live alt text', () => {
    for (const post of listPilotBlogPosts()) {
      assert.ok(post.authorAvatar?.src, `missing authorAvatar.src ${post.fileSlug}`);
      assert.ok(
        /תמונת הסופר/.test(post.authorAvatar?.alt || ''),
        `missing author avatar alt ${post.fileSlug}`
      );
    }
    const tpl = readFileSync('src/components/BlogPostPage.astro', 'utf8');
    assert.ok(tpl.includes('data-blog-author-avatar'));
    assert.ok(tpl.includes('authorAvatar'));
  });

  it('newest learning-gaps post resolves encoded and decoded and leads /blog', () => {
    const slug = 'פערים-לימודיים-במתמטיקה-כך-סוגרים-אותם-נכון';
    const encoded = encodeURIComponent(slug);
    const variants = [`/post/${slug}`, `/post/${encoded}`, `/post/${encodeURI(slug)}`];
    for (const path of variants) {
      const post = loadBlogPostByPath(path);
      assert.ok(post, path);
      assert.equal(post.fileSlug, 'learning-gaps-math');
      assert.equal(isPilotBlogPath(post.path), true);
      assert.equal(isLocallyServedPath(path), true, path);
    }
    const archive = loadBlogArchiveByPath('/blog');
    assert.ok(archive);
    assert.equal(archive.cards[0]?.title, 'פערים לימודיים במתמטיקה: כך סוגרים אותם נכון');
    assert.ok(archive.cards[0]?.href.includes(encoded));
  });

  it('manifest file documents classification + pilot (no bulk 63)', () => {
    const m = readFileSync('reports/m25-blog/pilot-manifest.txt', 'utf8');
    assert.ok(m.includes('59'));
    assert.ok(m.includes('Pilot posts (8)'));
    assert.ok(m.includes('Deferred'));
    assert.ok(m.includes('aboutus contact mailto-only'));
    assert.ok(m.includes('terms'));
  });
});

function contrastRatio(fg: string, bg: string): number {
  const lin = (hex: string) => {
    const n = hex.replace('#', '');
    const ch = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255);
    return ch.map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  };
  const L = (hex: string) => {
    const [r, g, b] = lin(hex);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const lighter = Math.max(L(fg), L(bg));
  const darker = Math.min(L(fg), L(bg));
  return (lighter + 0.05) / (darker + 0.05);
}

describe('blog CTA contrast', () => {
  it('scoped CTA style reaches WCAG AA for text on the button', () => {
    const src = readFileSync('src/components/BlogPostPage.astro', 'utf8');
    const style = src.slice(src.lastIndexOf('<style>'));
    assert.match(style, /\.blog-post__cta a\.cta/);
    assert.match(style, /color:\s*#fff/);
    assert.match(style, /background-color:\s*#1565c0/i);
    assert.match(style, /:hover/);
    assert.match(style, /:focus-visible/);
    assert.ok(contrastRatio('#ffffff', '#1565c0') >= 4.5);
    assert.ok(contrastRatio('#ffffff', '#0d47a1') >= 4.5);
    assert.ok(!src.includes('catalog.css'));
  });
});
