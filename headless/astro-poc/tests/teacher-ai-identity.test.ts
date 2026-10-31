import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runCompanionTurn } from '../../../noam-ai/site-companion/endpoint.js';
import { classifierRequestBody, normalizeLabel, parseClassifier, selectTeacherPicks } from '../../../noam-ai/site-companion/teacher-pick.js';
import { wizardPrefillFromSearch } from '../public/teachers/wizard-prefill.js';

const numericPdf = '2de72d016066488b9b9368f59dacdc72';
function sheet(grade = 9, total = 20) {
  return {
    pdfId: numericPdf, grade, gradeLabel: `כיתה ${grade}`, band: grade <= 6 ? 'elementary' : 'middle',
    topicId: '18', topic: 'בעיות מילוליות', level: 'b', levelLabel: 'רמה ב׳',
    title: 'בעיות מילוליות', mode: 'exercise', pdfUrl: `https://static.wixstatic.com/ugd/d8e7ad_${numericPdf}.pdf`,
    questions: Array.from({ length: total }, (_, i) => String(i + 1)),
  };
}
function payload(row: ReturnType<typeof sheet>, count: number) {
  return {
    message: `בחר ${count} שאלות שלמות עם AI`,
    page: { kind: 'teachers', path: '/teachers', title: 'למורים' },
    teacher: {
      grade: String(row.grade), topic: row.topicId, level: row.level,
      topicLabel: row.topic, count, goal: 'first', style: 'scaffold',
      note: 'בחר רק את השאלות 16, 17, 18, 19 ו־20',
      candidates: row.questions.map((label) => ({ id: `b:${label}`, label, text: `שאלה ${label}` })),
    },
  };
}
async function response(row: ReturnType<typeof sheet>, count: number, labels: string[], input = payload(row, count)) {
  const calls: object[] = [];
  const body = await runCompanionTurn(input, {
    teacherIndex: [row], catalog: { grades: [] }, qwenKey: 'synthetic-test-key',
    fetch: async (_url: string, init: { body: string }) => {
      calls.push(JSON.parse(init.body));
      return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({
        grade: row.grade, topicQuery: row.topic, level: row.level, exerciseLabels: labels,
      }) } }] }) };
    },
  });
  assert.equal(calls.length, 1, 'These tests stub one model call; no network or production secret is used');
  return { body, sent: calls[0] as { messages: { content: string }[] } };
}
const ids = (labels: string[]) => labels.map((label) => `ex:${numericPdf}:${label.replace(/^[abc]:/, '')}`);

test('numeric and Hebrew-suffixed question identifiers survive parsing and wizard handoff', () => {
  for (const value of ['1', '16', '120', '1א', 'b:16', 'a:1א']) assert.ok(normalizeLabel(value), value);
  for (const value of ['0', '01', '-1', '1.2', 'a:1x', '<script>', 'b:1000']) assert.equal(normalizeLabel(value), '', value);
  const parsed = parseClassifier('{"grade":9,"level":"b","exerciseLabels":["b:16","b:17","b:18","b:19","b:20"]}');
  assert.deepEqual(parsed.scopedExerciseLabels, ['b:16', 'b:17', 'b:18', 'b:19', 'b:20']);
  for (const level of ['a', 'b', 'c', 'all']) {
    const pick = `ex:${numericPdf}:16`;
    const prefill = wizardPrefillFromSearch(`?grade=9&topic=18&level=${level}&pick=${encodeURIComponent(pick)}`);
    assert.deepEqual(prefill.exerciseIds, [pick]);
    assert.equal(prefill.level, level);
  }
});

test('the numeric-only regression preserves the actual model choice of 16–20', async () => {
  const labels = ['b:16', 'b:17', 'b:18', 'b:19', 'b:20'];
  const { body, sent } = await response(sheet(), 5, labels);
  assert.equal(body.source, 'classifier');
  assert.equal(body.model, 'qwen3.8-flash');
  assert.deepEqual(body.exerciseIds, ids(labels));
  assert.deepEqual(body.modelExerciseIds, ids(labels));
  assert.match(sent.messages[1].content, /b:20/);
});

for (const grade of [1, 2, 3, 4, 5, 6, 7, 8, 9]) {
  for (const count of [5, 10, 15]) {
    test(`grade ${grade}: mapped questions use the model's ${count} choices, not sheet selection`, async () => {
      const row = sheet(grade);
      const labels = row.questions.slice(-count).map((label) => `b:${label}`);
      const { body } = await response(row, count, labels);
      assert.equal(body.source, 'classifier');
      assert.deepEqual(body.exerciseIds, ids(labels));
      assert.deepEqual(body.modelExerciseIds, ids(labels));
      assert.deepEqual(body.sheetIds, []);
    });
  }
}

