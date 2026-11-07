import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { classifierRequestBody } from '../../../noam-ai/site-companion/teacher-pick.js';

const printer = readFileSync(new URL('../public/teachers/teacher-factoring-print.js', import.meta.url), 'utf8');
function definition(name: string) {
  const start = printer.search(new RegExp(`(?:^|\\n)(?:async )?function ${name}\\(`));
  assert.notEqual(start, -1);
  const tail = printer.slice(start + (printer[start] === '\n' ? 1 : 0));
  const end = tail.search(/\n(?:async )?function /);
  return end < 0 ? tail : tail.slice(0, end);
}
type Group = { key: string; role: string; pdfId: string; index: number; source: { level: string } };
const { pick, order } = new Function(`${['rolePlan', 'interleaveSheets', 'planOrder', 'smartQuestionPick'].map(definition).join('\n')} return {pick: smartQuestionPick, order: planOrder};`)() as {
  pick: (groups: Group[], count: number, goal: string, style: string, seeds: string[], preserve?: boolean, level?: string) => string[];
  order: (groups: Group[], goal: string, style: string) => Group[];
};
const groups: Group[] = Array.from({ length: 20 }, (_, i) => ({ key: `a:${i + 1}`, role: i < 7 ? 'basis' : i < 14 ? 'review' : 'creative', pdfId: 'a', index: i, source: { level: 'a' } }));
const roleCounts = (keys: string[], pool = groups) => keys.reduce((counts, key) => {
  const role = pool.find((group) => group.key === key)!.role;
  counts[role] = (counts[role] || 0) + 1;
  return counts;
}, {} as Record<string, number>);

test('five default questions cover source beginning, middle and end even if AI picks only 1–5', () => {
  const seeds = groups.slice(0, 5).map((group) => group.key);
  const picked = pick(groups, 5, 'first', 'scaffold', seeds);
  assert.deepEqual(roleCounts(picked), { basis: 2, review: 2, creative: 1 });
  assert.equal(picked.filter((key) => seeds.includes(key)).length, 2, 'Only retained model choices count as AI picks');
  assert.deepEqual(picked.map((key) => Number(key.split(':')[1])), [1, 2, 8, 9, 15]);
});

test('balanced model choices survive, stay unique and display in source order', () => {
  const seeds = ['a:18', 'a:11', 'a:5', 'a:9', 'a:2'];
  const picked = pick(groups, 5, 'first', 'scaffold', [...seeds, 'invalid', 'a:2']);
  assert.deepEqual(new Set(picked), new Set(seeds));
  assert.deepEqual(picked, ['a:2', 'a:5', 'a:9', 'a:11', 'a:18']);
});

test('10 and 15 questions retain role variety and a sparse role never reduces count', () => {
  assert.deepEqual(roleCounts(pick(groups, 10, 'first', 'scaffold', [])), { basis: 4, review: 3, creative: 3 });
  assert.deepEqual(roleCounts(pick(groups, 15, 'first', 'scaffold', [])), { basis: 5, review: 5, creative: 5 });
  const sparse = groups.filter((group) => group.role === 'basis' || group.key === 'a:15');
  const picked = pick(sparse, 5, 'first', 'scaffold', []);
  assert.equal(picked.length, 5);
  assert.ok(picked.includes('a:15'));
  assert.equal(pick(sparse, 15, 'first', 'scaffold', []).length, sparse.length);
});

test('style changes the balance priority while teacher instructions preserve focused model choices', () => {
  assert.deepEqual(roleCounts(pick(groups, 5, 'first', 'creative', [])), { basis: 1, review: 2, creative: 2 });
  assert.deepEqual(roleCounts(pick(groups, 5, 'exam', 'scaffold', [])), { basis: 1, review: 2, creative: 2 });
  const seeds = groups.slice(0, 5).map((group) => group.key);
  assert.deepEqual(pick(groups, 5, 'first', 'scaffold', seeds, true), seeds);
});

