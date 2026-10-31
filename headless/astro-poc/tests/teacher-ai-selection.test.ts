import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { groupWholeQuestions } from '../public/teachers/teacher-question-pick.js';

const printer = readFileSync(new URL('../public/teachers/teacher-factoring-print.js', import.meta.url), 'utf8');
const source = JSON.parse(readFileSync(new URL('../public/teachers/factoring-grade-9-a-source.json', import.meta.url), 'utf8'));
source.level = 'a';
source.levelLabel = 'רמה א׳';
source.questions.forEach((question: { source: unknown }) => { question.source = source; });
const groups = groupWholeQuestions(source.questions);
const groupKeys = (group: { questions: { id: string }[] }) => group.questions.map((part) => `ex:${source.pdfId}:${part.id}`);

function definition(name: string) {
  const start = printer.search(new RegExp(`(?:^|\\n)(?:async )?function ${name}\\(`));
  assert.notEqual(start, -1, `Missing ${name}`);
  const tail = printer.slice(start + (printer[start] === '\n' ? 1 : 0));
  const end = tail.search(/\n(?:async )?function /);
  return end < 0 ? tail : tail.slice(0, end);
}

type Payload = { teacher: { level: string; count: number; planCounts: number[]; candidates: { id: string; label: string }[] } };
type State = { grade: string; topic: string; level: string; scenario: string; style: string; selected: string[]; blocks: { kind: string; title: string; keys: string[] }[]; sectionKind: string; pickMode: string; filter: string; lastAiPickCount: number; pickNote?: string };
const successfulReply = (payload: Payload) => ({
  source: 'classifier', model: 'qwen3.8-flash',
  exerciseIds: payload.teacher.candidates.slice(-payload.teacher.count).map((candidate) => `ex:${source.pdfId}:${candidate.label}`),
});

type ChallengeHandler = { isCurrent: () => boolean; onChallenge: (challenge: unknown) => Promise<string> };
type HumanRequest = { isCurrent: () => boolean; onSubmitting: () => void; challenge: unknown; client: unknown; anchor: unknown };
function harness(reply: (payload: Payload, state: State, requestOptions: ChallengeHandler) => unknown = successfulReply, options: { pool?: unknown[]; grade?: string; scenario?: string; style?: string; savedKeys?: string[]; humanVerification?: (request: HumanRequest) => Promise<string>; clock?: { now: () => number }; timers?: { setInterval: (fn: () => void) => number; clearInterval: () => void } } = {}) {
  return new Function('pool', 'groupWholeQuestions', 'savedKeys', 'reply', 'options', 'Date', 'globalThis', `
    let state = { grade: '9', topic: '2', level: 'a', scenario: 'other', style: 'blended',
      selected: [], blocks: [{ kind: 'test', title: 'נושא קודם', keys: savedKeys }],
      sectionKind: 'review', lastAiPickCount: 0, pickMode: 'manual', filter: 'selected', expanded: false,
      ...Object.fromEntries(['grade', 'scenario', 'style'].filter(key => options[key] != null).map(key => [key, options[key]])) };
    let history = [];
    let aiPickPending = 0, teacherAiPlanCache = null;
    const status = { textContent: '' };
    const requests = [];
    const announcements = [];
    const attrs = [];
    let renderCount = 0;
    const controls = {
      'ai-suggest-status': status,
      grade: { selectedOptions: [{ textContent: 'כיתה ט׳' }] },
      topic: { selectedOptions: [{ textContent: 'פירוק לגורמים' }] },
      'teacher-note': { value: 'לתרגול בכיתה' },
      'filter-all': { setAttribute: (...args) => attrs.push(['all', ...args]) },
      'filter-selected': { setAttribute: (...args) => attrs.push(['selected', ...args]) },
    };
    const $ = (id) => controls[id] || null;
    const document = { title: 'בוחרים מה לתרגל' };
    const location = { pathname: '/teachers', search: '?grade=9&topic=2&level=a' };
    const currentExercises = () => pool;
    const band = () => 'middle';
    const paintAiPickButtons = () => {};
    const clearPreparedPrint = () => {};
    const render = () => { renderCount += 1; };
    const announce = (message) => announcements.push(message);
    const SCENARIOS = { other: { label: 'אחר' } };
    const STYLES = { blended: { label: 'משולבת' } };
    const QUESTION_ROLES = { basis: 'ביסוס', review: 'חזרה', creative: 'יצירתית' };
    const AI_QUESTION_COUNTS = [5, 10, 15];
    let dismissedPanels = 0;
    const dismissTeacherHumanVerification = () => { dismissedPanels += 1; };
    const requestTeacherHumanVerification = options.humanVerification || (() => { throw new Error('Unexpected human verification'); });
    const ensureTeacherBotClient = async () => ({ postJson: async (path, payload, requestOptions) => {
      requests.push({ path, payload });
      return await reply(payload, state, requestOptions);
    } });
    ${['exKey', 'questionPreviewGroup', 'currentQuestions', 'keysOfQuestions', 'rolePlan', 'interleaveSheets', 'planOrder', 'smartQuestionPick', 'carriedKeys', 'selectionKey', 'snapshot', 'teacherAiNote', 'teacherAiContext', 'teacherLevelsCovered', 'verifiedTeacherPlan', 'rememberTeacherPlans', 'pickWithAi'].map(definition).join('\n')}
    return { pick: pickWithAi, state, requests, status, attrs, controls, announcements, renders: () => renderCount, dismisses: () => dismissedPanels };
  `)(options.pool || source.questions, groupWholeQuestions, options.savedKeys || groupKeys(groups[0]), reply, options, options.clock || Date, options.timers || globalThis) as {
    pick: (count: number) => Promise<string[]>;
    state: State;
    requests: { path: string; payload: Payload }[];
    status: { textContent: string };
    attrs: string[][];
    controls: Record<string, { value: string }>;
    renders: () => number;
    dismisses: () => number;
  };
}

