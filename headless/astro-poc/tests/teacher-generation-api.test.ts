import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { handleTeacherGeneration, type GenerationDependencies } from '../src/lib/teacherGeneration';
import { createGenerationStore, GenerationStoreError, generationSessionToken } from '../src/lib/teacherGenerationStore';
import { loadGenerationCurriculum } from '../src/lib/teacherGenerationCurriculum';
import { parseTeacherGenerationCurriculum } from '../src/lib/teacherGenerationContract';
import { authorizeTeacherRequest, TEACHER_SESSION_COOKIE, TEACHER_PRIVATE_HEADERS } from '../src/lib/teacherAccess';
import { TEACHER_ACCESS_CONFIG } from '../src/lib/teacherAccessConfig';

// All Auth, CAPTCHA and transport substitutes below are in-process fixtures.
// This suite never contacts a live Auth, CAPTCHA, storage or model endpoint.
const origin = 'https://www.noamdoronmath.co.il';
const owner = TEACHER_ACCESS_CONFIG.ownerUserId;
const requestKey = '11111111-1111-4111-8111-111111111111';
const jobId = '22222222-2222-4222-8222-222222222222';
const rawCurriculum = readFileSync(new URL('../public/teachers/generation-curriculum.json', import.meta.url));
const curriculum = parseTeacherGenerationCurriculum(JSON.parse(rawCurriculum.toString()));
const lesson = { version: 2, lessonBoundary: {version: 1, kind: 'division_facts', allowedDivisors: [1,2,3,4,5,6,7,8,9,10], maxDividend: 100}, gradeNumber: 3, topicId: 'ג10', level: 'b', lessonGoal: 'practice',
  lastLesson: 'חילוק בתחום לוח הכפל', alreadyLearned: ['כפל'], minutes: 45, questionCount: 12, explicitShortSheet: false };
const requestHash = createHash('sha256').update(JSON.stringify(lesson)).digest('hex');
const job = { id: jobId, request_key: requestKey, request_hash: requestHash, status: 'queued', lesson };
const input = (extra = {}) => ({ requestKey, lesson, botToken: 'local-unit-fixture', ...extra });
function post(body: unknown = input(), headers: Record<string, string> = {}) {
  return new Request(origin + '/api/teacherGeneration', { method: 'POST',
    headers: { origin, 'sec-fetch-site': 'same-origin', 'content-type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body) });
}
function fixture() {
  const calls: string[] = [];
  const store = {
    health: async () => { calls.push('health'); return { online: true, capabilities: { acceptedIntakeVersions: [2], topics: [{ topicId: 'ג10', gradeNumber: 3,
      enabled: true, e2eVerified: true, levels: ['b'], questionCounts: [12] }] } }; },
    list: async () => { calls.push('list'); return []; },
    get: async (_id: string): Promise<any> => { calls.push('get'); return job; },
    findRequest: async (_key: string): Promise<any> => { calls.push('find'); return null; },
    enqueue: async (row: Record<string, unknown>) => { calls.push('enqueue'); assert.equal(row.owner_id, owner); return job; },
    download: async (_owner: string, _id: string, _kind: 'pdf' | 'docx') => { calls.push('download'); return new Response('PDF', { headers: { 'content-length': '3' } }); },
  };
  const deps: GenerationDependencies = { store,
    authorize: async () => { calls.push('auth'); return { ok: true, userId: owner, expiresAt: 2e9 }; },
    loadCurriculum: async () => { calls.push('curriculum'); return curriculum; },
    verifyBot: async () => { calls.push('bot'); return true; },
  };
  return { calls, store, deps };
}
async function code(response: Response, status: number, expected: string) {
  assert.equal(response.status, status); const body = await response.json();
  assert.equal(body.code ?? body.error, expected);
  assert.match(response.headers.get('cache-control')!, /no-store/);
}

test('no session and authenticated non-owner stop before curriculum, bot or storage work', async () => {
  const f = fixture(); delete f.deps.authorize;
  await code(await handleTeacherGeneration(post(), f.deps), 401, 'TEACHER_SIGN_IN_REQUIRED');
  assert.deepEqual(f.calls, []);
  f.deps.authorize = req => authorizeTeacherRequest(req, { fetch: async () => Response.json({
    id: '33333333-3333-4333-8333-333333333333', app_metadata: { provider: 'google' },
  }) });
  await code(await handleTeacherGeneration(post(input(), { cookie: TEACHER_SESSION_COOKIE + '=a.b.c' }), f.deps), 403, 'TEACHER_ACCESS_DENIED');
  assert.deepEqual(f.calls, []);
});

test('owner mutation still requires exact origin and same-origin fetch metadata', async () => {
  const attempts: Record<string, string>[] = [{ origin: 'https://attacker.example' }, { origin: 'null' }, { 'sec-fetch-site': 'cross-site' }];
  for (const headers of attempts) {
    const f = fixture(); await code(await handleTeacherGeneration(post(input(), headers), f.deps), 403, 'ORIGIN_NOT_ALLOWED');
    assert.deepEqual(f.calls, ['auth']);
  }
});

test('unknown-length oversized request streams are cancelled without buffering the rest', async () => {
  let chunks = 0, cancelled = false;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) { chunks++; controller.enqueue(new Uint8Array(16000)); },
    cancel() { cancelled = true; },
  });
  const request = new Request(origin + '/api/teacherGeneration', { method: 'POST',
    headers: { origin, 'sec-fetch-site': 'same-origin', 'content-type': 'application/json' }, body,
    duplex: 'half',
  } as RequestInit);
  const f = fixture(); await code(await handleTeacherGeneration(request, f.deps), 413, 'REQUEST_TOO_LARGE');
  assert.equal(cancelled, true); assert.ok(chunks <= 3, 'reader must stop at the size limit');
  assert.deepEqual(f.calls, ['auth']);
});

