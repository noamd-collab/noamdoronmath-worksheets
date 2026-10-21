/**
 * GET /sitemap.xml
 *
 * Sitemap index for the cut-over. Child sitemaps list grades, topic pages,
 * worksheets, and the blog. Locs stay on https://www.noamdoronmath.co.il.
 * /sitemap-blog.xml stays the blog child (Wix reserves the *-sitemap.xml suffix).
 */
import type { APIRoute } from 'astro';
import { renderSitemapIndexXml } from '../lib/siteSitemaps';

export const prerender = false;

export const GET: APIRoute = () =>
  new Response(renderSitemapIndexXml(), {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'public, max-age=3600',
    },
  });