test('the whole candidate pool, including questions after 90 and 120, reaches the model', async () => {
  const row = sheet(7, 150);
  const input = payload(row, 5);
  input.teacher.candidates.push({ id: 'b:999', label: '999', text: 'not a source question' });
  const labels = ['b:146', 'b:147', 'b:148', 'b:149', 'b:150'];
  const { body, sent } = await response(row, 5, labels, input);
  for (const label of row.questions) assert.ok(sent.messages[1].content.includes(`b:${label} (`), label);
  assert.equal(sent.messages[1].content.includes('b:999'), false, 'Do not send client-invented identifiers');
  assert.deepEqual(body.exerciseIds, ids(labels));
  assert.equal(body.source, 'classifier');
});

test('partial model choices are retained and local completion is explicitly identified', async () => {
  const { body } = await response(sheet(), 5, ['b:19', 'b:20', 'b:999']);
  assert.equal(body.source, 'mixed');
  assert.equal(body.code, 'MODEL_SELECTION_PARTIAL');
  assert.equal(body.model, 'qwen3.8-flash');
  assert.deepEqual(body.modelExerciseIds, ids(['b:19', 'b:20']));
  assert.equal(body.exerciseIds.length, 5);
  for (const id of body.modelExerciseIds) assert.ok(body.exerciseIds.includes(id));
  assert.match(body.answer, /הושלמה מקומית/);
});

test('an empty or wholly invalid model selection never masquerades as AI selection', async () => {
  for (const labels of [[], ['b:999'], ['invalid']]) {
    const { body } = await response(sheet(), 5, labels);
    assert.equal(body.source, 'fallback');
    assert.equal(body.model, null);
    assert.equal(body.code, 'MODEL_SELECTION_INVALID');
    assert.deepEqual(body.modelExerciseIds, []);
    assert.equal(body.exerciseIds.length, 5);
    assert.match(body.answer, /לא התקבלה מהמודל בחירה תקינה/);
  }
});

test('server completion uses whole-question candidates, not different sections of a question', async () => {
  const row = sheet();
  row.questions = Array.from({ length: 8 }, (_, q) => ['א', 'ב', 'ג'].map((part) => `${q + 1}${part}`)).flat();
  const input = payload(row, 5);
  input.teacher.candidates = input.teacher.candidates.filter((candidate) => candidate.id.endsWith('א'));
  const { body } = await response(row, 5, [], input);
  assert.equal(body.source, 'fallback');
  assert.equal(body.exerciseIds.length, 5);
  assert.ok(body.exerciseIds.every((id: string) => id.endsWith('א')));
  assert.equal(new Set(body.exerciseIds.map((id: string) => parseInt(id.split(':').pop()!, 10))).size, 5);
});

test('available counts below 15 and duplicate source identifiers cannot inflate selection', async () => {
  const row = sheet(2, 8);
  row.questions.push('8', '8');
  const input = payload(row, 15);
  const labels = Array.from({ length: 8 }, (_, i) => `b:${i + 1}`);
  const { body } = await response(row, 15, labels, input);
  assert.equal(body.source, 'classifier');
  assert.equal(body.exerciseIds.length, 8);
  assert.equal(new Set(body.exerciseIds).size, 8);
  const exact = await response(sheet(2, 8), 8, labels);
  assert.equal(exact.body.exerciseIds.length, 8, 'The frontend may submit the available target, not just a button count');
});

test('an open-ended teacher chat does not dump the entire catalog into the classifier prompt', () => {
  const request = classifierRequestBody({ message: 'עזור לי לבחור נושא', page: { kind: 'teachers' } }, [sheet()]);
  assert.equal(request.messages[1].content.includes('b:20'), false);
});

