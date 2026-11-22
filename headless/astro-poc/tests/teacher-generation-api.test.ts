import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { handleTeacherGeneration, type GenerationDependencies } from '../src/lib/teacherGeneration';
import { createGenerationStore, GenerationStoreError, generationSessionToken } from '../src/lib/teacherGenerationStore';
import { loadGenerationCurriculum } from '../src/lib/teacherGenerationCurriculum';
import { parseTeacherGenerationCurriculum, GENERATION_CURRICULUM_SHA256 } from '../src/lib/teacherGenerationContract';
import { authorizeTeacherRequest, TEACHER_SESSION_COOKIE, TEACHER_PRIVATE_HEADERS } from '../src/lib/teacherAccess';
import { TEACHER_ACCESS_CONFIG } from '../src/lib/teacherAccessConfig';
import { createTeacherWorkerWake } from '../src/lib/teacherWorkerWake';

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
    quota: async () => ({ dailyLimit:null, remainingToday:null, resetsAt:'2026-11-22T22:00:00Z' }),
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

test('version3 grade8 uses pinned general profile and explicit scope without claiming e2e verification',async()=>{
 const f=fixture(),lesson3={...lesson,version:3,gradeNumber:8,topicId:'g8:congruence',questionCount:20,alreadyLearned:[],
  lessonBoundary:{version:1,kind:'curriculum_scope',curriculumSha256:GENERATION_CURRICULUM_SHA256,conceptIds:['g8:congruence#0']}};
 const capabilities={profile:'general-skill-source/v1',curriculumSha256:GENERATION_CURRICULUM_SHA256,acceptedIntakeVersions:[2,3],
  topics:[{topicId:lesson3.topicId,gradeNumber:8,enabled:true,e2eVerified:false,readiness:'private_draft',levels:['b','a','e'],questionCounts:[20]}]};
 f.store.health=async()=>({online:true,capabilities}) as any;
 assert.equal((await handleTeacherGeneration(post(input({lesson:lesson3})),f.deps)).status,202);
 assert.equal(f.calls.filter(x=>x==='bot').length,1);assert.equal(f.calls.filter(x=>x==='enqueue').length,1);
 for(const mutation of [(c:any)=>{c.profile='unknown';},(c:any)=>{c.curriculumSha256='0'.repeat(64);},(c:any)=>{c.acceptedIntakeVersions=[2];},
  (c:any)=>{c.topics[0].enabled=false;},(c:any)=>{c.topics[0].readiness='planned';},(c:any)=>{c.topics[0].gradeNumber=7;},
  (c:any)=>{c.topics[0].levels=['a'];},(c:any)=>{c.topics[0].questionCounts=[21];}]) {
  const invalid=structuredClone(capabilities);mutation(invalid);f.calls.length=0;
  f.store.health=async()=>({online:true,capabilities:invalid}) as any;
  await code(await handleTeacherGeneration(post(input({lesson:lesson3})),f.deps),422,'TOPIC_NOT_SUPPORTED_YET');
  assert.ok(!f.calls.includes('enqueue')&&!f.calls.includes('bot'));
 }
});

test('status uses the authorized database session for the Jerusalem allowance and never accepts a browser owner override', async () => {
  const f=fixture();
  const response=await handleTeacherGeneration(new Request(origin+'/api/teacherGeneration?ownerId=untrusted&dailyLimit=0'),f.deps);
  assert.deepEqual((await response.json()).quota,await f.store.quota());
  const remaining={dailyLimit:5,remainingToday:2,resetsAt:'2026-11-23T00:00:00+02:00'};
  const store=createGenerationStore('unit-user-token',async(url,init)=>{
    assert.equal(new URL(String(url)).pathname,'/rest/v1/rpc/noam_teacher_generation_quota_status');
    assert.deepEqual(JSON.parse(String(init?.body)),{});
    assert.equal(new Headers(init?.headers).get('authorization'),'Bearer unit-user-token');
    return Response.json({...remaining,ignored:'not returned'});
  },'fixture-server-key');
  assert.deepEqual(await store.quota(),remaining);
});

test('active creation and exhausted daily quota have distinct responses, gateway throttles stay service errors', async () => {
  for(const [status,body,expected] of [
    [423,{code:'PT423',message:'GENERATION_ACTIVE'},'GENERATION_ACTIVE'],
    [429,{code:'PT429',message:'GENERATION_LIMIT'},'GENERATION_LIMIT'],
    [429,{error:'rate limit'},'GENERATION_UNAVAILABLE'],
  ] as const){
    const store=createGenerationStore('unit-user-token',async()=>Response.json(body,{status}),'fixture-server-key');
    await assert.rejects(store.enqueue({}),e=>e instanceof GenerationStoreError && e.code===expected);
  }
});

