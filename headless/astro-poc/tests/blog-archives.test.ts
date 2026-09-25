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
  skimArchiveCards,
  localizeArchiveHref,
  archiveCardIsPilot,
} from '../src/lib/blogArchives';
import { isLocallyServedPath, localizeBlogHref, isPilotBlogPath } from '../src/lib/blogPosts';

describe('M26 blog archives', () => {
  it('covers exactly 4 archive routes (index + 3 categories)', () => {
    assert.equal(BLOG_ARCHIVE_M26_PATHS.length, 4);
    const archives = listBlogArchives();
    assert.equal(archives.length, 4);
    assert.deepEqual(
      archives.map((a) => a.path).sort(),
      [...BLOG_ARCHIVE_M26_PATHS].sort()
    );
  });

  it('each archive has h1, nav, ordered cards with title+excerpt', () => {
    const expectedCounts: Record<string, number> = {
      '/blog': 20,
      '/blog/categories/elementary-math': 7,
      '/blog/categories/middle-school-math': 20,
      '/blog/categories/teachers-and-parents': 7,
    };
    for (const archive of listBlogArchives()) {
      assert.ok(archive.h1.length > 1, archive.path);
      assert.ok(archive.title.length > 3, archive.path);
      assert.ok(archive.description.length > 10, archive.path);
      assert.ok(archive.nav.length >= 4, archive.path);
      assert.equal(
        archive.cards.length,
        expectedCounts[archive.path],
        `${archive.path} cards ${archive.cards.length} (SSR-complete, not gallery-virtualized)`
      );
      assert.equal(archive.source.cardCount, archive.cards.length);
      assert.ok(archive.nav.some((n) => /כל הפוסטים|יסודי|חטיבת|מורים/.test(n.text)));
      for (const card of archive.cards) {
        assert.ok(card.title.length > 3, archive.path);
        assert.ok(card.excerpt.length > 10, card.title);
        assert.ok(/\/post\//.test(card.href), card.title);
      }
      const skim = skimArchiveCards(archive);
      assert.equal(skim.length, archive.cards.length);
    }
  });

  it('includes previously omitted grade-7 SSR cards on /blog and middle-school', () => {
    const blog = loadBlogArchiveByPath('/blog')!;
    const mid = loadBlogArchiveByCategorySlug('middle-school-math')!;
    const blogMust = [
      'משוואות ופתרונן חלק 2 — סוגריים ושקילות לכיתה ז׳ — דפי עבודה',
      'משוואות חד־שלביות לכיתה ז׳ — דפי עבודה',
      'תיבה וקובייה לכיתה ז׳ — דפי עבודה',
      'שטח מלבן וריבוע — העמקה לכיתה ז׳ — דפי עבודה',
      // OPEN-07-FIX: the 25.09 post pushed 'שטחים ב׳ חלק 2' to page 2 of live /blog
      // (it stays on middle-school below); the live-SSR gate pins the exact order.
    ];
    const midMust = [
      'שטחים ב׳ חלק 2 — מצולעים מורכבים לכיתה ז׳ — דפי עבודה',
      'נקודות על גרף ברביע הראשון לכיתה ז׳ — דפי עבודה',
      'משתנים וביטויים אלגבריים — שפה ומידול לכיתה ז׳ — דפי עבודה',
      'סוגריים וחוק הפילוג לכיתה ז׳ — דפי עבודה',
      'הנעלם בשני האגפים לכיתה ז׳ — דפי עבודה',
    ];
    for (const t of blogMust) {
      assert.ok(
        blog.cards.some((c) => c.title === t),
        `blog missing ${t}`
      );
    }
    for (const t of midMust) {
      assert.ok(
        mid.cards.some((c) => c.title === t),
        `middle-school missing ${t}`
      );
    }
    // source order: previously omitted blog cards are the last SSR items
    assert.deepEqual(
      blog.cards.slice(-blogMust.length).map((c) => c.title),
      blogMust
    );
    // OPEN-07-FIX: the newest live post leads /blog.
    assert.equal(blog.cards[0].title, 'פערים לימודיים במתמטיקה: כך סוגרים אותם נכון');
  });

  it('preserves cover images+alt when present on live cards', () => {
    const withImg = listBlogArchives().flatMap((a) =>
      a.cards.filter((c) => c.imageSrc)
    );
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

  it('archive + category hrefs localize locally; unmigrated post cards stay absolute', () => {
    assert.equal(localizeArchiveHref('https://www.noamdoronmath.co.il/blog'), '/blog');
    assert.equal(
      localizeArchiveHref('https://www.noamdoronmath.co.il/blog/categories/elementary-math'),
      '/blog/categories/elementary-math'
    );
    assert.equal(isLocallyServedPath('/blog'), true);
    assert.equal(isLocallyServedPath('/blog/categories/middle-school-math'), true);

    for (const archive of listBlogArchives()) {
      for (const { where, href } of collectArchiveHrefs(archive)) {
        const out = localizeArchiveHref(href);
        let path = '';
        try {
          path = new URL(href, 'https://www.noamdoronmath.co.il').pathname.replace(/\/$/, '') || '/';
        } catch {
          continue;
        }
        if (path === '/blog' || path.startsWith('/blog/categories/')) {
          assert.ok(out.startsWith('/blog'), `${archive.path} ${where} ${out}`);
        } else if (path.startsWith('/post/')) {
          if (isPilotBlogPath(path) || archiveCardIsPilot(href)) {
            assert.ok(
              out.startsWith('/post/') || out === path,
              `${archive.path} pilot card should be local: ${out}`
            );
          } else {
            assert.ok(
              out.startsWith('https://www.noamdoronmath.co.il/post/'),
              `${archive.path} unmigrated card must stay prod: ${out}`
            );
          }
        }
      }
    }
  });

  it('template + routes exist for reusable archive model', () => {
    assert.ok(existsSync('src/components/BlogArchivePage.astro'));
    assert.ok(existsSync('src/pages/blog/index.astro'));
    assert.ok(existsSync('src/pages/blog/categories/[slug].astro'));
    assert.ok(existsSync('src/lib/blogArchives.ts'));
    const tpl = readFileSync('src/components/BlogArchivePage.astro', 'utf8');
    assert.ok(tpl.includes('data-blog-archive-list'));
    assert.ok(tpl.includes('data-blog-archive-card'));
    assert.ok(tpl.includes('data-blog-archive-nav'));
    assert.ok(tpl.includes('localizeArchiveHref'));
  });

  it('does not claim load-more/pagination when live had none', () => {
    for (const archive of listBlogArchives()) {
      assert.equal(archive.loadMore, null);
      assert.equal(archive.pagination, null);
    }
  });
});
