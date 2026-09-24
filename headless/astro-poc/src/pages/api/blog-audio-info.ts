/**
 * OPEN-07 — same-origin proxy for the classic site's public `blogAudioInfo`.
 * The upstream sends no CORS headers, so the player on this origin calls here.
 * Public data only; no secret is read or forwarded.
 */
import type { APIRoute } from 'astro';
import { fetchBlogAudioInfo, isValidAudioSlug } from '../../lib/blogAudio';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  const slug = url.searchParams.get('slug');
  if (!isValidAudioSlug(slug)) {
    return new Response(JSON.stringify({ error: 'slug is required' }), {
      status: 400,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    });
  }
  const info = await fetchBlogAudioInfo(slug);
  return new Response(JSON.stringify(info), {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': info.available ? 'public, max-age=300' : 'public, max-age=60',
    },
  });
};
