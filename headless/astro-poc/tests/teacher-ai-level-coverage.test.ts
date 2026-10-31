import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { handleNoamSiteCompanion } from '../../../noam-ai/site-companion/endpoint.js';
import { classifierRequestBody, parseClassifier, selectTeacherPicks, selectTeacherPlans } from '../../../noam-ai/site-companion/teacher-pick.js';

const index = JSON.parse(readFileSync(new URL('../src/data/teacher-pick-index.json', import.meta.url), 'utf8'));
const family = (level: string) => level === 'c2' ? 'c' : level;
function anchors(rows: any[]) {
  return rows.flatMap(row => {
    const seen = new Set<number>();
    return row.questions.filter((label: string) => {
      const number = parseInt(label, 10); if (seen.has(number)) return false; seen.add(number); return true;
    }).map((label: string) => ({ id: /^(?:[abc]|c2)$/.test(row.level) ? `${row.level}:${label}` : label,
      label, family: family(row.level), key: `ex:${row.pdfId}:${label}`, text: `שאלה ${label}` }));
  });
}
function inputFor(rows: any[], count = 5, candidates = anchors(rows)) {
  return { message: `בחר ${count} שאלות`, page: { kind: 'teachers', path: '/teachers', title: 'למורים' },
    teacher: { grade: String(rows[0].grade), topic: String(rows[0].topicId), level: 'all', count,
      planCounts: [5, 10, 15], goal: 'first', style: 'scaffold', candidates: candidates.slice() },
    botVerification: { provider: 'recaptcha-v3', token: 'synthetic-mixed-level-proof' } };
}
function mixed(candidates: any[], count: number) {
  const representatives = ['a', 'b', 'c'].map(level => candidates.find(candidate => candidate.family === level)).filter(Boolean);
  return [...representatives, ...candidates.slice().reverse().filter(candidate => !representatives.includes(candidate))].slice(0, count);
}
function modelFor(candidates: any[], count = 5) {
  return { exerciseLabels: mixed(candidates, count).map(candidate => candidate.id),
    exerciseLabelsByCount: Object.fromEntries([5, 10, 15].map(n => [String(n), mixed(candidates, n).map(candidate => candidate.id)])) };
}
function assertCoverage(ids: string[], candidates: any[]) {
  const required = [...new Set(candidates.map(candidate => candidate.family))].filter(level => ['a', 'b', 'c'].includes(level));
  const selected = new Set(candidates.filter(candidate => ids.includes(candidate.key)).map(candidate => candidate.family));
  for (const level of required) assert.ok(selected.has(level), `Missing ${level}`);
  assert.equal(new Set(ids).size, ids.length);
}

for (const grade of [1, 2, 3, 4, 5, 6, 7, 8, 9]) {
  test(`grade ${grade}: real all-level primary and independent 5/10/15 plans cover every eligible family`, () => {
    const first = index.find((row: any) => row.grade === grade && row.level === 'a');
    const rows = index.filter((row: any) => row.grade === grade && row.topicId === first.topicId);
    const candidates = anchors(rows);
    for (const count of [5, 10, 15]) {
      const input = inputFor(rows, count), classified = parseClassifier(JSON.stringify(modelFor(candidates, count)));
      const primary = selectTeacherPicks(index, input, classified);
      assert.equal(primary.selectionSource, 'classifier'); assert.equal(primary.exerciseIds.length, count);
      assertCoverage(primary.modelExerciseIds, candidates);
      const plans = selectTeacherPlans(index, input, classified, 'offline-model');
      for (const size of [5, 10, 15]) {
        assert.equal(plans[size].exerciseIds.length, size);
        assertCoverage(plans[size].modelExerciseIds, candidates);
      }
    }
  });
}

test('all-level prompts require each eligible family in primary and cached plans', () => {
  const rows = index.filter((row: any) => row.grade === 1 && row.topicId === '1');
  const input = inputFor(rows);
  const prompt = classifierRequestBody(input, index).messages[1].content;
  assert.match(prompt, /ב-exerciseLabels ובכל אחת מרשימות exerciseLabelsByCount חובה לבחור לפחות שאלה שלמה אחת/);
  assert.match(prompt, /משפחת רמה זמינה: a, b, c/);
  assert.match(prompt, /c ו-c2 הן אותה משפחת מצוינות c/);
  input.teacher.candidates = input.teacher.candidates.filter(candidate => candidate.family !== 'c');
  const filtered = classifierRequestBody(input, index).messages[1].content;
  assert.match(filtered, /משפחת רמה זמינה: a, b\./);
  assert.doesNotMatch(filtered, /משפחת רמה זמינה: a, b, c/);
});

