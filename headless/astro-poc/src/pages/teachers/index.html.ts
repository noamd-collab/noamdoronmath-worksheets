/** Preserve direct links to the old static wizard entry without shadowing /teachers. */
import type { APIRoute } from 'astro';
import { TEACHER_TOOL_PATH } from '../../lib/teacherLandingContent';

export const prerender = false;
export const GET: APIRoute = ({ url }) => new Response(null, {
  status: 307,
  headers: {
    location: `${TEACHER_TOOL_PATH}${url.search}`,
    'cache-control': 'no-store',
    'x-robots-tag': 'noindex, nofollow',
  },
});