for (const count of [5, 10, 15]) {
  test(`AI selects ${count} complete questions while preserving saved test/review sections and all-question browsing`, async () => {
    const app = harness();
    const saved = JSON.stringify(app.state.blocks);
    const result = await app.pick(count);
    assert.equal(app.requests.length, 1);
    assert.equal(app.requests[0].path, '/api/noamSiteCompanion');
    assert.equal(app.requests[0].payload.teacher.count, count);
    assert.equal(app.requests[0].payload.teacher.candidates.some((candidate) => candidate.label === groups[0].questions[0].id), false, 'Saved questions are not offered to the AI again');
    const picked = groups.filter((group) => groupKeys(group).some((key) => result.includes(key)));
    assert.equal(picked.length, count);
    for (const group of picked) assert.ok(groupKeys(group).every((key) => result.includes(key)), 'Every sub-part remains selected');
    assert.equal(new Set(result).size, result.length);
    assert.deepEqual(app.state.selected, result);
    assert.equal(JSON.stringify(app.state.blocks), saved);
    assert.equal(app.state.sectionKind, 'review');
    assert.equal(app.state.pickMode, 'manual');
    assert.equal(app.state.filter, 'all');
    assert.equal(app.state.lastAiPickCount, count);
    assert.ok(app.attrs.some((attr) => attr.join(':') === 'all:aria-pressed:true'));
    assert.match(app.status.textContent, new RegExp(`^נבחרו ${count} שאלות.*עם AI`));
    assert.equal(app.renders(), 1);
  });
}

for (const failure of [
  new Error('model unavailable'),
  Object.assign(new Error('denied'), { status: 403, code: 'BOT_VERIFICATION_FAILED' }),
  Object.assign(new Error('limited'), { status: 429, code: 'RATE_LIMITED' }),
  Object.assign(new Error('timeout'), { code: 'REQUEST_TIMEOUT' }),
  Object.assign(new Error('unconfigured'), { status: 403, code: 'BOT_STEP_UP_REQUIRED' }),
]) {
  test(`an AI failure (${(failure as any).code || 'model'}) keeps manual choices and never substitutes local selection`, async () => {
    const app = harness(() => { throw failure; });
    const manual = groupKeys(groups[2]);
    app.state.selected = manual.slice();
    const before = JSON.stringify(app.state);
    assert.deepEqual(await app.pick(10), []);
    assert.equal(JSON.stringify(app.state), before);
    assert.equal(app.renders(), 0);
    assert.match(app.status.textContent, /הבחירה שלכם נשמרה/);
    assert.doesNotMatch(app.status.textContent, /נבחרו|בחירה אוטומטית מקומית|עם AI\./);
    if ((failure as any).status === 429) assert.match(app.status.textContent, /הגבלת בקשות/);
    if ((failure as any).code === 'BOT_STEP_UP_REQUIRED') assert.match(app.status.textContent, /אימות אנושי.*לא זמין/);
  });
}

test('manual changes made during an AI request are retained instead of overwritten', async () => {
  const manual = groupKeys(groups[2]);
  const app = harness((payload, state) => {
    state.selected = manual.slice();
    return successfulReply(payload);
  });
  assert.deepEqual(await app.pick(5), []);
  assert.deepEqual(app.state.selected, manual);
  assert.equal(app.state.lastAiPickCount, 0);
  assert.equal(app.renders(), 0);
  assert.match(app.status.textContent, /הבחירה שלכם נשמרה/);
});

test('the client recovery guard detects a manual edit before another verification request', async () => {
  const manual = groupKeys(groups[2]);
  const app = harness((_payload, state, requestOptions) => {
    assert.equal(requestOptions.isCurrent(), true);
    state.selected = manual.slice();
    assert.equal(requestOptions.isCurrent(), false);
    throw Object.assign(new Error('הנושא או הבחירה השתנו. הבחירה שלכם נשמרה.'), { code: 'BOT_REQUEST_CONTEXT_CHANGED' });
  });
  assert.deepEqual(await app.pick(5), []);
  assert.deepEqual(app.state.selected, manual);
  assert.equal(app.requests.length, 1);
  assert.equal(app.renders(), 0);
  assert.equal(app.state.lastAiPickCount, 0);
  assert.match(app.status.textContent, /הבחירה שלכם נשמרה/);
});

