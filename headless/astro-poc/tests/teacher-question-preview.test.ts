import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { sheetFromManifest } from '../scripts/build-teacher-catalog.mjs';
import { groupWholeQuestions } from '../public/teachers/teacher-question-pick.js';
import { test } from 'node:test';

const printer = readFileSync(new URL('../public/teachers/teacher-factoring-print.js', import.meta.url), 'utf8');

type Box = { x: number; y: number; w: number; h: number; page?: number };
type Part = { id: string; q: number; page: number; row: Box; rows?: Box[]; stem?: Box; source?: Sheet };
type Sheet = { pdfId: string; questions: Part[] };
type Group = { key: string; q: number; source: Sheet; parts: Part[] };
type Slice = { kind: string; page: number; pdfId: string; box: Box };
type Manifest = { exercises: { id: string; q: number; pin: { page: number; y: number }; crop?: Box; crops?: Box[]; contextQuestionNumbers?: number[] }[] };

function definition(name: string) {
  const start = printer.search(new RegExp(`(?:^|\\n)(?:async )?function ${name}\\(`));
  assert.notEqual(start, -1, `Missing ${name}`);
  const tail = printer.slice(start + (printer[start] === '\n' ? 1 : 0));
  const end = tail.search(/\n(?:async )?function /);
  return end < 0 ? tail : tail.slice(0, end);
}

function readGroup(pdfId: string, number: number): Group {
  const file = new URL(`../public/teachers/sheets/${pdfId}.json`, import.meta.url);
  const source: Sheet = existsSync(file)
    ? JSON.parse(readFileSync(file, 'utf8'))
    : sheetFromManifest({ pdfId, level: 'a', levelLabel: 'רמה א׳' }, readManifest(pdfId));
  source.questions.forEach((part) => { part.source = source; });
  return { key: `q:${pdfId}:${number}`, q: number, source, parts: source.questions.filter((part) => part.q === number) };
}

function readManifest(pdfId: string): Manifest {
  return JSON.parse(readFileSync(new URL(`../../../noam-ai/manifests/${pdfId}.json`, import.meta.url), 'utf8'));
}

const previewHelpers = () => ['exKey', 'questionPreviewGroup', 'questionPreviewSlices'].map(definition).join('\n');
const preview = new Function(`${previewHelpers()} return questionPreviewSlices;`)() as (group: Group, manifest: Manifest) => Slice[];

const covers = (slices: Slice[], page: number, y: number) => slices.some((slice) => (
  slice.page === page && slice.box.y <= y && slice.box.y + slice.box.h >= y
));

test('the question preview keeps the whole instruction and all four parts across source pages', () => {
  const group = readGroup('40e46a64bcf0441bae36eba820884704', 2);
  const manifest = readManifest(group.source.pdfId);
  const before = JSON.stringify(manifest);
  const exercises = manifest.exercises.filter((exercise) => exercise.q === group.q);
  assert.equal(group.parts.length, 4);
  assert.equal(new Set(exercises.map((exercise) => exercise.id)).size, 4);
  const slices = preview(group, manifest);

  assert.deepEqual(slices.map((slice) => slice.page), [1, 2], 'Four identical whole-question crops must not duplicate either page');
  assert.ok(Math.abs(slices[0].box.y - 0.588343) < 1e-8);
  assert.ok(Math.abs(slices[0].box.y + slices[0].box.h - 0.966742) < 1e-8);
  assert.ok(Math.abs(slices[1].box.y - 0.032071) < 1e-8);
  assert.ok(Math.abs(slices[1].box.y + slices[1].box.h - 0.224286) < 1e-8);
  assert.ok(covers(slices, 1, group.parts[0].stem!.y + group.parts[0].stem!.h / 2));
  for (const exercise of exercises) {
    assert.ok(covers(slices, exercise.pin.page, exercise.pin.y), `Missing ${exercise.id}`);
  }
  assert.ok(slices.every((slice) => slice.pdfId === group.source.pdfId));
  assert.equal(JSON.stringify(manifest), before, 'Preview calculation must not mutate the source mapping');
});

test('a whole-question preview keeps its shared geometry drawing without repeating it', () => {
  const group = readGroup('0d548ce76eb74a1ab10385cdaf1f77ca', 9);
  assert.equal(group.parts.length, 3);
  const slices = preview(group, readManifest(group.source.pdfId));
  assert.equal(slices.length, 1);

  for (const y of [0.12, 0.25]) {
    assert.equal(slices.filter((slice) => slice.page === 4 && slice.box.y <= y && slice.box.y + slice.box.h >= y).length, 1, `Drawing at y=${y}`);
  }
  assert.ok(covers(slices, 4, group.parts[2].row.y + group.parts[2].row.h / 2));
  assert.ok(slices.every((slice) => slice.pdfId === group.source.pdfId));
  assert.ok(Math.abs(slices[0].box.y + slices[0].box.h - 0.334327) < 1e-8);
  assert.ok(!('mask' in slices[0].box) && !('masks' in slices[0].box), 'Whole questions must not mask their own drawing or text');
});

