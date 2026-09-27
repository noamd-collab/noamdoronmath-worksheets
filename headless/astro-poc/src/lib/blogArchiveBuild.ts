/**
 * Build blog archive listings from served post inventory (not frozen SSR cards).
 * Pagination is real, crawlable (?page=N), and union(pages) must equal inventory.
 */
import {
  type BlogArchiveCard,
  type BlogArchiveContent,
  listBlogArchives,
  loadBlogArchiveByCategorySlug,
  loadBlogArchiveByPath,
} from './blogArchives';
import { resolveBlogDateDisplay } from './blogDates';
import {
  listServedBlogPosts,
  type BlogPostContent,
} from './blogPosts';

export const BLOG_ARCHIVE_PAGE_SIZE = 20;
export const BLOG_ARCHIVE_ORIGIN = 'https://www.noamdoronmath.co.il';

const CATEGORY_SLUGS = [
  'elementary-math',
  'middle-school-math',
  'teachers-and-parents',
] as const;

export type BlogArchiveCategorySlug = (typeof CATEGORY_SLUGS)[number];

function publishedMs(post: BlogPostContent): number {
  const ms = Date.parse(post.datePublished || '');
  return Number.isFinite(ms) ? ms : 0;
}

function absolutePostHref(post: BlogPostContent): string {
  let path = post.path || `/post/${post.pathSlug}`;
  try {
    path = decodeURIComponent(path);
  } catch {
    /* keep */
  }
  if (!path.startsWith('/')) path = `/${path}`;
  // Preserve encoded Hebrew path when stored encoded; encodeURI for decoded Hebrew.
  if (/%[0-9A-Fa-f]{2}/.test(post.path)) {
    return `${BLOG_ARCHIVE_ORIGIN}${post.path.startsWith('/') ? post.path : `/${post.path}`}`;
  }
  return `${BLOG_ARCHIVE_ORIGIN}${encodeURI(path)}`;
}

function categorySlugFromHref(href: string | undefined | null): string | null {
  if (!href) return null;
  try {
    const path = new URL(href, BLOG_ARCHIVE_ORIGIN).pathname.replace(/\/$/, '');
    const m = path.match(/\/blog\/categories\/([^/]+)$/);
    return m?.[1] || null;
  } catch {
    return null;
  }
}

/** Primary category assignment from capture fields — does not invent membership. */
export function primaryCategorySlug(post: BlogPostContent): BlogArchiveCategorySlug | null {
  const fromPc = categorySlugFromHref(post.postCategory?.href);
  if (fromPc && (CATEGORY_SLUGS as readonly string[]).includes(fromPc)) {
    return fromPc as BlogArchiveCategorySlug;
  }
  const hint = post.categoryHint;
  if (hint && (CATEGORY_SLUGS as readonly string[]).includes(hint)) {
    return hint as BlogArchiveCategorySlug;
  }
  return null;
}

export function postBelongsToCategory(
  post: BlogPostContent,
  categorySlug: string
): boolean {
  return primaryCategorySlug(post) === categorySlug;
}

export function listArchivePosts(archive: BlogArchiveContent): BlogPostContent[] {
  const all = listServedBlogPosts();
  const filtered =
    archive.kind === 'category' && archive.categorySlug
      ? all.filter((p) => postBelongsToCategory(p, archive.categorySlug!))
      : all;
  return [...filtered].sort(
    (a, b) => publishedMs(b) - publishedMs(a) || a.fileSlug.localeCompare(b.fileSlug)
  );
}

function cardCategories(
  post: BlogPostContent
): Array<{ text: string; href: string }> | undefined {
  const primary = primaryCategorySlug(post);
  if (post.postCategory?.text && post.postCategory.href) {
    return [{ text: post.postCategory.text, href: post.postCategory.href }];
  }
  if (primary) {
    const labels: Record<BlogArchiveCategorySlug, string> = {
      'elementary-math': 'יסודי',
      'middle-school-math': 'חטיבת הביניים',
      'teachers-and-parents': 'מורים והורים',
    };
    return [
      {
        text: labels[primary],
        href: `${BLOG_ARCHIVE_ORIGIN}/blog/categories/${primary}`,
      },
    ];
  }
  return undefined;
}

