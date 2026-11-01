import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { handleNoamSiteCompanion } from '../../../noam-ai/site-companion/endpoint.js';

const index = JSON.parse(readFileSync(new URL('../src/data/teacher-pick-index.json', import.meta.url), 'utf8'));
type Candidate = { id: string; label: string; key: string; questionKey: string; family: string; text: string };
function candidatesFor(rows: any[]): Candidate[] {
  return rows.flatMap(row => {
    const seen = new Set<number>();
    return row.questions.filter((label: string) => {
      const number = parseInt(label, 10); if (seen.has(number)) return false;
      seen.add(number); return true;
    }).map((label: string) => ({ id: /^(?:[abc]|c2)$/.test(row.level) ? `${row.level}:${label}` : label, label, key: `ex:${row.pdfId}:${label}`,
      questionKey: `${row.pdfId}:${parseInt(label, 10)}`, family: row.level === 'c2' ? 'c' : row.level, text: `שאלה ${label}` }));
  });
}
function inputFor(rows: any[], count = 5, candidates = candidatesFor(rows)): any {
  return { message: `בחר ${count} שאלות שלמות עם AI`, page: { kind: 'teachers', path: '/teachers', title: 'למורים' },
    teacher: { grade: String(rows[0].grade), topic: String(rows[0].topicId), level: 'all', count,
      planCounts: [5, 10, 15], goal: 'first', style: 'scaffold', note: 'PRIVATE_TEACHER_NOTE_SENTINEL', candidates },
    botVerification: { provider: 'recaptcha-v3', token: 'PRIVATE_SYNTHETIC_VERIFICATION_SENTINEL' } };
}
function mixed(candidates: Candidate[], count: number): string[] {
  const selected = ['a', 'b', 'c'].map(family => {
    const pool = candidates.filter(c => c.family === family);
    return pool.find(c => c.id.startsWith('c2:')) || pool[0];
  }).filter(Boolean);
  for (const candidate of candidates.slice().reverse()) {
    if (selected.length >= count) break;
    if (!selected.includes(candidate)) selected.push(candidate);
  }
  return selected.map(c => c.id);
}
function invalidModel(input: any): any {
  return { exerciseLabels: input.teacher.candidates.filter((c: Candidate) => c.family === 'a').slice(0, input.teacher.count).map((c: Candidate) => c.id),
    exerciseLabelsByCount: {}, privateUntrustedOutput: 'PRIVATE_MODEL_OUTPUT_SENTINEL' };
}
type ResponseSpec = { model?: unknown; raw?: string; status?: number; networkError?: boolean; abortError?: boolean;
  headersHang?: boolean; bodyHang?: boolean; bodyInvalid?: boolean; bodyHook?: () => void; finishReason?: string };
type Options = { rows?: any[]; input?: any; responses?: ResponseSpec[]; timeoutMs?: number; modelNow?: () => number;
  rateAllowed?: boolean; verification?: Record<string, unknown>; apiKey?: string; baseUrl?: string };
