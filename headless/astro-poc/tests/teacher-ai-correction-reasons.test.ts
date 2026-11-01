import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { handleNoamSiteCompanion } from '../../../noam-ai/site-companion/endpoint.js';
import { logTeacherSelection, parseClassifier, teacherCorrectionRequestBody, validateExactTeacherPrimary } from '../../../noam-ai/site-companion/teacher-pick.js';

const index = JSON.parse(readFileSync(new URL('../src/data/teacher-pick-index.json', import.meta.url), 'utf8'));
type Candidate = { id: string; label: string; family: string; key: string };
function fixture(grade = 6, topic = '12', count = 5) {
  const rows = index.filter((row: any) => row.grade === grade && row.topicId === topic);
  const candidates: Candidate[] = rows.flatMap((row: any) => {
    const seen = new Set<number>();
    return row.questions.filter((label: string) => {
      const q = parseInt(label, 10); if (seen.has(q)) return false; seen.add(q); return true;
    }).map((label: string) => ({ id: `${row.level}:${label}`, label,
      family: row.level === 'c2' ? 'c' : row.level, key: `ex:${row.pdfId}:${label}` }));
  });
  const chosen = ['a', 'b', 'c'].map(family => {
    const matching = candidates.filter(item => item.family === family);
    return matching.find(item => item.id.startsWith('c2:')) || matching[0];
  });
  for (const item of candidates.slice().reverse()) if (chosen.length < count && !chosen.includes(item)) chosen.push(item);
  const labels = chosen.map(item => item.id);
  const input = { message: `בחר ${count} שאלות שלמות`, page: { kind: 'teachers', path: '/teachers', title: 'למורים' },
    teacher: { grade: String(grade), topic, level: 'all', count, planCounts: [5, 10, 15], candidates,
      goal: 'first', style: 'scaffold', note: 'PRIVATE_NOTE_SENTINEL' },
    botVerification: { provider: 'recaptcha-v3', token: 'PRIVATE_SYNTHETIC_TOKEN_SENTINEL' } };
  return { rows, candidates, labels, input };
}
type Defect = { name: string; reason: string; mutate: (labels: string[]) => unknown; count: number; invalid: number };
const defects: Defect[] = [
  { name: 'missing array', reason: 'malformed-labels', mutate: () => undefined, count: 0, invalid: 1 },
  { name: 'nested array', reason: 'malformed-labels', mutate: l => [[l[0]], ...l.slice(1)], count: 5, invalid: 1 },
  { name: 'malformed string', reason: 'malformed-labels', mutate: l => ['PRIVATE_BAD_LABEL_SENTINEL', ...l.slice(1)], count: 5, invalid: 1 },
  { name: 'one too few', reason: 'wrong-count', mutate: l => l.slice(0, 4), count: 4, invalid: 1 },
  { name: 'one too many', reason: 'wrong-count', mutate: l => [...l, l[0]], count: 6, invalid: 1 },
  { name: 'unknown identifier', reason: 'unknown-id', mutate: l => [...l.slice(0, 4), 'c:999'], count: 5, invalid: 1 },
  { name: 'ambiguous unscoped identifier', reason: 'ambiguous-id', mutate: l => [l[0].split(':')[1], ...l.slice(1)], count: 5, invalid: 1 },
  { name: 'duplicate whole question', reason: 'duplicate-question', mutate: l => [...l.slice(0, 4), l[3]], count: 5, invalid: 1 },
];

for (const defect of defects) test(`real G6/T12 ${defect.name} has a precise safe reason and original counts`, () => {
  const f = fixture(), classified = parseClassifier(JSON.stringify({ exerciseLabels: defect.mutate(f.labels) }));
  const validation = validateExactTeacherPrimary(index, f.input, classified);
  assert.equal(validation.pick, null); assert.equal(validation.selectionError, 'MODEL_SELECTION_INVALID');
  assert.deepEqual(validation.diagnostic, { reason: defect.reason, primaryCount: defect.count,
    expectedCount: 5, candidateCount: 60, invalidCount: defect.invalid });
  assert.doesNotMatch(JSON.stringify(validation.diagnostic), /PRIVATE_|exerciseLabels|a:|b:|c:/);
});

test('overlong primary arrays retain their real count before parser truncation', () => {
  const f = fixture(), labels = Array.from({ length: 61 }, () => f.labels[0]);
  const classified = parseClassifier(JSON.stringify({ exerciseLabels: labels }));
  assert.ok(classified); assert.equal(classified.scopedExerciseLabels.length, 60);
  const validation = validateExactTeacherPrimary(index, f.input, classified);
  assert.equal(validation.diagnostic.reason, 'wrong-count');
  assert.equal(validation.diagnostic.primaryCount, 61); assert.equal(validation.diagnostic.invalidCount, 56);
});

