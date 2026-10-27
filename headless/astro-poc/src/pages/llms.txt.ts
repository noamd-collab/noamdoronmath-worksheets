/**
 * GET /llms.txt
 *
 * Hebrew site map for agents. Links use the production origin.
 * Built from bundled page data — no filesystem reads (Workers).
 */
import type { APIRoute } from 'astro';
import { renderLlmsTxt } from '../lib/llmsTxt';

export const prerender = false;

export const GET: APIRoute = () =>
  new Response(renderLlmsTxt(), {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=3600',
    },
  });
