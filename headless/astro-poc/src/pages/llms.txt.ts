/**
 * GET /llms.txt
 *
 * Live site-llms.md first, then SEO extras from page data.
 * No filesystem reads at request time (Workers).
 */
import type { APIRoute } from 'astro';
import liveGuide from '../data/site-llms.md?raw';
import { renderLlmsTxt } from '../lib/llmsTxt';

export const prerender = false;

export const GET: APIRoute = () =>
  new Response(renderLlmsTxt(liveGuide), {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=3600',
    },
  });