test('the client recovery guard detects a changed topic without changing the current manual choices', async () => {
  const app = harness((_payload, state, requestOptions) => {
    assert.equal(requestOptions.isCurrent(), true);
    state.topic = '3';
    assert.equal(requestOptions.isCurrent(), false);
    throw Object.assign(new Error('הנושא או הבחירה השתנו. הבחירה שלכם נשמרה.'), { code: 'BOT_REQUEST_CONTEXT_CHANGED' });
  });
  const manual = groupKeys(groups[2]);
  app.state.selected = manual.slice();
  assert.deepEqual(await app.pick(10), []);
  assert.equal(app.state.topic, '3');
  assert.deepEqual(app.state.selected, manual);
  assert.equal(app.renders(), 0);
});

test('repeated Google browser failure reports a communication error and preserves the complete manual state', async () => {
  const app = harness(() => {
    throw Object.assign(new Error('Google verification failed'), { status: 403, code: 'BOT_VERIFICATION_FAILED', recaptchaBrowserError: true });
  });
  app.state.selected = groupKeys(groups[2]).slice();
  const before = JSON.stringify(app.state);
  assert.deepEqual(await app.pick(15), []);
  assert.equal(JSON.stringify(app.state), before);
  assert.equal(app.renders(), 0);
  assert.match(app.status.textContent, /Google.*תקלה בתקשורת.*הבחירה שלכם נשמרה/);
  assert.doesNotMatch(app.status.textContent, /נבחרו|נחסמה מטעמי אבטחה|בחירה אוטומטית מקומית|עם AI\./);
});

test('changing a saved section while AI is running is not overwritten by the returned selection', async () => {
  const app = harness((payload, state) => {
    state.blocks[0].kind = 'review';
    return successfulReply(payload);
  });
  assert.deepEqual(await app.pick(5), []);
  assert.equal(app.state.blocks[0].kind, 'review');
  assert.deepEqual(app.state.selected, []);
  assert.match(app.status.textContent, /הבחירה שלכם נשמרה/);
});

test('unsupported counts never send a model request', async () => {
  const app = harness();
  for (const count of [0, -1, 6, 20, NaN]) assert.deepEqual(await app.pick(count), []);
  assert.deepEqual(app.requests, []);
});

function numberedPool(count: number, pdfId = 'elementary-source') {
  const sheet = { pdfId, level: 'a', levelLabel: 'רמה א׳' };
  return Array.from({ length: count }, (_, index) => ({ id: String(index + 1), q: index + 1, page: Math.floor(index / 5) + 1, source: sheet }));
}

test('the excellence filter includes both c and c2 while keeping other levels separate', () => {
  const topic = { sheets: ['a', 'b', 'c', 'c2'].map((level) => ({ level, pdfId: level })) };
  const select = new Function('topic', `
    const state = { level: 'c' };
    const currentTopic = () => topic;
    ${definition('topicSheets')}
    ${definition('levelAllows')}
    return () => topicSheets().filter(levelAllows);
  `)(topic);
  assert.deepEqual(select().map((sheet: { level: string }) => sheet.level), ['c', 'c2']);
});

for (const count of [5, 10, 15]) {
  test(`the real AI ${count} button keeps c2 candidates and selections distinct from c`, async () => {
    const c = numberedPool(20, 'c-source');
    const c2 = numberedPool(20, 'c2-source');
    c[0].source.level = 'c';
    c2[0].source.level = 'c2';
    const chosen = c2.slice(-count).map((question) => `ex:${question.source.pdfId}:${question.id}`);
    const app = harness((payload) => {
      const identifiers = payload.teacher.candidates.map((candidate) => candidate.id);
      assert.equal(new Set(identifiers).size, 40);
      assert.ok(identifiers.includes('c:20'));
      assert.ok(identifiers.includes('c2:20'));
      return { source: 'classifier', model: 'test-model', exerciseIds: chosen, modelExerciseIds: chosen };
    }, { pool: [...c, ...c2], grade: '8', savedKeys: [] });
    assert.deepEqual(await app.pick(count), chosen);
    assert.equal(app.requests.length, 1);
    assert.match(app.status.textContent, /עם AI/);
    assert.doesNotMatch(app.status.textContent, /מקומית/);
  });
}

