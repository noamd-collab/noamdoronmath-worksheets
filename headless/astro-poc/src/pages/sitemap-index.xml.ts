import type { APIRoute } from 'astro';
import { renderSitemapIndexXml } from '../lib/siteSitemaps';

export const prerender = false;

export const GET: APIRoute = () =>
  new Response(renderSitemapIndexXml(), {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'public, max-age=3600',
    },
  });
