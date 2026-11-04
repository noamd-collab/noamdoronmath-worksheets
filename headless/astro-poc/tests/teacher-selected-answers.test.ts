import assert from 'node:assert/strict';
import { createHash, webcrypto } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { applyTeacherAnswerMaps, validateAnswerAssets, validateAnswerMap } from '../scripts/apply-teacher-answer-maps.mjs';

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
  ${['levelPrintName', 'answerDocumentSource', 'selectedAnswerCrops', 'answerMeasured', 'contentHeight', 'gapSize', 'fittedHeight', 'fittedScale', 'sheetContentLimit', 'packShort'].map(definition).join('\n')}
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
const supplement = (digest = 'c'.repeat(64)) => ({ url: `/teachers/answers/${digest}.pdf`, sha256: digest, pageCount: 2, answerStartPage: 1 });
function supplementalSource() {
  const s: any = source();
  s.answerMap.questions[0].answerDocument = supplement();
  s.answerMap.questions[0].crops = [rectangle(1, 0.15, 0.13)];
  return s;
}

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

test('mixes original and supplementary answers while keeping whole-question identity and deduplication', async () => {
  const s = supplementalSource();
  const b = { ...supplementalSource(), pdfId: 'level-b', level: 'b' };
  const slices = await api.answerMeasured([group(s, [1, 2]), group(s, [1]), group(b, [1])]);
  const answers = slices.filter((slice: any) => slice.kind === 'answer');
  assert.deepEqual(answers.map((slice: any) => slice.answerKey), ['level-a:1', 'level-a:2', 'level-b:1']);
  assert.equal(answers[0].pdfId, 'level-a', 'Question identity remains the original source');
  assert.equal(answers[0].source.pdfId, 'answer:' + 'c'.repeat(64));
  assert.equal(answers[0].source.pdfUrl, supplement().url);
  assert.equal(answers[0].page, 1, 'Supplement can start before original answer appendix');
  assert.equal(answers[1].page, 4);
  assert.equal(answers[1].source, undefined, 'Unchanged answers keep original PDF rendering');
  assert.deepEqual(api.selectedAnswerCrops({ source: s, questions: [s.questions[0]] }), api.selectedAnswerCrops(group(s, [1])));
  assert.doesNotThrow(() => validateAnswerMap(s, s.answerMap));
});

test('overlap is forbidden within one document and allowed across different answer documents', () => {
  const s = supplementalSource();
  s.answerMap.questions[1].answerDocument = supplement('d'.repeat(64));
  s.answerMap.questions[1].crops = structuredClone(s.answerMap.questions[0].crops);
  assert.doesNotThrow(() => validateAnswerMap(s, s.answerMap));
  assert.equal(api.selectedAnswerCrops(group(s, [1, 2])).length, 2);
  s.answerMap.questions[1].answerDocument = supplement();
  assert.throws(() => validateAnswerMap(s, s.answerMap), /overlaps/);
  assert.throws(() => api.selectedAnswerCrops(group(s)), { code: 'MISSING_ANSWERS' });
});

test('supplementary URL, digest, page limits, and complete parts fail closed', async () => {
  for (const mutate of [
    (s: any) => { s.answerMap.questions[0].answerDocument = null; },
    (s: any) => { s.answerMap.questions[0].answerDocument.url = 'https://example.com/answer.pdf'; },
    (s: any) => { s.answerMap.questions[0].answerDocument.url = '/teachers/answers/../answer.pdf'; },
    (s: any) => { s.answerMap.questions[0].answerDocument.url += '?download=1'; },
    (s: any) => { s.answerMap.questions[0].answerDocument.sha256 = 'd'.repeat(64); },
    (s: any) => { s.answerMap.questions[0].answerDocument.pageCount = 0; },
    (s: any) => { s.answerMap.questions[0].answerDocument.pageCount = 1.5; },
    (s: any) => { s.answerMap.questions[0].answerDocument.answerStartPage = 3; },
    (s: any) => { s.answerMap.questions[0].crops[0].page = 3; },
    (s: any) => { s.answerMap.questions[0].parts = ['א']; },
  ]) {
    const s = supplementalSource(); mutate(s);
    assert.throws(() => validateAnswerMap(s, s.answerMap));
    await assert.rejects(api.answerMeasured([group(s)]), { code: 'MISSING_ANSWERS' });
  }
});

