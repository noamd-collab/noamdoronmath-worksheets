/**
 * GET /robots.txt
 *
 * Preview hosts disallow crawling. Production (and SITE_INDEXABLE=true on a
 * non-preview host) allows crawling except dev routes. The Sitemap line always
 * uses the production origin and /sitemap-index.xml, which this app serves.
 * Wix's own /sitemap.xml is reserved and is not this file.
 */
import type { APIRoute } from 'astro';
import { renderRobotsTxt, robotsContent } from '../lib/siteSeo';

export const prerender = false;

export const GET: APIRoute = ({ url }) => {
  const indexable = robotsContent(url.hostname) === 'index,follow';
  return new Response(renderRobotsTxt(indexable), {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=3600',
    },
  });
};