for (const grade of ['1', '2', '3', '4', '5', '6', '7', '8', '9']) {
  for (const count of [5, 10, 15]) {
    test(`grade ${grade} accepts AI ${count} with numeric question labels and preserves every selected question`, async () => {
      const pool = numberedPool(20, `grade-${grade}`);
      const chosen = pool.slice(-count).map((question) => `ex:${question.source.pdfId}:${question.id}`);
      const app = harness(() => ({ source: 'classifier', model: 'test-model', exerciseIds: chosen, modelExerciseIds: chosen }), { pool, grade, savedKeys: [], scenario: 'first', style: 'scaffold' });
      assert.deepEqual(await app.pick(count), chosen);
      assert.equal(app.requests[0].payload.teacher.candidates.length, 20);
      assert.equal(app.state.filter, 'all');
      assert.match(app.status.textContent, new RegExp(`^נבחרו ${count} שאלות.*עם AI\\.`));
    });
  }
}

test('all 120 questions reach the model and a teacher request for questions beyond 90 is retained', async () => {
  const pool = numberedPool(120);
  const chosen = pool.slice(-15).map((question) => `ex:${question.source.pdfId}:${question.id}`);
  const app = harness((payload) => {
    assert.equal(payload.teacher.candidates.length, 120);
    assert.equal(new Set(payload.teacher.candidates.map((candidate) => candidate.id)).size, 120);
    assert.ok(payload.teacher.candidates.some((candidate) => candidate.id === 'a:120'));
    return { source: 'classifier', model: 'test-model', exerciseIds: chosen, modelExerciseIds: chosen };
  }, { pool, savedKeys: [], scenario: 'first', style: 'scaffold' });
  assert.deepEqual(await app.pick(15), chosen);
});

test('mixed selections keep model choices and identify local completion without crediting it to AI', async () => {
  const pool = numberedPool(20);
  const modelExerciseIds = ['ex:elementary-source:19', 'ex:elementary-source:20'];
  const app = harness(() => ({ source: 'mixed', model: 'test-model', modelExerciseIds,
    exerciseIds: [...modelExerciseIds, 'ex:elementary-source:1', 'ex:elementary-source:2', 'ex:elementary-source:3'] }), { pool, savedKeys: [] });
  const result = await app.pick(5);
  assert.equal(result.length, 5);
  modelExerciseIds.forEach((key) => assert.ok(result.includes(key)));
  assert.match(app.status.textContent, /2 עם AI, והשאר הושלמו בבחירה מקומית/);
  assert.doesNotMatch(app.status.textContent, /סעיפים\) עם AI\./);
});

test('zero accepted model IDs cannot replace a manual choice even when the response includes locally padded exercise IDs', async () => {
  const pool = numberedPool(20);
  const app = harness(() => ({ source: 'classifier', model: 'test-model', modelExerciseIds: [],
    exerciseIds: pool.slice(0, 5).map((question) => `ex:${question.source.pdfId}:${question.id}`) }), { pool, savedKeys: [] });
  app.state.selected = ['ex:elementary-source:19'];
  assert.deepEqual(await app.pick(5), []);
  assert.deepEqual(app.state.selected, ['ex:elementary-source:19']);
  assert.match(app.status.textContent, /לא התקבלה בחירת שאלות מה-AI.*הבחירה שלכם נשמרה/);
  assert.doesNotMatch(app.status.textContent, /עם AI\./);
});

test('requesting 15 from a topic with eight questions sends eight and explicitly explains the shortfall', async () => {
  const pool = numberedPool(8);
  const chosen = pool.map((question) => `ex:${question.source.pdfId}:${question.id}`);
  const app = harness((payload) => {
    assert.equal(payload.teacher.count, 8);
    return { source: 'classifier', model: 'test-model', exerciseIds: chosen, modelExerciseIds: chosen };
  }, { pool, grade: '1', savedKeys: [] });
  assert.deepEqual(await app.pick(15), chosen);
  assert.match(app.status.textContent, /^נבחרו 8 שאלות/);
  assert.match(app.status.textContent, /התבקשו 15 שאלות, אך בנושא וברמה האלה זמינות רק 8; כולן נבחרו/);
  assert.equal(new Set(app.state.selected).size, 8);
});

function explicitPlan(ids: string[]) {
  return { source: 'classifier', model: 'test-model', exerciseIds: ids.slice().reverse(), modelExerciseIds: ids.slice() };
}

function replyWithPlans(payload: Payload, pool: ReturnType<typeof numberedPool>) {
  const candidateIds = new Set(payload.teacher.candidates.map((candidate) => candidate.id));
  const available = pool.filter((part) => candidateIds.has(`${part.source.level}:${part.id}`));
  const teacherPlans = Object.fromEntries([5, 10, 15].map((count) => {
    const representatives = payload.teacher.level === 'all' ? ['a', 'b', 'c'].map(level => available.find(part => (part.source.level === 'c2' ? 'c' : part.source.level) === level)).filter(Boolean) : [];
    const selected = representatives.length > 1 ? [...representatives, ...available.slice().reverse().filter(part => !representatives.includes(part))].slice(0, count) : available.slice(-count);
    return [String(count), explicitPlan(available.filter(part => selected.includes(part)).map(part => `ex:${part.source.pdfId}:${part.id}`))];
  }));
  const primary = teacherPlans[String([5, 10, 15].find((count) => Math.min(count, available.length) === payload.teacher.count) || 5)];
  return { ...primary, teacherPlans };
}

