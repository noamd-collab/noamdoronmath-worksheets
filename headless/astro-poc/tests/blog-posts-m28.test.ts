import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  BLOG_POST_M25_PILOT_PATHS,
  BLOG_POST_M27_PATHS,
  BLOG_POST_M28_PATHS,
  BLOG_POST_SERVED_PATHS,
  LIVE_CHROME_BASELINE,
  listM28BlogPosts,
  listServedBlogPosts,
  loadBlogPostByPath,
  isPilotBlogPath,
  isLocallyServedPath,
  localizeBlogHref,
  expectedChromeFlags,
  collectBlogPostHrefs,
  skimBlogBody,
} from '../src/lib/blogPosts';

describe('M28 blog batch (18 of remaining 36)', () => {
  it('serves exactly 18 M28 posts within 60 total served (59 + OPEN-07-FIX)', () => {
    assert.equal(BLOG_POST_M25_PILOT_PATHS.length, 8);
    assert.equal(BLOG_POST_M27_PATHS.length, 15);
    assert.equal(BLOG_POST_M28_PATHS.length, 18);
    assert.equal(BLOG_POST_SERVED_PATHS.length, 60);
    assert.equal(listM28BlogPosts().length, 18);
    assert.equal(listServedBlogPosts().length, 60);
  });

  it('spans elementary, middle-school, and layout clusters', () => {
    const posts = listM28BlogPosts();
    const hints = new Set(posts.map((p) => p.categoryHint));
    assert.ok(hints.has('elementary-math') || hints.has('middle-school-math'), 'category spread');
    assert.ok(hints.has('middle-school-math'), 'middle-school');
    const keys = new Set(posts.map((p) => p.featureKey));
    assert.ok(keys.size >= 3, `expected multiple layout clusters, got ${keys.size}`);
  });

  it('each M28 post has ordered body, author, schema, avatar', () => {
    for (const post of listM28BlogPosts()) {
      assert.ok(post.h1.length > 2, post.fileSlug);
      assert.ok(post.blocks.length >= 3, post.fileSlug);
      assert.ok(post.author.length > 0, post.fileSlug);
      assert.ok(post.authorAvatar?.src, post.fileSlug);
      assert.ok(/BlogPosting/.test(JSON.stringify(post.jsonLd)), post.fileSlug);
      assert.equal(post.batch, 'm28');
    }
  });

  it('fixtures match frozen LIVE_CHROME_BASELINE (no silently dropped chrome)', () => {
    for (const post of listM28BlogPosts()) {
      const flags = expectedChromeFlags(post);
      assert.ok(LIVE_CHROME_BASELINE[post.fileSlug], post.fileSlug);
      assert.deepEqual(flags, LIVE_CHROME_BASELINE[post.fileSlug], post.fileSlug);
    }
  });

  it('all 60 served posts have LIVE_CHROME_BASELINE entries', () => {
    for (const post of listServedBlogPosts()) {
      assert.ok(LIVE_CHROME_BASELINE[post.fileSlug], post.fileSlug);
      assert.deepEqual(expectedChromeFlags(post), LIVE_CHROME_BASELINE[post.fileSlug], post.fileSlug);
    }
  });

  it('coverage-aware links: only served post routes localize', () => {
    for (const post of listM28BlogPosts()) {
      for (const { where, href } of collectBlogPostHrefs(post)) {
        const out = localizeBlogHref(href);
        let path = '';
        try {
          path = new URL(href, 'https://www.noamdoronmath.co.il').pathname.replace(/\/$/, '') || '/';
        } catch {
          continue;
        }
        if (!path.startsWith('/post/')) continue;
        if (isPilotBlogPath(path)) {
          assert.ok(out.startsWith('/post/') || out === path, `${post.fileSlug} ${where} ${out}`);
        } else {
          assert.ok(
            out.startsWith('https://www.noamdoronmath.co.il/post/'),
            `${post.fileSlug} ${where} must stay prod: ${out}`
          );
        }
      }
    }
  });

  it('omission regression: dropping FAQ chrome fails baseline when FAQ expected', () => {
    const post = listM28BlogPosts().find((p) => LIVE_CHROME_BASELINE[p.fileSlug]?.faq);
    assert.ok(post?.faq?.items?.length);
    const broken = { ...post!, faq: undefined };
    assert.notDeepEqual(expectedChromeFlags(broken), LIVE_CHROME_BASELINE[post!.fileSlug]);
  });

  it('omission regression: dropping postCategory fails baseline when category expected', () => {
    const post = listM28BlogPosts().find((p) => LIVE_CHROME_BASELINE[p.fileSlug]?.postCategory);
    assert.ok(post?.postCategory?.text);
    const broken = { ...post!, postCategory: undefined };
    assert.notDeepEqual(expectedChromeFlags(broken), LIVE_CHROME_BASELINE[post!.fileSlug]);
  });

  it('omission regression: truncating body skim fails parity with full capture', () => {
    const post = listM28BlogPosts().find((p) => p.blocks.length >= 10)!;
    const full = skimBlogBody(post.blocks);
    const truncated = skimBlogBody(post.blocks.slice(0, 5));
    assert.notEqual(full.length, truncated.length);
    assert.ok(full.length > truncated.length);
  });

  it('false-local gate: M28/M29 posts and M30 topics localize', () => {
    assert.equal(isLocallyServedPath('/post/assessment-1-grade-7'), true);
    assert.equal(
      localizeBlogHref('https://www.noamdoronmath.co.il/post/assessment-1-grade-7'),
      '/post/assessment-1-grade-7'
    );
    assert.equal(isLocallyServedPath('/post/simplify-then-solve-equations-grade-7'), true);
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
    assert.equal(isLocallyServedPath('/patterns-and-graphs-grade-7'), true);
    assert.equal(
      localizeBlogHref('https://www.noamdoronmath.co.il/patterns-and-graphs-grade-7'),
      '/patterns-and-graphs-grade-7'
    );
  });

  it('resolves M28 paths via loadBlogPostByPath', () => {
    for (const path of BLOG_POST_M28_PATHS) {
      assert.ok(isPilotBlogPath(path), path);
      assert.ok(loadBlogPostByPath(path), path);
    }
  });
});