test('balanced selection still covers every requested level family', () => {
  const pool = ['a', 'b', 'c'].flatMap((level, sheet) => groups.map((group, i) => ({ ...group, key: `${level}:${i + 1}`, pdfId: level, source: { level }, index: sheet * 20 + i })));
  const picked = pick(pool, 5, 'first', 'scaffold', ['a:1', 'a:2', 'b:1', 'b:2', 'c:1'], false, 'all');
  assert.deepEqual(new Set(picked.map((key) => key.split(':')[0])), new Set(['a', 'b', 'c']));
  assert.deepEqual(roleCounts(picked, pool), { basis: 2, review: 2, creative: 1 });
  const sparse = [
    { ...groups[0], key: 'a:1', source: {level: 'a'} },
    { ...groups[15], key: 'a:16', source: {level: 'a'} },
    { ...groups[0], key: 'b:1', pdfId: 'b', index: 20, source: {level: 'b'} },
    { ...groups[8], key: 'c:9', pdfId: 'c', index: 40, source: {level: 'c'} },
  ];
  const sparsePick = pick(sparse, 3, 'first', 'scaffold', [], false, 'all');
  assert.deepEqual(new Set(sparsePick.map((key) => key.split(':')[0])), new Set(['a', 'b', 'c']));
  assert.deepEqual(roleCounts(sparsePick, sparse), {creative: 1, basis: 1, review: 1});
});

test('candidate order interleaves role pools instead of exhausting all basis questions', () => {
  assert.deepEqual(order(groups, 'first', 'scaffold').slice(0, 6).map((group) => group.role), ['basis', 'review', 'creative', 'basis', 'review', 'creative']);
});

function aiFlow(note = '', behavior = 'success') {
  const pool = groups.map((group, i) => ({ ...group, q: i + 1, source: { ...group.source, levelLabel: 'רמה א׳' }, parts: [{ id: `${i + 1}א` }], keys: [`ex:a:${i + 1}א`] }));
  const app = new Function('groups', 'note', 'behavior', `
    let state = {grade: '9', topic: '2', level: 'a', scenario: 'first', style: 'scaffold', wizard: 'pick', selected: [], blocks: []};
    let aiPickPending = 0, teacherAiPlanCache = null, wizardNavigating = false, disabledAtRequest = false;
    const AI_QUESTION_COUNTS = [5, 10, 15], QUESTION_ROLES = {basis: 'ביסוס', review: 'חזרה', creative: 'יצירתית'};
    const SCENARIOS = {first: {label: 'מפגש ראשון'}}, STYLES = {scaffold: {label: 'מדורגת'}};
    const status = {textContent: ''}, document = {title: 'למורים'}, location = {pathname: '/teachers', search: ''};
    const controls = {'teacher-ai-note': {value: note}, 'ai-suggest-status': status,
      'wizard-next': {disabled: false}, 'ai-pick-group': {querySelectorAll() {return [];}},
      grade: {selectedOptions: [{textContent: 'ט׳'}]}, topic: {selectedOptions: [{textContent: 'פירוק לגורמים'}]},
      'filter-all': {setAttribute() {}}, 'filter-selected': {setAttribute() {}}};
    const $ = id => controls[id] || null;
    const currentQuestions = () => groups, carriedKeys = () => new Set(), allSelectedKeys = () => state.selected, selectionKey = () => JSON.stringify(state.selected);
    const confirmTeacherReplacement = () => true, dismissTeacherHumanVerification = () => {};
    const snapshot = () => {}, clearPreparedPrint = () => {}, render = () => paintAiPickButtons(), rememberTeacherPlans = () => {};
    const ensureTeacherBotClient = async () => ({postJson: async () => {
      disabledAtRequest = controls['wizard-next'].disabled;
      if (behavior === 'stale') { state.selected = [groups[6].keys[0]]; paintAiPickButtons(); }
      if (behavior === 'error') throw new Error('MODEL_FAILED');
      const chosen = /אחרונ/.test(note) ? groups.slice(-5) : groups.slice(0, 5);
      return {source: 'classifier', model: 'test-model', exerciseIds: chosen.map(g => g.keys[0]), modelExerciseIds: chosen.map(g => g.keys[0])};
    }});
    ${['rolePlan', 'interleaveSheets', 'planOrder', 'smartQuestionPick', 'keysOfQuestions', 'teacherAiNote', 'teacherAiSelectionIsFocused', 'teacherAiContext', 'teacherLevelsCovered', 'verifiedTeacherPlan', 'pickWithAi', 'paintAiPickButtons'].map(definition).join('\n')}
    return {pick: pickWithAi, state, status, controls, wasDisabled: () => disabledAtRequest};
  `)(pool, note, behavior);
  return app;
}

test('default AI flow discloses local balancing and records a truthful reason for each chosen question', async () => {
  const app = aiFlow();
  await app.pick(5);
  assert.deepEqual(app.state.selected, ['ex:a:1א', 'ex:a:2א', 'ex:a:8א', 'ex:a:9א', 'ex:a:15א']);
  assert.match(app.status.textContent, /2 עם AI, והשאר הושלמו בבחירה מקומית לגיוון/);
  assert.match(app.state.aiPickReasons['a:1'], /בחירת AI/);
  assert.match(app.state.aiPickReasons['a:8'], /חזרה באמצע דף המקור · השלמה מקומית לגיוון/);
  assert.equal(Object.keys(app.state.aiPickReasons).length, 5);
});

