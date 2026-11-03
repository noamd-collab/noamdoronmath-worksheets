import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { applyTeacherAnswerMaps, validateAnswerMap } from '../scripts/apply-teacher-answer-maps.mjs';

const printer = readFileSync(new URL('../public/teachers/teacher-factoring-print.js', import.meta.url), 'utf8');
function definition(name: string) {
  const start = printer.search(new RegExp(`(?:^|\\n)(?:async )?function ${name}\\(`));
  assert.notEqual(start, -1, name);
  const tail = printer.slice(start + (printer[start] === '\n' ? 1 : 0));
  const end = tail.search(/\n(?:async )?function /);
  return end < 0 ? tail : tail.slice(0, end);
}
const api = new Function(`
  const measureSlices = async slices => slices;
  const SHEET_PAGE_H = 1440, SHEET_BASAD_H = 40, SHEET_TITLE_H = 86;
  ${['levelPrintName', 'selectedAnswerCrops', 'answerMeasured', 'contentHeight', 'gapSize', 'fittedHeight', 'fittedScale', 'sheetContentLimit', 'packShort'].map(definition).join('\n')}
  return { selectedAnswerCrops, answerMeasured, packShort, fittedScale, contentHeight };
`)();

const sha = 'a'.repeat(64);
const rectangle = (page: number, y: number, h: number, x = 0.05, w = 0.9) => ({ page, x, y, w, h });
function source() {
  return {
    pdfId: 'level-a', topic: 'נושא לדוגמה', level: 'a', pageCount: 6, answerStartPage: 4, sourceSha256: 'b'.repeat(64), answerSourceSha256: sha,
    questions: [1, 2, 3].flatMap(q => ['א', 'ב', 'ג'].map(part => ({ q, part, id: q + part }))),
    answerGeometry: 'full-pages',
    answerMap: { version: 1, sourceSha256: sha, questions: [
      { q: 1, parts: ['א', 'ב', 'ג'], crops: [rectangle(4, 0.15, 0.13)] },
      { q: 2, parts: ['א', 'ב', 'ג'], crops: [rectangle(4, 0.3, 0.12)] },
      { q: 3, parts: ['א', 'ב', 'ג'], crops: [rectangle(4, 0.44, 0.35), rectangle(5, 0.08, 0.17)] },
    ] },
  };
}
const group = (s = source(), qs = [1]) => ({ source: s, questions: s.questions.filter(item => qs.includes(item.q)) });

test('prints only selected whole answers, preserving every subpart and the source rectangle', async () => {
  const s = source();
  const slices = await api.answerMeasured([group(s, [1, 3])]);
  const answers = slices.filter((item: any) => item.kind === 'answer');
  assert.deepEqual(answers.map((item: any) => item.answerKey), ['level-a:1', 'level-a:3', 'level-a:3']);
  assert.deepEqual(answers.map((item: any) => item.page), [4, 4, 5]);
  assert.ok(answers.every((item: any) => !item.pieces), 'Numerators and denominators stay in their source rectangle');
  assert.equal(slices[0].block, answers[0].block, 'Heading belongs to the first answer block');
  assert.match(slices[0].label, /רק|שנבחרו/);
  assert.ok(!slices.some((item: any) => item.box?.h === 1), 'Never insert a whole source answer page');
  const partial = { source: s, questions: [s.questions[0]] };
  assert.deepEqual(api.selectedAnswerCrops(partial), api.selectedAnswerCrops(group(s, [1])), 'Legacy selected parts still get the complete answer to their question');
});

test('deduplicates repeated questions across sections while retaining equal numbers in different levels', async () => {
  const a = source();
  const b = { ...source(), pdfId: 'level-b', level: 'b' };
  const slices = await api.answerMeasured([group(a, [2]), group(b, [2]), group(a, [1, 2])]);
  assert.deepEqual(slices.filter((item: any) => item.kind === 'answer').map((item: any) => item.answerKey), ['level-a:2', 'level-a:1', 'level-b:2']);
  assert.equal(slices.filter((item: any) => item.kind === 'answer-heading').length, 2);
});