test('malformed, oversized and unsupported intake stop before bot or enqueue', async () => {
  for (const [body, status, expected] of [
    ['{broken', 400, 'INVALID_REQUEST'], [[], 400, 'INVALID_REQUEST'],
    [input({ requestKey: '../bad' }), 400, 'INVALID_REQUEST'],
    [input({ lesson: { ...lesson, topicId: 'ג99' } }), 422, 'LESSON_INVALID'],
    [input({ lesson: { ...lesson, gradeNumber: 4 } }), 422, 'LESSON_INVALID'],
    [input({ lesson: { ...lesson, alreadyLearned: ['א'.repeat(121)] } }), 422, 'LESSON_INVALID'],
    [input({ extra: 'x'.repeat(25000) }), 413, 'REQUEST_TOO_LARGE'],
  ] as const) {
    const f = fixture(); await code(await handleTeacherGeneration(post(body), f.deps), status, expected);
    assert.ok(!f.calls.includes('bot') && !f.calls.includes('enqueue'));
  }
  const f = fixture(); await code(await handleTeacherGeneration(post(input(), { 'content-type': 'text/plain' }), f.deps), 415, 'INVALID_REQUEST');
});

test('a retry of an identical normalized request reuses one job without bot or paid enqueue', async () => {
  const f = fixture(); f.store.findRequest = async () => job;
  const response = await handleTeacherGeneration(post(), f.deps);
  assert.equal(response.status, 200); assert.equal((await response.json()).reused, true);
  assert.ok(!f.calls.includes('bot') && !f.calls.includes('enqueue') && !f.calls.includes('health'));
  f.store.findRequest = async () => ({ ...job, request_hash: 'f'.repeat(64) });
  await code(await handleTeacherGeneration(post(), f.deps), 409, 'REQUEST_CONFLICT');
});

test('a duplicate-key race returns the original job only when request hashes match', async () => {
  const f = fixture(); let finds = 0;
  f.store.findRequest = async () => ++finds === 1 ? null : job;
  f.store.enqueue = async () => { throw new GenerationStoreError('REQUEST_CONFLICT', 409); };
  const response = await handleTeacherGeneration(post(), f.deps);
  assert.equal(response.status, 200); assert.equal((await response.json()).reused, true); assert.equal(finds, 2);
});

test('offline or unsupported worker capability prevents bot and enqueue', async () => {
  const offline = fixture(); offline.store.health = async () => ({ online: false, capabilities: { acceptedIntakeVersions: [2], topics: [] } });
  await code(await handleTeacherGeneration(post(), offline.deps), 503, 'GENERATOR_OFFLINE');
  assert.ok(!offline.calls.includes('bot') && !offline.calls.includes('enqueue'));
  for (const changed of [{ lessonGoal: 'assessment' }, { explicitShortSheet: true }, { topicId: 'ג09' }, { level: 'a' }, { questionCount: 13 }]) {
    const f = fixture(); await code(await handleTeacherGeneration(post(input({ lesson: { ...lesson, ...changed } })), f.deps), 422, 'topicId' in changed ? 'LESSON_INVALID' : 'TOPIC_NOT_SUPPORTED_YET');
    assert.ok(!f.calls.includes('bot') && !f.calls.includes('enqueue'));
  }
  for (const changed of [{ enabled: false }, { e2eVerified: false }, { levels: [] }, { questionCounts: [] }]) {
    const f = fixture();
    f.store.health = async () => ({ online: true, capabilities: { acceptedIntakeVersions: [2], topics: [{ topicId: 'ג10', gradeNumber: 3,
      enabled: true, e2eVerified: true, levels: ['b'], questionCounts: [12], ...changed }] } });
    await code(await handleTeacherGeneration(post(), f.deps), 422, 'TOPIC_NOT_SUPPORTED_YET');
    assert.ok(!f.calls.includes('bot') && !f.calls.includes('enqueue'));
  }
});

