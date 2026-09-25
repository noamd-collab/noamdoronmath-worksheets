/**
 * GET /blog-feed.xml
 *
 * RSS 2.0 from listServedBlogPosts(). The handler does not read the request,
 * so every link stays on https://www.noamdoronmath.co.il.
 */
import type { APIRoute } from 'astro';
import { renderBlogFeedXml } from '../lib/blogFeed';

export const prerender = false;

const xml = renderBlogFeedXml();

export const GET: APIRoute = () =>
  new Response(xml, {
    headers: {
      'content-type': 'application/rss+xml; charset=utf-8',
      'cache-control': 'public, max-age=3600',
    },
  });
