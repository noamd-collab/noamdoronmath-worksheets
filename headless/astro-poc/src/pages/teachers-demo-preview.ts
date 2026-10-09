/**
 * Preview-only route for the grade-9 factoring teacher picker.
 * Not a live page: noindex, not linked from any menu, and absent from the
 * pages sitemap (that glob is only src/pages/*.astro).
 * Remove this route, or keep it, only after Noam decides before merge.
 */
import type { APIRoute } from 'astro';
import page from '../../public/teachers-demo-preview/index.html?raw';

export const prerender = false;

export const GET: APIRoute = () =>
  new Response(page, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'x-robots-tag': 'noindex, nofollow',
      'cache-control': 'no-store',
    },
  });