test('the kite preview includes the final wrapped sentence beyond the old print-row boundary', () => {
  const group = readGroup('6e51741996d24010aa38e941f7199848', 1);
  const slices = preview(group, readManifest(group.source.pdfId));
  assert.equal(slices.length, 1);
  assert.ok(slices[0].box.y + slices[0].box.h >= 0.769062 - 1e-8, 'The final נמקו line must remain visible');
  assert.ok(covers(slices, 1, 0.75), 'Do not use the old per-part bottom at 0.7171');
});

test('factoring question 6 excludes an unrelated question 5 crop and retains every own part', () => {
  const group = readGroup('40e46a64bcf0441bae36eba820884704', 6);
  const manifest = readManifest(group.source.pdfId);
  const exercises = manifest.exercises.filter((exercise) => exercise.q === 6);
  assert.equal(exercises.length, 4);
  assert.ok(exercises.every((exercise) => !exercise.contextQuestionNumbers?.length));

  const slices = preview(group, manifest);
  assert.deepEqual(slices.map((slice) => slice.page), [3, 4]);
  assert.ok(Math.abs(slices[0].box.y - 0.633671) < 1e-8, 'The preview must start at question 6, not the extra question 5 crop');
  assert.equal(covers(slices, 3, 0.051014 + 0.581469 / 2), false);
  assert.ok(Math.abs(slices[1].box.y - 0.032071) < 1e-8);
  assert.ok(Math.abs(slices[1].box.y + slices[1].box.h - 0.171379) < 1e-8);
  for (const exercise of exercises) {
    assert.ok(covers(slices, exercise.pin.page, exercise.pin.y), `Missing ${exercise.id}`);
  }
});

test('question 7 retains the earlier question 6 crop when its manifest explicitly requires that context', () => {
  const group = readGroup('5be1af0651d142648da6c08d0ff028f4', 7);
  const manifest = readManifest(group.source.pdfId);
  const exercises = manifest.exercises.filter((exercise) => exercise.q === 7);
  assert.ok(exercises.length > 0);
  assert.ok(exercises.every((exercise) => exercise.contextQuestionNumbers?.includes(6)));

  const slices = preview(group, manifest);
  assert.deepEqual(slices.map((slice) => slice.page), [3, 4, 5]);
  assert.ok(Math.abs(slices[0].box.y - 0.463682) < 1e-8, 'Preserve the explicitly required question 6 context');
  for (const exercise of manifest.exercises.filter((exercise) => exercise.q === 6 || exercise.q === 7)) {
    assert.ok(covers(slices, exercise.pin.page, exercise.pin.y), `Missing required context or current part ${exercise.id}`);
  }
});

test('invalid manifest crops fail instead of silently truncating question content', () => {
  const group = readGroup('40e46a64bcf0441bae36eba820884704', 2);
  for (const bad of [{ x: -0.1 }, { y: 0.9, h: 0.5 }, { w: 0 }, { page: 0 }]) {
    const manifest = readManifest(group.source.pdfId);
    const exercise = manifest.exercises.find((item) => item.q === group.q)!;
    Object.assign(exercise.crops![0], bad);
    assert.throws(() => preview(group, manifest), /QUESTION_PREVIEW_BOUNDS/);
  }
});

test('the preview canvas paints the entire question at natural height from both PDF pages', async () => {
  const group = readGroup('40e46a64bcf0441bae36eba820884704', 2);
  const manifest = readManifest(group.source.pdfId);
  const harness = new Function('group', 'manifest', `
    let SOURCE = { pdfId: 'unrelated-print-source' };
    const sheets = new Map([[group.source.pdfId, group.source]]);
    const draws = [];
    const requested = [];
    const canvas = { width: 0, height: 0, getContext: () => ctx };
    const ctx = { canvas, fillRect() {}, drawImage(...args) { draws.push(args); } };
    const document = { createElement: () => canvas };
    async function loadQuestionPreviewManifest() { return manifest; }
    async function pageBitmap(page, source) {
      requested.push({ page, pdfId: source.pdfId });
      return { width: 1100, height: 1555, page };
    }
    ${definition('gapSize')}
    ${definition('fittedHeight')}
    ${definition('measureSlices')}
    ${definition('paintMeasuredPage')}
    ${previewHelpers()}
    ${definition('questionPreviewCanvas')}
    return { render: questionPreviewCanvas, draws, requested };
  `)(group, manifest) as {
    render: (group: Group) => Promise<{ width: number; height: number }>;
    draws: [unknown, number, number, number, number, number, number, number, number][];
    requested: { page: number; pdfId: string }[];
  };

  const canvas = await harness.render(group);
  assert.equal(canvas.width, 1000);
  assert.ok(canvas.height > 120, 'A multi-part question must not be cropped to a thumbnail height');
  assert.deepEqual([...new Set(harness.requested.map((request) => request.page))], [1, 2]);
  assert.ok(harness.requested.every((request) => request.pdfId === group.source.pdfId));
  assert.equal(harness.draws.length, 2, 'Paints one complete question crop from each page, without repeating parts');
  const bottom = Math.max(...harness.draws.map((draw) => draw[6] + draw[8]));
  assert.equal(bottom, canvas.height, 'The last line of the question must fit in the canvas');
});