test('actual Python general heartbeat agrees with API admission for all232 source topics and retains v2 bounds',async()=>{
 const capabilities=JSON.parse(execFileSync('python3',['-c',"import json; from pathlib import Path; from runtime_catalog import general_capabilities; print(json.dumps(general_capabilities(json.loads(Path('capabilities.json').read_text()))))"],{
  cwd:fileURLToPath(new URL('../../../tools/teacher-generation/',import.meta.url)),encoding:'utf8'}));
 assert.equal(capabilities.topics.length,232);assert.equal(capabilities.profile,'general-skill-source/v1');
 for(const cap of capabilities.topics) {
  const f=fixture();f.store.health=async()=>({online:true,capabilities});
  const topicLesson={...lesson,version:3,gradeNumber:cap.gradeNumber,topicId:cap.topicId,level:cap.levels[0],questionCount:cap.questionCounts[0],alreadyLearned:[],
   lessonBoundary:{version:1,kind:'curriculum_scope',curriculumSha256:GENERATION_CURRICULUM_SHA256,conceptIds:[cap.topicId+'#0']}};
  assert.equal((await handleTeacherGeneration(post(input({lesson:topicLesson})),f.deps)).status,202,cap.topicId);
 }
 const f=fixture();f.store.health=async()=>({online:true,capabilities});
 assert.equal((await handleTeacherGeneration(post(),f.deps)).status,202,'legacy v2 supported draft');
 f.calls.length=0;await code(await handleTeacherGeneration(post(input({lesson:{...lesson,level:'a',questionCount:20}})),f.deps),422,'TOPIC_NOT_SUPPORTED_YET');
 assert.ok(!f.calls.includes('enqueue')&&!f.calls.includes('bot'));
});

test('owner can download an explicit general review draft only with successful rendering and no failed checks',async()=>{
 const result={authoringProfile:'general-skill-source/v1',automatedChecksPassed:false,renderingChecksPassed:true,humanReviewRequired:true,
  checks:[{name:'render',status:'PASS'},{name:'didactic',status:'REVIEW'}],reviewFindings:[{code:'DIDACTIC_REVIEW',count:1}]};
 const url=origin+'/api/teacherGeneration?id='+jobId+'&file=pdf';
 const f=fixture();f.store.get=async()=>({...job,status:'needs_review',result});
 assert.equal((await handleTeacherGeneration(new Request(url),f.deps)).status,200);
 for(const change of [{authoringProfile:'unknown'},{renderingChecksPassed:false},{humanReviewRequired:false},{checks:[]},{checks:[{status:'FAIL'}]},{checks:[{status:'SKIP'}]},{automatedChecksPassed:true,checks:[{status:'FAIL'}]}]) {
  f.calls.length=0;f.store.get=async()=>({...job,status:'needs_review',result:{...result,...change}});
  await code(await handleTeacherGeneration(new Request(url),f.deps),409,'DRAFT_NOT_AVAILABLE');
  assert.ok(!f.calls.includes('download'));
 }
 for(const status of [401,403] as const) {
  f.calls.length=0;f.deps.authorize=async()=>({ok:false,status,code:status===401?'TEACHER_SIGN_IN_REQUIRED':'TEACHER_ACCESS_DENIED'});
  assert.equal((await handleTeacherGeneration(new Request(url),f.deps)).status,status);assert.deepEqual(f.calls,[]);
 }
});

test('anonymous and non-owner requests never wake cloud compute, including health GET', async () => {
  for (const status of [401, 403] as const) for (const request of [post(), new Request(origin + '/api/teacherGeneration')]) {
    const f = fixture();
    f.deps.authorize = async () => { f.calls.push('auth'); return { ok: false, status, code: status === 401 ? 'TEACHER_SIGN_IN_REQUIRED' : 'TEACHER_ACCESS_DENIED' }; };
    f.deps.wake = async () => { f.calls.push('wake'); return 'accepted'; };
    assert.equal((await handleTeacherGeneration(request, f.deps)).status, status);
    assert.deepEqual(f.calls, ['auth']);
  }
});

test('owner health may request a wake but only a fresh compatible heartbeat makes it online', async () => {
  const f = fixture();
  f.deps.wake = async () => { f.calls.push('wake'); return 'accepted'; };
  const health = await f.store.health(); f.calls.length = 0;
  for (const [online, versions, expected] of [[false, [2], false], [true, [1], false], [true, [2], true]] as const) {
    f.store.health = async () => { f.calls.push('health'); return { ...health, online, capabilities: { ...health.capabilities, acceptedIntakeVersions: [...versions] } }; };
    const response = await handleTeacherGeneration(new Request(origin + '/api/teacherGeneration'), f.deps);
    const body = await response.json();
    assert.equal(body.online, expected); assert.equal(body.waking, !expected);
    assert.deepEqual(f.calls, ['auth','wake','health','list']); f.calls.length = 0;
  }
});

