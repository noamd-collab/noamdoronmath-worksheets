import type { APIRoute } from 'astro';
import content from '../data/site-llms.md?raw';

/** Project-owned navigation summary; no crawler/account policy is changed. */
export const prerender = false;
export const GET: APIRoute = () => new Response(content, {
  headers: {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'public, max-age=3600',
  },
});
