/**
 * Unlisted lesson. Not linked from the site, not in the sitemap glob, noindex.
 * Lesson HTML is sent only while the 72h window is open.
 */
import type { APIRoute } from 'astro';
import { SECRET_LESSON_START } from 'astro:env/server';
import lessonHtml from '../../../secret-lesson/lesson.html?raw';
import { lessonPhase, resolveNowMs, secretResponseHeaders, tokenMatches } from '../../../lib/secretLesson';
import { renderGatePage, renderNotFoundPage, withSocialUrls } from '../../../lib/secretLessonPage';

export const prerender = false;

function startsAt(): string {
  const fromEnv = (SECRET_LESSON_START || '').trim();
  if (fromEnv) return fromEnv;
  const fromProcess = typeof process !== 'undefined' ? (process.env.SECRET_LESSON_START || '').trim() : '';
  return fromProcess;
}

export const GET: APIRoute = ({ params, url }) => {
  const token = params.token || '';
  if (!tokenMatches(token)) {
    return new Response(renderNotFoundPage(), {
      status: 404,
      headers: secretResponseHeaders({ 'content-type': 'text/html; charset=utf-8' }),
    });
  }
  const now = resolveNowMs({
    hostname: url.hostname,
    allowClock: typeof process !== 'undefined' && process.env.SECRET_LESSON_ALLOW_CLOCK === '1',
    nowOverride: typeof process !== 'undefined' ? process.env.SECRET_LESSON_NOW : '',
  });
  const phase = lessonPhase(now, startsAt());
  if (phase !== 'live') {
    return new Response(renderGatePage(phase), {
      status: 200,
      headers: secretResponseHeaders({ 'content-type': 'text/html; charset=utf-8' }),
    });
  }
  const html = withSocialUrls(lessonHtml, url.origin, token);
  return new Response(html, {
    status: 200,
    headers: secretResponseHeaders({ 'content-type': 'text/html; charset=utf-8' }),
  });
};