test('malformed configured cloud fails closed despite a live local heartbeat, while history stays readable', async () => {
  const f = fixture(); let networkCalls = 0;
  f.deps.wake = createTeacherWorkerWake({ url: 'http://localhost', secret: '1'.repeat(64) }, async () => { networkCalls++; throw Error('must not fetch'); });
  const body = await (await handleTeacherGeneration(new Request(origin + '/api/teacherGeneration'), f.deps)).json();
  assert.equal(body.online, false); assert.equal(body.waking, false); assert.deepEqual(body.jobs, []);
  await code(await handleTeacherGeneration(post(), f.deps), 503, 'GENERATOR_OFFLINE');
  assert.equal(networkCalls, 0); assert.ok(!f.calls.includes('bot') && !f.calls.includes('enqueue'));
});

test('cold create requests stop after validation and idempotency, before CAPTCHA, quota or paid enqueue', async () => {
  const f = fixture();
  f.deps.wake = async () => { f.calls.push('wake'); return 'accepted'; };
  const health = await f.store.health(); f.calls.length = 0;
  f.store.health = async () => { f.calls.push('health'); return { ...health, online: false }; };
  await code(await handleTeacherGeneration(post(), f.deps), 503, 'GENERATOR_WAKING');
  assert.deepEqual(f.calls, ['auth','curriculum','find','wake','health']);
  f.calls.length = 0;
  f.store.findRequest = async () => { f.calls.push('find'); return job; };
  const reused = await (await handleTeacherGeneration(post(), f.deps)).json();
  assert.equal(reused.reused, true);
  assert.deepEqual(f.calls, ['auth','curriculum','find','wake'], 'queued retry only dispatches the original job, without another enqueue or CAPTCHA');
});

test('a wake timeout cannot reuse an old fresh heartbeat as cloud readiness', async () => {
  const f = fixture(); f.deps.wake = async () => { f.calls.push('wake'); return 'pending'; };
  const status = await (await handleTeacherGeneration(new Request(origin + '/api/teacherGeneration'), f.deps)).json();
  assert.equal(status.online, false); assert.equal(status.waking, true);
  f.calls.length = 0;
  await code(await handleTeacherGeneration(post(), f.deps), 503, 'GENERATOR_WAKING');
  assert.deepEqual(f.calls, ['auth','curriculum','find','wake','health']);
});

test('a warm cloud still uses the unchanged CAPTCHA and database quota gates exactly once', async () => {
  for (const limited of [false, true]) {
    const f = fixture(); f.deps.wake = async () => { f.calls.push('wake'); return 'accepted'; };
    if (limited) f.store.enqueue = async () => { f.calls.push('enqueue'); throw new GenerationStoreError('GENERATION_LIMIT', 429); };
    const response = await handleTeacherGeneration(post(), f.deps);
    assert.equal(response.status, limited ? 429 : 202);
    if (limited) assert.equal((await response.json()).code, 'GENERATION_LIMIT');
    assert.deepEqual(f.calls, ['auth','curriculum','find','wake','health','bot','enqueue',...(limited ? [] : ['wake'])]);
  }
});

test('a prior consumer failure cannot remove the post-enqueue dispatch request', async () => {
  const f=fixture();let consumer=true,wakes=0;
  f.deps.wake=async()=>{f.calls.push('wake');if(++wakes===2)consumer=true;return 'accepted';};
  f.deps.verifyBot=async()=>{f.calls.push('bot');consumer=false;return true;};
  f.store.enqueue=async()=>{f.calls.push('enqueue');assert.equal(consumer,false);return job;};
  const response=await handleTeacherGeneration(post(),f.deps);const body=await response.json();
  assert.equal(response.status,202);assert.equal(body.job.id,jobId);assert.equal(body.dispatchPending,false);assert.equal(consumer,true);
  assert.deepEqual(f.calls,['auth','curriculum','find','wake','health','bot','enqueue','wake']);
});