test('bot denial never enqueues; successful validation enqueues an owner-bound request', async () => {
  const f = fixture(); f.deps.verifyBot = async () => false;
  await code(await handleTeacherGeneration(post(), f.deps), 403, 'BOT_VERIFICATION_FAILED');
  assert.ok(!f.calls.includes('enqueue'));
  const success = fixture(); const response = await handleTeacherGeneration(post(), success.deps);
  assert.equal(response.status, 202); assert.equal(success.calls.filter(x => x === 'enqueue').length, 1);
  assert.ok(success.calls.indexOf('bot') < success.calls.indexOf('enqueue'));
});

test('draft downloads require a completed review-state job and passing automated checks', async () => {
  for (const candidate of [null, job, { ...job, status: 'running' }, { ...job, status: 'needs_review', result: {} },
    { ...job, status: 'needs_review', result: { automatedChecksPassed: 'true' } }]) {
    const f = fixture(); f.store.get = async () => candidate;
    const response = await handleTeacherGeneration(new Request(origin + '/api/teacherGeneration?id=' + jobId + '&file=pdf'), f.deps);
    await code(response, candidate ? 409 : 404, candidate ? 'DRAFT_NOT_AVAILABLE' : 'JOB_NOT_FOUND');
    assert.ok(!f.calls.includes('download'));
  }
  for (const [kind, mime] of [['pdf', 'application/pdf'], ['docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']]) {
    const f = fixture(); f.store.get = async () => { f.calls.push('get'); return { ...job, status: 'needs_review', result: { automatedChecksPassed: true } }; };
    const response = await handleTeacherGeneration(new Request(origin + '/api/teacherGeneration?id=' + jobId + '&file=' + kind), f.deps);
    assert.equal(response.status, 200); assert.equal(await response.text(), 'PDF');
    assert.equal(response.headers.get('content-type'), mime);
    assert.equal(response.headers.get('content-disposition'), `attachment; filename="worksheet-${jobId}.${kind}"`);
    assert.equal(response.headers.get('content-length'), '3');
    // A bare sandbox blocks even a normal navigation to an attachment. Only
    // permit downloads: scripts, same-origin privileges and popups stay denied.
    assert.equal(response.headers.get('content-security-policy'), "default-src 'none'; sandbox allow-downloads");
    for (const [name, value] of Object.entries(TEACHER_PRIVATE_HEADERS)) assert.equal(response.headers.get(name), value);
    assert.deepEqual(f.calls, ['auth', 'get', 'download']);
  }
});

test('download IDs, file kinds and missing or oversized response lengths fail closed', async () => {
  const f = fixture(); f.store.get = async () => ({ ...job, status: 'needs_review', result: { automatedChecksPassed: true } });
  await code(await handleTeacherGeneration(new Request(origin + '/api/teacherGeneration?id=bad&file=pdf'), f.deps), 400, 'INVALID_JOB');
  await code(await handleTeacherGeneration(new Request(origin + '/api/teacherGeneration?id=' + jobId + '&file=../json'), f.deps), 400, 'INVALID_FILE');
  for (const length of ['', '0', '15728641', 'NaN']) {
    f.store.download = async () => new Response('bad', { headers: length ? { 'content-length': length } : {} });
    await code(await handleTeacherGeneration(new Request(origin + '/api/teacherGeneration?id=' + jobId + '&file=pdf'), f.deps), 503, 'DRAFT_NOT_AVAILABLE');
  }
});

test('store reads use the user token; only enqueue uses the server key, and paths are fixed', async () => {
  const calls: { url: string; init: RequestInit }[] = [];
  const store = createGenerationStore('unit-user-token', async (url, init) => {
    calls.push({ url: String(url), init: init! }); return Response.json([job]);
  }, 'unit-service-key');
  await store.list(); await store.enqueue({ owner_id: owner }); await store.download(owner, jobId, 'pdf');
  assert.equal(new Headers(calls[0].init.headers).get('authorization'), 'Bearer unit-user-token');
  assert.equal(new Headers(calls[1].init.headers).get('authorization'), 'Bearer unit-service-key');
  assert.equal(new Headers(calls[2].init.headers).get('authorization'), 'Bearer unit-user-token');
  assert.equal(calls[2].url, TEACHER_ACCESS_CONFIG.supabaseUrl + '/storage/v1/object/authenticated/teacher-generation-private/' + owner + '/' + jobId + '/sheet.pdf');
  for (const call of calls) { assert.equal(call.init.redirect, 'error'); assert.equal(call.init.credentials, 'omit'); }
  await assert.rejects(createGenerationStore('token', async () => { throw Error('must not fetch'); }).enqueue({}), GenerationStoreError);
  await assert.rejects(store.download('../owner', jobId, 'pdf'), GenerationStoreError);
});

