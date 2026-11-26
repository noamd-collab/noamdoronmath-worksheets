/**
 * GET /search-index.v1.json — the build-time site search index
 * (src/data/search-index.v1.json, gzipped for the worker, built by
 * `npm run refresh:search-index`). The body is still that JSON.
 * Fetched by the search page only when a visitor starts typing.
 */
import type { APIRoute } from 'astro';
import { loadSearchIndexData } from '../lib/siteSearch/packedIndex';

export const prerender = false;

export const GET: APIRoute = async () => {
  const body = JSON.stringify(await loadSearchIndexData());
  return new Response(body, {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'public, max-age=3600',
      'x-robots-tag': 'noindex',
    },
  });
};
