/**
 * OPEN-07 — same-origin proxy for the classic site's public `blogAudioInfo`.
 * The upstream sends no CORS headers, so the player on this origin calls here.
 * Public data only; no secret is read or forwarded.
 */
import type { APIRoute } from 'astro';
import { BLOG_AUDIO_FUNCTIONS_BASE } from 'astro:env/server';
import { blogAudioFunctionsBase, handleBlogAudioInfoRequest } from '../../lib/blogAudio';

export const prerender = false;

export const GET: APIRoute = ({ url }) =>
  handleBlogAudioInfoRequest(url, { base: blogAudioFunctionsBase({ BLOG_AUDIO_FUNCTIONS_BASE }) });
