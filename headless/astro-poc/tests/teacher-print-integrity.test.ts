import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { parseHTML } from 'linkedom';
import { buildTeacherReview, renderTeacherReview } from '../public/teachers/teacher-review-summary.js';
import { SECTION_KINDS, sectionKind } from '../public/teachers/teacher-page-sections.js';

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

type PrintOptions = {
  failure?: boolean; sections?: boolean; wait?: Promise<void>; review?: boolean;
  selection?: { catalog: object; sources: object[]; state?: object };
};

function printApp(options: PrintOptions = {}) {
  const { document } = parseHTML(`<html><body>
    <div id="dialog-plan"></div><div id="print-area"><canvas data-old="1"></canvas></div>
    <textarea id="teacher-ai-note"></textarea><textarea id="teacher-note"></textarea><button id="prepare"></button><button id="prepare-short"></button>
    <p id="prepare-hint"></p><div id="wizard-preview"></div><h2 id="print-title"></h2><p id="print-lead"></p><button id="print">הדפסה</button><dialog id="print-dialog"></dialog>
    ${options.review ? '<section id="wizard-review" hidden><div id="wizard-review-content"></div></section>' : ''}
  </body></html>`);
  return new Function('document', 'options', 'buildTeacherReview', 'renderTeacherReview', 'SECTION_KINDS', 'sectionKind', `
    const $ = id => document.getElementById(id);
    const state = { grade: '9', topic: '2', level: 'a', selected: ['ex:source:2'], blocks: [],
      sectionKind: 'review', scenario: 'first', style: 'first', pickMode: 'manual', ...options.selection?.state };
    let printGeneration = 0, printMode = 'marked', printOpener = null, rendering = false;
    const history = [], render = () => {};
    const assignWholeQuestions = () => { throw new Error('A manual goal change must not select new questions'); };
    const PRINT_UNPREPARED = '<p class="print-unprepared">יש להכין את הדף</p>';
    const sources = structuredClone(options.selection?.sources || [{ pdfId: 'source', title: 'דף', pdfUrl: '/source.pdf',
      grade: 9, gradeLabel: 'כיתה ט׳', level: 'a', questions: [{ id: '2', q: 2, part: '', page: 1 }] }]);
    const sheets = new Map(sources.map(source => [source.pdfId, source]));
    sources.forEach(source => source.questions.forEach(question => { question.source = source; }));
    const CATALOG = options.selection?.catalog || { grades: [{ grade: 9, label: 'כיתה ט׳', topics: [{ id: 2,
      title: 'נושא נוכחי', sheets: [{ pdfId: 'source', level: 'a' }] }] }] };
    const SCENARIOS = { first: { label: 'חזרה' }, practice: { label: 'תרגול וביסוס' } }, STYLES = { first: { label: 'משולבת', plan: '' } };
    const pageNeedsSections = () => Boolean(options.sections), metaHTML = () => '';
    const worksheetTitle = () => 'דף';
    const markedHTML = () => '<figure class="source-sheet"><div class="source-stage"><canvas></canvas></div></figure>';
    const paintSheets = async () => {};
    const noteBandMm = async () => 12;
    const awaitPrintResources = async () => {
      if (options.wait) await options.wait;
      if (options.failure) throw Object.assign(new Error('חסרות תשובות סופיות'), { code: 'MISSING_ANSWERS' });
    };
    const answerMeasured = async groups => {
      assertGroups = groups;
      await awaitPrintResources();
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
    const printInputs = [];
    const paintAllShort = async (root, chosen, blocks) => {
      printInputs.push({ chosen, blocks, planText: root.parentElement?.textContent || '' });
      await awaitPrintResources();
      root.innerHTML = '<figure class="crop-sheet"><canvas></canvas></figure><figure class="crop-sheet" data-answers="1"><canvas></canvas></figure>';
    };
    const notices = [];
    const announce = message => notices.push(message);
    let opened = 0;
    ['prepare-hint', 'dialog-plan', 'wizard-preview'].forEach(id => { $(id).focus = () => {}; });
    $('print-dialog').showModal = () => { opened += 1; };
    ${['exKey', 'gradeRecord', 'currentTopic', 'topicSheets', 'currentExercises', 'visibleSelectionKeys', 'available',
      'sourceForContext', 'questionsForKeys', 'pageBlocks', 'resolveChosen', 'partRank', 'levelPrintName', 'orderPrintQuestions',
      'escapeHTML', 'groupsOf', 'paintPacked', 'teacherNoteHTML', 'attachTeacherNote', 'updateShortPrint',
      'clearPreparedPrint', 'copyCanvases', 'paintTeacherReview', 'updatePrint', 'reportPrintError', 'prepare',
      'selectionKey', 'snapshot', 'applyScenario'].map(definition).join('\n')}
    return { document, state, notices, update: updatePrint, prepare, report: reportPrintError, invalidate: clearPreparedPrint, applyScenario,
      opener: () => printOpener, opened: () => opened, groups: () => assertGroups, printInputs,
      mode: value => { printMode = value; } };
  `)(document, options, buildTeacherReview, renderTeacherReview, SECTION_KINDS, sectionKind);
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

for (const mode of ['marked', 'short']) {
  test(`${mode} printing and the review show only complete student instructions, never private AI guidance`, async () => {
    const app = printApp({ review: true });
    app.state.wizard = 'result';
    app.mode(mode);
    const privateGuidance = 'AI_ONLY_PRIVATE_GUIDANCE_DO_NOT_PRINT';
    const studentInstructions = 'STUDENT_ONLY_' + 'א'.repeat(450) + '\n  <b>הסבירו את הדרך</b>';
    app.document.getElementById('teacher-ai-note').value = privateGuidance;
    app.document.getElementById('teacher-note').value = `  ${studentInstructions}\n`;
    assert.equal(await app.update(), true);
    const printArea = app.document.getElementById('print-area');
    const review = app.document.getElementById('wizard-review');
    assert.equal(review.hidden, false);
    assert.equal(review.querySelector('.teacher-review-note').textContent, studentInstructions);
    assert.equal(printArea.querySelector('.teacher-print-note p').textContent, studentInstructions);
    assert.ok(printArea.querySelector('[data-answers="1"]'), 'Instructions stay in the one worksheet with final answers');
    for (const id of ['dialog-plan', 'print-area', 'wizard-review']) {
      const surface = app.document.getElementById(id);
      assert.ok(surface.textContent.includes(studentInstructions), `${id}: keep the full printed text`);
      assert.equal(surface.textContent.includes(privateGuidance), false, `${id}: AI guidance is not student-facing`);
      assert.equal(surface.querySelector('b'), null, `${id}: instructions remain escaped text`);
    }

    app.document.getElementById('teacher-note').value = '';
    assert.equal(await app.update(), true);
    assert.equal(printArea.querySelector('.teacher-print-note'), null, 'Empty student instructions never fall back to AI guidance');
    assert.equal(review.querySelector('.teacher-review-note').textContent, 'לא נוספו הוראות לתלמיד');
    for (const id of ['dialog-plan', 'print-area', 'wizard-review']) {
      assert.equal(app.document.getElementById(id).textContent.includes(privateGuidance), false);
    }
  });
}

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

function reviewSelection() {
  return {
    catalog: { grades: [
      { grade: 7, label: 'כיתה ז׳', topics: [{ id: 1, title: 'נושא שמור', sheets: [{ pdfId: 'shared', level: 'c' }] }] },
      { grade: 9, label: 'כיתה ט׳', topics: [{ id: 2, title: 'נושא נוכחי', sheets: [
        { pdfId: 'shared', level: 'b' }, { pdfId: 'current', level: 'a' },
      ] }] },
    ] },
    sources: [
      { pdfId: 'shared', pdfUrl: '/shared.pdf', grade: 4, gradeLabel: 'כיתה ד׳', topic: 'הקשר מהמטמון', level: 'a', questions: [
        { id: '1א', q: 1, part: 'א', page: 1 }, { id: '1ב', q: 1, part: 'ב', page: 1 },
      ] },
      { pdfId: 'current', pdfUrl: '/current.pdf', grade: 9, level: 'c', questions: [
        { id: '2א', q: 2, part: 'א', page: 1 }, { id: '2ב', q: 2, part: 'ב', page: 1 },
        { id: '3', q: 3, part: '', page: 2 },
      ] },
      { pdfId: 'hidden', pdfUrl: '/hidden.pdf', questions: [{ id: '9', q: 9, part: '', page: 1 }] },
    ],
    state: {
      grade: '9', topic: '2', level: 'all', wizard: 'result',
      blocks: [{ grade: '7', topic: '1', title: 'נושא שמור', kind: 'test', keys: ['ex:shared:1א', 'ex:shared:1ב'] }],
      // Include a saved key, a repeated current key and an out-of-scope key:
      // the shipped gathering functions must resolve all three before review.
      selected: ['ex:shared:1א', 'ex:current:2א', 'ex:current:2א', 'ex:current:2ב', 'ex:current:3', 'ex:hidden:9'],
    },
  };
}

test('review and printing consume the same scoped saved/current selection and full printed note before PDF work completes', async () => {
  let finish!: () => void;
  const app = printApp({ review: true, selection: reviewSelection(), wait: new Promise<void>(resolve => { finish = resolve; }) });
  app.mode('short');
  const note = 'הוראות מקוריות '.repeat(34) + '<b>סיום</b>';
  assert.ok(note.length > 400, 'The printed note must not use the shorter AI-note limit');
  app.document.getElementById('teacher-note').value = `  ${note}\n `;
  const pending = app.update();
  await Promise.resolve();
  const panel = app.document.getElementById('wizard-review');
  const content = app.document.getElementById('wizard-review-content');
  assert.equal(panel.hidden, false, 'The choice summary is available while PDFs are still loading');
  assert.equal(app.document.getElementById('print-area').querySelector('canvas'), null);
  const input = app.printInputs[0];
  assert.deepEqual(input.chosen.map((question: any) => `${question.source.pdfId}:${question.id}`),
    ['shared:1א', 'shared:1ב', 'current:2א', 'current:2ב', 'current:3']);
  assert.deepEqual(input.blocks.map((block: any) => [block.title, block.kind, block.questions.length]),
    [['נושא שמור', 'test', 2], ['נושא נוכחי', 'review', 3]]);
  const facts = Object.fromEntries([...content.querySelectorAll('dt')].map((term: any) => [term.textContent, term.nextElementSibling.textContent]));
  assert.deepEqual(facts, { כיתות: 'כיתה ז׳ · כיתה ט׳', שאלות: '3 שאלות', סעיפים: '4 סעיפים', מטרה: 'חזרה', גישה: 'משולבת' });
  const sections = [...content.querySelectorAll('.teacher-review-section')];
  assert.deepEqual(sections.map((section: any) => section.querySelector('h4').textContent), ['נושא שמור', 'נושא נוכחי']);
  assert.match(sections[0].textContent, /קטע ממבחן · כיתה ז׳ · מצוינות · שאלה אחת · 2 סעיפים/);
  assert.match(sections[1].textContent, /דף חזרה · כיתה ט׳ · רמה א׳ · 2 שאלות · 2 סעיפים/);
  assert.doesNotMatch(content.textContent, /כיתה ד׳|הקשר מהמטמון|רמה ב׳/);
  assert.ok(input.planText.includes(note), 'The detached print preview already uses the same full student instructions');
  assert.equal(content.querySelector('.teacher-review-note').textContent, note);
  assert.equal(content.querySelector('b'), null, 'The printed note is represented as text, not markup');
  finish();
  assert.equal(await pending, true);
  assert.equal(panel.hidden, false);
  assert.equal(app.document.getElementById('print-area').querySelector('.teacher-review-facts'), null);
});

test('missing answers retain the resolved review while preventing worksheet output', async () => {
  const app = printApp({ review: true, failure: true });
  app.state.wizard = 'result';
  await app.prepare('short');
  const panel = app.document.getElementById('wizard-review');
  assert.equal(panel.hidden, false);
  assert.match(panel.textContent, /נושא נוכחי/);
  assert.match(panel.textContent, /ללא סעיפים נפרדים/);
  assert.match(app.document.getElementById('wizard-preview').textContent, /חסרות תשובות סופיות/);
  assert.equal(app.opened(), 0);
  assert.equal(app.document.getElementById('print-area').querySelector('canvas'), null);
  app.invalidate(true);
  assert.equal(panel.hidden, false, 'A print-error invalidation may preserve the valid choice summary');
});

test('selection invalidation hides the review and an older pending PDF render cannot restore it', async () => {
  let finish!: () => void;
  const app = printApp({ review: true, wait: new Promise<void>(resolve => { finish = resolve; }) });
  app.state.wizard = 'result';
  app.mode('short');
  const pending = app.update();
  await Promise.resolve();
  const panel = app.document.getElementById('wizard-review');
  assert.equal(panel.hidden, false);
  app.state.selected = [];
  app.invalidate();
  assert.equal(panel.hidden, true);
  finish();
  assert.equal(await pending, false);
  assert.equal(panel.hidden, true);
  assert.equal(app.document.getElementById('print-area').querySelector('canvas'), null);
});

test('a companion goal change invalidates the open review and print even when manual question IDs remain unchanged', async () => {
  const app = printApp({ review: true, selection: reviewSelection() });
  app.mode('short');
  assert.equal(await app.update(), true);
  const panel = app.document.getElementById('wizard-review');
  const printArea = app.document.getElementById('print-area');
  const selection = JSON.stringify({ selected: app.state.selected, blocks: app.state.blocks });
  assert.equal(panel.hidden, false);
  assert.ok(printArea.querySelector('canvas'));
  app.applyScenario('first', { quiet: true });
  assert.equal(panel.hidden, false, 'Reapplying the unchanged manual goal preserves a valid review');
  assert.ok(printArea.querySelector('canvas'));

  // noam-teacher-option calls this shipped function while the result step can
  // remain open; changing its goal must not depend on changing selected IDs.
  app.applyScenario('practice');
  assert.equal(app.state.wizard, 'result');
  assert.equal(app.state.scenario, 'practice');
  assert.equal(JSON.stringify({ selected: app.state.selected, blocks: app.state.blocks }), selection);
  assert.equal(panel.hidden, true, 'The old goal must no longer be presented as the current review');
  assert.equal(printArea.querySelector('canvas'), null, 'The old prepared output is invalidated too');
  assert.equal(await app.update(), true);
  const goal = [...panel.querySelectorAll('dt')].find((term: any) => term.textContent === 'מטרה');
  assert.equal(goal.nextElementSibling.textContent, 'תרגול וביסוס');
  assert.equal(panel.hidden, false);
});

test('empty or unavailable selections hide an earlier review instead of presenting it as the current choice', async () => {
  for (const unavailable of [false, true]) {
    const app = printApp({ review: true });
    app.state.wizard = 'result';
    app.mode('short');
    assert.equal(await app.update(), true);
    const panel = app.document.getElementById('wizard-review');
    assert.equal(panel.hidden, false);
    if (unavailable) app.state.topic = 'missing';
    else app.state.selected = [];
    assert.equal(await app.update(), false);
    assert.equal(panel.hidden, true);
    assert.equal(app.document.getElementById('print-area').querySelector('canvas'), null);
  }
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