async function run(options: Options = {}) {
  const rows = options.rows || index.filter((r: any) => r.grade === 1 && r.topicId === '21');
  const input = options.input || inputFor(rows);
  const responses: ResponseSpec[] = options.responses || [{ model: invalidModel(input) }, { model: { exerciseLabels: mixed(input.teacher.candidates, input.teacher.count) } }];
  const calls: string[] = [], requests: any[] = [], signals: AbortSignal[] = [], logs: any[] = [];
  const result = await handleNoamSiteCompanion({ method: 'POST', url: 'https://www.noamdoronmath.co.il/api/noamSiteCompanion' }, {
    payload: input, origin: 'https://www.noamdoronmath.co.il', clientIp: '203.0.113.82', store: new Map(), now: 5000,
    teacherIndex: rows, catalog: { grades: [] }, qwenKey: options.apiKey === undefined ? 'PRIVATE_SYNTHETIC_MODEL_KEY_SENTINEL' : options.apiKey,
    qwenModel: 'qwen3.8-flash', qwenBaseUrl: options.baseUrl || 'https://token-plan.maas.qwencloudapi.com/compatible-mode/v1',
    qwenTimeoutMs: options.timeoutMs, modelNow: options.modelNow,
    recaptchaSecret: 'PRIVATE_SYNTHETIC_RECAPTCHA_SECRET_SENTINEL', log: (entry: unknown) => logs.push(entry),
    rateBackend: { async take() { calls.push('rate'); return options.rateAllowed !== false; } },
    fetch: async (url: string, init: { body: string; signal: AbortSignal }) => {
      if (url === 'https://www.google.com/recaptcha/api/siteverify') {
        calls.push('verify'); return { ok: true, json: async () => ({ success: true, score: 0.9,
          hostname: 'www.noamdoronmath.co.il', action: 'noam_site_companion', ...options.verification }) };
      }
      assert.match(url, /\/chat\/completions$/);
      calls.push('model'); requests.push(JSON.parse(init.body)); signals.push(init.signal);
      const spec = responses[requests.length - 1];
      assert.ok(spec, 'An unplanned extra provider call must never occur');
      if (spec.networkError) throw new Error('PRIVATE_PROVIDER_NETWORK_SENTINEL');
      if (spec.abortError) throw Object.assign(new Error('PRIVATE_ABORT_SENTINEL'), { name: 'AbortError' });
      if (spec.headersHang) return new Promise(() => {});
      return { ok: !spec.status || spec.status === 200, status: spec.status || 200, json: async () => {
        spec.bodyHook?.();
        if (spec.bodyHang) return new Promise(() => {});
        if (spec.bodyInvalid) throw new SyntaxError('PRIVATE_PROVIDER_BODY_SENTINEL');
        if (spec.status && spec.status !== 200) return { error: { code: 'SyntheticProviderError', message: 'PRIVATE_PROVIDER_RESPONSE_SENTINEL' } };
        return { choices: [{ finish_reason: spec.finishReason || 'stop', message: {
          content: spec.raw === undefined ? JSON.stringify(spec.model) : spec.raw } }], usage: { completion_tokens: 100 } };
      } };
    },
  });
  return { result, body: result.body as any, calls, requests, signals, logs, input };
}
function assertCalls(result: Awaited<ReturnType<typeof run>>, models: number) {
  assert.deepEqual(result.calls, ['rate', 'verify', ...Array(models).fill('model')]);
  assert.equal(result.requests.length, models);
}
function assertExact(body: any, labels: string[], candidates: Candidate[]) {
  const expected = labels.map(label => {
    const found = candidates.filter(c => c.id === label); assert.equal(found.length, 1); return found[0];
  });
  assert.equal(body.source, 'classifier'); assert.equal(body.model, 'qwen3.8-flash');
  assert.deepEqual(body.modelExerciseIds, expected.map(c => c.key));
  assert.deepEqual(new Set(body.exerciseIds), new Set(expected.map(c => c.key)));
  assert.equal(body.exerciseIds.length, labels.length);
  assert.equal(new Set(expected.map(c => c.questionKey)).size, labels.length);
  for (const family of new Set(candidates.map(c => c.family))) assert.ok(expected.some(c => c.family === family));
  assert.equal(body.selectionError, undefined);
  assert.doesNotMatch(body.answer || '', /הושלמה מקומית|הנה בחירה בסיסית|לא התקבלה/);
}
function assertNoSelection(body: any) {
  assert.equal(body.source, 'fallback'); assert.equal(body.model, null);
  assert.deepEqual(body.exerciseIds, []); assert.deepEqual(body.modelExerciseIds, []);
  assert.equal(body.teacherPlans, undefined);
  assert.doesNotMatch(body.answer || '', /הושלמה מקומית|הנה בחירה בסיסית/);
}
function assertInfrastructureFailure(body: any, code: string) {
  assert.equal(body.code, code);
  assert.equal(body.source, code === 'NOT_ACTIVE' ? 'inactive' : 'fallback');
  assert.equal(body.model, ['BOT_VERIFICATION_FAILED', 'RATE_LIMIT'].includes(code) ? undefined : null);
  assert.deepEqual(body.exerciseIds, []); assert.deepEqual(body.sheetIds, []);
  assert.equal(body.modelExerciseIds, undefined); assert.equal(body.teacherPlans, undefined);
  assert.equal(body.selectionError, undefined);
}

