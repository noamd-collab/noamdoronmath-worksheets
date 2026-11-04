import type { APIRoute } from 'astro';
import bundle from '../../data/teacher-word-content.json';
import { selectWordQuestions, type WordBank } from '../../lib/teacherWordSelection';

export const prerender = false;
let loading: Promise<WordBank> | undefined;
function loadBank() {
  if (!loading) {
    const bytes = Uint8Array.from(atob(bundle.gzipBase64), (c) => c.charCodeAt(0));
    loading = new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).json();
  }
  return loading;
}
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), {
  status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
});

export const POST: APIRoute = async ({ request }) => {
  if (!request.headers.get('content-type')?.startsWith('application/json')) return json({ error: 'INVALID_REQUEST' }, 415);
  if (Number(request.headers.get('content-length') || 0) > 24000) return json({ error: 'INVALID_REQUEST' }, 413);
  try {
    const text = await request.text();
    if (text.length > 24000) return json({ error: 'INVALID_REQUEST' }, 413);
    const body = JSON.parse(text), result = selectWordQuestions(await loadBank(), body.selection);
    if (result.missing.length) return json({ error: 'WORD_CONTENT_UNAVAILABLE', missing: result.missing }, 422);
    if (result.required.length) return json({ error: 'WORD_CONTEXT_REQUIRED', required: result.required }, 409);
    return json(result);
  } catch {
    return json({ error: 'INVALID_SELECTION' }, 400);
  }
};
