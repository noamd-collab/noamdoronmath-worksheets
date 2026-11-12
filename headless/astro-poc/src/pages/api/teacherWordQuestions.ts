import type { APIRoute } from 'astro';
import bundle from '../../data/teacher-word-descriptor.json';
import { createWordBankLoader } from '../../lib/teacherWordBank';
import { selectWordQuestions } from '../../lib/teacherWordSelection';
import { requireGoogleTeacher, teacherAccessFailure, TEACHER_PRIVATE_HEADERS } from '../../lib/teacherAccess';

export const prerender = false;
const loadBank = createWordBankLoader(bundle, fetch, import.meta.env?.DEV);
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), {
  status, headers: { ...TEACHER_PRIVATE_HEADERS, 'Content-Type': 'application/json; charset=utf-8' },
});

export const POST: APIRoute = async ({ request }) => {
  const access = await requireGoogleTeacher(request);
  if (!access.ok) return teacherAccessFailure(access);
  if (!request.headers.get('content-type')?.startsWith('application/json')) return json({ error: 'INVALID_REQUEST' }, 415);
  if (Number(request.headers.get('content-length') || 0) > 24000) return json({ error: 'INVALID_REQUEST' }, 413);
  try {
    const text = await request.text();
    if (text.length > 24000) return json({ error: 'INVALID_REQUEST' }, 413);
    const body = JSON.parse(text);
    let bank;
    try { bank = await loadBank(request.url, request.headers.get('x-wix-forwarded-url')); }
    catch { return json({ error: 'WORD_CONTENT_UNAVAILABLE_TEMPORARILY' }, 503); }
    const result = selectWordQuestions(bank, body.selection);
    if (result.missing.length) return json({ error: 'WORD_CONTENT_UNAVAILABLE', missing: result.missing }, 422);
    if (result.required.length) return json({ error: 'WORD_CONTEXT_REQUIRED', required: result.required }, 409);
    return json(result);
  } catch {
    return json({ error: 'INVALID_SELECTION' }, 400);
  }
};
