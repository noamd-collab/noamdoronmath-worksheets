import type { APIRoute } from 'astro';
import previews from '../../data/teacher-question-previews.json';

export const prerender = false;

// Only geometry for active teacher sheets is compiled into this map. There is
// no filesystem lookup or arbitrary source URL in the request path.
export const GET: APIRoute = ({ url }) => {
  const pdfId = url.searchParams.get('pdfId') || '';
  if (!/^[a-f0-9]{32}$/.test(pdfId)) {
    return new Response('Invalid worksheet', { status: 400 });
  }
  if (!Object.hasOwn(previews, pdfId)) {
    return new Response('Worksheet not found', { status: 404 });
  }
  return new Response(JSON.stringify(previews[pdfId as keyof typeof previews]), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    },
  });
};
