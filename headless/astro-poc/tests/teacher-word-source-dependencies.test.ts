import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { collectRequiredQuestions } from '../scripts/build-teacher-word-bank.mjs';
import { selectWordQuestions } from '../src/lib/teacherWordSelection';
import { createTeacherDocx } from '../../../demos/teacher-word-export.js';

const pdfId = 'a'.repeat(32), sha = 'b'.repeat(64);
const question = (q: number) => ({ id: `${pdfId}:${q}`, q, topic: 'חיבור', text: 'חשבו:',
  items: [{ label: '', text: '$4 + 3$', answer: '$7$' }] });

test('explicit source dependencies survive without textual references and combine with legacy references without duplication', () => {
  const questions = { 1: question(1), 2: question(2), 3: question(3) };
  const source = { ...questions[3], requiredQuestions: [1, 1], text: 'השתמשו בשאלה 2.',
    items: [{ label: '', text: 'הסבירו בעזרת שאלה 1.', answer: 'שבע' }] };
  assert.deepEqual(collectRequiredQuestions(source, questions), [1, 2]);
  assert.deepEqual(source.requiredQuestions, [1, 1], 'validation must not mutate author data');
  assert.deepEqual(collectRequiredQuestions({ ...questions[3], requiredQuestions: [1] }, questions), [1]);
  assert.deepEqual(collectRequiredQuestions({ ...questions[3], text: 'היעזרו בשאלה 2.' }, questions), [2]);
  assert.deepEqual(collectRequiredQuestions(questions[3], questions), []);
});

test('malformed, self-referential and unavailable explicit prerequisites fail instead of being silently discarded', () => {
  const questions = { 1: question(1), 3: question(3) };
  for (const requiredQuestions of [null, '1', [0], [-1], [1.5], ['1'], [1000]]) {
    assert.throws(() => collectRequiredQuestions({ ...questions[3], requiredQuestions }, questions), /requiredQuestions|invalid required question/);
  }
  assert.throws(() => collectRequiredQuestions({ ...questions[3], requiredQuestions: [3] }, questions), /self dependency/);
  assert.throws(() => collectRequiredQuestions({ ...questions[3], requiredQuestions: [2] }, questions), /missing required question 2/);
});

test('structured dependency reaches strict selection and Word export; a different PDF cannot satisfy it', async () => {
  const questions: Record<number, any> = { 1: question(1), 3: { ...question(3), requiredQuestions: [1] } };
  questions[3].requiredQuestions = collectRequiredQuestions(questions[3], questions);
  const otherPdfId = 'c'.repeat(32);
  const bank = { sheets: {
    [pdfId]: { sourceSha256: sha, questions },
    [otherPdfId]: { sourceSha256: sha, questions: { 1: { ...question(1), id: `${otherPdfId}:1` } } },
  } };
  const select = (q: number, id = pdfId) => ({ pdfId: id, q, sourceSha256: sha });
  const incomplete = selectWordQuestions(bank, [select(3), select(1, otherPdfId)]);
  assert.deepEqual(incomplete.questions, []);
  assert.equal(incomplete.required[0].pdfId, pdfId);
  assert.equal(incomplete.required[0].q, 1);
  await assert.rejects(createTeacherDocx({ questions: [questions[3]] }), /WORD_CONTEXT_REQUIRED/);
  const complete = selectWordQuestions(bank, [select(1), select(3)]);
  assert.equal(complete.questions.length, 2);
  assert.deepEqual(complete.required, []);
  assert.ok((await createTeacherDocx({ questions: complete.questions })).length > 0);
  const stale = selectWordQuestions(bank, [{ ...select(1), sourceSha256: '0'.repeat(64) }, select(3)]);
  assert.deepEqual(stale.questions, []);
  assert.equal(stale.missing.length, 1);
});

test('all existing checked Word bank dependencies remain unchanged', () => {
  const bundle = JSON.parse(readFileSync(new URL('../src/data/teacher-word-content.json', import.meta.url), 'utf8'));
  const bank = JSON.parse(gunzipSync(Buffer.from(bundle.gzipBase64, 'base64')).toString());
  let count = 0;
  for (const sheet of Object.values(bank.sheets) as any[]) for (const question of Object.values(sheet.questions) as any[]) {
    assert.deepEqual(collectRequiredQuestions(question, sheet.questions), question.requiredQuestions || [], question.id);
    count++;
  }
  assert.equal(count, bundle.questions);
});