test('a successful human step resumes one AI request and retains all three explicit model plans', async () => {
  const pool = numberedPool(20);
  let finishHuman: (token: string) => void = () => { throw new Error('Human step not shown'); };
  let human: HumanRequest | undefined;
  const proof = { provider: 'recaptcha-v2', siteKey: 'synthetic-site-key', requestToken: 'synthetic-ticket', expiresAt: Date.now() + 10000 };
  const app = harness(async (payload, _state, options) => {
    assert.equal(await options.onChallenge(proof), 'synthetic-human-token');
    return replyWithPlans(payload, pool);
  }, { pool, savedKeys: [], humanVerification: (request) => {
    human = request;
    return new Promise((resolve) => { finishHuman = resolve; });
  } });
  app.state.selected = ['ex:elementary-source:1'];
  const pending = app.pick(5);
  while (!human) await new Promise((resolve) => setImmediate(resolve));
  assert.equal(human.challenge, proof);
  assert.equal(human.isCurrent(), true);
  assert.deepEqual(app.state.selected, ['ex:elementary-source:1']);
  assert.match(app.status.textContent, /נדרש אימות אנושי.*הבחירה שלכם נשמרה/);
  assert.deepEqual(await app.pick(10), [], 'No duplicate AI request while human verification is pending');
  assert.equal(app.requests.length, 1);
  assert.equal(app.dismisses(), 1, 'A duplicate click must not dismiss the active human task');
  human.onSubmitting(); finishHuman('synthetic-human-token');
  assert.equal((await pending).length, 5);
  assert.equal((await app.pick(10)).length, 10);
  assert.equal((await app.pick(15)).length, 15);
  assert.equal(app.requests.length, 1, 'Only model-returned plans are reused after human verification');
  assert.match(app.status.textContent, /עם AI.*הוכנה בבקשת ה-AI הקודמת/);
});

test('the thinking timer excludes time spent completing the human challenge', async () => {
  let now = 1000, tick = () => {}, cleared = 0;
  const app = harness(async (payload, _state, options) => {
    now = 2000;
    await options.onChallenge({ expiresAt: 120000 });
    tick();
    assert.match(app.status.textContent, /\(1 שניות\)/, 'Sixty seconds of human time are excluded');
    return successfulReply(payload);
  }, {
    clock: { now: () => now },
    timers: { setInterval(fn) { tick = fn; return 1; }, clearInterval() { cleared += 1; } },
    humanVerification: async (request) => {
      now = 62000; tick();
      assert.match(app.status.textContent, /נדרש אימות אנושי/, 'Waiting does not overwrite the human instruction');
      request.onSubmitting();
      return 'synthetic-human-token';
    },
  });
  await app.pick(5);
  assert.equal(cleared, 1);
});

test('manual edits during human verification invalidate its context and cannot cache late model plans', async () => {
  const pool = numberedPool(20);
  let finishHuman: (token: string) => void = () => { throw new Error('Human step not shown'); };
  let human: HumanRequest | undefined;
  let first = true;
  const app = harness(async (payload, _state, options) => {
    if (first) {
      first = false;
      await options.onChallenge({ expiresAt: Date.now() + 10000 });
    }
    return replyWithPlans(payload, pool);
  }, { pool, savedKeys: [], humanVerification: (request) => {
    human = request;
    return new Promise((resolve) => { finishHuman = resolve; });
  } });
  const pending = app.pick(5);
  while (!human) await new Promise((resolve) => setImmediate(resolve));
  app.state.selected = ['ex:elementary-source:2'];
  assert.equal(human.isCurrent(), false);
  // Even a misbehaving/late widget callback cannot overwrite a newer manual choice.
  finishHuman('late-synthetic-token');
  assert.deepEqual(await pending, []);
  assert.deepEqual(app.state.selected, ['ex:elementary-source:2']);
  assert.equal(app.renders(), 0);
  await app.pick(10);
  assert.equal(app.requests.length, 2, 'The stale response must not populate the model-plan cache');
});

for (const code of ['BOT_CHALLENGE_CANCELLED', 'BOT_CHALLENGE_EXPIRED', 'BOT_CHALLENGE_UNAVAILABLE']) {
  test(`${code} from human verification preserves manual choices without local completion`, async () => {
    const pool = numberedPool(20);
    const app = harness(async (payload, _state, options) => {
      await options.onChallenge({ expiresAt: Date.now() + 10000 });
      return replyWithPlans(payload, pool);
    }, { pool, savedKeys: [], humanVerification: async () => {
      throw Object.assign(new Error('האימות לא הושלם. הבחירה שלכם נשמרה.'), { code });
    } });
    app.state.selected = ['ex:elementary-source:3'];
    const before = JSON.stringify(app.state);
    assert.deepEqual(await app.pick(5), []);
    assert.equal(JSON.stringify(app.state), before);
    assert.equal(app.renders(), 0);
    assert.match(app.status.textContent, /הבחירה שלכם נשמרה/);
    assert.doesNotMatch(app.status.textContent, /נבחרו|מקומית/);
    if (code === 'BOT_CHALLENGE_UNAVAILABLE') {
      assert.match(app.status.textContent, /Google לא נטענה/);
      assert.doesNotMatch(app.status.textContent, /לא אישרה/);
    }
  });
}

