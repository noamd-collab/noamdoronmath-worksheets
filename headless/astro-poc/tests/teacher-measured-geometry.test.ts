import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { test } from 'node:test';
import { prepareMeasuredManifestDraft, validateMeasuredManifest } from '../scripts/lib/measured-worksheet.mjs';
import { sheetFromManifest } from '../scripts/build-teacher-catalog.mjs';
import { compileQuestionPreviews } from '../scripts/build-teacher-question-previews.mjs';

const printer = readFileSync(new URL('../../../demos/teacher-factoring-print.js', import.meta.url), 'utf8');
const hash = (b: Buffer) => createHash('sha256').update(b).digest('hex');
const clone = (v: any) => structuredClone(v);
const fixtures = ['a05-B', 'b28-E', 'synthetic-dependency', 'synthetic-split'];
function loadFixture(name: string) {
  const root = new URL('./fixtures/measured-v1/' + name + '/', import.meta.url);
  const identity = JSON.parse(readFileSync(new URL('fixture.json', root), 'utf8'));
  assert.equal(identity.testOnly, true);
  assert.equal(identity.publishable, false);
  for (const [file, digest] of Object.entries(identity.files)) assert.equal(hash(readFileSync(new URL(file, root))), digest, name + ':' + file);
  const draft = JSON.parse(readFileSync(new URL('draft.json', root), 'utf8'));
  assert.equal(hash(readFileSync(new URL('sheet.pdf', root))), draft.binding.pdfSha256);
  assert.equal(hash(readFileSync(new URL('worksheet-source.json', root))), draft.binding.canonicalSourceSha256);
  const pdfId = ['a', 'b', 'c', 'd'][fixtures.indexOf(name)].repeat(32);
  const manifest = prepareMeasuredManifestDraft(draft, readFileSync(new URL('layout.json', root)), {
    pdfId, url: `https://static.wixstatic.com/ugd/d8e7ad_${pdfId}.pdf`,
    downloadedSha256: draft.binding.pdfSha256, syntheticTestFixture: true,
  });
  const meta = { pdfId, grade: manifest.grade, topicId: manifest.topicId, level: manifest.level, title: name + ' — test fixture' };
  const sheet = sheetFromManifest(meta, manifest, undefined, { allowDraft: true });
  return { draft, manifest, sheet, root, meta };
}
function definition(name: string) {
  const start = printer.search(new RegExp(`(?:^|\n)(?:async )?function ${name}\\(`));
  assert.notEqual(start, -1, name);
  const tail = printer.slice(start + (printer[start] === '\n' ? 1 : 0));
  const end = tail.search(/\n(?:async )?function /);
  return end < 0 ? tail : tail.slice(0, end);
}
function api(source: any) {
  const names = ['measuredFragmentSlices', 'measuredPreviewSlices', 'measuredShortSlices', 'originalShortSlices',
    'questionPreviewGroup', 'originalQuestionPreviewSlices', 'selectedAnswerCrops', 'measuredAnswerCrops',
    'measuredSourceLabels', 'measuredSourceDescription', 'measuredQuestionHeading', 'levelPrintName', 'answerMeasured'];
  return new Function('SOURCE', 'const measureSlices=async slices=>slices;\n'+names.map(definition).join('\n') + '\nreturn { short:(...args)=>originalShortSlices(...args).filter(slice=>slice.fragmentRef), shortAll:originalShortSlices, sourceLabels:measuredSourceLabels, description:measuredSourceDescription, preview:originalQuestionPreviewSlices, fragments:measuredFragmentSlices, answers:selectedAnswerCrops, answerRows:answerMeasured };')(source);
}
function owned(sheet: any, parts: any[]) { return parts.map(part => ({ ...part, source: sheet })); }
function measuredPack(slices: any[], aspect = Math.SQRT2) {
  const pack = new Function(['contentHeight', 'gapSize', 'fittedHeight', 'fittedScale', 'sheetContentLimit', 'packShort'].map(definition).join('\n')
    + '\nconst SHEET_PAGE_H=1440, SHEET_BASAD_H=40, SHEET_TITLE_H=86; return packShort;')();
  return pack(slices.map(slice => ({slice,dh:slice.kind==='question-heading'?66:slice.box.h*aspect*1000})));
}

