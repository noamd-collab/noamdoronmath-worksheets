/**
 * OG image for the public lesson. Same bundled PNG as the unlisted link, always available.
 */
import type { APIRoute } from 'astro';
import { PREVIEW_PNG_BASE64 } from '../../../secret-lesson/previewPng';
import { decodeBase64Bytes } from '../../../lib/secretLessonPage';

export const prerender = false;

export const GET: APIRoute = () => {
  const bytes = decodeBase64Bytes(PREVIEW_PNG_BASE64);
  return new Response(bytes, {
    status: 200,
    headers: {
      'content-type': 'image/png',
      'content-length': String(bytes.length),
      'cache-control': 'public, max-age=86400',
    },
  });
};
