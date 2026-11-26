/**
 * GET /search-index.v1.json — the build-time site search index
 * (src/data/search-index.v1.json, built by `npm run refresh:search-index`).
 * Fetched by the search page only when a visitor starts typing.
 */
import type { APIRoute } from 'astro';
import index from '../data/search-index.v1.json';

export const prerender = false;

const body = JSON.stringify(index);

export const GET: APIRoute = () =>
  new Response(body, {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'public, max-age=3600',
      'x-robots-tag': 'noindex',
    },
  });
