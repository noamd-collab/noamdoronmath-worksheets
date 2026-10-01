/**
 * Public lesson. Permanent, no token, no 72-hour gate.
 * Markup is the shared lesson.html file, with public title, description, and OG.
 */
import type { APIRoute } from 'astro';
import lessonHtml from '../../../secret-lesson/lesson.html?raw';
import { renderPublicLesson } from '../../../lib/publicLesson';

export const prerender = false;

export const GET: APIRoute = ({ url }) => {
  const html = renderPublicLesson(lessonHtml, url.hostname);
  return new Response(html, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, max-age=300',
    },
  });
};