for (const [grade, topic] of [[1, '21'], [8, '43']] as const) for (const count of [5, 10, 15]) {
  test(`G${grade}T${topic}: one guarded correction returns exactly the model's ${count} whole questions`, async () => {
    const rows = index.filter((r: any) => r.grade === grade && r.topicId === topic);
    const input = inputFor(rows, count), chosen = mixed(input.teacher.candidates, count);
    const result = await run({ rows, input });
    assert.equal(result.result.status, 200); assertCalls(result, 2); assertExact(result.body, chosen, input.teacher.candidates);
    if (grade === 8) assert.ok(chosen.some(id => id.startsWith('c2:')));
    const prompt = result.requests[1].messages.map((m: any) => m.content).join('\n');
    assert.ok(prompt.includes(input.teacher.note));
    for (const candidate of input.teacher.candidates) assert.ok(prompt.includes(candidate.id), candidate.id);
    assert.doesNotMatch(prompt, /PRIVATE_MODEL_OUTPUT_SENTINEL|PRIVATE_SYNTHETIC_VERIFICATION|PRIVATE_SYNTHETIC_MODEL_KEY|PRIVATE_SYNTHETIC_RECAPTCHA/);
    assert.equal(result.requests[1].model, result.requests[0].model);
    assert.equal(result.requests[1].stream, false); assert.equal(result.requests[1].enable_thinking, false);
  });
}

for (const defect of ['missing family', 'short', 'extra', 'duplicate', 'unknown', 'ambiguous', 'nested array'] as const) {
  test(`a second ${defect} selection is rejected without a third call or local completion`, async () => {
    const rows = index.filter((r: any) => r.grade === 8 && r.topicId === '43'), input = inputFor(rows);
    const labels: any[] = mixed(input.teacher.candidates, 5);
    if (defect === 'missing family') labels.splice(0, 5, ...input.teacher.candidates.filter((c: Candidate) => c.family === 'a').slice(0, 5).map((c: Candidate) => c.id));
    if (defect === 'short') labels.pop();
    if (defect === 'extra') labels.push(input.teacher.candidates.find((c: Candidate) => !labels.includes(c.id)).id);
    if (defect === 'duplicate') labels[4] = labels[3];
    if (defect === 'unknown') labels[4] = 'c:999';
    if (defect === 'ambiguous') labels[4] = '1א';
    if (defect === 'nested array') labels[4] = [labels[4]];
    const result = await run({ rows, input, responses: [{ model: invalidModel(input) }, { model: { exerciseLabels: labels } }] });
    assertCalls(result, 2); assertNoSelection(result.body);
    assert.equal(result.body.selectionError, defect === 'missing family' ? 'MODEL_LEVEL_COVERAGE_MISSING' : 'MODEL_SELECTION_INVALID');
  });
}

test('valid primary or valid exact same-count plan never spends a corrective model call', async () => {
  const rows = index.filter((r: any) => r.grade === 1 && r.topicId === '21'), input = inputFor(rows);
  const labels = mixed(input.teacher.candidates, 5);
  for (const model of [{ exerciseLabels: labels }, { ...invalidModel(input), exerciseLabelsByCount: { '5': labels } }]) {
    const result = await run({ rows, input, responses: [{ model }] });
    assertCalls(result, 1); assertExact(result.body, labels, input.teacher.candidates);
  }
});

