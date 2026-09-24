import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  BLOG_POST_M25_PILOT_PATHS,
  BLOG_POST_M27_PATHS,
  BLOG_POST_SERVED_PATHS,
  LIVE_CHROME_BASELINE,
  listM27BlogPosts,
  listServedBlogPosts,
  loadBlogPostByPath,
  isPilotBlogPath,
  isLocallyServedPath,
  localizeBlogHref,
  expectedChromeFlags,
  collectBlogPostHrefs,
  skimBlogBody,
} from '../src/lib/blogPosts';

describe('M27 blog batch (15 of remaining 51)', () => {
  it('serves exactly 15 M27 posts within 59 total served', () => {
    assert.equal(BLOG_POST_M25_PILOT_PATHS.length, 8);
    assert.equal(BLOG_POST_M27_PATHS.length, 15);
    assert.equal(BLOG_POST_SERVED_PATHS.length, 59);
    assert.equal(listM27BlogPosts().length, 15);
    assert.equal(listServedBlogPosts().length, 59);
  });

  it('spans elementary, middle-school, teachers, and general layout clusters', () => {
    const posts = listM27BlogPosts();
    const hints = new Set(posts.map((p) => p.categoryHint));
    assert.ok(hints.has('elementary-math'), 'elementary');
    assert.ok(hints.has('middle-school-math'), 'middle-school');
    assert.ok(hints.has('teachers-and-parents'), 'teachers');
    assert.ok(hints.has('general'), 'general');
    const keys = new Set(posts.map((p) => p.featureKey));
    assert.ok(keys.size >= 4, `expected multiple layout clusters, got ${keys.size}`);
  });

  it('each M27 post has ordered body, author, schema, avatar', () => {
    for (const post of listM27BlogPosts()) {
      assert.ok(post.h1.length > 2, post.fileSlug);
      assert.ok(post.blocks.length >= 3, post.fileSlug);
      assert.ok(post.author.length > 0, post.fileSlug);
      assert.ok(post.authorAvatar?.src, post.fileSlug);
      assert.ok(/BlogPosting/.test(JSON.stringify(post.jsonLd)), post.fileSlug);
      assert.equal(post.batch, 'm27');
    }
  });

  it('fixtures match frozen LIVE_CHROME_BASELINE (no silently dropped chrome)', () => {
    for (const post of listM27BlogPosts()) {
      const flags = expectedChromeFlags(post);
      assert.deepEqual(flags, LIVE_CHROME_BASELINE[post.fileSlug], post.fileSlug);
    }
  });

  it('coverage-aware links: only served post routes localize', () => {
    for (const post of listM27BlogPosts()) {
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

  it('omission regression: dropping FAQ chrome fails baseline for authorEditor posts', () => {
    const post = loadBlogPostByPath('/post/box-and-cube-grade-7');
    assert.ok(post?.faq?.items?.length);
    const broken = { ...post!, faq: undefined };
    assert.notDeepEqual(expectedChromeFlags(broken), LIVE_CHROME_BASELINE[post!.fileSlug]);
  });

  it('omission regression: truncating body skim fails parity with full capture', () => {
    const post = listM27BlogPosts().find((p) => p.blocks.length >= 10)!;
    const full = skimBlogBody(post.blocks);
    const truncated = skimBlogBody(post.blocks.slice(0, 5));
    assert.notEqual(full.length, truncated.length);
    assert.ok(full.length > truncated.length);
  });

  it('M29 posts and M30 topic pages localize', () => {
    assert.equal(
      isLocallyServedPath('/post/substitution-in-algebraic-expressions-grade-7'),
      true
    );
    assert.equal(isLocallyServedPath('/post/box-and-cube-grade-7'), true);
    assert.equal(isLocallyServedPath('/post/assessment-1-grade-7'), true);
    assert.equal(isLocallyServedPath('/patterns-and-graphs-grade-7'), true);
    assert.equal(
      localizeBlogHref('https://www.noamdoronmath.co.il/patterns-and-graphs-grade-7'),
      '/patterns-and-graphs-grade-7'
    );
  });
});