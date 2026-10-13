/**
 * GET /sitemap-blog.xml
 *
 * The body is renderBlogSitemapXml(), computed from the blog JSON bundled with
 * this build (listServedBlogPosts and listBlogArchives). The handler does not
 * read the request, so loc stays on the production host.
 */
import type { APIRoute } from 'astro';
import { renderBlogSitemapXml } from '../lib/blogSitemap';

export const prerender = false;

const xml = renderBlogSitemapXml();

export const GET: APIRoute = () =>
  new Response(xml, {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'public, max-age=3600',
    },
  });