test('correction retains independently valid earlier plans and ignores new unsolicited plans', async () => {
  const rows = index.filter((r: any) => r.grade === 8 && r.topicId === '43'), input = inputFor(rows);
  const first = { ...invalidModel(input), exerciseLabelsByCount: { '10': mixed(input.teacher.candidates, 10), '15': mixed(input.teacher.candidates, 15) } };
  const second = { exerciseLabels: mixed(input.teacher.candidates, 5), exerciseLabelsByCount: { '5': ['PRIVATE_UNSOLICITED_PLAN'] } };
  const result = await run({ rows, input, responses: [{ model: first }, { model: second }] });
  assertCalls(result, 2); assertExact(result.body, second.exerciseLabels, input.teacher.candidates);
  for (const count of ['10', '15'] as const) assertExact(result.body.teacherPlans[count], first.exerciseLabelsByCount[count], input.teacher.candidates);
  assert.equal(result.body.teacherPlans['5'], undefined);
});

test('a correction cannot substitute an unsolicited valid plan for its invalid primary', async () => {
  const rows = index.filter((r: any) => r.grade === 1 && r.topicId === '21'), input = inputFor(rows);
  const result = await run({ rows, input, responses: [{ model: invalidModel(input) },
    { model: { exerciseLabels: [], exerciseLabelsByCount: { '5': mixed(input.teacher.candidates, 5) } } }] });
  assertCalls(result, 2); assertNoSelection(result.body);
});

test('correction cannot reintroduce a question excluded from the original candidates', async () => {
  const rows = index.filter((r: any) => r.grade === 8 && r.topicId === '43');
  const all = candidatesFor(rows), excluded = all[0], input = inputFor(rows, 5, all.slice(1));
  const labels = mixed(input.teacher.candidates, 5); labels[4] = excluded.id;
  const result = await run({ rows, input, responses: [{ model: invalidModel(input) }, { model: { exerciseLabels: labels } }] });
  assertCalls(result, 2); assertNoSelection(result.body);
  const prompt = result.requests[1].messages.map((m: any) => m.content).join('\n');
  assert.ok(!prompt.includes(excluded.id + ' ('), 'Excluded candidate must not reappear in the correction candidate list');
});

const uncorrectable: [string, ResponseSpec, string][] = [
  ['authentication failure', { status: 401 }, 'MODEL_AUTH_FAILED'],
  ['provider HTTP failure', { status: 503 }, 'MODEL_HTTP'],
  ['network failure', { networkError: true }, 'MODEL_HTTP'],
  ['abort', { abortError: true }, 'UNAVAILABLE'],
  ['malformed JSON', { raw: 'PRIVATE_BAD_JSON_SENTINEL' }, 'MODEL_RESPONSE_FAILED'],
  ['JSON null', { raw: 'null' }, 'MODEL_RESPONSE_FAILED'],
  ['empty content', { raw: '' }, 'MODEL_RESPONSE_FAILED'],
  ['truncated JSON', { raw: '{"exerciseLabels":[', finishReason: 'length' }, 'MODEL_RESPONSE_FAILED'],
  ['unreadable response body', { bodyInvalid: true }, 'MODEL_RESPONSE_FAILED'],
];
for (const [name, spec, code] of uncorrectable) test(`${name} is not corrected or relabeled as bad mixed-level selection`, async () => {
  const result = await run({ responses: [spec] });
  assertCalls(result, 1);
  if (code === 'UNAVAILABLE') assertInfrastructureFailure(result.body, code);
  else { assertNoSelection(result.body); assert.equal(result.body.code, code); }
  assert.equal(result.body.selectionError, undefined);
  assert.doesNotMatch(JSON.stringify(result.logs), /PRIVATE_/);
});

for (const [name, spec, code] of uncorrectable) test(`a corrective ${name} stops after two calls and retains its real error category`, async () => {
  const rows = index.filter((r: any) => r.grade === 1 && r.topicId === '21'), input = inputFor(rows);
  const result = await run({ rows, input, responses: [{ model: invalidModel(input) }, spec] });
  assertCalls(result, 2);
  if (code === 'UNAVAILABLE') assertInfrastructureFailure(result.body, code);
  else { assertNoSelection(result.body); assert.equal(result.body.code, code); }
  assert.equal(result.body.selectionError, undefined);
  assert.doesNotMatch(JSON.stringify(result.logs), /PRIVATE_/);
});

