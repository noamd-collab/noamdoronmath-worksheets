/**
 * GET /sitemap-pages.xml
 *
 * Page inventory comes from Vite `import.meta.glob` (build-time).
 * Do not use filesystem APIs here — Workers have no `src/pages` tree (was HTTP 500).
 */
import type { APIRoute } from 'astro';
import { renderPagesSitemapXml } from '../lib/siteSitemaps';

export const prerender = false;

const pageModules = import.meta.glob('./*.astro');

export const GET: APIRoute = () =>
  new Response(renderPagesSitemapXml(Object.keys(pageModules)), {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'public, max-age=3600',
    },
  });