test('one guarded response supplies three distinct model plans without another POST or truncating a larger plan', async () => {
  const pool = numberedPool(20);
  const ids = (from: number, to: number) => pool.slice(from, to).map((part) => `ex:${part.source.pdfId}:${part.id}`);
  const teacherPlans = { '5': explicitPlan(ids(15, 20)), '10': explicitPlan(ids(0, 10)), '15': explicitPlan(ids(2, 17)) };
  const app = harness((payload) => {
    assert.deepEqual(payload.teacher.planCounts, [5, 10, 15]);
    return { ...teacherPlans['5'], teacherPlans };
  }, { pool, savedKeys: [] });
  assert.deepEqual(await app.pick(5), ids(15, 20));
  assert.deepEqual(await app.pick(10), ids(0, 10));
  assert.deepEqual(await app.pick(15), ids(2, 17));
  assert.deepEqual(await app.pick(5), ids(15, 20));
  assert.equal(app.requests.length, 1);
  assert.match(app.status.textContent, /עם AI\./);
  assert.match(app.status.textContent, /הוכנה בבקשת ה-AI הקודמת/);
  assert.doesNotMatch(app.status.textContent, /מקומית/);
  app.state.selected = ids(0, 1);
  assert.deepEqual(await app.pick(10), ids(0, 10), 'An explicit AI click may replace a manual selection with its verified plan');
  assert.equal(app.requests.length, 1);
});

test('plan reuse is invalidated by every model input, source hash, full question membership and saved section context', async () => {
  const pool = numberedPool(20);
  const app = harness((payload) => replyWithPlans(payload, pool), { pool, savedKeys: [] });
  await app.pick(5);
  assert.equal(app.requests.length, 1);
  const changes = [
    () => { app.state.grade = '8'; },
    () => { app.state.topic = '46'; },
    () => { app.state.level = 'all'; },
    () => { app.state.scenario = 'exam'; },
    () => { app.state.style = 'creative'; },
    () => { app.controls['teacher-note'].value = 'בחר שאלות מסוף המאגר'; },
    () => { Object.assign(pool[0].source, { sourceSha256: 'changed-source-sha256' }); },
    () => { pool.push({ ...pool[0], id: '1ב' }); },
    () => { pool.push({ ...pool[19], id: '21', q: 21 }); },
    () => { app.state.blocks[0].title = 'שם חדש לאותו חלק'; },
    () => { app.state.blocks[0].kind = 'review'; },
    () => { app.state.blocks[0].keys.push('ex:elementary-source:2'); },
  ];
  for (const [index, change] of changes.entries()) {
    change();
    await app.pick(10);
    assert.equal(app.requests.length, index + 2, `Context change ${index + 1} requires a fresh guarded request`);
  }
});

test('the cache uses the exact trimmed 400-character note sent to the server', async () => {
  const pool = numberedPool(20);
  const app = harness((payload) => replyWithPlans(payload, pool), { pool, savedKeys: [] });
  app.controls['teacher-note'].value = '  ' + 'א'.repeat(400) + 'first ignored suffix';
  await app.pick(5);
  app.controls['teacher-note'].value = 'א'.repeat(400) + 'other ignored suffix  ';
  await app.pick(10);
  assert.equal(app.requests.length, 1);
  app.controls['teacher-note'].value = 'ב' + 'א'.repeat(399);
  await app.pick(15);
  assert.equal(app.requests.length, 2);
});

for (const mutation of ['goal', 'style', 'note', 'source hash', 'candidate subparts']) {
  test(`a ${mutation} change during the request preserves the current selection and cannot populate reusable plans`, async () => {
    const pool = numberedPool(20);
    let change = true;
    const app = harness((payload, state) => {
      const result = replyWithPlans(payload, pool);
      if (change) {
        change = false;
        if (mutation === 'goal') state.scenario = 'exam';
        if (mutation === 'style') state.style = 'creative';
        if (mutation === 'note') app.controls['teacher-note'].value = 'משימה חדשה';
        if (mutation === 'source hash') Object.assign(pool[0].source, { sourceSha256: 'new-source' });
        if (mutation === 'candidate subparts') pool.push({ ...pool[0], id: '1ב' });
      }
      return result;
    }, { pool, savedKeys: [] });
    assert.deepEqual(await app.pick(5), []);
    assert.deepEqual(app.state.selected, []);
    assert.match(app.status.textContent, /הבחירה שלכם נשמרה/);
    await app.pick(10);
    assert.equal(app.requests.length, 2);
  });
}