test('unreliable text overlays and full-page metadata cannot substitute for a missing verified map', async () => {
  for (const mutate of [
    (s: any) => { delete s.answerMap; },
    (s: any) => { s.answerMap.sourceSha256 = 'b'.repeat(64); },
    (s: any) => { s.answerMap.questions = s.answerMap.questions.filter((q: any) => q.q !== 1); },
    (s: any) => { s.answerMap.questions[0].parts = ['א', 'ב']; },
    (s: any) => { s.answerMap.questions[0].crops = []; },
    (s: any) => { s.answerMap.questions[0].crops[0].h = 1; },
    (s: any) => { s.answerMap.questions[0].crops[0].page = 3; },
    (s: any) => { s.answerMap.questions.push(s.answerMap.questions[0]); },
    (s: any) => { s.answerMap.questions[0].crops[0].h = 0.3; },
  ]) {
    const s = source(); mutate(s);
    await assert.rejects(api.answerMeasured([group(s)]), { code: 'MISSING_ANSWERS' });
  }
});

test('distinct answer columns can share a vertical band without including a neighbor', () => {
  const s = source();
  s.answerMap.questions[0].crops = [rectangle(4, 0.15, 0.13, 0.55, 0.4)];
  s.answerMap.questions[1].crops = [rectangle(4, 0.15, 0.13, 0.05, 0.4)];
  assert.equal(api.selectedAnswerCrops(group(s))[0].box.x, 0.55);
  assert.doesNotThrow(() => validateAnswerMap(s, s.answerMap));
});

test('answer columns on either side of half-width preserve the same readable source scale', async () => {
  const measure = new Function(`
    const SOURCE = {}, sheets = new Map();
    const pageBitmap = async () => ({ width: 2000, height: 2800 });
    ${definition('measureSlices')}
    return measureSlices;
  `)();
  const measured = await measure([0.49, 0.51, 0.9].map(w => ({
    kind: 'answer', pdfId: 'source', page: 4, box: { x: 0.01, y: 0.1, w, h: 0.1 },
  })));
  assert.deepEqual(measured.map((item: any) => item.dh), [140, 140, 140]);
});

test('answer headings stay attached and multi-page answers split only at verified crop boundaries', () => {
  const item = (block: string, dh: number, kind = 'answer') => ({ slice: { block, gap: 8, kind }, dh });
  const pages = api.packShort([item('old', 1320), item('new', 66, 'answer-heading'), item('new', 500)], { answers: true });
  assert.deepEqual(pages.map((page: any[]) => page.map(item => item.slice.kind)), [['answer'], ['answer-heading', 'answer']]);
  const long = api.packShort([item('long', 66, 'answer-heading'), item('long', 1200), item('long', 1200)], { answers: true });
  assert.equal(long.length, 2);
  assert.ok(long.every((page: any[]) => api.fittedScale(page, 1400) >= 0.85));
  assert.equal(long.flat().filter((entry: any) => entry.slice.kind === 'answer').length, 2);
});

test('every active source has validated answer geometry or an explicit original-content gap; selections never add other answers', async () => {
  const report = applyTeacherAnswerMaps({ check: true });
  assert.equal(report.sheets, 933);
  const catalog = JSON.parse(readFileSync(new URL('../public/teachers/teacher-catalog.json', import.meta.url), 'utf8'));
  const ids = [...new Set<string>(catalog.grades.flatMap((g: any) => g.topics.flatMap((t: any) => t.sheets.map((s: any) => s.pdfId))))];
  for (const pdfId of ids) {
    const s = JSON.parse(readFileSync(new URL(`../public/teachers/sheets/${pdfId}.json`, import.meta.url), 'utf8'));
    for (const answer of s.answerMap.questions) {
      if (answer.unavailableReason) {
        assert.throws(() => api.selectedAnswerCrops({ source: s, questions: [{ q: answer.q }] }), { code: 'MISSING_ANSWERS' });
        continue;
      }
      const crops = api.selectedAnswerCrops({ source: s, questions: s.questions.filter((q: any) => Number(q.q) === answer.q) });
      assert.equal(crops.length, answer.crops.length, `${pdfId}:${answer.q}: preserve continuations`);
      assert.ok(crops.every((crop: any) => crop.q === answer.q), `${pdfId}:${answer.q}: no other answers`);
    }
  }
});
