import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { handleNoamSiteCompanion } from '../../../noam-ai/site-companion/endpoint.js';
import { classifierRequestBody, CLASSIFIER_MAX_TOKENS, parseClassifier, selectTeacherPlans, TEACHER_PLANS_MAX_TOKENS } from '../../../noam-ai/site-companion/teacher-pick.js';

const pdfId = 'a'.repeat(32);
const row = {
  pdfId, grade: 3, gradeLabel: 'כיתה ג׳', topicId: '11', topic: 'שברים', band: 'elementary',
  level: 'a', levelLabel: 'רמה א׳', mode: 'exercise', title: 'שברים',
  pdfUrl: `https://static.wixstatic.com/ugd/d8e7ad_${pdfId}.pdf`,
  questions: Array.from({ length: 20 }, (_, index) => String(index + 1)),
};
const ids = (labels: string[], source = pdfId) => labels.map((label) => `ex:${source}:${label.replace(/^(?:[abc]|c2):/, '')}`);
const labels = (start: number, count: number, level = 'a') => Array.from({ length: count }, (_, index) => `${level}:${start + index}`);
const plans = { '5': labels(16, 5), '10': labels(2, 10), '15': labels(1, 15) };
const classification = () => ({ grade: 3, level: 'a', exerciseLabels: labels(4, 5), exerciseLabelsByCount: plans });
function payload(count = 5, questions = row.questions) {
  return {
    message: `בחר ${count} שאלות שלמות עם AI`,
    page: { kind: 'teachers', path: '/teachers?grade=3&topic=11&level=a', title: 'למורים' },
    teacher: { grade: '3', topic: '11', level: 'a', count, planCounts: [5, 10, 15], goal: 'first', style: 'scaffold', note: '',
      candidates: questions.map((label) => ({ id: `a:${label}`, label, text: `שאלה ${parseInt(label, 10)}` })) },
    botVerification: { provider: 'recaptcha-v3', token: 'synthetic-single-use-plan-token' },
  };
}

async function request(options: {
  input?: ReturnType<typeof payload>; model?: unknown; verification?: Record<string, unknown>;
  allowed?: boolean; teacherIndex?: unknown[]; origin?: string;
} = {}) {
  const calls: string[] = [];
  const modelRequests: any[] = [];
  const result = await handleNoamSiteCompanion(
    { method: 'POST', url: 'https://www.noamdoronmath.co.il/api/noamSiteCompanion' },
    {
      origin: options.origin || 'https://www.noamdoronmath.co.il', clientIp: '203.0.113.37',
      qwenKey: 'synthetic-plan-model-key', recaptchaSecret: 'synthetic-plan-recaptcha-secret',
      teacherIndex: options.teacherIndex || [row], catalog: { grades: [] }, store: new Map(), now: 5_000,
      payload: options.input || payload(),
      rateBackend: { async take() { calls.push('rate'); return options.allowed !== false; } },
      fetch: async (url: string, init: { body: string }) => {
        if (url === 'https://www.google.com/recaptcha/api/siteverify') {
          calls.push('captcha');
          return { ok: true, json: async () => ({ success: true, score: 0.9, action: 'noam_site_companion', hostname: 'www.noamdoronmath.co.il', ...options.verification }) };
        }
        assert.match(url, /\/chat\/completions$/);
        calls.push('model');
        modelRequests.push(JSON.parse(init.body));
        return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(options.model === undefined ? classification() : options.model) } }] }) };
      },
    }
  );
  return { result, calls, modelRequests, body: result.body as any };
}

test('one rate-limited, verified model request returns three independent explicit plans while retaining the primary choice', async () => {
  const { result, calls, modelRequests, body } = await request();
  assert.equal(result.status, 200);
  assert.deepEqual(calls, ['rate', 'captcha', 'model']);
  assert.equal(body.source, 'classifier');
  assert.deepEqual(body.exerciseIds, ids(labels(4, 5)));
  assert.deepEqual(Object.keys(body.teacherPlans), ['5', '10', '15']);
  for (const count of ['5', '10', '15'] as const) {
    const plan = body.teacherPlans[count];
    assert.equal(plan.source, 'classifier');
    assert.equal(plan.model, 'qwen3.8-flash');
    assert.deepEqual(plan.exerciseIds, ids(plans[count]));
    assert.deepEqual(plan.modelExerciseIds, ids(plans[count]));
  }
  assert.notDeepEqual(body.teacherPlans['5'].exerciseIds, body.teacherPlans['15'].exerciseIds.slice(0, 5));
  assert.equal(modelRequests.length, 1);
  assert.equal(modelRequests[0].max_tokens, TEACHER_PLANS_MAX_TOKENS);
  assert.match(modelRequests[0].messages[0].content, /exerciseLabelsByCount/);
  assert.match(modelRequests[0].messages[1].content, /כמות מבוקשת לבחירה: 5/);
  for (const count of [5, 10, 15]) assert.ok(modelRequests[0].messages[1].content.includes(`exerciseLabelsByCount["${count}"]`));
});