for (const invalid of ['mixed', 'fallback', 'missing model', 'partial', 'extra', 'duplicate', 'unknown', 'different IDs', 'same whole question']) {
  test(`an explicit ${invalid} plan is never reused as verified AI`, async () => {
    const pool = numberedPool(20);
    pool.push({ ...pool[0], id: '1ב' });
    const valid = pool.slice(0, 10).map((part) => `ex:${part.source.pdfId}:${part.id}`);
    const bad: Record<string, any> = explicitPlan(valid);
    if (invalid === 'mixed' || invalid === 'fallback') bad.source = invalid;
    if (invalid === 'missing model') bad.model = '';
    if (invalid === 'partial') { bad.exerciseIds.pop(); bad.modelExerciseIds.pop(); }
    if (invalid === 'extra') { bad.exerciseIds.push('ex:elementary-source:11'); bad.modelExerciseIds.push('ex:elementary-source:11'); }
    if (invalid === 'duplicate') { bad.exerciseIds[0] = bad.exerciseIds[1]; bad.modelExerciseIds[0] = bad.modelExerciseIds[1]; }
    if (invalid === 'unknown') { bad.exerciseIds[0] = 'ex:unknown:10'; bad.modelExerciseIds[9] = 'ex:unknown:10'; }
    if (invalid === 'different IDs') bad.exerciseIds[0] = 'ex:elementary-source:11';
    if (invalid === 'same whole question') { bad.exerciseIds[0] = 'ex:elementary-source:1ב'; bad.modelExerciseIds[9] = 'ex:elementary-source:1ב'; }
    const app = harness((payload) => ({ ...replyWithPlans(payload, pool), teacherPlans: { '10': bad } }), { pool, savedKeys: [] });
    await app.pick(5);
    await app.pick(10);
    assert.equal(app.requests.length, 2);
    assert.doesNotMatch(app.status.textContent, /הוכנה בבקשת ה-AI הקודמת/);
  });
}

for (const source of ['mixed', 'fallback']) {
  test(`a ${source} response cannot populate the verified-plan cache`, async () => {
    const pool = numberedPool(20);
    const app = harness((payload) => ({ ...replyWithPlans(payload, pool), source }), { pool, savedKeys: [] });
    await app.pick(5);
    await app.pick(10);
    assert.equal(app.requests.length, 2);
  });
}

test('c2 model plans stay distinct from c when switching all three counts without another request', async () => {
  const c = numberedPool(20, 'c-source'), c2 = numberedPool(20, 'c2-source');
  c[0].source.level = 'c'; c2[0].source.level = 'c2';
  const app = harness((payload) => replyWithPlans(payload, [...c, ...c2]), { pool: [...c, ...c2], grade: '8', savedKeys: [] });
  for (const count of [5, 10, 15]) {
    assert.deepEqual(await app.pick(count), c2.slice(-count).map((part) => `ex:${part.source.pdfId}:${part.id}`));
  }
  assert.equal(app.requests.length, 1);
});

function mixedLevelPool() {
  return ['a', 'b', 'c2'].flatMap(level => {
    const pool = numberedPool(20, `${level}-mixed-source`);
    pool[0].source.level = level;
    return pool;
  });
}
function assertMixedSelection(picked: string[], pool: ReturnType<typeof numberedPool>) {
  const represented = new Set(pool.filter(part => picked.includes(`ex:${part.source.pdfId}:${part.id}`)).map(part => part.source.level === 'c2' ? 'c' : part.source.level));
  assert.deepEqual([...represented].sort(), ['a', 'b', 'c']);
}

test('all-level 5/10/15 choices reuse only explicit plans covering a, b and c2 as excellence', async () => {
  const pool = mixedLevelPool();
  const app = harness(payload => replyWithPlans(payload, pool), { pool, savedKeys: [] });
  app.state.level = 'all';
  for (const count of [5, 10, 15]) {
    const picked = await app.pick(count);
    assert.equal(picked.length, count); assertMixedSelection(picked, pool);
  }
  assert.equal(app.requests.length, 1);
  assert.match(app.status.textContent, /הוכנה בבקשת ה-AI הקודמת/);
});

for (const count of [5, 10, 15]) {
  test(`a ${count}-question primary response missing a family preserves the entire manual state`, async () => {
    const pool = mixedLevelPool();
    const onlyA = pool.filter(part => part.source.level === 'a').slice(0, count).map(part => `ex:${part.source.pdfId}:${part.id}`);
    const app = harness(() => ({ ...explicitPlan(onlyA), teacherPlans: { [String(count)]: explicitPlan(onlyA) } }), { pool, savedKeys: [] });
    app.state.level = 'all'; app.state.selected = [`ex:${pool.at(-1)!.source.pdfId}:20`];
    const before = JSON.stringify(app.state);
    assert.deepEqual(await app.pick(count), []);
    assert.equal(JSON.stringify(app.state), before); assert.equal(app.renders(), 0);
    assert.match(app.status.textContent, /לא התקבלה בחירת AI מלאה שמשלבת את כל הרמות.*הבחירה שלכם נשמרה/);
    assert.doesNotMatch(app.status.textContent, /נבחרו|הושלמו|הוכנה בבקשת/);
  });
}