test('missing-family primary and same-count plan fail honestly after one guarded correction with no local fill', async () => {
  const rows = index.filter((row: any) => row.grade === 1 && row.topicId === '1');
  const input = inputFor(rows), aOnly = input.teacher.candidates.filter(candidate => candidate.family === 'a').slice(0, 5).map(candidate => candidate.id);
  const calls: string[] = [];
  const result = await handleNoamSiteCompanion({ method: 'POST', url: 'https://www.noamdoronmath.co.il/api/noamSiteCompanion' }, {
    payload: input, origin: 'https://www.noamdoronmath.co.il', clientIp: '203.0.113.28', store: new Map(), now: 5000,
    teacherIndex: index, catalog: { grades: [] }, qwenKey: 'synthetic-model-key', recaptchaSecret: 'synthetic-recaptcha-secret',
    rateBackend: { async take() { calls.push('rate'); return true; } },
    fetch: async (url: string) => {
      if (url === 'https://www.google.com/recaptcha/api/siteverify') {
        calls.push('verify'); return { ok: true, json: async () => ({ success: true, score: 0.9, hostname: 'www.noamdoronmath.co.il', action: 'noam_site_companion' }) };
      }
      calls.push('model'); return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ exerciseLabels: aOnly, exerciseLabelsByCount: { '5': aOnly } }) } }] }) };
    },
  });
  const body = result.body as any;
  assert.equal(result.status, 200); assert.deepEqual(calls, ['rate', 'verify', 'model', 'model']);
  assert.equal(body.source, 'fallback'); assert.equal(body.model, null);
  assert.equal(body.selectionError, 'MODEL_LEVEL_COVERAGE_MISSING'); assert.equal(body.code, body.selectionError);
  assert.deepEqual(body.exerciseIds, []); assert.deepEqual(body.modelExerciseIds, []); assert.deepEqual(body.sheetIds, []);
  assert.equal(body.teacherPlans, undefined); assert.deepEqual(body.links, []);
  assert.match(body.answer, /לא התקבלה בחירת שאלות תקינה שמשלבת את כל הרמות/);
  assert.doesNotMatch(body.answer, /הנה בחירה|הושלמה מקומית/);
});

test('every cached count is checked independently and an all-a plan is omitted', () => {
  const rows = index.filter((row: any) => row.grade === 1 && row.topicId === '1');
  const input = inputFor(rows), candidates = input.teacher.candidates;
  for (const invalidCount of [5, 10, 15]) {
    const model = modelFor(candidates);
    model.exerciseLabelsByCount[String(invalidCount)] = candidates.filter(candidate => candidate.family === 'a').slice(0, invalidCount).map(candidate => candidate.id);
    const parsed = parseClassifier(JSON.stringify(model));
    assert.equal(selectTeacherPicks(index, input, parsed).selectionSource, 'classifier');
    const plans = selectTeacherPlans(index, input, parsed, 'offline-model');
    assert.equal(plans[invalidCount], undefined);
    for (const count of [5, 10, 15].filter(n => n !== invalidCount)) assertCoverage(plans[count].modelExerciseIds, candidates);
  }
});

test('partial, duplicate, ambiguous and duplicate-whole-question primary choices cannot be locally repaired', () => {
  const rows = ['a', 'b', 'c'].map((level, i) => ({ grade: 3, topicId: '11', band: 'elementary', level, pdfId: String(i + 1).repeat(32), questions: ['1א', '1ב', '2א', '3א', '4א'] }));
  const input = inputFor(rows);
  input.teacher.candidates.push({ id: 'a:1ב', label: '1ב', family: 'a', key: `ex:${rows[0].pdfId}:1ב`, text: 'אותה שאלה' });
  for (const labels of [
    ['a:1א', 'b:1א', 'c:1א'],
    ['a:1א', 'b:1א', 'c:1א', 'a:2א', 'a:2א'],
    ['a:1א', 'b:1א', 'c:1א', 'a:1ב', 'a:2א'],
    ['1א', '1א', '1א', '2א', '3א'],
    ['a:1א', 'b:1א', 'c:1א', 'a:2א', 'c:999'],
  ]) {
    const result = selectTeacherPicks(rows, input, parseClassifier(JSON.stringify({ exerciseLabels: labels })));
    assert.equal(result.selectionError, 'MODEL_SELECTION_INVALID');
    assert.deepEqual(result.exerciseIds, []); assert.deepEqual(result.modelExerciseIds, []);
  }
});

test('excluded or exhausted families are not required and invented candidates cannot create them', () => {
  const rows = index.filter((row: any) => row.grade === 1 && row.topicId === '1');
  for (const families of [['a', 'b'], ['a']]) {
    const candidates = anchors(rows).filter(candidate => families.includes(candidate.family));
    const input = inputFor(rows, 5, candidates), model = modelFor(candidates);
    input.teacher.candidates.push({ id: 'c:999', label: '999', family: 'c', key: 'invented', text: 'not available' });
    const classified = parseClassifier(JSON.stringify(model));
    const primary = selectTeacherPicks(index, input, classified);
    assert.equal(primary.selectionSource, 'classifier'); assertCoverage(primary.modelExerciseIds, candidates);
    const plans = selectTeacherPlans(index, input, classified, 'offline-model');
    for (const count of [5, 10, 15]) assertCoverage(plans[count].modelExerciseIds, candidates);
  }
});

