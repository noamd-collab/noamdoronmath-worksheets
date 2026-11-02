import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { parseHTML } from 'linkedom';

const printer = readFileSync(new URL('../public/teachers/teacher-factoring-print.js', import.meta.url), 'utf8');
function definition(name: string) {
  const start = printer.search(new RegExp(`(?:^|\\n)(?:async )?function ${name}\\(`));
  assert.notEqual(start, -1, `Missing ${name}`);
  const tail = printer.slice(start + (printer[start] === '\n' ? 1 : 0));
  const end = tail.search(/\n(?:async )?function /);
  return end < 0 ? tail : tail.slice(0, end);
}

function answerPipeline(crops: { q: number; page: number; box: object }[] = [], textFails = false) {
  return new Function('crops', 'textFails', `
    const sheetTextLines = async () => { if (textFails) throw new Error('text unavailable'); return []; };
    const answerCropsFromLines = () => crops;
    const measureSlices = async slices => slices;
    ${['levelPrintName', 'answerSpecsForGroup', 'answerFallbackSlices', 'answerMeasured'].map(definition).join('\n')}
    return answerMeasured;
  `)(crops, textFails);
}

const group = (extra = {}) => ({
  source: { pdfId: 'source', title: 'דף תרגול', level: 'a', ...extra },
  questions: [{ id: '2', q: 2 }, { id: '5', q: 5 }],
});
const crop = { q: 2, page: 8, box: { x: 0.02, y: 0.2, w: 0.96, h: 0.1 } };

test('partly extracted answer keys use verified complete source pages instead of dropping selected answers', async () => {
  const slices = await answerPipeline([crop])([group({ answerStartPage: 8, pageCount: 9 })]);
  assert.deepEqual(slices.filter((slice: { kind: string }) => slice.kind === 'answer').map((slice: { page: number }) => slice.page), [8, 9]);
  assert.ok(slices.filter((slice: { kind: string }) => slice.kind === 'answer').every((slice: { box: { h: number } }) => slice.box.h === 1));
  assert.equal(slices.some((slice: { block: string }) => slice.block === 'answer:source:2'), false);
});

test('a missing selected answer blocks printing explicitly when no verified answer pages exist', async () => {
  await assert.rejects(answerPipeline([crop])([group()]), (error: Error & { code?: string }) => {
    assert.equal(error.code, 'MISSING_ANSWERS');
    assert.match(error.message, /לשאלות 5 — דף תרגול/);
    assert.match(error.message, /לא הוכן להדפסה/);
    return true;
  });
});

test('missing full-page metadata cannot silently produce an answerless worksheet', async () => {
  for (const source of [
    { answerGeometry: 'full-pages' },
    { answerGeometry: 'full-pages', answerStartPage: 10, pageCount: 9 },
    { answerGeometry: 'full-pages', answerStartPage: 0, pageCount: 9 },
  ]) {
    await assert.rejects(answerPipeline([], true)([group(source)]), { code: 'MISSING_ANSWERS' });
  }
});