test('two different parts of one G8 source question are a duplicate whole question', () => {
  const f = fixture(8, '43');
  f.input.teacher.candidates.push({ ...f.candidates[0], id: 'a:1ב', label: '1ב', key: f.candidates[0].key.replace(/1א$/, '1ב') });
  const validation = validateExactTeacherPrimary(index, f.input, parseClassifier(JSON.stringify({
    exerciseLabels: [f.labels[0], f.labels[1], f.labels[2], 'a:1ב', f.labels[4]],
  })));
  assert.equal(validation.pick, null); assert.equal(validation.diagnostic.reason, 'duplicate-question');
  assert.equal(validation.diagnostic.invalidCount, 1); assert.equal(validation.diagnostic.candidateCount, 80);
});

test('precise reasons preserve missing-family rejection and valid c2 family representation', () => {
  const f = fixture(8, '43');
  const aOnly = f.candidates.filter(c => c.family === 'a').slice(0, 5).map(c => c.id);
  const rejected = validateExactTeacherPrimary(index, f.input, parseClassifier(JSON.stringify({ exerciseLabels: aOnly })));
  assert.equal(rejected.selectionError, 'MODEL_LEVEL_COVERAGE_MISSING');
  assert.equal(rejected.diagnostic.reason, 'level-coverage'); assert.equal(rejected.diagnostic.invalidCount, 2);
  const accepted = validateExactTeacherPrimary(index, f.input, parseClassifier(JSON.stringify({ exerciseLabels: f.labels })));
  assert.ok(accepted.pick); assert.ok(f.labels.some(label => label.startsWith('c2:')));
  assert.equal(accepted.selectionError, null); assert.equal(accepted.diagnostic.invalidCount, 0);
});

const feedback: Record<string, string> = {
  'malformed-labels': 'מערך של מחרוזות מזהה בלבד',
  'wrong-count': 'מספר המזהים בבחירה הקודמת לא התאים',
  'unknown-id': 'מזהה שאינו ברשימת המועמדים המותרת',
  'ambiguous-id': 'מזהה שמתאים ליותר ממקור אחד',
  'duplicate-question': 'אותה שאלה שלמה יותר מפעם אחת',
  'level-coverage': 'לא ייצגה את כל משפחות הרמה',
};

async function request(defect: Defect, correctSecond = true, count = 5) {
  const f = fixture(6, '12', count);
  const calls: string[] = [], requests: any[] = [], logs: any[] = [];
  const first = { exerciseLabels: defect.mutate(f.labels), privateOutput: 'PRIVATE_MODEL_OUTPUT_SENTINEL' };
  const result = await handleNoamSiteCompanion({ method: 'POST', url: 'https://www.noamdoronmath.co.il/api/noamSiteCompanion' }, {
    payload: f.input, origin: 'https://www.noamdoronmath.co.il', clientIp: '203.0.113.91', store: new Map(), now: 5000,
    teacherIndex: index, catalog: { grades: [] }, qwenKey: 'PRIVATE_SYNTHETIC_KEY_SENTINEL', recaptchaSecret: 'PRIVATE_SYNTHETIC_SECRET_SENTINEL',
    log: (entry: unknown) => logs.push(entry),
    rateBackend: { async take() { calls.push('rate'); return true; } },
    fetch: async (url: string, init: { body: string }) => {
      if (url === 'https://www.google.com/recaptcha/api/siteverify') {
        calls.push('verify'); return { ok: true, json: async () => ({ success: true, score: 0.9, hostname: 'www.noamdoronmath.co.il', action: 'noam_site_companion' }) };
      }
      calls.push('model'); requests.push(JSON.parse(init.body));
      assert.ok(requests.length <= 2, 'No third model attempt');
      const model = requests.length === 1 || !correctSecond ? first : { exerciseLabels: f.labels };
      return { ok: true, json: async () => ({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(model) } }] }) };
    },
  });
  return { ...f, result, body: result.body as any, calls, requests, logs };
}

for (const defect of defects) test(`existing single correction receives the precise ${defect.reason} feedback for ${defect.name}`, async () => {
  const run = await request(defect);
  assert.equal(run.result.status, 200); assert.deepEqual(run.calls, ['rate', 'verify', 'model', 'model']);
  assert.equal(run.body.source, 'classifier');
  assert.deepEqual(run.body.modelExerciseIds, run.labels.map(label => run.candidates.find(c => c.id === label)!.key));
  const second = run.requests[1].messages[1].content;
  assert.ok(second.includes(feedback[defect.reason]));
  const grouped = JSON.parse(second.split('\nמזהי שאלות מותרים לפי מקור: ')[1]);
  assert.deepEqual(new Set(Object.values(grouped).flat()), new Set(run.candidates.map(c => c.id)));
  assert.deepEqual(Object.keys(grouped), ['a', 'b', 'c']);
  assert.doesNotMatch(second, /PRIVATE_MODEL_OUTPUT_SENTINEL|PRIVATE_BAD_LABEL_SENTINEL|PRIVATE_SYNTHETIC_/);
  const attempted = run.logs.find(entry => entry.code === 'MODEL_CORRECTION_ATTEMPTED');
  assert.ok(attempted); assert.equal(attempted.reason, defect.reason); assert.equal(attempted.primaryCount, defect.count);
  assert.equal(attempted.expectedCount, 5); assert.equal(attempted.candidateCount, 60); assert.equal(attempted.invalidCount, defect.invalid);
  assert.doesNotMatch(JSON.stringify(run.logs), /PRIVATE_|exerciseLabels|exerciseIds|Bearer/);
});