test('all measured fixtures are byte-bound and remain unapproved drafts', () => {
  for (const name of fixtures) {
    const { manifest, sheet, meta } = loadFixture(name);
    assert.equal(manifest.syntheticTestFixture, true);
    assert.equal(manifest.publishable, false);
    assert.equal(sheet.expectedSha256, manifest.sourceSha256);
    assert.throws(() => sheetFromManifest(meta, manifest), /DRAFT/);
    assert.equal(sheet.questions.length, name === 'synthetic-split' ? 6 : 40);
    assert.equal(new Set(sheet.questions.map((q: any) => q.id)).size, sheet.questions.length);
    for (const q of sheet.questions) {
      assert.deepEqual(q.rows, q.fragmentRefs.map((ref: string) => sheet.fragmentLedger[ref].crop));
      assert.equal(q.id, String(q.q) + q.part);
    }
  }
});

test('measured ingestion rejects missing context, stale SHA, altered crops, IDs, answers and figure owners', () => {
  const { manifest } = loadFixture('b28-E');
  const changes = [
    (m: any) => { m.measured.sheet.layoutSha256 = 'f'.repeat(64); },
    (m: any) => { m.measured.sheet.questions[0].rows[0].h += .001; },
    (m: any) => { const q = m.measured.sheet.questions[0]; q.contextCrops.shift(); q.contextFragmentRefs.shift(); },
    (m: any) => { m.measured.sheet.questions[0].canonicalItemId = 'wrong'; },
    (m: any) => { m.measured.sheet.answerMap.questions[0].crops.pop(); },
    (m: any) => { m.measured.figureOccurrences[0].questionId = 'wrong'; },
    (m: any) => { m.measured.figureOccurrences = []; },
  ];
  for (const change of changes) { const m = clone(manifest); change(m); assert.throws(() => validateMeasuredManifest(m, { allowDraft: true })); }
});

test('merged arithmetic table rows retain labels and one shared measured header', () => {
  const { sheet } = loadFixture('a05-B');
  const chosen = owned(sheet, sheet.questions.filter((q: any) => q.q === 4).slice(0, 2));
  const slices = api(sheet).short(chosen);
  assert.equal(slices.filter((s: any) => s.fragmentRole === 'table-heading').length, 1);
  for (const q of chosen) for (const ref of q.fragmentRefs) assert.equal(slices.filter((s: any) => s.fragmentRef === ref).length, 1);
  assert.notDeepEqual(chosen[0].rows, chosen[1].rows);
  for (const s of slices) assert.deepEqual(s.box, sheet.fragmentLedger[s.fragmentRef].crop);
});

test('raw measurements and complete split fragments cannot be replaced by internally consistent omissions', () => {
  const { draft, manifest, root } = loadFixture('synthetic-split');
  const modified = clone(draft), ref = Object.keys(modified.fragmentLedger)[0];
  modified.fragmentLedger[ref].crop.y += .001;
  assert.throws(() => prepareMeasuredManifestDraft(modified, readFileSync(new URL('layout.json', root)), {
    pdfId: manifest.pdfHash, url: manifest.measured.sheet.pdfUrl,
    downloadedSha256: draft.binding.pdfSha256, syntheticTestFixture: true,
  }), /RAW_CROP/);
  const incomplete = clone(manifest), q = incomplete.measured.sheet.questions[0], exercise = incomplete.exercises[0];
  q.fragmentRefs.pop(); q.rows.pop(); exercise.itemFragmentRefs.pop(); exercise.itemCrops.pop();
  assert.throws(() => validateMeasuredManifest(incomplete, { allowDraft: true }), /ITEM_COMPLETE/);
  const noPrompt = clone(manifest), whole = noPrompt.measured.wholeQuestions[0];
  whole.contextFragmentRefs = [];
  noPrompt.measured.sheet.questions.filter((q: any) => q.q === 1).forEach((q: any) => { q.contextFragmentRefs=[]; q.contextCrops=[]; });
  assert.throws(() => validateMeasuredManifest(noPrompt, { allowDraft: true }), /WHOLE_CONTEXT_COMPLETE/);
});