for (const level of ['a', 'c2', 'one']) test(`${level}: correction selects a complete model result without local filling`, async () => {
  const rows = level === 'one'
    ? [index.find((row: any) => row.level === 'one' && new Set(row.questions.map((q: string) => parseInt(q, 10))).size >= 5)]
    : index.filter((row: any) => row.grade === 8 && row.topicId === '43' && row.level === level);
  assert.equal(rows.length, 1); assert.ok(rows[0]);
  const input = inputFor(rows); input.teacher.level = level;
  const labels = mixed(input.teacher.candidates, 5);
  const result = await run({ rows, input, responses: [{ model: { exerciseLabels: [] } }, { model: { exerciseLabels: labels } }] });
  assertCalls(result, 2); assertExact(result.body, labels, input.teacher.candidates);
});

test('missing provider key and rejected provider configuration never send a model request', async () => {
  const inactive = await run({ apiKey: '' });
  assert.equal(inactive.requests.length, 0); assertInfrastructureFailure(inactive.body, 'NOT_ACTIVE');
  const rejected = await run({ baseUrl: 'https://attacker.example/v1' });
  assert.equal(rejected.requests.length, 0); assertNoSelection(rejected.body); assert.equal(rejected.body.code, 'QWEN_CONFIG_REJECTED');
});

for (const kind of ['teacher chat', 'absent candidates', 'empty candidates', 'wrong plan opt-in', 'shortage 8', 'shortage 12'] as const) {
  test(`${kind} cannot trigger the page-picker correction`, async () => {
    const rows = index.filter((r: any) => r.grade === 1 && r.topicId === '21'), input = inputFor(rows);
    if (kind === 'teacher chat') { delete input.teacher.planCounts; delete input.teacher.count; }
    if (kind === 'absent candidates') delete input.teacher.candidates;
    if (kind === 'empty candidates') input.teacher.candidates = [];
    if (kind === 'wrong plan opt-in') input.teacher.planCounts = [5, 15, 10];
    if (kind.startsWith('shortage')) input.teacher.count = Number(kind.split(' ')[1]);
    const result = await run({ rows, input, responses: [{ model: { exerciseLabels: [], exerciseLabelsByCount: {} } }] });
    assertCalls(result, 1); assertNoSelection(result.body);
  });
}

test('one failed guard or rate check prevents every model call and correction', async () => {
  const refused = await run({ verification: { score: 0.1 } });
  assert.equal(refused.result.status, 403); assert.deepEqual(refused.calls, ['rate', 'verify']);
  assertInfrastructureFailure(refused.body, 'BOT_VERIFICATION_FAILED');
  const limited = await run({ rateAllowed: false });
  assert.equal(limited.result.status, 429); assert.deepEqual(limited.calls, ['rate']);
  assertInfrastructureFailure(limited.body, 'RATE_LIMIT');
});

test('first response body time reduces the second call deadline instead of resetting18seconds', async () => {
  let now = 1000;
  const delays: number[] = [], original = globalThis.setTimeout;
  const rows = index.filter((r: any) => r.grade === 1 && r.topicId === '21'), input = inputFor(rows);
  globalThis.setTimeout = ((handler: any, delay?: number, ...args: any[]) => {
    delays.push(Number(delay)); return original(handler, delay, ...args);
  }) as typeof setTimeout;
  try {
    const result = await run({ rows, input, timeoutMs: 60000, modelNow: () => now, responses: [
      { model: invalidModel(input), bodyHook: () => { now += 7000; } },
      { model: { exerciseLabels: mixed(input.teacher.candidates, 5) } },
    ] });
    assertCalls(result, 2); assertExact(result.body, mixed(input.teacher.candidates, 5), input.teacher.candidates);
    assert.ok(delays.includes(18000), JSON.stringify(delays));
    assert.ok(delays.includes(11000), JSON.stringify(delays));
    assert.equal(delays.filter(delay => delay === 18000).length, 1);
  } finally { globalThis.setTimeout = original; }
});

