/**
 * The playable game document for /games/eliyahu-pythagoras/play.
 * The 756 KB document is a static file at /games/eliyahu-pythagoras.html, so it
 * stays out of the worker bundle and never costs base64 budget. This route keeps
 * the old embed URL working; the static file carries
 * <meta name="robots" content="noindex"> and the wrapper page at
 * /games/eliyahu-pythagoras stays canonical.
 */
import type { APIRoute } from 'astro';

export const PYTHAGORAS_GAME_DOCUMENT_PATH = '/games/eliyahu-pythagoras.html';

export const prerender = false;

export const GET: APIRoute = () =>
  new Response(null, {
    status: 308,
    headers: {
      location: PYTHAGORAS_GAME_DOCUMENT_PATH,
      'cache-control': 'public, max-age=300',
    },
  });
