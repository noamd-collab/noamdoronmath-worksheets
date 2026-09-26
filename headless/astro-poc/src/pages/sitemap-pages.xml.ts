import type { APIRoute } from 'astro';
import { renderPagesSitemapXml } from '../lib/siteSitemaps';

export const prerender = false;

const xml = renderPagesSitemapXml();

export const GET: APIRoute = () =>
  new Response(xml, {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'public, max-age=3600',
    },
  });
