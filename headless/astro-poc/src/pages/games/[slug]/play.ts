/**
 * The playable game document for /games/<slug>/play.
 * X-Robots-Tag keeps the raw file out of the index; the wrapper page at
 * /games/<slug> is canonical.
 */
import type { APIRoute } from 'astro';
import { findEngineGame } from '../../../lib/eliyahuGames';
import { hasSpec, renderGameDocument } from '../../../lib/eliyahuGameDocument';
export const prerender = false;
export const GET: APIRoute = ({ params }) => {
  const slug = params.slug;
  const game = slug ? findEngineGame(slug) : undefined;
  if (!game || !hasSpec(game.slug)) return new Response('Not found', { status: 404 });
  return new Response(renderGameDocument(game), {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, max-age=300',
      'x-robots-tag': 'noindex'
    }
  });
};
