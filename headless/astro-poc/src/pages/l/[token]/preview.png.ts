/**
 * Social preview image for the unlisted lesson. Same token and 72h gate as the page.
 * Bytes are bundled (no filesystem read — Wix workers have no src tree).
 */
import type { APIRoute } from 'astro';
import { SECRET_LESSON_START } from 'astro:env/server';
import { PREVIEW_PNG_BASE64 } from '../../../secret-lesson/previewPng';
import { lessonPhase, resolveNowMs, secretResponseHeaders, tokenMatches } from '../../../lib/secretLesson';
import { decodeBase64Bytes } from '../../../lib/secretLessonPage';

export const prerender = false;

export const GET: APIRoute = ({ params, url }) => {
  if (!tokenMatches(params.token || '')) {
    return new Response('Not found', { status: 404, headers: secretResponseHeaders({ 'content-type': 'text/plain; charset=utf-8' }) });
  }
  const start = (SECRET_LESSON_START || (typeof process !== 'undefined' ? process.env.SECRET_LESSON_START : '') || '').trim();
  const now = resolveNowMs({
    hostname: url.hostname,
    allowClock: typeof process !== 'undefined' && process.env.SECRET_LESSON_ALLOW_CLOCK === '1',
    nowOverride: typeof process !== 'undefined' ? process.env.SECRET_LESSON_NOW : '',
  });
  if (lessonPhase(now, start) !== 'live') {
    return new Response('Not found', { status: 404, headers: secretResponseHeaders({ 'content-type': 'text/plain; charset=utf-8' }) });
  }
  const bytes = decodeBase64Bytes(PREVIEW_PNG_BASE64);
  return new Response(bytes, {
    status: 200,
    headers: secretResponseHeaders({ 'content-type': 'image/png', 'content-length': String(bytes.length) }),
  });
};