test('an exhausted shared budget never starts a second provider call', async () => {
  let now = 1000;
  const rows = index.filter((r: any) => r.grade === 1 && r.topicId === '21'), input = inputFor(rows);
  const result = await run({ rows, input, modelNow: () => now, responses: [
    { model: invalidModel(input), bodyHook: () => { now += 18001; } },
  ] });
  assertCalls(result, 1); assertInfrastructureFailure(result.body, 'UNAVAILABLE');
});

test('a valid corrective body arriving after the shared deadline is never applied', async () => {
  let now = 1000;
  const rows = index.filter((r: any) => r.grade === 1 && r.topicId === '21'), input = inputFor(rows);
  const result = await run({ rows, input, modelNow: () => now, responses: [
    { model: invalidModel(input), bodyHook: () => { now += 7000; } },
    { model: { exerciseLabels: mixed(input.teacher.candidates, 5) }, bodyHook: () => { now += 11001; } },
  ] });
  assertCalls(result, 2); assertInfrastructureFailure(result.body, 'UNAVAILABLE');
});

for (const phase of ['first headers', 'first body', 'second headers', 'second body'] as const) {
  test(`a stalled ${phase} is aborted inside the one provider budget`, { timeout: 1000 }, async () => {
    const rows = index.filter((r: any) => r.grade === 1 && r.topicId === '21'), input = inputFor(rows);
    const stalled: ResponseSpec = phase.endsWith('headers') ? { headersHang: true } : { bodyHang: true };
    const responses = phase.startsWith('first') ? [stalled] : [{ model: invalidModel(input) }, stalled];
    const result = await run({ rows, input, timeoutMs: 35, responses });
    assertCalls(result, responses.length); assertInfrastructureFailure(result.body, 'UNAVAILABLE');
    assert.equal(result.signals.at(-1)?.aborted, true);
  });
}

test('correction diagnostics expose bounded categories and counts, never teacher text or provider output', async () => {
  const success = await run();
  const failure = await run({ responses: [{ model: { exerciseLabels: [] } }, { model: { exerciseLabels: [] } }] });
  const entries = [...success.logs, ...failure.logs].filter(entry => entry.event === 'noam-teacher-selection');
  for (const code of ['MODEL_CORRECTION_ATTEMPTED', 'MODEL_CORRECTION_SUCCEEDED', 'MODEL_CORRECTION_REJECTED']) {
    assert.ok(entries.some(entry => entry.code === code), code);
  }
  const allowed = new Set(['event', 'code', 'reason', 'requestedCount', 'primaryCount', 'expectedCount', 'candidateCount', 'invalidCount', 'planCount', 'completionTokens', 'finishReason', 'remainingMs']);
  for (const entry of entries) {
    assert.ok(Object.keys(entry).every(key => allowed.has(key)));
    assert.ok(['MODEL_RESPONSE_INVALID', 'MODEL_RESPONSE_TRUNCATED', 'MODEL_SELECTION_REJECTED', 'MODEL_SELECTION_RECOVERED',
      'MODEL_CORRECTION_ATTEMPTED', 'MODEL_CORRECTION_SUCCEEDED', 'MODEL_CORRECTION_REJECTED'].includes(entry.code));
    assert.ok(['missing-content', 'invalid-json', 'length-limit', 'primary-invalid', 'level-coverage', 'requested-plan',
      'exact-primary', 'provider-failure', 'deadline', 'malformed-labels', 'wrong-count', 'unknown-id', 'ambiguous-id', 'duplicate-question'].includes(entry.reason));
    if ('remainingMs' in entry) assert.ok(Number.isInteger(entry.remainingMs) && entry.remainingMs >= 0 && entry.remainingMs <= 18000);
  }
  assert.doesNotMatch(JSON.stringify(entries), /PRIVATE_|exerciseLabels|exerciseIds|Bearer|apiKey|botVerification/);
});