test('post-enqueue wake failure preserves one queued job and same-key retry only dispatches it', async () => {
  for(const outcome of ['pending','unavailable','throw'] as const){
    const f=fixture();let wakes=0;
    f.deps.wake=async()=>{f.calls.push('wake');if(++wakes===1)return 'accepted';if(outcome==='throw')throw Error('local transport fixture');return outcome;};
    const response=await handleTeacherGeneration(post(),f.deps);const body=await response.json();
    assert.equal(response.status,202);assert.equal(body.job.id,jobId);assert.equal(body.job.request_key,requestKey);assert.equal(body.dispatchPending,true);
    assert.equal(f.calls.filter(c=>c==='enqueue').length,1);assert.equal(f.calls.filter(c=>c==='bot').length,1);
    f.calls.length=0;f.store.findRequest=async()=>{f.calls.push('find');return job;};
    f.deps.wake=async()=>{f.calls.push('wake');return 'accepted';};
    const reused=await (await handleTeacherGeneration(post(),f.deps)).json();
    assert.equal(reused.reused,true);assert.equal(reused.job.id,jobId);assert.equal(reused.job.request_key,requestKey);assert.equal(reused.dispatchPending,false);
    assert.deepEqual(f.calls,['auth','curriculum','find','wake']);
  }
});

test('same-key active or terminal replay never dispatches or retries a model', async () => {
  for(const status of ['running','needs_review','failed']){
    const f=fixture();f.store.findRequest=async()=>{f.calls.push('find');return {...job,status};};
    f.deps.wake=async()=>{throw Error('must not wake');};
    const response=await handleTeacherGeneration(post(),f.deps);const body=await response.json();
    assert.equal(response.status,200);assert.equal(body.reused,true);assert.equal(body.job.status,status);assert.equal('dispatchPending' in body,false);
    assert.deepEqual(f.calls,['auth','curriculum','find']);
  }
});

test('an enqueue conflict dispatches the original queued job without a second reservation', async () => {
  const f=fixture();let finds=0;f.store.findRequest=async()=>{f.calls.push('find');return ++finds===1?null:job;};
  f.store.enqueue=async()=>{f.calls.push('enqueue');throw new GenerationStoreError('REQUEST_CONFLICT',409);};
  f.deps.wake=async()=>{f.calls.push('wake');return 'accepted';};
  const response=await handleTeacherGeneration(post(),f.deps);const body=await response.json();
  assert.equal(response.status,200);assert.equal(body.reused,true);assert.equal(body.job.id,jobId);assert.equal(body.dispatchPending,false);
  assert.deepEqual(f.calls,['auth','curriculum','find','wake','health','bot','enqueue','find','wake']);
});

test('invalid input and cross-origin POST cannot wake, while job and download GETs do not wake unnecessarily', async () => {
  for (const request of [post(input(), { origin: 'https://evil.test' }), post(input({ lesson: { ...lesson, version: 1 } }))]) {
    const f = fixture(); f.deps.wake = async () => { f.calls.push('wake'); return 'accepted'; };
    assert.ok((await handleTeacherGeneration(request, f.deps)).status >= 400);
    assert.ok(!f.calls.includes('wake'));
  }
  for (const suffix of ['', '&file=pdf', '&file=docx']) {
    const f = fixture(); f.deps.wake = async () => { f.calls.push('wake'); return 'accepted'; };
    f.store.get = async () => { f.calls.push('get'); return { ...job, status: 'needs_review', result: { automatedChecksPassed: true } }; };
    assert.equal((await handleTeacherGeneration(new Request(origin + '/api/teacherGeneration?id=' + jobId + suffix), f.deps)).status, 200);
    assert.ok(!f.calls.includes('wake'));
  }
});

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

test('insufficient minority division facts fail before any store call or paid job creation', async () => {
  for (const [allowedDivisors, maxDividend] of [[[1,10],10], [[1,9,10],10], [[1,10],20]] as const) {
    const f = fixture();
    const value = {...lesson, lessonBoundary:{version:1,kind:'division_facts',allowedDivisors:[...allowedDivisors],maxDividend}};
    const response = await handleTeacherGeneration(post(input({lesson:value})), f.deps);
    assert.equal(response.status, 422);
    const body = await response.json();
    assert.equal(body.code, 'LESSON_INVALID');
    assert.ok(body.issues.some((issue: any) => issue.field === 'lessonBoundary' && issue.code === 'BOUNDARY_TOO_NARROW'));
    assert.match(response.headers.get('cache-control')!, /no-store/);
    assert.deepEqual(f.calls, ['auth','curriculum'], 'no request lookup, worker health, CAPTCHA or create RPC');
  }
  for (const [allowedDivisors, maxDividend] of [[[1,10],30], [[1,8,9,10],10], [[10],90]] as const) {
    const f = fixture();
    const value = {...lesson, lessonBoundary:{version:1,kind:'division_facts',allowedDivisors:[...allowedDivisors],maxDividend}};
    const response = await handleTeacherGeneration(post(input({lesson:value})), f.deps);
    assert.equal(response.status, 202);
    assert.deepEqual(f.calls, ['auth','curriculum','find','health','bot','enqueue']);
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
