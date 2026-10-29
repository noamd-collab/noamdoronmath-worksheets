/**
 * GET /sitemap.xml
 *
 * Same index as /sitemap-index.xml. Locs stay on https://www.noamdoronmath.co.il.
 * On Wix-managed hosting, Wix serves its own /sitemap.xml before this route
 * (reserved path; there is no adapter flag to turn that off). Crawlers are
 * sent to /sitemap-index.xml from robots.txt. This route still serves the
 * index anywhere the request reaches Astro, including the local build.
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