export function postToArchiveCard(post: BlogPostContent): BlogArchiveCard {
  return {
    title: post.title,
    href: absolutePostHref(post),
    excerpt: post.description || '',
    imageSrc: post.coverImage || post.ogImage,
    imageAlt: post.coverAlt || post.title,
    authorAvatar: post.authorAvatar,
    author: post.author,
    date: resolveBlogDateDisplay(post.datePublished, post.dateDisplay),
    categories: cardCategories(post),
  };
}

export function archivePageCount(total: number, pageSize = BLOG_ARCHIVE_PAGE_SIZE): number {
  return Math.max(1, Math.ceil(total / pageSize));
}

export function archivePageHref(basePath: string, page: number): string {
  if (page <= 1) return basePath;
  return `${basePath}?page=${page}`;
}

export function parseArchivePageParam(raw: string | null | undefined): number {
  const n = Number.parseInt(String(raw || '1'), 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return n;
}

export type BuiltBlogArchive = BlogArchiveContent & {
  page: number;
  pageCount: number;
  totalCards: number;
  pageSize: number;
};

export function buildBlogArchive(
  shell: BlogArchiveContent,
  page = 1,
  pageSize = BLOG_ARCHIVE_PAGE_SIZE
): BuiltBlogArchive {
  const posts = listArchivePosts(shell);
  const totalCards = posts.length;
  const pageCount = archivePageCount(totalCards, pageSize);
  const safePage = Math.min(Math.max(1, page), pageCount);
  const start = (safePage - 1) * pageSize;
  const pagePosts = posts.slice(start, start + pageSize);
  const cards = pagePosts.map(postToArchiveCard);

  const pagination =
    pageCount > 1
      ? Array.from({ length: pageCount }, (_, i) => {
          const n = i + 1;
          return {
            text: String(n),
            href: `${BLOG_ARCHIVE_ORIGIN}${archivePageHref(shell.path, n)}`,
          };
        })
      : null;

  return {
    ...shell,
    cards,
    pagination,
    loadMore: null,
    page: safePage,
    pageCount,
    totalCards,
    pageSize,
    source: {
      ...shell.source,
      cardCount: cards.length,
      captureMethod: 'served-posts-inventory',
    },
  };
}

export function loadBuiltArchiveByPath(
  pathname: string,
  page = 1
): BuiltBlogArchive | null {
  const shell = loadBlogArchiveByPath(pathname);
  if (!shell) return null;
  return buildBlogArchive(shell, page);
}

export function loadBuiltArchiveByCategorySlug(
  slug: string,
  page = 1
): BuiltBlogArchive | null {
  const shell = loadBlogArchiveByCategorySlug(slug);
  if (!shell) return null;
  return buildBlogArchive(shell, page);
}

/** Every card href across every pagination page of every archive shell. */
export function listAllArchiveListingPaths(): {
  indexPaths: string[];
  byCategory: Record<string, string[]>;
  unionPaths: string[];
} {
  const norm = (href: string) => {
    try {
      return decodeURIComponent(new URL(href, BLOG_ARCHIVE_ORIGIN).pathname).replace(/\/$/, '') || '/';
    } catch {
      return href;
    }
  };

  const indexShell = listBlogArchives().find((a) => a.path === '/blog')!;
  const indexPosts = listArchivePosts(indexShell);
  const indexPaths = indexPosts.map((p) => {
    try {
      return decodeURIComponent(p.path).replace(/\/$/, '') || '/';
    } catch {
      return p.path.replace(/\/$/, '') || '/';
    }
  });

  const byCategory: Record<string, string[]> = {};
  for (const slug of CATEGORY_SLUGS) {
    const shell = loadBlogArchiveByCategorySlug(slug)!;
    byCategory[slug] = listArchivePosts(shell).map((p) => {
      try {
        return decodeURIComponent(p.path).replace(/\/$/, '') || '/';
      } catch {
        return p.path.replace(/\/$/, '') || '/';
      }
    });
  }

  const union = new Set<string>(indexPaths);
  for (const paths of Object.values(byCategory)) {
    for (const p of paths) union.add(p);
  }

  return {
    indexPaths,
    byCategory,
    unionPaths: [...union].sort(),
  };
}

/** Paginated archive locs for sitemap (page 1 = bare path). */
export function listArchivePaginationPaths(): string[] {
  const out: string[] = [];
  for (const shell of listBlogArchives()) {
    const total = listArchivePosts(shell).length;
    const pages = archivePageCount(total);
    for (let p = 1; p <= pages; p++) {
      out.push(archivePageHref(shell.path, p));
    }
  }
  return out;
}