test('measurement actually uses the supplementary PDF instead of resolving the original pdfId', async () => {
  const calls: any[] = [];
  const measure = new Function('pageBitmap', `
    const SOURCE = { pdfId: 'fallback' }, sheets = new Map([['level-a', { pdfId: 'original' }]]);
    ${definition('measureSlices')}
    return measureSlices;
  `)(async (page: number, source: any) => { calls.push({ page, source }); return { width: 1000, height: 1400 }; });
  const slices = await api.answerMeasured([group(supplementalSource(), [1, 2])]);
  await measure(slices);
  assert.deepEqual(calls.map(call => [call.page, call.source.pdfId]), [[1, 'answer:' + 'c'.repeat(64)], [4, 'original']]);
});

test('build asset validation requires existing bytes matching the content-addressed PDF URL', () => {
  const publicDir = mkdtempSync(join(tmpdir(), 'teacher-answer-assets-'));
  try {
    mkdirSync(join(publicDir, 'teachers/answers'), { recursive: true });
    const bytes = Buffer.from('%PDF-1.4\npublic final answers fixture\n');
    const digest = createHash('sha256').update(bytes).digest('hex');
    const s = supplementalSource();
    s.answerMap.questions[0].answerDocument = supplement(digest);
    assert.throws(() => validateAnswerAssets(s.answerMap, { publicDir }), /ENOENT/);
    writeFileSync(join(publicDir, 'teachers/answers', digest + '.pdf'), bytes);
    assert.doesNotThrow(() => validateAnswerAssets(s.answerMap, { publicDir }));
    writeFileSync(join(publicDir, 'teachers/answers', digest + '.pdf'), Buffer.from('%PDF-1.4\nwrong content'));
    assert.throws(() => validateAnswerAssets(s.answerMap, { publicDir }), /digest mismatch/);
  } finally { rmSync(publicDir, { recursive: true, force: true }); }
});

test('runtime verifies supplementary bytes and page count, and cache identity includes URL and digest', async () => {
  const bytes = Buffer.from('%PDF-1.4\npublic answer fixture');
  const digest = createHash('sha256').update(bytes).digest('hex');
  let fetched = 0;
  let parsed = 0;
  const makeLoader = (data: Buffer, numPages = 2) => new Function('fetch', 'crypto', 'window', `
    const SOURCE = null, PDFJS_WORKER = 'worker', pdfDocs = new Map();
    ${definition('pdfCacheKey')}
    ${definition('loadPdf')}
    return { loadPdf, pdfCacheKey };
  `)(async () => { fetched++; return { ok: true, arrayBuffer: async () => Uint8Array.from(data).buffer }; }, webcrypto,
    { pdfjsLib: { GlobalWorkerOptions: {}, getDocument: (input: any) => { parsed++; assert.ok(input.data); return { promise: Promise.resolve({ numPages }) }; } } });
  const src = { pdfId: 'answer:' + digest, pdfUrl: supplement(digest).url, expectedSha256: digest, pageCount: 2 };
  const loader = makeLoader(bytes);
  await Promise.all([loader.loadPdf(src), loader.loadPdf(src)]);
  assert.equal(fetched, 1); assert.equal(parsed, 1);
  assert.notEqual(loader.pdfCacheKey(src), loader.pdfCacheKey({ ...src, pdfUrl: '/different.pdf' }));
  assert.notEqual(loader.pdfCacheKey(src), loader.pdfCacheKey({ ...src, expectedSha256: sha }));
  assert.notEqual(loader.pdfCacheKey(src), loader.pdfCacheKey({ ...src, pageCount: 1 }));
  await assert.rejects(makeLoader(Buffer.from('wrong')).loadPdf(src), /ANSWER_DOCUMENT_DIGEST/);
  await assert.rejects(makeLoader(bytes, 1).loadPdf(src), /ANSWER_DOCUMENT_PAGES/);
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