function printApp(options: { failure?: boolean; sections?: boolean; wait?: Promise<void> } = {}) {
  const { document } = parseHTML(`<html><body>
    <div id="dialog-plan"></div><div id="print-area"><canvas data-old="1"></canvas></div>
    <textarea id="teacher-note"></textarea><button id="prepare"></button><button id="prepare-short"></button>
    <p id="prepare-hint"></p><div id="wizard-preview"></div><h2 id="print-title"></h2><p id="print-lead"></p><button id="print">הדפסה</button><dialog id="print-dialog"></dialog>
  </body></html>`);
  return new Function('document', 'options', `
    const $ = id => document.getElementById(id);
    const state = { selected: ['ex:source:2'], blocks: [], sectionKind: 'review', scenario: 'first', style: 'first' };
    let printGeneration = 0, printMode = 'marked', printOpener = null, rendering = false;
    const PRINT_UNPREPARED = '<p class="print-unprepared">יש להכין את הדף</p>';
    const source = { pdfId: 'source', title: 'דף', pdfUrl: '/source.pdf' };
    const chosen = [{ id: '2', q: 2, source }];
    const available = () => true, pageBlocks = () => [], resolveChosen = async () => chosen;
    const exKey = (pdfId, id) => 'ex:' + pdfId + ':' + id;
    const SCENARIOS = { first: { label: 'חזרה' } }, STYLES = { first: { plan: '' } };
    const pageNeedsSections = () => Boolean(options.sections), metaHTML = () => '';
    const worksheetTitle = () => 'דף';
    const markedHTML = () => '<figure class="source-sheet"><div class="source-stage"><canvas></canvas></div></figure>';
    const paintSheets = async () => {};
    const attachTeacherNote = async () => {};
    const answerMeasured = async groups => {
      if (options.wait) await options.wait;
      if (options.failure) throw Object.assign(new Error('חסרות תשובות סופיות'), { code: 'MISSING_ANSWERS' });
      assertGroups = groups;
      return [{ slice: { kind: 'answer', block: 'answer:source:2' }, dh: 100 }];
    };
    let assertGroups = null;
    const packShort = items => [items];
    const sheetContentLimit = () => 1000, fittedScale = () => 1, fittedHeight = () => 100;
    const SHEET_BASAD_H = 30, SHEET_TITLE_H = 30;
    const paintPageChrome = () => 30, paintMeasuredPage = () => {};
    // linkedom creates canvas elements through innerHTML; install only the
    // drawing primitive so the real packing/DOM pipeline can be exercised.
    const canvasPrototype = Object.getPrototypeOf(document.querySelector('canvas'));
    canvasPrototype.getContext = () => ({ fillRect() {}, drawImage() {} });
    const updateShortPrint = async (plan, area) => {
      plan.innerHTML = '<figure class="crop-sheet"><canvas></canvas></figure>';
      area.innerHTML = plan.innerHTML;
    };
    const notices = [];
    const announce = message => notices.push(message);
    let opened = 0;
    ['prepare-hint', 'dialog-plan', 'wizard-preview'].forEach(id => { $(id).focus = () => {}; });
    $('print-dialog').showModal = () => { opened += 1; };
    ${['escapeHTML', 'groupsOf', 'paintPacked', 'clearPreparedPrint', 'copyCanvases', 'updatePrint', 'reportPrintError', 'prepare'].map(definition).join('\n')}
    return { document, state, notices, update: updatePrint, prepare, report: reportPrintError, invalidate: clearPreparedPrint,
      opener: () => printOpener, opened: () => opened, groups: () => assertGroups };
  `)(document, options);
}

test("prepare('marked') appends selected final answers after the source pages in the shared worksheet", async () => {
  const app = printApp();
  await app.prepare('marked');
  assert.equal(app.opened(), 1);
  assert.equal(app.groups()[0].questions[0].q, 2);
  for (const id of ['dialog-plan', 'print-area']) {
    const figures = [...app.document.getElementById(id).querySelectorAll('figure')];
    assert.equal(figures.length, 2, 'Answers must not introduce a blank exercise page');
    assert.equal(figures[0].className, 'source-sheet');
    assert.equal(figures[1].dataset.answers, '1');
  }
});

test('failed answer preparation clears stale printable canvases and reports the missing key', async () => {
  const app = printApp({ failure: true });
  await app.prepare('marked');
  assert.equal(app.opened(), 0);
  assert.equal(app.document.getElementById('print-area').querySelector('canvas'), null);
  assert.ok(app.document.getElementById('print-area').querySelector('.print-unprepared'));
  const feedback = app.document.getElementById('prepare-hint');
  assert.equal(feedback.getAttribute('role'), 'alert');
  assert.match(feedback.textContent, /חסרות תשובות סופיות/);
  assert.deepEqual(app.notices, [], 'Persistent error must not be repeated in the transient toast');
});

test('successful retry clears the persistent print error without requiring a selection edit', async () => {
  const options = { failure: true };
  const app = printApp(options);
  await app.prepare('marked');
  const feedback = app.document.getElementById('prepare-hint');
  assert.equal(feedback.getAttribute('role'), 'alert');
  options.failure = false;
  await app.prepare('marked');
  assert.equal(app.opened(), 1);
  assert.equal(feedback.getAttribute('role'), null);
  assert.equal(feedback.getAttribute('tabindex'), null);
  assert.equal(feedback.textContent, 'דף מלא עם סימון, או דף מצומצם שנחתך מהמקור');
  for (const id of ['dialog-plan', 'print-area']) {
    assert.equal(app.document.getElementById(id).querySelectorAll('canvas').length, 2);
    assert.ok(app.document.getElementById(id).querySelector('[data-answers="1"]'));
  }
});

