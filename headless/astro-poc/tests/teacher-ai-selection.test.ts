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

type Payload = { teacher: { count: number; planCounts: number[]; candidates: { id: string; label: string }[] } };
type State = { grade: string; topic: string; level: string; scenario: string; style: string; selected: string[]; blocks: { kind: string; title: string; keys: string[] }[]; sectionKind: string; pickMode: string; filter: string; lastAiPickCount: number; pickNote?: string };
const successfulReply = (payload: Payload) => ({
  source: 'classifier', model: 'qwen3.8-flash',
  exerciseIds: payload.teacher.candidates.slice(-payload.teacher.count).map((candidate) => `ex:${source.pdfId}:${candidate.label}`),
});

function harness(reply: (payload: Payload, state: State) => unknown = successfulReply, options: { pool?: unknown[]; grade?: string; scenario?: string; style?: string; savedKeys?: string[] } = {}) {
  return new Function('pool', 'groupWholeQuestions', 'savedKeys', 'reply', 'options', `
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
    const ensureTeacherBotClient = async () => ({ postJson: async (path, payload) => {
      requests.push({ path, payload });
      return await reply(payload, state);
    } });
    ${['exKey', 'questionPreviewGroup', 'currentQuestions', 'keysOfQuestions', 'rolePlan', 'interleaveSheets', 'planOrder', 'smartQuestionPick', 'carriedKeys', 'selectionKey', 'snapshot', 'teacherAiNote', 'teacherAiContext', 'verifiedTeacherPlan', 'rememberTeacherPlans', 'pickWithAi'].map(definition).join('\n')}
    return { pick: pickWithAi, state, requests, status, attrs, controls, announcements, renders: () => renderCount };
  `)(options.pool || source.questions, groupWholeQuestions, options.savedKeys || groupKeys(groups[0]), reply, options) as {
    pick: (count: number) => Promise<string[]>;
    state: State;
    requests: { path: string; payload: Payload }[];
    status: { textContent: string };
    attrs: string[][];
    controls: Record<string, { value: string }>;
    renders: () => number;
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

test('a model failure remains usable and clearly labels the automatic local fallback', async () => {
  const app = harness(() => { throw new Error('model unavailable'); });
  const result = await app.pick(10);
  assert.equal(groups.filter((group) => groupKeys(group).some((key) => result.includes(key))).length, 10);
  assert.match(app.status.textContent, /בחירה אוטומטית מקומית/);
  assert.match(app.status.textContent, /לא התקבלה בחירה מתאימה מה-AI/);
  assert.doesNotMatch(app.status.textContent, /עם AI\./);
});

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

test('zero accepted model IDs are labelled local even when the response includes padded exercise IDs', async () => {
  const pool = numberedPool(20);
  const app = harness(() => ({ source: 'classifier', model: 'test-model', modelExerciseIds: [],
    exerciseIds: pool.slice(0, 5).map((question) => `ex:${question.source.pdfId}:${question.id}`) }), { pool, savedKeys: [] });
  assert.equal((await app.pick(5)).length, 5);
  assert.match(app.status.textContent, /בחירה אוטומטית מקומית/);
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
  const teacherPlans = Object.fromEntries([5, 10, 15].map((count) => [String(count), explicitPlan(
    available.slice(-Math.min(count, available.length)).map((part) => `ex:${part.source.pdfId}:${part.id}`)
  )]));
  const primary = teacherPlans[String([5, 10, 15].find((count) => Math.min(count, available.length) === payload.teacher.count) || 5)];
  return { ...primary, teacherPlans };
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