test('generic classroom notes and lesson-length prefill still balance the default model selection', async () => {
  for (const note of ['לתרגול בכיתה', 'אורך שיעור: 45 דקות', 'השיעור נמשך 30 דקות', 'תרגול לקראת מבחן']) {
    const app = aiFlow(note);
    await app.pick(5);
    assert.deepEqual(app.state.selected, ['ex:a:1א', 'ex:a:2א', 'ex:a:8א', 'ex:a:9א', 'ex:a:15א'], note);
    assert.match(app.status.textContent, /2 עם AI, והשאר הושלמו בבחירה מקומית/);
  }
});

test('explicit constraints preserve the requested model choices instead of applying a generic mix', async () => {
  for (const note of ['רק גורם משותף', 'ללא שאלות יצירתיות', 'דגש על גורם מספרי', 'התמקדו בסימנים', 'שאלות 1 עד 5', 'only common factors', 'focus on signs']) {
    const app = aiFlow(note);
    await app.pick(5);
    assert.deepEqual(app.state.selected, ['ex:a:1א', 'ex:a:2א', 'ex:a:3א', 'ex:a:4א', 'ex:a:5א'], note);
  }
  const last = aiFlow('בחר רק את חמש השאלות האחרונות');
  await last.pick(5);
  assert.deepEqual(last.state.selected, ['ex:a:16א', 'ex:a:17א', 'ex:a:18א', 'ex:a:19א', 'ex:a:20א']);
});

test('Next is disabled during AI and restored after stale replies and model failures', async () => {
  for (const behavior of ['success', 'stale', 'error']) {
    const app = aiFlow('', behavior);
    app.state.selected = ['ex:a:1א'];
    await app.pick(5);
    assert.equal(app.wasDisabled(), true, behavior);
    assert.equal(app.controls['wizard-next'].disabled, false, behavior);
  }
  const empty = aiFlow('', 'error');
  await empty.pick(5);
  assert.equal(empty.controls['wizard-next'].disabled, true, 'An empty failed selection still cannot continue');
});

test('manual deselection and reselection removes former AI attribution', () => {
  const app = new Function(`
    const state = {selected: ['ex:a:1א'], aiPickReasons: {'a:1': 'בחירת AI'}};
    const $ = () => null, snapshot = () => {}, render = () => {}, clearPreparedPrint = () => {};
    const carriedKeys = () => new Set(), selectionKey = () => state.selected.join(), currentExercises = () => [];
    const groupWholeQuestions = () => [{key: 'a:1', questions: [{id: '1א', source: {pdfId: 'a'}}]}];
    ${['exKey', 'toggleWholeQuestion'].map(definition).join('\n')}
    return {state, toggle: toggleWholeQuestion};
  `)();
  app.toggle('a:1', false);
  app.toggle('a:1', true);
  assert.deepEqual(app.state.selected, ['ex:a:1א']);
  assert.deepEqual(app.state.aiPickReasons, {});
});

test('server provides source-derived roles and balanced guidance without trusting browser role text', () => {
  const index = [{ pdfId: 'source-pdf', grade: 9, topicId: '2', level: 'a', levelLabel: 'רמה א׳', questions: Array.from({ length: 20 }, (_, i) => `${i + 1}א`) }];
  const input = { message: 'בחר 5 שאלות', page: { kind: 'teachers', path: '/teachers' }, teacher: { grade: '9', topic: '2', level: 'a', count: 5, planCounts: [5, 10, 15], goal: 'first', style: 'scaffold', candidates: index[0].questions.map((label) => ({ id: `a:${label}`, label, text: 'UNTRUSTED_ROLE' })) } };
  const prompt = classifierRequestBody(input, index).messages[1].content;
  assert.match(prompt, /a:1א \([^)]*\) \[ביסוס\]/);
  assert.match(prompt, /a:8א \([^)]*\) \[חזרה\]/);
  assert.match(prompt, /a:15א \([^)]*\) \[יצירתית\]/);
  assert.match(prompt, /באופן מאוזן/);
  assert.match(prompt, /אין כאן טקסט מלא/);
  assert.equal(prompt.includes('UNTRUSTED_ROLE'), false);
});