for (const count of [10, 15]) test(`G6/T12 precise count feedback still accepts only a complete model correction of ${count}`, async () => {
  const defect: Defect = { name: 'one too few', reason: 'wrong-count', mutate: labels => labels.slice(0, -1), count: count - 1, invalid: 1 };
  const run = await request(defect, true, count);
  assert.deepEqual(run.calls, ['rate', 'verify', 'model', 'model']);
  assert.equal(run.body.source, 'classifier'); assert.equal(run.body.exerciseIds.length, count);
  assert.deepEqual(run.body.modelExerciseIds, run.labels.map(label => run.candidates.find(c => c.id === label)!.key));
  assert.ok(run.requests[1].messages[1].content.includes(feedback['wrong-count']));
  const attempted = run.logs.find(entry => entry.code === 'MODEL_CORRECTION_ATTEMPTED');
  assert.equal(attempted.primaryCount, count - 1); assert.equal(attempted.expectedCount, count);
  assert.equal(attempted.invalidCount, 1); assert.equal(attempted.candidateCount, 60);
  assert.ok(run.requests[1].max_tokens <= 600);
});

test('an explicitly invalid classifier cannot be accepted through inconsistent internal count metadata', () => {
  const f = fixture(), classified = parseClassifier(JSON.stringify({ exerciseLabels: f.labels }));
  assert.ok(classified);
  const validation = validateExactTeacherPrimary(index, f.input, { ...classified, primaryLabelsValid: false });
  assert.equal(validation.pick, null); assert.equal(validation.diagnostic.reason, 'malformed-labels');
});

test('a repeated invalid result remains rejected after exactly one correction and logs the second reason', async () => {
  const run = await request(defects.find(d => d.reason === 'unknown-id')!, false);
  assert.deepEqual(run.calls, ['rate', 'verify', 'model', 'model']);
  assert.equal(run.body.source, 'fallback'); assert.equal(run.body.model, null);
  assert.equal(run.body.code, 'MODEL_SELECTION_INVALID'); assert.equal(run.body.selectionError, run.body.code);
  assert.deepEqual(run.body.exerciseIds, []); assert.deepEqual(run.body.modelExerciseIds, []);
  const rejected = run.logs.find(entry => entry.code === 'MODEL_CORRECTION_REJECTED');
  assert.equal(rejected.reason, 'unknown-id'); assert.equal(rejected.invalidCount, 1);
  assert.equal(run.body.diagnostic, undefined);
});

test('grouped corrective labels contain only server-validated candidates and preserve c2 exactly', () => {
  const f = fixture(8, '43'), excluded = f.candidates[0].id;
  f.input.teacher.candidates = f.input.teacher.candidates.slice(1);
  f.input.teacher.candidates.push({ id: 'a:999', label: '999', family: 'a', key: 'PRIVATE_INVENTED_KEY' });
  const body = teacherCorrectionRequestBody(f.input, index, 'unknown-id');
  const grouped = JSON.parse(body.messages[1].content.split('\nמזהי שאלות מותרים לפי מקור: ')[1]);
  const labels = Object.values(grouped).flat();
  assert.ok(!labels.includes(excluded)); assert.ok(!labels.includes('a:999'));
  assert.equal(labels.length, 79); assert.ok(Array.isArray(grouped.c2));
  assert.ok(grouped.c2.every((id: string) => id.startsWith('c2:')));
});

test('diagnostic sanitizer bounds new counts and drops private or invalid fields and reasons', () => {
  const logs: any[] = [];
  logTeacherSelection({ log: (entry: unknown) => logs.push(entry) }, { code: 'MODEL_CORRECTION_REJECTED', reason: 'unknown-id',
    primaryCount: 1000, expectedCount: 1000, candidateCount: 999999, invalidCount: 999999,
    rawLabels: ['PRIVATE_MODEL_LABEL'], note: 'PRIVATE_NOTE', providerBody: 'PRIVATE_RESPONSE' });
  assert.deepEqual(logs[0], { event: 'noam-teacher-selection', code: 'MODEL_CORRECTION_REJECTED', reason: 'unknown-id',
    primaryCount: 60, expectedCount: 60, candidateCount: 10000, invalidCount: 60 });
  logTeacherSelection({ log: (entry: unknown) => logs.push(entry) }, { code: 'MODEL_CORRECTION_REJECTED', reason: 'PRIVATE_REASON' });
  assert.equal(logs.length, 1); assert.doesNotMatch(JSON.stringify(logs), /PRIVATE_/);
  const f = fixture(), prompt = teacherCorrectionRequestBody(f.input, index, 'PRIVATE_REASON');
  assert.doesNotMatch(JSON.stringify(prompt.messages), /PRIVATE_REASON/);
});
