import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import {
  BLOG_ARCHIVE_M26_PATHS,
  listBlogArchives,
  loadBlogArchiveByPath,
  loadBlogArchiveByCategorySlug,
  isBlogArchivePath,
  collectArchiveHrefs,
  localizeArchiveHref,
  archiveCardIsPilot,
} from '../src/lib/blogArchives';
import {
  buildBlogArchive,
  listArchivePosts,
  BLOG_ARCHIVE_PAGE_SIZE,
} from '../src/lib/blogArchiveBuild';
import { isLocallyServedPath, localizeBlogHref, isPilotBlogPath } from '../src/lib/blogPosts';

describe('M26 blog archives (shell + built listings)', () => {
  it('covers exactly 4 archive routes (index + 3 categories)', () => {
    assert.equal(BLOG_ARCHIVE_M26_PATHS.length, 4);
    const archives = listBlogArchives();
    assert.equal(archives.length, 4);
    assert.deepEqual(
      archives.map((a) => a.path).sort(),
      [...BLOG_ARCHIVE_M26_PATHS].sort()
    );
  });

  it('built /blog lists all served posts across real pagination', () => {
    const shell = loadBlogArchiveByPath('/blog')!;
    const all = listArchivePosts(shell);
    assert.ok(all.length >= 60, `expected ≥60 posts, got ${all.length}`);
    const built = buildBlogArchive(shell, 1);
    assert.equal(built.totalCards, all.length);
    assert.equal(built.cards.length, Math.min(BLOG_ARCHIVE_PAGE_SIZE, all.length));
    assert.ok(built.pagination && built.pagination.length >= 2);
    assert.equal(built.loadMore, null);
    assert.ok(built.h1.length > 1);
    assert.ok(built.nav.some((n) => /כל הפוסטים|יסודי|חטיבת|מורים/.test(n.text)));
    for (const card of built.cards) {
      assert.ok(card.title.length > 3, card.title);
      assert.ok(card.excerpt.length > 10, card.title);
      assert.ok(/\/post\//.test(card.href), card.title);
      assert.ok(card.date && !/לפני/.test(card.date), card.date);
    }
  });

  it('built category archives keep shell chrome and list assigned posts', () => {
    for (const slug of [
      'elementary-math',
      'middle-school-math',
      'teachers-and-parents',
    ] as const) {
      const shell = loadBlogArchiveByCategorySlug(slug)!;
      const built = buildBlogArchive(shell, 1);
      assert.ok(built.totalCards >= 1, slug);
      assert.ok(built.cards.length >= 1, slug);
      assert.ok(built.nav.length >= 4, slug);
    }
  });

  it('includes grade-1 confidence post that was outside the old SSR window', () => {
    const built = buildBlogArchive(loadBlogArchiveByPath('/blog')!, 1);
    const page2 = buildBlogArchive(loadBlogArchiveByPath('/blog')!, 2);
    const page3 = buildBlogArchive(loadBlogArchiveByPath('/blog')!, 3);
    const titles = [...built.cards, ...page2.cards, ...page3.cards].map((c) => c.title);
    assert.ok(
      titles.some((t) => t.includes('דפי עבודה לכיתה א')),
      'missing grade-1 worksheets confidence post from paginated archive'
    );
  });

  it('preserves cover images+alt when present on posts', () => {
    const shell = loadBlogArchiveByPath('/blog')!;
    const cards = [];
    const pageCount = Math.ceil(listArchivePosts(shell).length / BLOG_ARCHIVE_PAGE_SIZE);
    for (let p = 1; p <= pageCount; p++) {
      cards.push(...buildBlogArchive(shell, p).cards);
    }
    const withImg = cards.filter((c) => c.imageSrc);
    assert.ok(withImg.length >= 10, `expected several cover images, got ${withImg.length}`);
    for (const c of withImg) {
      assert.ok(/wixstatic|wixmp|static\.wix/.test(c.imageSrc || ''), c.title);
      assert.ok((c.imageAlt || '').length > 0, c.title);
    }
  });

  it('resolves index and category paths', () => {
    assert.ok(isBlogArchivePath('/blog'));
    assert.ok(loadBlogArchiveByPath('/blog'));
    assert.ok(loadBlogArchiveByCategorySlug('elementary-math'));
    assert.ok(loadBlogArchiveByCategorySlug('middle-school-math'));
    assert.ok(loadBlogArchiveByCategorySlug('teachers-and-parents'));
    assert.equal(loadBlogArchiveByCategorySlug('nope'), null);
  });

  it('archive + category hrefs localize locally; post cards localize when served', () => {
    assert.equal(localizeArchiveHref('https://www.noamdoronmath.co.il/blog'), '/blog');
    assert.equal(
      localizeArchiveHref('https://www.noamdoronmath.co.il/blog/categories/elementary-math'),
      '/blog/categories/elementary-math'
    );
    assert.equal(isLocallyServedPath('/blog'), true);
    assert.equal(isLocallyServedPath('/blog/categories/middle-school-math'), true);

    const built = buildBlogArchive(loadBlogArchiveByPath('/blog')!, 1);
    for (const { where, href } of collectArchiveHrefs(built)) {
      const out = localizeArchiveHref(href);
      let path = '';
      try {
        path = new URL(href, 'https://www.noamdoronmath.co.il').pathname.replace(/\/$/, '') || '/';
      } catch {
        continue;
      }
      if (path === '/blog' || path.startsWith('/blog/categories/')) {
        assert.ok(out.startsWith('/blog'), `${where} ${out}`);
      } else if (path.startsWith('/post/')) {
        if (isPilotBlogPath(path) || archiveCardIsPilot(href)) {
          assert.ok(
            out.startsWith('/post/') || out === path,
            `pilot card should be local: ${out}`
          );
        }
      }
    }
    assert.equal(typeof localizeBlogHref, 'function');
  });

  it('template + routes exist for reusable archive model', () => {
    assert.ok(existsSync('src/components/BlogArchivePage.astro'));
    assert.ok(existsSync('src/pages/blog/index.astro'));
    assert.ok(existsSync('src/pages/blog/categories/[slug].astro'));
    assert.ok(existsSync('src/lib/blogArchives.ts'));
    assert.ok(existsSync('src/lib/blogArchiveBuild.ts'));
    const tpl = readFileSync('src/components/BlogArchivePage.astro', 'utf8');
    assert.ok(tpl.includes('data-blog-archive-list'));
    assert.ok(tpl.includes('data-blog-archive-card'));
    assert.ok(tpl.includes('data-blog-archive-nav'));
    assert.ok(tpl.includes('data-blog-archive-pagination'));
    assert.ok(tpl.includes('localizeArchiveHref'));
    const indexPage = readFileSync('src/pages/blog/index.astro', 'utf8');
    assert.ok(indexPage.includes('loadBuiltArchiveByPath'));
  });

  it('shell fixtures may still hold frozen SSR cards; runtime ignores them', () => {
    const shell = loadBlogArchiveByPath('/blog')!;
    assert.equal(shell.cards.length, 20, 'historical SSR snapshot size');
    assert.equal(shell.pagination, null);
    const built = buildBlogArchive(shell, 1);
    assert.ok(built.totalCards > shell.cards.length);
    assert.ok(built.pagination && built.pagination.length > 1);
  });
});