test('an explicit empty or invalid candidate list cannot reopen excluded catalog questions', () => {
  const rows = index.filter((row: any) => row.grade === 1 && row.topicId === '1');
  const model = parseClassifier(JSON.stringify(modelFor(anchors(rows))));
  for (const candidates of [[], [{ id: 'invalid' }], [{ id: 'c:999' }]]) {
    const input = inputFor(rows);
    (input.teacher as any).candidates = candidates;
    const picked = selectTeacherPicks(index, input, model);
    assert.equal(picked.selectionError, 'MODEL_SELECTION_INVALID'); assert.deepEqual(picked.exerciseIds, []);
    assert.deepEqual(selectTeacherPlans(index, input, model, 'offline-model'), {});
    assert.doesNotMatch(classifierRequestBody(input, index).messages[1].content, /סעיפים קיימים בדף לבחירה/);
  }
});

for (const topic of ['43', '54']) {
  test(`G8T${topic}: c2 satisfies the c family without selecting from both excellence sources`, () => {
    const rows = index.filter((row: any) => row.grade === 8 && row.topicId === topic);
    const candidates = anchors(rows).filter(candidate => !candidate.id.startsWith('c:'));
    const input = inputFor(rows, 5, candidates), classified = parseClassifier(JSON.stringify(modelFor(candidates)));
    const primary = selectTeacherPicks(index, input, classified);
    assert.equal(primary.selectionSource, 'classifier'); assertCoverage(primary.modelExerciseIds, candidates);
    const plans = selectTeacherPlans(index, input, classified, 'offline-model');
    for (const count of [5, 10, 15]) assertCoverage(plans[count].modelExerciseIds, candidates);
  });
}

test('a real shortage returns each available whole question while still representing its eligible families', () => {
  const rows = ['a', 'b', 'c'].map((level, i) => ({ grade: 2, topicId: '1', level, pdfId: String(i + 1).repeat(32), questions: ['1', '1'] }));
  const input = inputFor(rows, 3), classified = parseClassifier(JSON.stringify(modelFor(input.teacher.candidates, 3)));
  const primary = selectTeacherPicks(rows, input, classified);
  assert.equal(primary.selectionSource, 'classifier'); assert.equal(primary.exerciseIds.length, 3);
  assertCoverage(primary.modelExerciseIds, input.teacher.candidates);
  for (const plan of Object.values(selectTeacherPlans(rows, input, classified, 'offline-model')) as any[]) {
    assert.equal(plan.exerciseIds.length, 3); assertCoverage(plan.modelExerciseIds, input.teacher.candidates);
  }
});

test('one and single-family scopes keep valid explicit 5/10/15 selections without invented families', () => {
  for (const level of ['one', 'a', 'c', 'c2']) {
    const rows = [{ grade: 9, topicId: '1', level, pdfId: 'a'.repeat(32), questions: Array.from({ length: 8 }, (_, i) => String(i + 1)) }];
    const input = inputFor(rows, 5), classified = parseClassifier(JSON.stringify(modelFor(input.teacher.candidates)));
    assert.equal(selectTeacherPicks(rows, input, classified).selectionSource, 'classifier');
    const plans = selectTeacherPlans(rows, input, classified, 'offline-model');
    assert.equal(plans['5'].exerciseIds.length, 5); assert.equal(plans['10'].exerciseIds.length, 8); assert.equal(plans['15'].exerciseIds.length, 8);
  }
});

test('legacy teacher chat without an explicit all-level selection retains a one-question request', () => {
  const rows = index.filter((row: any) => row.grade === 1 && row.topicId === '1');
  const candidate = anchors(rows).find(item => item.family === 'b')!;
  const input = { message: 'בחר 1 שאלות', page: { kind: 'teachers' }, teacher: { grade: '1', topic: '1' } };
  const classified = parseClassifier(JSON.stringify({ exerciseLabels: [candidate.id] }));
  const picked = selectTeacherPicks(index, input, classified);
  assert.equal(picked.selectionSource, 'classifier');
  assert.deepEqual(picked.exerciseIds, [candidate.key]);
  assert.equal(picked.selectionError, undefined);
  assert.doesNotMatch(classifierRequestBody(input, index).messages[1].content, /חובה לבחור לפחות שאלה שלמה אחת/);
  const explicitAll = { ...input, teacher: { ...input.teacher, level: 'all' } };
  assert.equal(selectTeacherPicks(index, explicitAll, classified).selectionError, 'MODEL_LEVEL_COVERAGE_MISSING');
});
