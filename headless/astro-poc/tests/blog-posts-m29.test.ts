import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  BLOG_POST_M25_PILOT_PATHS,
  BLOG_POST_M27_PATHS,
  BLOG_POST_M28_PATHS,
  BLOG_POST_M29_PATHS,
  BLOG_POST_SERVED_PATHS,
  LIVE_CHROME_BASELINE,
  listM29BlogPosts,
  listServedBlogPosts,
  loadBlogPostByPath,
  isPilotBlogPath,
  isLocallyServedPath,
  localizeBlogHref,
  expectedChromeFlags,
  collectBlogPostHrefs,
  skimBlogBody,
} from '../src/lib/blogPosts';

describe('M29 blog batch (remaining 18 → all 59)', () => {
  it('serves exactly 18 new posts (+41 prior = 59 total)', () => {
    assert.equal(BLOG_POST_M25_PILOT_PATHS.length, 8);
    assert.equal(BLOG_POST_M27_PATHS.length, 15);
    assert.equal(BLOG_POST_M28_PATHS.length, 18);
    assert.equal(BLOG_POST_M29_PATHS.length, 18);
    assert.equal(BLOG_POST_SERVED_PATHS.length, 59);
    assert.equal(listM29BlogPosts().length, 18);
    assert.equal(listServedBlogPosts().length, 59);
  });

  it('each M29 post has ordered body, author, schema, avatar', () => {
    for (const post of listM29BlogPosts()) {
      assert.ok(post.h1.length > 2, post.fileSlug);
      assert.ok(post.blocks.length >= 3, post.fileSlug);
      assert.ok(post.author.length > 0, post.fileSlug);
      assert.ok(post.authorAvatar?.src, post.fileSlug);
      assert.ok(/BlogPosting/.test(JSON.stringify(post.jsonLd)), post.fileSlug);
      assert.equal(post.batch, 'm29');
    }
  });

  it('fixtures match frozen LIVE_CHROME_BASELINE', () => {
    for (const post of listM29BlogPosts()) {
      assert.ok(LIVE_CHROME_BASELINE[post.fileSlug], post.fileSlug);
      assert.deepEqual(expectedChromeFlags(post), LIVE_CHROME_BASELINE[post.fileSlug], post.fileSlug);
    }
  });

  it('all 59 served posts have LIVE_CHROME_BASELINE entries', () => {
    for (const post of listServedBlogPosts()) {
      assert.ok(LIVE_CHROME_BASELINE[post.fileSlug], post.fileSlug);
      assert.deepEqual(expectedChromeFlags(post), LIVE_CHROME_BASELINE[post.fileSlug], post.fileSlug);
    }
  });

  it('coverage-aware links: only served post routes localize', () => {
    for (const post of listM29BlogPosts()) {
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

  it('omission regression: dropping FAQ fails baseline when FAQ expected', () => {
    const post = listM29BlogPosts().find((p) => LIVE_CHROME_BASELINE[p.fileSlug]?.faq);
    assert.ok(post?.faq?.items?.length);
    const broken = { ...post!, faq: undefined };
    assert.notDeepEqual(expectedChromeFlags(broken), LIVE_CHROME_BASELINE[post!.fileSlug]);
  });

  it('omission regression: truncating body skim fails parity', () => {
    const post = listM29BlogPosts().find((p) => p.blocks.length >= 10)!;
    const full = skimBlogBody(post.blocks);
    const truncated = skimBlogBody(post.blocks.slice(0, 5));
    assert.ok(full.length > truncated.length);
  });

  it('M29 posts and M30 topic pages localize', () => {
    assert.equal(isLocallyServedPath('/post/patterns-grade-7'), true);
    assert.equal(
      localizeBlogHref('https://www.noamdoronmath.co.il/post/patterns-grade-7'),
      '/post/patterns-grade-7'
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

  it('resolves all M29 paths', () => {
    for (const path of BLOG_POST_M29_PATHS) {
      assert.ok(isPilotBlogPath(path), path);
      assert.ok(loadBlogPostByPath(path), path);
    }
  });
});