test('the initial manual view exposes all 60 complete questions before any selection', () => {
  const render = new Function(`
    let state = { selected: [], filter: 'all' };
    const previewManifests = new Map();
    const QUESTION_ROLES = {};
    ${definition('questionPreviewGroup')}
    ${definition('questionCard')}
    ${definition('exKey')}
    ${definition('escapeHTML')}
    ${definition('wholeQuestionPickCards')}
    return wholeQuestionPickCards;
  `)() as (groups: unknown[]) => string;
  const groups = Array.from({ length: 60 }, (_, index) => ({
    key: `source:${index + 1}`, number: index + 1,
    questions: [{ id: `${index + 1}א`, q: index + 1, source: { pdfId: 'source' } }],
  }));
  const html = render(groups);
  assert.equal((html.match(/data-whole-question=/g) || []).length, 60);
  assert.match(html, /data-whole-question="source:60"/);
});

test('manual selection keeps every part and preserves earlier test/review sections', () => {
  const source = readGroup('6a37fe7160324a17ad107b3dbe43c1db', 2).source;
  const pool = source.questions;
  const groups = groupWholeQuestions(pool);
  const saved = groups[0];
  const chosen = groups.find((group: { number: number }) => group.number === 2)!;
  const keys = (group: { questions: Part[] }) => group.questions.map((part) => `ex:${source.pdfId}:${part.id}`);
  const harness = new Function('pool', 'groupWholeQuestions', 'savedKeys', `
    let state = { selected: [], blocks: [{ kind: 'test', title: 'נושא קודם', keys: savedKeys }], sectionKind: 'review', lastAiPickCount: 15, pickNote: '' };
    let history = [];
    const announcements = [];
    const currentExercises = () => pool;
    const currentTopic = () => ({ title: 'פירוק לגורמים' });
    const sectionKind = (value) => value;
    const clearPreparedPrint = () => {};
    const render = () => {};
    const announce = (message) => announcements.push(message);
    const $ = () => null;
    ${definition('exKey')}
    ${definition('selectionKey')}
    ${definition('snapshot')}
    ${definition('carriedKeys')}
    ${definition('toggleWholeQuestion')}
    ${definition('addAnotherTopic')}
    return { select: toggleWholeQuestion, addTopic: addAnotherTopic, state, announcements };
  `)(pool, groupWholeQuestions, keys(saved));
  const originalBlock = JSON.stringify(harness.state.blocks);

  harness.select(chosen.key, true);
  assert.deepEqual(harness.state.selected, keys(chosen));
  assert.equal(harness.state.lastAiPickCount, 0);
  harness.select(chosen.key, true);
  assert.deepEqual(harness.state.selected, keys(chosen), 'Checking twice cannot duplicate any part');
  harness.select(chosen.key, false);
  assert.deepEqual(harness.state.selected, []);
  assert.equal(JSON.stringify(harness.state.blocks), originalBlock);
  harness.select(saved.key, true);
  assert.deepEqual(harness.state.selected, [], 'A question already in a saved section cannot be added twice');
  assert.match(harness.announcements.at(-1), /כבר בדף/);

  harness.select(chosen.key, true);
  harness.addTopic();
  assert.deepEqual(harness.state.blocks.map((block: { kind: string }) => block.kind), ['test', 'review']);
  assert.deepEqual(harness.state.blocks[0].keys, keys(saved));
  assert.deepEqual(harness.state.blocks[1].keys, keys(chosen));
  assert.deepEqual(harness.state.selected, []);
  assert.equal(harness.state.wizard, 'topic');
});

test('ticking a later question does not scroll the unchanged selection step back to the top', () => {
  const app = new Function(`
    const state = { wizard: 'pick' };
    const WIZARD_ORDER = ['grade', 'topic', 'level', 'scenario', 'style', 'pick', 'result'];
    const scrolled = [];
    const controls = new Map();
    const $ = (id) => {
      if (!controls.has(id)) controls.set(id, {
        hidden: false, textContent: '', classList: { toggle() {} },
        scrollIntoView() { scrolled.push(id); },
      });
      return controls.get(id);
    };
    const document = { body: { dataset: { wizard: 'pick' } }, querySelectorAll: () => [] };
    const band = () => 'middle';
    ${definition('applyWizard')}
    return { state, apply: applyWizard, scrolled };
  `)();
  app.apply();
  app.apply();
  assert.deepEqual(app.scrolled, [], 'Selection updates should preserve the teacher’s current scroll position');
  app.state.wizard = 'result';
  app.apply();
  assert.deepEqual(app.scrolled, ['wizard-result'], 'An actual wizard transition still brings its destination into view');
});