for (const invalid of ['partial', 'duplicate', 'unknown']) {
  test(`a ${invalid} primary selection covering all families still cannot be filled locally`, async () => {
    const pool = mixedLevelPool();
    const ids = ['a', 'b', 'c2'].map(level => `ex:${level}-mixed-source:1`);
    if (invalid === 'duplicate') ids.push('ex:a-mixed-source:2', 'ex:a-mixed-source:2');
    if (invalid === 'unknown') ids.push('ex:a-mixed-source:2', 'ex:unknown-source:1');
    const app = harness(() => explicitPlan(ids), { pool, savedKeys: [] });
    app.state.level = 'all'; app.state.selected = ['ex:b-mixed-source:20'];
    const before = JSON.stringify(app.state);
    assert.deepEqual(await app.pick(5), []);
    assert.equal(JSON.stringify(app.state), before); assert.equal(app.renders(), 0);
    assert.match(app.status.textContent, /לא התקבלה בחירת AI מלאה שמשלבת את כל הרמות.*הבחירה שלכם נשמרה/);
    assert.doesNotMatch(app.status.textContent, /נבחרו|הושלמו|הוכנה בבקשת/);
  });
}

for (const invalid of ['missing family', 'duplicate', 'partial']) {
  test(`a cached ${invalid} mixed-level plan cannot replace manual choices or avoid a fresh guarded request`, async () => {
    const pool = mixedLevelPool(); let requests = 0;
    const app = harness(payload => {
      requests += 1;
      if (requests > 1) return { source: 'fallback', model: null, exerciseIds: [], modelExerciseIds: [], selectionError: 'MODEL_LEVEL_COVERAGE_MISSING' };
      const response = replyWithPlans(payload, pool);
      const bad = response.teacherPlans['10'];
      if (invalid === 'missing family') response.teacherPlans['10'] = explicitPlan(pool.filter(part => part.source.level === 'a').slice(0, 10).map(part => `ex:${part.source.pdfId}:${part.id}`));
      if (invalid === 'duplicate') { bad.exerciseIds[0] = bad.exerciseIds[1]; bad.modelExerciseIds[0] = bad.modelExerciseIds[1]; }
      if (invalid === 'partial') { bad.exerciseIds.pop(); bad.modelExerciseIds.pop(); }
      return response;
    }, { pool, savedKeys: [] });
    app.state.level = 'all'; assertMixedSelection(await app.pick(5), pool);
    app.state.selected = [`ex:${pool[0].source.pdfId}:1`];
    const before = JSON.stringify(app.state);
    assert.deepEqual(await app.pick(10), []);
    assert.equal(JSON.stringify(app.state), before); assert.equal(requests, 2);
    assert.match(app.status.textContent, /הבחירה שלכם נשמרה/);
    assert.doesNotMatch(app.status.textContent, /הוכנה בבקשת/);
  });
}

test('shortage plans retain each requested count and honestly reuse the eight available questions', async () => {
  const pool = numberedPool(8);
  const app = harness((payload) => replyWithPlans(payload, pool), { pool, grade: '1', savedKeys: [] });
  assert.equal((await app.pick(5)).length, 5);
  assert.equal((await app.pick(10)).length, 8);
  assert.match(app.status.textContent, /התבקשו 10 שאלות.*זמינות רק 8/);
  assert.equal((await app.pick(15)).length, 8);
  assert.match(app.status.textContent, /התבקשו 15 שאלות.*זמינות רק 8/);
  assert.equal(app.state.lastAiPickCount, 15);
  assert.equal(app.requests.length, 1);
});

test('teacher startup prepares the shared client once without posting and remains usable if preparation fails', async () => {
  for (const failPrepare of [false, true]) {
    const boot = new Function('failPrepare', `
      const events = [];
      const installSuggest = () => {}, indexCatalog = () => {}, bind = () => {};
      const fillGrades = () => {}, fillTopics = () => {}, applyScenario = () => events.push('ready');
      const wizardPrefillFromSearch = () => null, loadCurrentTopic = async () => {};
      const state = { scenario: 'first' }, location = { search: '' }, CATALOG_URL = '/catalog';
      let CATALOG;
      const fetch = async () => ({ ok: true, json: async () => ({ grades: [] }) });
      const ensureTeacherBotClient = async () => ({
        prepare: async () => { events.push('prepare'); if (failPrepare) throw new Error('SDK unavailable'); },
        postJson: async () => { events.push('POST'); throw new Error('Unexpected model request'); },
      });
      ${definition('start').split('\nstart().catch')[0]}
      return start().then(() => Promise.resolve()).then(() => events);
    `);
    assert.deepEqual(await boot(failPrepare), ['prepare', 'ready']);
  }
});
