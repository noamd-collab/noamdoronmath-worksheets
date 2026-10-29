import type { APIRoute } from 'astro';
import bundle from '../../data/teacher-question-previews.json';

export const prerender = false;

// Only geometry for active teacher sheets is compiled into this map. There is
// no filesystem lookup or arbitrary source URL in the request path.
let loading: Promise<Record<string, unknown>> | undefined;
function loadPreviews() {
  if (!loading) {
    const bytes = Uint8Array.from(atob(bundle.gzipBase64), (character) => character.charCodeAt(0));
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    loading = new Response(stream).json();
  }
  return loading;
}

export const GET: APIRoute = async ({ url }) => {
  const pdfId = url.searchParams.get('pdfId') || '';
  if (!/^[a-f0-9]{32}$/.test(pdfId)) {
    return new Response('Invalid worksheet', { status: 400 });
  }
  const previews = await loadPreviews();
  if (!Object.hasOwn(previews, pdfId)) {
    return new Response('Worksheet not found', { status: 404 });
  }
  return new Response(JSON.stringify(previews[pdfId]), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    },
  });
};