test('store heartbeat expires, rejects future clocks, and provider errors reveal no SQL or secrets', async () => {
  for (const [date, expected] of [[Date.now(), true], [Date.now() - 100000, false], [Date.now() + 30000, false], [NaN, false]] as const) {
    const store = createGenerationStore('token', async () => Response.json([{ updated_at: Number.isFinite(date) ? new Date(date).toISOString() : 'bad', capabilities: { acceptedIntakeVersions: [2] } }]));
    assert.equal((await store.health()).online, expected);
  }
  const store = createGenerationStore('token', async () => new Response('secret SQL row', { status: 500 }));
  await assert.rejects(store.list(), (error: unknown) => error instanceof GenerationStoreError && error.message === 'GENERATION_UNAVAILABLE');
  assert.throws(() => generationSessionToken(new Request(origin, { headers: { cookie: `${TEACHER_SESSION_COOKIE}=one;${TEACHER_SESSION_COOKIE}=two` } })), GenerationStoreError);
});

test('curriculum loader rejects tampering and oversized content before caching a verified catalog', async () => {
  await assert.rejects(loadGenerationCurriculum(origin, async () => new Response('{}')), /CURRICULUM_HASH_MISMATCH/);
  await assert.rejects(loadGenerationCurriculum(origin, async () => new Response('x'.repeat(100001))), /CURRICULUM_SIZE/);
  let destination = '';
  const loaded = await loadGenerationCurriculum(origin, async (url, init) => {
    destination = String(url); assert.equal(init?.redirect, 'error'); assert.equal(init?.credentials, 'omit'); return new Response(rawCurriculum);
  });
  assert.equal(destination, origin + '/teachers/generation-curriculum.json'); assert.equal(loaded.topics.length, 232);
  assert.equal(await loadGenerationCurriculum(origin, async () => { throw Error('verified cache should avoid fetch'); }), loaded);
});

test('old intake and impossible teaching bounds fail before bot verification or enqueue', async () => {
  const old = {...lesson,version:1}; delete (old as any).lessonBoundary;
  for(const value of [old, {...lesson,lessonBoundary:undefined},
    {...lesson,lessonBoundary:{version:1,kind:'division_facts',allowedDivisors:[10],maxDividend:10}}]) {
    const f=fixture(); const response=await handleTeacherGeneration(post(input({lesson:value})),f.deps);
    assert.equal(response.status,422);
    assert.ok(!f.calls.includes('bot') && !f.calls.includes('enqueue'));
  }
});

test('completed legacy job remains readable and downloadable without intake revalidation', async () => {
  const f=fixture(); const old={...lesson,version:1}; delete (old as any).lessonBoundary;
  f.store.get=async()=>({...job,lesson:old,status:'needs_review',result:{automatedChecksPassed:true}});
  assert.equal((await handleTeacherGeneration(new Request(origin+'/api/teacherGeneration?id='+jobId),f.deps)).status,200);
  assert.equal((await handleTeacherGeneration(new Request(origin+'/api/teacherGeneration?id='+jobId+'&file=pdf'),f.deps)).status,200);
});


test('fresh old-worker heartbeats cannot advertise v2 readiness or enqueue but history remains available', async () => {
  for(const acceptedIntakeVersions of [undefined, [1], ['2'], null]) {
    const f=fixture();
    f.store.health=async()=>({online:true,capabilities:{acceptedIntakeVersions,topics:[]}} as any);
    f.store.list=async()=>[{...job,lesson:{...lesson,version:1}}] as any;
    const status=await handleTeacherGeneration(new Request(origin+'/api/teacherGeneration'),f.deps);
    const body=await status.json(); assert.equal(body.online,false); assert.equal(body.jobs.length,1);
    await code(await handleTeacherGeneration(post(),f.deps),503,'GENERATOR_OFFLINE');
    assert.ok(!f.calls.includes('bot') && !f.calls.includes('enqueue'));
    const store=createGenerationStore('token',async()=>Response.json([{updated_at:new Date().toISOString(),capabilities:{acceptedIntakeVersions}}]));
    assert.equal((await store.health()).online,false);
  }
});
