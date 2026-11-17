/**
 * GET /llms-full.txt
 *
 * Every topic landing for agents, ordered grade -> track -> catalog month or
 * group, one line each (title, URL, one sentence of scope). Links use the
 * production origin. Built from bundled page and catalog data — no
 * filesystem reads (Workers). Unlike /llms.txt, Wix does not reserve this path.
 */
import type { APIRoute } from 'astro';
import { renderLlmsFullTxt } from '../lib/llmsFullTxt';

export const prerender = false;

export const GET: APIRoute = () =>
  new Response(renderLlmsFullTxt(), {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=3600',
    },
  });
