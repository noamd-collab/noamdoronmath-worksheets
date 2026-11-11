/** Existing teacher wizard. Assets retain their /teachers/ URLs. */
import type { APIRoute } from 'astro';
import page from '../../teacher-pages/wizard.html?raw';

export const prerender = false;

export const GET: APIRoute = () =>
  new Response(page, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'x-robots-tag': 'noindex, nofollow',
      'cache-control': 'no-store',
    },
  });
