import { requireOwnerTeacher, teacherAccessFailure, TEACHER_PRIVATE_HEADERS, type TeacherAccessResult } from './teacherAccess';
import { sameOriginTeacherMutation } from './teacherSession';
import { createGenerationStore, generationSessionToken, GenerationStoreError, uuid } from './teacherGenerationStore';
import { validateTeacherGenerationIntake, type TeacherGenerationCurriculum } from './teacherGenerationContract';

const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: TEACHER_PRIVATE_HEADERS });
export interface GenerationDependencies {
  authorize?: (request: Request) => Promise<TeacherAccessResult>;
  store?: ReturnType<typeof createGenerationStore>;
  loadCurriculum: () => Promise<TeacherGenerationCurriculum>;
  verifyBot: (token: unknown) => Promise<boolean>;
  enqueueKey?: string;
}
const error = (code: string, status = 400) => reply({ ok: false, code }, status);
async function boundedBody(request: Request): Promise<string | null> {
  if(!request.body)return '';
  const reader=request.body.getReader(), decoder=new TextDecoder('utf-8',{fatal:true});
  let bytes=0,text='';
  try {for(;;){const part=await reader.read();if(part.done)break;bytes+=part.value.length;if(bytes>24000)return null;text+=decoder.decode(part.value,{stream:true});}return text+decoder.decode();}
  finally {void reader.cancel().catch(()=>{});reader.releaseLock();}
}
export async function handleTeacherGeneration(request: Request, deps: GenerationDependencies): Promise<Response> {
  // Always owner-only. Never classify a request by browser-controlled intent.
  const access = await (deps.authorize ?? requireOwnerTeacher)(request);
  if (!access.ok) return teacherAccessFailure(access);
  if (request.method !== 'GET' && request.method !== 'POST') return error('METHOD_NOT_ALLOWED', 405);
  if (request.method === 'POST' && !sameOriginTeacherMutation(request)) return error('ORIGIN_NOT_ALLOWED', 403);
  try {
    const store = deps.store ?? createGenerationStore(generationSessionToken(request), fetch, deps.enqueueKey);
    const query = new URL(request.url).searchParams;
    if (request.method === 'GET') {
      const id = query.get('id');
      if (id && !uuid(id)) return error('INVALID_JOB');
      if (!id) return reply({ ok: true, ...await store.health(), jobs: await store.list() });
      const job = await store.get(id);
      if (!job) return error('JOB_NOT_FOUND', 404);
      const kind = query.get('file');
      if (!kind) return reply({ ok: true, job });
      if (kind !== 'pdf' && kind !== 'docx') return error('INVALID_FILE');
      if (job.status !== 'needs_review' || job.result?.automatedChecksPassed !== true) return error('DRAFT_NOT_AVAILABLE', 409);
      const file = await store.download(access.userId, id, kind);
      if (!file.ok) return error('DRAFT_NOT_AVAILABLE', 503);
      const length = Number(file.headers.get('content-length'));
      if (!Number.isSafeInteger(length) || length <= 0 || length > 15728640) return error('DRAFT_NOT_AVAILABLE', 503);
      return new Response(file.body, { headers: { ...TEACHER_PRIVATE_HEADERS,
        'Content-Type': kind === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Length': String(length), 'Content-Disposition': `attachment; filename="worksheet-${id}.${kind}"`,
        'Content-Security-Policy': "default-src 'none'; sandbox allow-downloads",
      } });
    }
    if (!deps.enqueueKey && !deps.store) return error('GENERATION_UNAVAILABLE', 503);
    if (!request.headers.get('content-type')?.startsWith('application/json')) return error('INVALID_REQUEST', 415);
    const declared = Number(request.headers.get('content-length') || 0);
    if (!Number.isFinite(declared) || declared < 0 || declared > 24000) return error('REQUEST_TOO_LARGE', 413);
    const text = await boundedBody(request);
    if (text === null) return error('REQUEST_TOO_LARGE', 413);
    let input: any;
    try { input = JSON.parse(text); } catch { return error('INVALID_REQUEST'); }
    if (!input || Array.isArray(input) || !uuid(input.requestKey)) return error('INVALID_REQUEST');
    const checked = validateTeacherGenerationIntake(input.lesson, await deps.loadCurriculum());
    if (!checked.ok) return reply({ ok: false, code: 'LESSON_INVALID', issues: checked.issues }, 422);
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(checked.value)));
    const requestHash = Array.from(new Uint8Array(digest), n => n.toString(16).padStart(2, '0')).join('');
    const existing = await store.findRequest(input.requestKey);
    if (existing) return existing.request_hash === requestHash ? reply({ ok: true, job: existing, reused: true }) : error('REQUEST_CONFLICT', 409);
    const health = await store.health();
    if (!health.online) return error('GENERATOR_OFFLINE', 503);
    const capability = health.capabilities?.topics?.find((t: any) => t.topicId === checked.value.topicId && t.gradeNumber === checked.value.gradeNumber);
    if (!capability || capability.enabled !== true || capability.e2eVerified !== true ||
      !Array.isArray(capability.levels) || !capability.levels.includes(checked.value.level) ||
      !Array.isArray(capability.questionCounts) || !capability.questionCounts.includes(checked.value.questionCount) ||
      !['practice', 'review'].includes(checked.value.lessonGoal) || checked.value.explicitShortSheet) return error('TOPIC_NOT_SUPPORTED_YET', 422);
    if (!await deps.verifyBot(input.botToken)) return error('BOT_VERIFICATION_FAILED', 403);
    try {
      const job = await store.enqueue({ owner_id: access.userId, request_key: input.requestKey, request_hash: requestHash, lesson: checked.value });
      return reply({ ok: true, job }, 202);
    } catch (e) {
      // A network retry with the same key never starts a second paid task.
      if (e instanceof GenerationStoreError && e.code === 'REQUEST_CONFLICT') {
        const raced = await store.findRequest(input.requestKey);
        if (raced?.request_hash === requestHash) return reply({ ok: true, job: raced, reused: true });
      }
      throw e;
    }
  } catch (e) {
    if (e instanceof GenerationStoreError) return error(e.code, e.status);
    return error('GENERATION_UNAVAILABLE', 503);
  }
}
