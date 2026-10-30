import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { groupWholeQuestions } from '../public/teachers/teacher-question-pick.js';

const printer = readFileSync(new URL('../public/teachers/teacher-factoring-print.js', import.meta.url), 'utf8');
function definition(name: string) {
  const start = printer.search(new RegExp(`(?:^|\\n)(?:async )?function ${name}\\(`));
  assert.notEqual(start, -1, `Missing ${name}`);
  const tail = printer.slice(start + (printer[start] === '\n' ? 1 : 0));
  const end = tail.search(/\n(?:async )?function /);
  return end < 0 ? tail : tail.slice(0, end);
}

for (let grade = 1; grade <= 9; grade += 1) {
  test(`grade ${grade} loads every level and offers all full-question cards and AI counts`, async () => {
    const app = new Function('grade', 'groupWholeQuestions', `
      const state = { grade: String(grade), filter: 'all', selected: [], blocks: [], lastAiPickCount: 0, expanded: false };
      const sheet = { pdfId: 'grade-' + grade, pdfUrl: 'https://example.invalid/source.pdf', level: 'a', levelLabel: 'רמה א׳' };
      const pool = Array.from({ length: 20 }, (_, i) => ({ id: String(i + 1), q: i + 1, page: Math.floor(i / 5) + 1, source: sheet }));
      const currentExercises = () => pool;
      const currentTopic = () => ({ sheets: ['a', 'b', 'c'].map(level => ({ pdfId: 'grade-' + grade + '-' + level, mode: 'exercise' })) });
      const loaded = [], previewed = [];
      const loadExerciseSheet = async (pdfId) => { loaded.push(pdfId); return { pdfId }; };
      const loadQuestionPreviewManifest = async (source) => { previewed.push(source.pdfId); return {}; };
      const sheets = new Map();
      const previewManifests = new Map();
      const FACTORING_PDF = 'factoring';
      let loadToken = 0, topicLoadPromise = null, aiPickPending = 0;
      const AI_QUESTION_COUNTS = [5, 10, 15];
      const QUESTION_ROLES = { basis: 'ביסוס', review: 'חזרה', creative: 'יצירתית' };
      const buttons = [5, 10, 15].map(count => ({ dataset: { aiPick: count }, setAttribute() {}, removeAttribute() {} }));
      const controls = { 'ai-pick-group': { hidden: true, querySelectorAll: () => buttons }, 'ai-suggest-status': { hidden: true } };
      const $ = (id) => controls[id];
      ${['exKey', 'questionPreviewGroup', 'currentQuestions', 'carriedKeys', 'escapeHTML', 'questionCard', 'wholeQuestionPickCards', 'paintAiPickButtons', 'loadCurrentTopic'].map(definition).join('\n')}
      return { state, loaded, previewed, controls, buttons, load: loadCurrentTopic,
        cards: () => wholeQuestionPickCards(currentQuestions()), paintAi: paintAiPickButtons };
    `)(grade, groupWholeQuestions);
    await app.load();
    assert.deepEqual(app.loaded, [`grade-${grade}-a`, `grade-${grade}-b`, `grade-${grade}-c`]);
    assert.deepEqual(app.previewed, app.loaded);
    const html = app.cards();
    assert.equal((html.match(/data-whole-question=/g) || []).length, 20);
    assert.equal((html.match(/data-preview-key=/g) || []).length, 20);
    assert.equal((html.match(/טוענים את השאלה המלאה מדף המקור/g) || []).length, 20);
    assert.match(html, /aria-label="בחירת שאלה 20 רמה א׳"/);
    app.paintAi();
    assert.equal(app.controls['ai-pick-group'].hidden, false);
    assert.equal(app.controls['ai-suggest-status'].hidden, false);
    assert.deepEqual(app.buttons.map((button: { disabled: boolean }) => button.disabled), [false, false, false]);
  });
}

test('manual selection of a repeated part retains both source regions in current and saved-section prints', async () => {
  const source = { pdfId: 'source', questions: [
    { id: '13א', q: 13, page: 1, row: { page: 1, x: 0, y: 0.2, w: 1, h: 0.1 } },
    { id: '13א', q: 13, page: 2, row: { page: 2, x: 0, y: 0.1, w: 1, h: 0.1 } },
    { id: '13ב', q: 13, page: 2, row: { page: 2, x: 0, y: 0.3, w: 1, h: 0.1 } },
  ] };
  const app = new Function('source', 'groupWholeQuestions', `
    source.questions.forEach(question => { question.source = source; });
    const sheets = new Map([[source.pdfId, source]]);
    const state = { grade: '1', selected: [], blocks: [], sectionKind: 'review', filter: 'all' };
    const currentExercises = () => source.questions;
    const sectionKind = kind => kind;
    const gradeRecord = () => null;
    const $ = () => null;
    const render = () => {};
    const announce = () => {};
    const clearPreparedPrint = () => {};
    let history = [];
    ${['exKey', 'selectionKey', 'snapshot', 'carriedKeys', 'toggleWholeQuestion', 'visibleSelectionKeys', 'sourceForContext', 'questionsForKeys', 'resolveChosen', 'pageBlocks'].map(definition).join('\n')}
    return { state, toggle: toggleWholeQuestion, chosen: resolveChosen, blocks: pageBlocks };
  `)(source, groupWholeQuestions);
  app.toggle('source:13', true);
  assert.deepEqual(app.state.selected, ['ex:source:13א', 'ex:source:13ב']);
  assert.deepEqual((await app.chosen()).map((question: { page: number }) => question.page), [1, 2, 2]);
  app.state.blocks = [{ kind: 'review', title: 'נושא קודם', keys: app.state.selected.slice() }];
  assert.equal(app.blocks()[0].questions.length, 3);
  app.state.blocks = [];
  app.toggle('source:13', false);
  assert.deepEqual(app.state.selected, []);
  assert.deepEqual(await app.chosen(), []);
});

