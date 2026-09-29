/**
 * GET /llms-full.txt — extended llms.txt: intros for every hub and topic, plus the blog.
 */
import type { APIRoute } from 'astro';
import { renderLlmsFullTxt } from '../lib/llmsTxt';

export const prerender = false;

export const GET: APIRoute = () =>
  new Response(renderLlmsFullTxt(), {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=3600',
    },
  });
