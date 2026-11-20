/**
 * GET /robots.txt
 *
 * This route is NOT what production serves. On www.noamdoronmath.co.il, Wix
 * answers /robots.txt itself, before Astro, even with wix({ robots: false }).
 * Checked live on 17 Nov 2026: Wix's file ends with "# Auto generated, go to
 * SEO Tools > Robots.txt Editor to change this", and its only Sitemap line is
 * Wix's /sitemap.xml. Edit the live file in the Wix dashboard (SEO >
 * Robots.txt Editor) and add:
 *   Sitemap: https://www.noamdoronmath.co.il/sitemap-index.xml
 * `npm run check:live-robots` (scripts/check-live-robots.mjs) reports whether
 * that line is live. release.sh runs it after a release, report-only.
 *
 * This route answers only where a request reaches Astro, such as a local
 * build. There, preview hosts disallow crawling, and production (or
 * SITE_INDEXABLE=true on a non-preview host) allows crawling except dev
 * routes. Its Sitemap line uses the production origin and /sitemap-index.xml.
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
