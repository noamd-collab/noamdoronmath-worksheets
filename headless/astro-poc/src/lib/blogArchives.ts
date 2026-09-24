import blogIndex from '../data/blog-archives/blog-index.json';
import categoryElementary from '../data/blog-archives/category-elementary-math.json';
import categoryMiddle from '../data/blog-archives/category-middle-school-math.json';
import categoryTeachers from '../data/blog-archives/category-teachers-and-parents.json';
import { isPilotBlogPath, localizeBlogHref } from './blogPosts';

export type BlogArchiveNavItem = {
  text: string;
  href: string;
  current?: boolean;
};

export type BlogArchiveCard = {
  title: string;
  href: string;
  excerpt: string;
  imageSrc?: string;
  imageAlt?: string;
  authorAvatar?: { src: string; alt: string };
  author?: string;
  date?: string;
  categories?: Array<{ text: string; href: string }>;
};

export type BlogArchiveContent = {
  path: string;
  fileSlug: string;
  kind: 'index' | 'category';
  categorySlug?: string | null;
  title: string;
  description: string;
  ogTitle?: string;
  ogImage?: string;
  h1: string;
  nav: BlogArchiveNavItem[];
  cards: BlogArchiveCard[];
  jsonLd?: unknown[];
  pagination?: Array<{ text: string; href: string }> | null;
  loadMore?: { label: string } | null;
  source: {
    liveUrl: string;
    capturedAt: string;
    cardCount: number;
    /** Prefer ssr-html; gallery-DOM captures undercount virtualized lists. */
    captureMethod?: string;
  };
};

/** M26: blog index + 3 category archives. */
export const BLOG_ARCHIVE_M26_PATHS = [
  '/blog',
  '/blog/categories/elementary-math',
  '/blog/categories/middle-school-math',
  '/blog/categories/teachers-and-parents',
] as const;

const ALL: BlogArchiveContent[] = [
  blogIndex,
  categoryElementary,
  categoryMiddle,
  categoryTeachers,
] as BlogArchiveContent[];

function normPath(pathname: string): string {
  return pathname.replace(/\/$/, '') || '/';
}

function pathsEqual(a: string, b: string): boolean {
  if (a === b) return true;
  try {
    return decodeURIComponent(a) === decodeURIComponent(b);
  } catch {
    return false;
  }
}

export function listBlogArchives(): BlogArchiveContent[] {
  const byPath = new Map(ALL.map((p) => [p.path, p]));
  return BLOG_ARCHIVE_M26_PATHS.map((path) => {
    const p = byPath.get(path);
    if (!p) throw new Error(`Missing blog archive fixture for ${path}`);
    return p;
  });
}

export function isBlogArchivePath(pathname: string): boolean {
  const norm = normPath(pathname);
  return (BLOG_ARCHIVE_M26_PATHS as readonly string[]).some((p) => pathsEqual(p, norm));
}

export function loadBlogArchiveByPath(pathname: string): BlogArchiveContent | null {
  const norm = normPath(pathname);
  for (const a of ALL) {
    if (pathsEqual(a.path, norm)) return a;
  }
  return null;
}

export function loadBlogArchiveByCategorySlug(slug: string): BlogArchiveContent | null {
  return ALL.find((a) => a.kind === 'category' && a.categorySlug === slug) || null;
}

/** Localize archive/card hrefs: archives + pilot posts local; other posts stay on production. */
export function localizeArchiveHref(href: string): string {
  return localizeBlogHref(href);
}

export function collectArchiveHrefs(
  archive: BlogArchiveContent
): Array<{ where: string; href: string }> {
  const out: Array<{ where: string; href: string }> = [];
  for (const n of archive.nav) out.push({ where: 'nav', href: n.href });
  for (const c of archive.cards) {
    out.push({ where: 'card', href: c.href });
    for (const cat of c.categories || []) out.push({ where: 'card-cat', href: cat.href });
  }
  for (const p of archive.pagination || []) out.push({ where: 'pagination', href: p.href });
  return out;
}

/** Skim for parity gates. */
export function skimArchiveCards(archive: BlogArchiveContent): string[] {
  return archive.cards.map(
    (c) => `${c.title}|${(c.excerpt || '').slice(0, 60)}|${c.imageAlt || ''}`
  );
}

export function archiveCardIsPilot(href: string): boolean {
  try {
    const path = new URL(href, 'https://www.noamdoronmath.co.il').pathname.replace(/\/$/, '') || '/';
    return isPilotBlogPath(path);
  } catch {
    return false;
  }
}
