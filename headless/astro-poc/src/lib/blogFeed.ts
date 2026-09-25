/**
 * GET /blog-feed.xml — RSS 2.0 for the posts this preview serves.
 * Absolute URLs stay on the production host. Hebrew slugs are percent-encoded.
 */
import { listBlogArchives } from './blogArchives';
import { listServedBlogPosts, type BlogPostContent } from './blogPosts';

export const BLOG_FEED_ORIGIN = 'https://www.noamdoronmath.co.il';
export const BLOG_FEED_PATH = '/blog-feed.xml';

export type BlogFeedItem = {
  title: string;
  link: string;
  guid: string;
  pubDate: string;
  description: string;
};

function xmlEscape(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

/** Production URL. Decodes a stored slug first so encodeURI does not double-encode %. */
export function absoluteBlogUrl(pathname: string): string {
  let path = pathname || '/';
  try {
    path = decodeURIComponent(path);
  } catch {
    /* keep the raw path */
  }
  if (!path.startsWith('/')) path = `/${path}`;
  return `${BLOG_FEED_ORIGIN}${encodeURI(path)}`;
}

function publishedMs(post: BlogPostContent): number {
  const ms = Date.parse(post.datePublished || '');
  return Number.isFinite(ms) ? ms : 0;
}

/** Served posts, newest publication date first. */
export function listBlogFeedItems(posts: BlogPostContent[] = listServedBlogPosts()): BlogFeedItem[] {
  return [...posts]
    .sort((a, b) => publishedMs(b) - publishedMs(a) || a.fileSlug.localeCompare(b.fileSlug))
    .map((post) => {
      const link = absoluteBlogUrl(post.path);
      const when = post.datePublished ? new Date(post.datePublished) : null;
      return {
        title: post.title,
        link,
        guid: link,
        pubDate: when && !Number.isNaN(when.getTime()) ? when.toUTCString() : '',
        description: post.description || '',
      };
    });
}

export function renderBlogFeedXml(items: BlogFeedItem[] = listBlogFeedItems()): string {
  const archive = listBlogArchives().find((a) => a.path === '/blog');
  const title = archive?.title || 'נועם דורון מתמטיקה';
  const description = archive?.description || title;
  const body = items
    .map((item) => {
      const pub = item.pubDate ? `\n      <pubDate>${xmlEscape(item.pubDate)}</pubDate>` : '';
      return `    <item>
      <title>${xmlEscape(item.title)}</title>
      <link>${xmlEscape(item.link)}</link>
      <guid isPermaLink="true">${xmlEscape(item.guid)}</guid>${pub}
      <description>${xmlEscape(item.description)}</description>
    </item>`;
    })
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${xmlEscape(title)}</title>
    <link>${BLOG_FEED_ORIGIN}/blog</link>
    <description>${xmlEscape(description)}</description>
${body}
  </channel>
</rss>
`;
}