test('ambiguous or repeated unscoped model labels cannot choose a different level implicitly', () => {
  const rows = [
    { ...sheet(), pdfId: 'a'.repeat(32), level: 'a' },
    sheet(),
  ];
  const input = payload(sheet(), 5);
  input.teacher.level = 'all';
  input.teacher.candidates = rows.flatMap((row) => row.questions.map((label) => ({
    id: `${row.level}:${label}`, label, text: `שאלה ${label}`,
  })));
  const ambiguous = selectTeacherPicks(rows, input, parseClassifier(JSON.stringify({
    exerciseLabels: ['16', '16', '17', '18', '19'],
  })));
  assert.equal(ambiguous.selectionSource, 'fallback');
  assert.deepEqual(ambiguous.modelExerciseIds, []);
  const partial = selectTeacherPicks(rows, input, parseClassifier(JSON.stringify({
    exerciseLabels: ['b:20', '16', '16', '17', '18'],
  })));
  assert.equal(partial.selectionSource, 'fallback');
  assert.equal(partial.selectionError, 'MODEL_SELECTION_INVALID');
  assert.deepEqual(partial.modelExerciseIds, []);
  assert.deepEqual(partial.exerciseIds, [], 'A partial all-level result must not be completed locally');
  const unique = selectTeacherPicks([sheet()], payload(sheet(), 5), parseClassifier(JSON.stringify({
    exerciseLabels: ['16', '17', '18', '19', '20'],
  })));
  assert.equal(unique.selectionSource, 'classifier');
  assert.deepEqual(unique.modelExerciseIds, ids(['16', '17', '18', '19', '20']));
});

test('every mapped source label in the active catalog can survive model selection parsing', () => {
  const index = JSON.parse(readFileSync(new URL('../src/data/teacher-pick-index.json', import.meta.url), 'utf8'));
  let checked = 0;
  for (const row of index) {
    for (const label of row.questions || []) {
      assert.equal(normalizeLabel(label), label, `${row.grade}/${row.topicId}/${row.level}: ${label}`);
      checked += 1;
    }
  }
  assert.ok(checked > 30_000);
});

test('every actual grade/topic/level preserves model choices for 5, 10 and 15 whole questions', (t) => {
  const index = JSON.parse(readFileSync(new URL('../src/data/teacher-pick-index.json', import.meta.url), 'utf8'));
  assert.equal(index.length, 964);
  assert.ok(index.every((row: any) => row.mode === 'exercise' && row.questions.length));
  const scopes = new Map<string, any[]>();
  for (const row of index) {
    for (const level of new Set(['all', row.level, ...(row.level === 'c2' ? ['c'] : [])])) {
      const key = [row.grade, row.topicId, level].join(':');
      if (!scopes.has(key)) scopes.set(key, []);
      scopes.get(key)!.push(row);
    }
  }
  let cases = 0;
  for (const [scope, rows] of scopes) {
    const [grade, topic, level] = scope.split(':');
    const candidates = rows.flatMap((row: any) => {
      const seen = new Set<number>();
      return row.questions.filter((label: string) => {
        const q = parseInt(label, 10);
        if (seen.has(q)) return false;
        seen.add(q); return true;
      }).map((label: string) => ({
        id: /^(?:[abc]|c2)$/.test(row.level) ? `${row.level}:${label}` : label,
        label, text: `שאלה ${parseInt(label, 10)}`, key: `ex:${row.pdfId}:${label}`,
      }));
    });
    for (const requested of [5, 10, 15]) {
      const count = Math.min(requested, candidates.length);
      const representatives = level === 'all' ? ['a', 'b', 'c'].map(family => candidates.find((candidate: any) => candidate.id.split(':')[0].replace('c2', 'c') === family)).filter(Boolean) : [];
      const expected = [...representatives, ...candidates.slice().reverse().filter((candidate: any) => !representatives.includes(candidate))].slice(0, count);
      const input = {
        message: `בחר ${requested} שאלות שלמות עם AI`, page: { kind: 'teachers' },
        teacher: { grade, topic, level, count, candidates, goal: 'first', style: 'scaffold' },
      };
      const parsed = parseClassifier(JSON.stringify({ grade: Number(grade), level: level === 'all' ? 'a' : level, exerciseLabels: expected.map((c: any) => c.id) }));
      const picked = selectTeacherPicks(index, input, parsed);
      assert.equal(picked.selectionSource, 'classifier', scope);
      assert.deepEqual(new Set(picked.exerciseIds), new Set(expected.map((c: any) => c.key)), `${scope}:${requested}`);
      assert.equal(picked.exerciseIds.length, count);
      assert.equal(picked.modelExerciseIds.length, count);
      const prompt = classifierRequestBody(input, index).messages[1].content;
      for (const candidate of candidates) assert.ok(prompt.includes(candidate.id + ' ('), `${scope}: omitted ${candidate.id}`);
      cases += 1;
    }
  }
  t.diagnostic(`Validated ${cases} model-response selections across ${scopes.size} actual grade/topic/level scopes; model responses were simulated.`);
});
