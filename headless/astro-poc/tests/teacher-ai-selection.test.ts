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

type Payload = { teacher: { count: number; candidates: { id: string; label: string }[] } };
type State = { selected: string[]; blocks: { kind: string; title: string; keys: string[] }[]; sectionKind: string; pickMode: string; filter: string; lastAiPickCount: number };
const successfulReply = (payload: Payload) => ({
  source: 'classifier', model: 'qwen3.8-flash',
  exerciseIds: payload.teacher.candidates.slice(-payload.teacher.count).map((candidate) => `ex:${source.pdfId}:${candidate.label}`),
});

function harness(reply: (payload: Payload, state: State) => unknown = successfulReply) {
  return new Function('pool', 'groupWholeQuestions', 'savedKeys', 'reply', `
    let state = { grade: '9', topic: '2', level: 'a', scenario: 'other', style: 'blended',
      selected: [], blocks: [{ kind: 'test', title: 'נושא קודם', keys: savedKeys }],
      sectionKind: 'review', lastAiPickCount: 0, pickMode: 'manual', filter: 'selected', expanded: false };
    let history = [];
    let aiPickPending = 0;
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
    const AI_CANDIDATE_LIMIT = 90;
    const ensureTeacherBotClient = async () => ({ postJson: async (path, payload) => {
      requests.push({ path, payload });
      return await reply(payload, state);
    } });
    ${['exKey', 'questionPreviewGroup', 'currentQuestions', 'keysOfQuestions', 'rolePlan', 'interleaveSheets', 'planOrder', 'smartQuestionPick', 'carriedKeys', 'selectionKey', 'snapshot', 'pickWithAi'].map(definition).join('\n')}
    return { pick: pickWithAi, state, requests, status, attrs, announcements, renders: () => renderCount };
  `)(source.questions, groupWholeQuestions, groupKeys(groups[0]), reply) as {
    pick: (count: number) => Promise<string[]>;
    state: State;
    requests: { path: string; payload: Payload }[];
    status: { textContent: string };
    attrs: string[][];
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