test('shared figure prints once with two selected items and retains its actual owner', () => {
  const { sheet } = loadFixture('b28-E');
  const chosen = owned(sheet, sheet.questions.filter((q: any) => q.q === 1).slice(0, 2));
  const slices = api(sheet).short(chosen);
  const figures = slices.filter((s: any) => s.fragmentRole === 'figure');
  assert.equal(figures.length, 1);
  assert.equal(figures[0].questionId, chosen[0].canonicalQuestionId);
  assert.equal(figures[0].itemId, null);
  const excluded = sheet.questions.filter((q: any) => q.q === 1).slice(2).flatMap((q: any) => q.fragmentRefs);
  assert.ok(slices.every((s: any) => !excluded.includes(s.fragmentRef)));
  assert.ok(slices.every((s: any) => !s.box.mask && !s.box.masks));
});

test('a selected dependent part retains every source fragment of its required question', () => {
  const { sheet } = loadFixture('synthetic-dependency');
  const chosen = owned(sheet, [sheet.questions.find((q: any) => q.q === 2)]);
  const slices = api(sheet).short(chosen);
  assert.deepEqual(chosen[0].requiredQuestions, [1]);
  for (const ref of chosen[0].dependencyFragmentRefs) assert.equal(slices.filter((s: any) => s.fragmentRef === ref).length, 1);
  const dependency = sheet.wholeQuestions.find((q: any) => q.q === 1);
  assert.deepEqual(chosen[0].dependencyCrops, dependency.crops);
  assert.equal(sheet.figureOccurrences[0].questionId, dependency.canonicalQuestionId);
});

test('real split question and inline answer fragments survive selection and preview', () => {
  const { sheet, manifest } = loadFixture('synthetic-split');
  const part = sheet.questions[0];
  assert.ok(new Set(part.rows.map((r: any) => r.page)).size > 1);
  const slices = api(sheet).short(owned(sheet, [part]));
  for (const ref of part.fragmentRefs) assert.ok(slices.some((s: any) => s.fragmentRef === ref));
  const preview = api(sheet).preview({ key: 'split', q: 1, source: sheet, parts: sheet.questions.filter((q: any) => q.q === 1) }, manifest);
  assert.ok(new Set(preview.map((s: any) => s.page)).size > 1);
  assert.ok(new Set(sheet.answerPartMap[0].crops.map((c: any) => c.page)).size > 1);
  assert.ok(new Set(sheet.answerMap.questions[0].crops.map((c: any) => c.page)).size > 1);
  const answers = api(sheet).answers({ source: sheet, questions: [part] });
  assert.equal(answers.length, sheet.answerMap.questions[0].crops.length);
  for (const answer of answers) {
    assert.equal(answer.geometryContract, 'measured-v1');
    assert.deepEqual({ page: answer.page, ...answer.box }, sheet.fragmentLedger[answer.fragmentRef].crop);
    assert.equal(answer.questionId, part.canonicalQuestionId);
  }
  const pack = new Function(['contentHeight', 'gapSize', 'fittedHeight', 'fittedScale', 'sheetContentLimit', 'packShort'].map(definition).join('\n')
    + '\nconst SHEET_PAGE_H=1440, SHEET_BASAD_H=40, SHEET_TITLE_H=86; return {packShort,contentHeight};')();
  const wholeSlices = api(sheet).short(owned(sheet, sheet.questions.filter((q: any) => q.q === 1)));
  const measured = wholeSlices.map((slice: any) => ({ slice, dh: slice.box.h * 280 / 360 * 1000 }));
  const pages = pack.packShort(measured);
  assert.ok(pages.length > 1, 'Do not shrink a multi-page measured question into one tiny page');
  for (const ref of part.fragmentRefs) assert.equal(pages.flat().filter((item: any) => item.slice.fragmentRef === ref).length, 1);
  for (const page of pages) {
    assert.ok(page.some((item: any) => item.slice.fragmentRole === 'question-prompt'));
    assert.ok(pack.contentHeight(page) >= (1440 - 40 - 86) * .4, 'Do not leave a tiny continuation when a measured fragment fits');
  }
});