test('short topics explain availability visibly before clicking AI, with an accessible button-group description', () => {
  const note = { hidden: true, textContent: '' };
  const buttons = [5, 10, 15].map(count => ({ dataset: { aiPick: count }, title: '', setAttribute() {}, removeAttribute() {} }));
  const paint = new Function('note', 'buttons', `
    const state = { selected: [], lastAiPickCount: 0 }, aiPickPending = 0, AI_QUESTION_COUNTS = [5, 10, 15];
    const currentQuestions = () => Array.from({length: 8}, (_, i) => ({ keys: ['ex:source:' + (i + 1)] }));
    const carriedKeys = () => new Set();
    const $ = id => id === 'ai-available-note' ? note : id === 'ai-pick-group' ? { querySelectorAll: () => buttons } : {};
    ${definition('paintAiPickButtons')}
    return paintAiPickButtons;
  `)(note, buttons);
  paint();
  assert.equal(note.hidden, false);
  assert.match(note.textContent, /זמינות 8 שאלות לבחירה/);
  assert.match(note.textContent, /בקשה לכמות גדולה יותר תבחר את כולן/);
  assert.equal(buttons[2].title, 'זמינות 8 שאלות; כולן ייבחרו.');
  const html = readFileSync(new URL('../public/teachers/index.html', import.meta.url), 'utf8');
  assert.match(html, /id="ai-pick-group"[^>]*aria-describedby="ai-available-note"/);
});

for (const textFails of [false, true]) {
  test(`original elementary answer pages are appended when text extraction ${textFails ? 'fails' : 'has no usable question labels'}`, async () => {
    const measured = new Function('textFails', `
      const sheetTextLines = async () => { if (textFails) throw new Error('text unavailable'); return []; };
      const answerCropsFromLines = () => [];
      const measureSlices = async slices => slices;
      ${['levelPrintName', 'answerFallbackSlices', 'answerMeasured'].map(definition).join('\n')}
      return answerMeasured;
    `)(textFails);
    const slices = await measured([{ source: { pdfId: 'elementary', level: 'b', answerStartPage: 4, pageCount: 5 }, questions: [{ q: 2 }] }]);
    assert.match(slices[0].label, /רמה ב׳ · תשובות מדף המקור המלא/);
    assert.deepEqual(slices.filter((slice: { kind: string }) => slice.kind === 'answer').map((slice: { page: number; box: unknown }) => ({ page: slice.page, box: slice.box })), [
      { page: 4, box: { x: 0, y: 0, w: 1, h: 1 } },
      { page: 5, box: { x: 0, y: 0, w: 1, h: 1 } },
    ]);
    assert.deepEqual(await measured([{ source: { pdfId: 'no-answers', answerStartPage: null, pageCount: 3 }, questions: [{ q: 2 }] }]), []);
  });
}

test('outlined answer pages never use plausible text-overlay coordinates', async () => {
  const measured = new Function(`
    const sheetTextLines = async () => { throw new Error('Unreliable outlined-text coordinates must not be read'); };
    const answerCropsFromLines = () => { throw new Error('Do not derive answer crops from an outlined-text overlay'); };
    const measureSlices = async slices => slices;
    ${['levelPrintName', 'answerFallbackSlices', 'answerMeasured'].map(definition).join('\n')}
    return answerMeasured;
  `)();
  const slices = await measured([{ source: { pdfId: 'outlined-source', answerGeometry: 'full-pages', level: 'a', answerStartPage: 8, pageCount: 9 }, questions: [{ q: 5 }] }]);
  assert.deepEqual(slices.filter((slice: { kind: string }) => slice.kind === 'answer').map((slice: { page: number }) => slice.page), [8, 9]);
  assert.ok(slices.filter((slice: { kind: string }) => slice.kind === 'answer').every((slice: { box: { x: number; y: number; w: number; h: number } }) => slice.box.x === 0 && slice.box.y === 0 && slice.box.w === 1 && slice.box.h === 1));
});