for (const errorTarget of ['dialog-plan', 'wizard-preview']) {
  test(`successful retry restores ${errorTarget} without erasing the committed worksheet`, async () => {
    const app = printApp();
    app.state.wizard = 'result';
    app.document.getElementById('print-dialog').open = errorTarget === 'dialog-plan';
    app.report('ההדפסה נכשלה');
    const feedback = app.document.getElementById(errorTarget);
    assert.equal(feedback.getAttribute('role'), 'alert');
    assert.equal(await app.update(), true);
    assert.equal(feedback.getAttribute('role'), null);
    assert.equal(feedback.getAttribute('tabindex'), null);
    assert.doesNotMatch(feedback.textContent, /ההדפסה נכשלה/);
    assert.equal(feedback.querySelectorAll('canvas').length, 2);
    assert.equal(app.document.getElementById('print-area').querySelectorAll('canvas').length, 2);
    assert.ok(app.document.getElementById('print-area').querySelector('[data-answers="1"]'));
  });
}

test('changing selection while rendering prevents stale canvases from becoming printable', async () => {
  let finish!: () => void;
  const wait = new Promise<void>(resolve => { finish = resolve; });
  const app = printApp({ wait });
  const pending = app.update();
  await Promise.resolve();
  app.invalidate();
  finish();
  assert.equal(await pending, false);
  assert.equal(app.document.getElementById('print-area').querySelector('canvas'), null);
});

test('an obsolete render failure cannot clear a newer completed worksheet', async () => {
  let finish!: () => void;
  const options: { failure?: boolean; wait?: Promise<void> } = {
    wait: new Promise<void>(resolve => { finish = resolve; }),
  };
  const app = printApp(options);
  const old = app.update();
  await Promise.resolve();
  options.wait = undefined;
  assert.equal(await app.update(), true);
  options.failure = true;
  finish();
  assert.equal(await old, false);
  assert.equal(app.document.getElementById('print-area').querySelectorAll('canvas').length, 2);
  assert.ok(app.document.getElementById('print-area').querySelector('[data-answers="1"]'));
});

test('marked requests converted to compact output retain the actual opening button for focus return', async () => {
  const app = printApp({ sections: true });
  await app.prepare('marked');
  assert.equal(app.opened(), 1);
  assert.equal(app.opener(), app.document.getElementById('prepare'));
});

test('marked output retains every required page of real whole questions without copying marks onto context pages', () => {
  const render = new Function(`
    let SOURCE;
    const escapeHTML = value => String(value);
    ${['groupsOf', 'selectionMarkBox', 'sheetHTML', 'markedHTML'].map(definition).join('\n')}
    return markedHTML;
  `)();
  const catalog = JSON.parse(readFileSync(new URL('../public/teachers/teacher-catalog.json', import.meta.url), 'utf8'));
  const visited = new Set<string>();
  let continuationQuestions = 0;
  for (const grade of catalog.grades) for (const topic of grade.topics) for (const meta of topic.sheets) {
    if (visited.has(meta.pdfId)) continue;
    visited.add(meta.pdfId);
    const source = JSON.parse(readFileSync(new URL(`../public/teachers/sheets/${meta.pdfId}.json`, import.meta.url), 'utf8'));
    for (const question of source.questions) question.source = source;
    for (const number of new Set(source.questions.map((question: { q: number }) => question.q))) {
      const chosen = source.questions.filter((question: { q: number }) => question.q === number);
      const primaryPages = new Set<number>(chosen.map((question: { page: number }) => question.page));
      const requiredPages = new Set(primaryPages);
      for (const question of chosen) {
        const boxes = [...(question.rows?.length ? question.rows : [question.row]), question.stem].filter(Boolean);
        for (const box of boxes) requiredPages.add(box.page || question.page);
      }
      if (requiredPages.size === primaryPages.size) continue;
      continuationQuestions += 1;
      const { document } = parseHTML(`<html><body>${render(chosen)}</body></html>`);
      const stages = [...document.querySelectorAll<HTMLElement>('.source-stage')];
      assert.deepEqual(stages.map(stage => Number(stage.dataset.page)), [...requiredPages].sort((a, b) => a - b), `${meta.pdfId}:${number}`);
      for (const stage of stages) {
        const page = Number(stage.dataset.page);
        if (!primaryPages.has(page)) {
          assert.equal(stage.querySelectorAll('.source-mark').length, 0, `${meta.pdfId}:${number}: do not reuse primary-page mark coordinates on page ${page}`);
        }
      }
    }
  }
  assert.ok(continuationQuestions >= 20, 'Exercise the real continuation/shared-context cases, not only a synthetic page');
});