test('measured rows below the legacy footer limit are never truncated or padded', () => {
  const { sheet } = loadFixture('a05-B');
  const synthetic = clone(sheet), ref = 'SYNTHETIC_BOTTOM_TEST_ONLY';
  const crop = { page: 1, x: .12, y: .955, w: .25, h: .025 };
  synthetic.fragmentLedger[ref] = { crop, role: 'item', canonicalOwnerId: 'synthetic', questionId: 'q1', itemId: 'i1' };
  const result = api(synthetic).fragments(synthetic, [ref], 'test', 'row');
  assert.deepEqual(result[0].box, crop);
});

test('a multi-page dependency is packed as complete owned fragments, without repeating the whole dependency', () => {
  // Consumer-only synthetic dependency; the immutable source/fixture is not
  // changed or approved. All geometry remains the actual physical split PDF.
  const { sheet } = loadFixture('synthetic-split'), synthetic = clone(sheet);
  const dependency = synthetic.wholeQuestions.find((q: any) => q.q === 1);
  const selected = synthetic.questions.find((q: any) => q.q === 2);
  selected.requiredQuestions=[1]; selected.dependencyFragmentRefs=dependency.fragmentRefs.slice(); selected.dependencyCrops=dependency.crops.slice();
  const slices = api(synthetic).short(owned(synthetic, [selected]));
  const pack = new Function(['contentHeight', 'gapSize', 'fittedHeight', 'fittedScale', 'sheetContentLimit', 'packShort'].map(definition).join('\n')
    + '\nconst SHEET_PAGE_H=1440, SHEET_BASAD_H=40, SHEET_TITLE_H=86; return {packShort,fittedScale,sheetContentLimit};')();
  const pages = pack.packShort(slices.map((slice: any) => ({ slice, dh: slice.box.h * 280 / 360 * 1000 })));
  assert.ok(pages.length > 1);
  for (const ref of dependency.fragmentRefs) assert.equal(pages.flat().filter((item: any) => item.slice.fragmentRef === ref).length, 1);
  pages.forEach((items: any[], index: number) => assert.ok(pack.fittedScale(items, pack.sheetContentLimit(index, true)) >= .84));
});

test('preview compiler retains all measured part identities while legacy payload is identical', () => {
  const { manifest, sheet } = loadFixture('a05-B');
  const catalog = { grades: [{ topics: [{ sheets: [{ mode: 'exercise', pdfId: sheet.pdfId }] }] }] };
  const actual = compileQuestionPreviews(catalog, () => manifest, { allowDraft: true })[sheet.pdfId];
  assert.equal(actual.geometryContract, 'measured-v1');
  assert.equal(actual.exercises.length, 40);
  assert.deepEqual(actual.exercises.map((q: any) => q.canonicalItemId), sheet.questions.map((q: any) => q.canonicalItemId));
  assert.ok(actual.exercises.every((q: any) => q.id && q.part && q.itemFragmentRefs.length));
  assert.throws(() => compileQuestionPreviews(catalog, () => manifest), /DRAFT/);
  const oldCatalog = JSON.parse(readFileSync(new URL('../public/teachers/teacher-catalog.json', import.meta.url), 'utf8'));
  const old = JSON.parse(readFileSync(new URL('../src/data/teacher-question-previews.json', import.meta.url), 'utf8'));
  const expected = JSON.parse(gunzipSync(Buffer.from(old.gzipBase64, 'base64')).toString());
  const computed = compileQuestionPreviews(oldCatalog, (id: string) => JSON.parse(readFileSync(new URL('../../../noam-ai/manifests/' + id + '.json', import.meta.url), 'utf8')));
  assert.deepEqual(computed, expected);
  assert.equal(Object.values(computed).filter((row: any) => row.geometryContract !== 'measured-v1').length, 936); // +3 sheets: grade 8 topic 67 (Noam, 2026-11-09)
});