test('a narrow original column fills the question preview without changing its source crop or extracting PDF text', async () => {
  const crop = { page: 3, x: 0.53, y: 0.17, w: 0.42, h: 0.31 };
  const source = { pdfId: 'column-source', wholeQuestionGeometry: true };
  const group = { key: 'column-source:21', q: 21, source, parts: [{ id: '21', q: 21, page: 3, source }] };
  const manifest = { wholeQuestionGeometry: true, exercises: [{ q: 21, pin: { page: 3, x: 0.9, y: 0.2 }, crop }] };
  const before = JSON.stringify(manifest);
  const app = new Function('group', 'manifest', `
    let SOURCE = null;
    const sheets = new Map([[group.source.pdfId, group.source]]), draws = [], pages = [];
    const canvas = { width: 0, height: 0, getContext: () => ctx };
    const ctx = { canvas, fillRect() {}, drawImage(...args) { draws.push(args); } };
    const document = { createElement: () => canvas };
    const sheetTextLines = () => { throw new Error('Preview must not require extractable PDF text'); };
    const loadQuestionPreviewManifest = async () => manifest;
    const pageBitmap = async (page, source) => { pages.push([page, source.pdfId]); return { width: 1100, height: 1555 }; };
    ${['exKey', 'questionPreviewGroup', 'questionPreviewSlices', 'gapSize', 'fittedHeight', 'measureSlices', 'paintMeasuredPage', 'questionPreviewCanvas'].map(definition).join('\n')}
    return { render: questionPreviewCanvas, draws, pages };
  `)(group, manifest);
  const canvas = await app.render(group);
  assert.deepEqual(app.pages, [[3, 'column-source']]);
  assert.equal(app.draws.length, 1);
  const draw = app.draws[0];
  for (const [actual, expected] of [[draw[1], crop.x * 1100], [draw[2], crop.y * 1555], [draw[3], crop.w * 1100], [draw[4], crop.h * 1555]]) {
    assert.ok(Math.abs(actual - expected) < 0.00001, 'The preview must retain the exact original pixel rectangle');
  }
  assert.equal(draw[5], 0, 'A right source column should not leave blank space on the left of the preview');
  assert.equal(draw[7], 1000);
  assert.equal(draw[8], canvas.height);
  assert.equal(canvas.height, Math.round(1000 * crop.h * 1555 / (crop.w * 1100)));
  assert.equal(JSON.stringify(manifest), before);
});

test('whole-question print geometry retains original context, columns and content below the old footer clamp', () => {
  const source = { pdfId: 'elementary-source', wholeQuestionGeometry: true, questions: [] };
  const rows = [
    { page: 1, x: 0.04, y: 0.08, w: 0.91, h: 0.89 },
    { page: 2, x: 0.53, y: 0.93, w: 0.42, h: 0.04 },
  ];
  const question = { id: '1', q: 1, page: 2, source, row: rows[0], rows, inkTop: 0.93 };
  const slices = new Function('SOURCE', `${definition('wholeQuestionSlices')}\n${definition('shortSlices')} return shortSlices;`)(source)([question]);
  assert.deepEqual(slices.map((slice: { page: number; box: unknown }) => ({ page: slice.page, box: slice.box })), rows.map(box => ({ page: box.page, box })));
  assert.ok(slices.every((slice: { pdfId: string; block: string }) => slice.pdfId === source.pdfId && slice.block === 'elementary-source:q1'));
  assert.ok(Math.abs(slices[1].box.y + slices[1].box.h - 0.97) < 0.000001);
});

test('shared same-page context remains separate from the question instead of exposing intervening questions', () => {
  const source = { pdfId: 'source', wholeQuestionGeometry: true };
  const group = { key: 'source:4', q: 4, source, parts: [{ id: '4', q: 4, page: 2, source }] };
  const crops = [
    { page: 1, x: 0.08, y: 0.3, w: 0.84, h: 0.28 },
    { page: 2, x: 0.35, y: 0.04, w: 0.57, h: 0.08 },
    { page: 2, x: 0.05, y: 0.73, w: 0.9, h: 0.16 },
  ];
  const manifest = { exercises: [{ q: 4, pin: { page: 2, x: 0.9, y: 0.76 }, crops: [...crops, crops[2]] }] };
  const preview = new Function(`${['exKey', 'questionPreviewGroup', 'questionPreviewSlices'].map(definition).join('\n')} return questionPreviewSlices;`)();
  const slices = preview(group, manifest);
  assert.deepEqual(slices.map((slice: { page: number; box: unknown }) => ({ page: slice.page, ...slice.box as object })), crops);
  assert.equal(slices.length, 3, 'Repeated copies of an exact crop are rendered once');
  assert.ok(!slices.some((slice: { page: number; box: { y: number; h: number } }) => slice.page === 2 && slice.box.y < 0.4 && slice.box.y + slice.box.h > 0.4), 'The unrelated middle of page2 is not part of the selected question');
});