for (const [name, verification] of [
  ['low score 0.3', { score: 0.3 }],
  ['wrong action', { action: 'another_action' }],
  ['wrong hostname', { hostname: 'attacker.example' }],
  ['replayed or expired token', { success: false, 'error-codes': ['timeout-or-duplicate'] }],
] as const) {
  test(`${name} blocks all plans and model work`, async () => {
    const { result, calls, body } = await request({ verification });
    assert.equal(result.status, 403);
    assert.equal(body.code, 'BOT_VERIFICATION_FAILED');
    assert.deepEqual(calls, ['rate', 'captcha']);
    assert.equal(body.teacherPlans, undefined);
    assert.deepEqual(body.exerciseIds, []);
  });
}

test('a missing token cannot obtain plans or call the model', async () => {
  const input = payload();
  input.botVerification.token = '';
  const { result, calls, body } = await request({ input });
  assert.equal(result.status, 403);
  assert.deepEqual(calls, ['rate']);
  assert.equal(body.teacherPlans, undefined);
});

test('rate rejection and disallowed origins do not verify or call the model for plans', async () => {
  const limited = await request({ allowed: false });
  assert.equal(limited.result.status, 429);
  assert.deepEqual(limited.calls, ['rate']);
  assert.equal(limited.body.teacherPlans, undefined);
  const forbidden = await request({ origin: 'https://attacker.example' });
  assert.equal(forbidden.result.status, 403);
  assert.deepEqual(forbidden.calls, []);
  assert.equal(forbidden.body.teacherPlans, undefined);
});

test('legacy requests and unsupported planCounts keep the existing single-selection behavior and budget', async () => {
  for (const planCounts of [undefined, [], [5], [5, 10, 15, 30], [5, 10, 10], ['5', '10', '15']]) {
    const input = payload();
    (input.teacher as any).planCounts = planCounts;
    const { body, calls, modelRequests } = await request({ input });
    assert.deepEqual(calls, ['rate', 'captcha', 'model']);
    assert.deepEqual(body.exerciseIds, ids(labels(4, 5)));
    assert.equal(body.teacherPlans, undefined);
    assert.equal(modelRequests[0].max_tokens, CLASSIFIER_MAX_TOKENS);
    assert.doesNotMatch(modelRequests[0].messages[0].content, /exerciseLabelsByCount/);
  }
});

test('partial, duplicate, invalid, extra and ambiguous plans are omitted without local completion', async () => {
  const malformed = [labels(1, 4), labels(1, 6), [...labels(1, 4), 'a:999'], [...labels(1, 4), 'a:4'], [...labels(1, 4), '<script>']];
  for (const bad of malformed) {
    const { body } = await request({ model: { ...classification(), exerciseLabelsByCount: { ...plans, '5': bad } } });
    assert.equal(body.teacherPlans['5'], undefined);
    assert.deepEqual(Object.keys(body.teacherPlans), ['10', '15']);
    assert.deepEqual(body.exerciseIds, ids(labels(4, 5)), 'The primary result stays independent');
  }
  const input = payload();
  input.teacher.level = 'all';
  const other = { ...row, pdfId: 'b'.repeat(32), level: 'b' };
  input.teacher.candidates.push(...other.questions.map((label) => ({ id: `b:${label}`, label, text: `שאלה ${label}` })));
  const { body } = await request({ input, teacherIndex: [row, other], model: { ...classification(), exerciseLabelsByCount: { '5': ['1', '2', '3', '4', '5'] } } });
  assert.equal(body.teacherPlans, undefined, 'An unscoped model choice cannot choose the first matching level');
});

test('nested arrays, objects, nulls and numbers cannot be coerced into reusable model identifiers', async () => {
  for (const malformed of [['a:1'], { id: 'a:1' }, null, 1, true]) {
    const invalid = [malformed, ...labels(2, 4)];
    const model = { ...classification(), exerciseLabelsByCount: { ...plans, '5': invalid } };
    const parsed = parseClassifier(JSON.stringify(model));
    assert.equal(parsed.scopedExerciseLabelsByCount['5'], undefined);
    const { body } = await request({ model });
    assert.equal(body.teacherPlans['5'], undefined);
    assert.deepEqual(Object.keys(body.teacherPlans), ['10', '15']);
    assert.deepEqual(body.exerciseIds, ids(labels(4, 5)), 'Rejecting a malformed plan does not alter the valid primary choice');
  }
});

test('two different parts of the same question cannot count as two questions in a reusable plan', async () => {
  const source = { ...row, questions: ['1א', '1ב', '2א', '3א', '4א', '5א', '6א'] };
  const input = payload(5, source.questions);
  const { body } = await request({ input, teacherIndex: [source], model: { grade: 3, level: 'a', exerciseLabels: ['a:1א'],
    exerciseLabelsByCount: { '5': ['a:1א', 'a:1ב', 'a:2א', 'a:3א', 'a:4א'] } } });
  assert.equal(body.teacherPlans, undefined);
});