test('measured preview refuses another PDF/layout binding and altered geometry', () => {
  const { sheet, manifest } = loadFixture('b28-E');
  const group = { key: 'test', q: 1, source: sheet, parts: sheet.questions.filter((q: any) => q.q === 1) };
  for (const change of [(m: any) => { m.layoutSha256 = 'f'.repeat(64); }, (m: any) => { m.exercises[0].crops[0].h += .01; }]) {
    const candidate = clone(manifest); change(candidate);
    assert.throws(() => api(sheet).preview(group, candidate), /MEASURED_PREVIEW/);
  }
});

test('semantic question numbers match the answer key without creating or changing a PDF crop', () => {
  const {sheet}=loadFixture('a05-B'), before=JSON.stringify(sheet), engine=api(sheet);
  const selected=owned(sheet,[sheet.questions.find((q: any)=>q.q===1),sheet.questions.find((q: any)=>q.q===4)]);
  const slices=engine.shortAll(selected,{sourceLabels:engine.sourceLabels(selected)});
  const headings=slices.filter((s: any)=>s.kind==='question-heading');
  assert.deepEqual(headings.map((s: any)=>s.label),['שאלה 1','שאלה 4']);
  assert.deepEqual(headings.map((s: any)=>s.questionNumber),engine.answers({source:sheet,questions:selected}).map((a: any)=>a.q));
  assert.ok(headings.every((s: any)=>!s.box && !s.fragmentRef && !s.geometryContract));
  for(const s of slices.filter((s: any)=>s.fragmentRef)) assert.deepEqual(s.box,sheet.fragmentLedger[s.fragmentRef].crop);
  assert.equal(measuredPack(slices).length,1,'Two small numbered questions should fit the same sheet');
  assert.equal(JSON.stringify(sheet),before,'Semantic headings must not mutate measured source metadata');
});

test('identical question numbers from two sources receive matching distinct source labels in questions and answers', async () => {
  const a=loadFixture('a05-B').sheet,b=loadFixture('b28-E').sheet,engine=api(a);
  const chosen=[...owned(a,[a.questions[0]]),...owned(b,[b.questions[0]])];
  const options={sourceLabels:engine.sourceLabels(chosen)};
  const headings=engine.shortAll(chosen,options).filter((s: any)=>s.kind==='question-heading');
  assert.deepEqual(headings.map((s: any)=>s.label),['שאלה 1','שאלה 1']);
  assert.match(headings[0].note,/^דף מקור 1 · /);assert.match(headings[1].note,/^דף מקור 2 · /);
  const answers=await engine.answerRows([{source:a,questions:[chosen[0]]},{source:b,questions:[chosen[1]]}],options);
  assert.deepEqual(answers.filter((s: any)=>s.kind==='answer-heading').map((s: any)=>s.note),headings.map((s: any)=>s.note));
  assert.ok(headings.every((s: any)=>!s.note.includes(s.pdfId) && !s.note.includes('measured')));
  assert.ok(!engine.description(a,{...options,showLevel:false}).includes('רמה ב׳'));
});

test('selected and prerequisite questions have explicit identities, and continuation repeats the same semantic heading', () => {
  const dep=loadFixture('synthetic-dependency').sheet,engine=api(dep);
  const selected=owned(dep,[dep.questions.find((q: any)=>q.q===2)]);
  const headings=engine.shortAll(selected).filter((s: any)=>s.kind==='question-heading');
  assert.deepEqual(headings.map((s: any)=>s.label),['נתונים משאלה 1','שאלה 2']);
  const split=loadFixture('synthetic-split').sheet;
  const slices=api(split).shortAll(owned(split,split.questions.filter((q: any)=>q.q===1)));
  const pages=measuredPack(slices,280/360);assert.ok(pages.length>1);
  for(const page of pages){const titles=page.filter((item: any)=>item.slice.kind==='question-heading');assert.equal(titles.length,1);assert.equal(titles[0].slice.label,'שאלה 1');}
  for(const s of slices.filter((s: any)=>s.fragmentRef && s.fragmentRole==='item')) assert.equal(pages.flat().filter((item: any)=>item.slice.fragmentRef===s.fragmentRef).length,1);
});
