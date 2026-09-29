/**
 * GET /llms.txt — site summary + links to all grade hubs and topic pages.
 * Generated from bundled JSON (no filesystem; Worker-safe), like the sitemaps.
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
