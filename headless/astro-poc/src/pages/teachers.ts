/**
 * Teachers page: every catalog grade and sheet.
 * Static assets live under public/teachers/. This route is not an .astro
 * page, so it stays out of the pages sitemap glob.
 * Not linked from the menu. Preview hosts stay noindex.
 */
import type { APIRoute } from 'astro';
import page from '../../public/teachers/index.html?raw';

export const prerender = false;

export const GET: APIRoute = () =>
  new Response(page, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'x-robots-tag': 'noindex, nofollow',
      'cache-control': 'no-store',
    },
  });