test('a shortage keeps the original 15-plan key with exactly the available twelve questions', async () => {
  const source = { ...row, questions: row.questions.slice(0, 12) };
  const input = payload(12, source.questions);
  const { body, modelRequests } = await request({ input, teacherIndex: [source], model: {
    grade: 3, level: 'a', exerciseLabels: labels(1, 12), exerciseLabelsByCount: { '5': labels(8, 5), '10': labels(2, 10), '15': labels(1, 12) },
  } });
  assert.equal(body.exerciseIds.length, 12);
  assert.equal(body.teacherPlans['5'].exerciseIds.length, 5);
  assert.equal(body.teacherPlans['10'].exerciseIds.length, 10);
  assert.equal(body.teacherPlans['15'].exerciseIds.length, 12);
  assert.match(modelRequests[0].messages[1].content, /exerciseLabelsByCount\["15"\]: בחר בדיוק 12/);
});

test('current numeric and c2 source plans resolve to the exact model-chosen IDs in all grades', () => {
  const index = JSON.parse(readFileSync(new URL('../src/data/teacher-pick-index.json', import.meta.url), 'utf8'));
  const cases = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((grade) => index.find((item: any) => item.grade === grade && item.level === 'a'));
  cases.push(...index.filter((item: any) => item.level === 'c2'));
  for (const source of cases) {
    const seen = new Set<number>();
    const candidates = source.questions.filter((label: string) => {
      const q = parseInt(label, 10); if (seen.has(q)) return false; seen.add(q); return true;
    }).map((label: string) => ({ id: `${source.level}:${label}`, label, text: `שאלה ${parseInt(label, 10)}` }));
    const input = payload();
    Object.assign(input.teacher, { grade: String(source.grade), topic: source.topicId, level: source.level, candidates });
    const explicit = Object.fromEntries([5, 10, 15].map((count) => [String(count), candidates.slice(-count).map((item: any) => item.id)]));
    const parsed = parseClassifier(JSON.stringify({ exerciseLabelsByCount: explicit }));
    const selected = selectTeacherPlans(index, input, parsed, 'test-model');
    for (const count of ['5', '10', '15']) {
      assert.deepEqual(new Set(selected[count].exerciseIds), new Set(ids(explicit[count], source.pdfId)));
      assert.deepEqual(new Set(selected[count].modelExerciseIds), new Set(ids(explicit[count], source.pdfId)));
    }
    const prompt = classifierRequestBody(input, index).messages[1].content;
    for (const item of candidates) assert.ok(prompt.includes(item.id + ' ('), `${source.grade}:${source.topicId}:${item.id}`);
  }
});

test('all actual grade/topic/level scopes retain three independently supplied model plans', (t) => {
  const index = JSON.parse(readFileSync(new URL('../src/data/teacher-pick-index.json', import.meta.url), 'utf8'));
  const scopes = new Map<string, any[]>();
  for (const source of index) {
    for (const level of new Set(['all', source.level, ...(source.level === 'c2' ? ['c'] : [])])) {
      const key = [source.grade, source.topicId, level].join(':');
      if (!scopes.has(key)) scopes.set(key, []);
      scopes.get(key)!.push(source);
    }
  }
  let checked = 0;
  for (const [scope, sources] of scopes) {
    const [grade, topic, level] = scope.split(':');
    const candidates = sources.flatMap((source: any) => {
      const seen = new Set<number>();
      return source.questions.filter((label: string) => {
        const q = parseInt(label, 10); if (seen.has(q)) return false; seen.add(q); return true;
      }).map((label: string) => ({ id: /^(?:[abc]|c2)$/.test(source.level) ? `${source.level}:${label}` : label,
        label, text: `שאלה ${parseInt(label, 10)}`, key: `ex:${source.pdfId}:${label}` }));
    });
    const expected = {
      '5': candidates.slice(-5),
      '10': candidates.slice(0, 10),
      '15': candidates.slice(-15).reverse(),
    };
    const input = payload(Math.min(5, candidates.length));
    Object.assign(input.teacher, { grade, topic, level, candidates });
    const parsed = parseClassifier(JSON.stringify({ exerciseLabelsByCount: Object.fromEntries(
      Object.entries(expected).map(([count, choices]) => [count, choices.map((candidate: any) => candidate.id)])
    ) }));
    const selected = selectTeacherPlans(index, input, parsed, 'test-model');
    for (const count of ['5', '10', '15'] as const) {
      assert.equal(selected[count]?.source, 'classifier', `${scope}:${count}`);
      assert.deepEqual(new Set(selected[count].exerciseIds), new Set(expected[count].map((candidate: any) => candidate.key)), `${scope}:${count}`);
      assert.deepEqual(selected[count].modelExerciseIds, expected[count].map((candidate: any) => candidate.key), `${scope}:${count}: model order`);
      checked += 1;
    }
  }
  assert.ok(scopes.size > 1200);
  t.diagnostic(`Validated ${checked} explicit model plans across ${scopes.size} actual grade/topic/level scopes without network requests.`);
});
