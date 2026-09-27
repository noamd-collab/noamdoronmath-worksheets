/**
 * Prevents archive truncation regressions: union of every archive page must
 * equal the served published-post inventory (no omissions / no invented extras
 * on the main index).
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  BLOG_ARCHIVE_PAGE_SIZE,
  buildBlogArchive,
  listAllArchiveListingPaths,
  listArchivePosts,
  postToArchiveCard,
  primaryCategorySlug,
} from '../src/lib/blogArchiveBuild';
import { listBlogArchives } from '../src/lib/blogArchives';
import { isFrozenRelativeDate } from '../src/lib/blogDates';
import { listServedBlogPosts } from '../src/lib/blogPosts';

function normPath(pathname: string): string {
  try {
    return decodeURIComponent(pathname).replace(/\/$/, '') || '/';
  } catch {
    return pathname.replace(/\/$/, '') || '/';
  }
}

describe('blog archive completeness (inventory ↔ listing)', () => {
  it('main /blog listing covers every served published post exactly once', () => {
    const served = listServedBlogPosts().map((p) => normPath(p.path)).sort();
    const { indexPaths } = listAllArchiveListingPaths();
    assert.deepEqual([...indexPaths].sort(), served);
    assert.equal(indexPaths.length, served.length);
    assert.ok(served.length >= 60, `expected ≥60 served posts, got ${served.length}`);
  });

  it('union of paginated archive pages equals inventory (no page omissions)', () => {
    const index = listBlogArchives().find((a) => a.path === '/blog')!;
    const posts = listArchivePosts(index);
    const seen = new Set<string>();
    const pageCount = Math.ceil(posts.length / BLOG_ARCHIVE_PAGE_SIZE);
    for (let page = 1; page <= pageCount; page++) {
      const built = buildBlogArchive(index, page);
      assert.equal(built.page, page);
      assert.equal(built.pageCount, pageCount);
      assert.ok(built.pagination && built.pagination.length === pageCount);
      for (const card of built.cards) {
        const path = normPath(new URL(card.href).pathname);
        assert.equal(seen.has(path), false, `duplicate listing ${path}`);
        seen.add(path);
        assert.equal(isFrozenRelativeDate(card.date), false, `relative date on ${path}`);
      }
    }
    const served = new Set(listServedBlogPosts().map((p) => normPath(p.path)));
    assert.deepEqual([...seen].sort(), [...served].sort());
  });

  it('category listings only include posts with matching primary assignment', () => {
    for (const archive of listBlogArchives().filter((a) => a.kind === 'category')) {
      const posts = listArchivePosts(archive);
      assert.ok(posts.length >= 1, archive.path);
      for (const post of posts) {
        assert.equal(
          primaryCategorySlug(post),
          archive.categorySlug,
          `${post.fileSlug} in ${archive.path}`
        );
      }
      const built = buildBlogArchive(archive, 1);
      assert.equal(built.totalCards, posts.length);
      assert.ok(built.cards.length <= BLOG_ARCHIVE_PAGE_SIZE);
    }
  });

  it('card builder never emits frozen relative dates', () => {
    for (const post of listServedBlogPosts()) {
      const card = postToArchiveCard(post);
      assert.ok(card.title.length > 2);
      assert.match(card.href, /\/post\//);
      assert.equal(isFrozenRelativeDate(card.date), false, post.fileSlug);
      if (post.datePublished) {
        assert.ok((card.date || '').length > 0, post.fileSlug);
      }
    }
  });

  it('known post outside the old 20-card SSR window is listed', () => {
    const { indexPaths } = listAllArchiveListingPaths();
    assert.ok(
      indexPaths.some((p) => p.includes('דפי-עבודה-לכיתה-א-שמחזקים-ביטחון-במתמטיקה')),
      'grade-1 confidence post missing from archive listing'
    );
  });
});
