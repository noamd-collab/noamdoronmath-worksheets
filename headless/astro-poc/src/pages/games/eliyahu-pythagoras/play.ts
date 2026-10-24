/**
 * Unchanged game document. The public page iframes this URL.
 * X-Robots-Tag keeps the raw file out of the index; the wrapper page is canonical.
 */
import type { APIRoute } from 'astro';
import gameHtml from '../../../games/eliyahu-pythagoras.html?raw';

export const prerender = false;

export const GET: APIRoute = () =>
  new Response(gameHtml, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, max-age=300',
      'x-robots-tag': 'noindex',
    },
  });
