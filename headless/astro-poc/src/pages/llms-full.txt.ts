/**
 * GET /llms-full.txt
 *
 * Every topic landing for agents, ordered grade -> track -> catalog month or
 * group, one line each (title, URL, one sentence of scope). Links use the
 * production origin. Built from bundled page and catalog data — no
 * filesystem reads (Workers). Unlike /llms.txt, Wix does not reserve this path.
 *
 * X-Robots-Tag: noindex keeps search engines from indexing this text copy of
 * every landing and ranking it against the landings themselves. AI agents
 * still fetch and read it; robots.txt and /llms.txt point to it.
 */
import type { APIRoute } from 'astro';
import { renderLlmsFullTxt } from '../lib/llmsFullTxt';

export const prerender = false;

/** The text only changes with a deploy, so build it once per worker instance. */
let body: string | undefined;

export const GET: APIRoute = () =>
  new Response((body ??= renderLlmsFullTxt()), {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=3600',
      'x-robots-tag': 'noindex',
    },
  });
