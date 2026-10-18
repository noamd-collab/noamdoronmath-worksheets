/**
 * OG image for the public lesson.
 */
import type { APIRoute } from 'astro';
import { PREVIEW_PNG_BASE64 } from '../../../public-lesson/previewPng';

function decodeBase64Bytes(b64: string): Uint8Array {
  const clean = b64.replace(/\s+/g, '');
  const bin = atob(clean);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

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
