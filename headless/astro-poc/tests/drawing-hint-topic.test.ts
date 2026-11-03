/**
 * Noam, 29.10.2026: a drawing hint (רמז בשרטוט) may appear only on a
 * geometry or analytic-geometry worksheet. Algebra, arithmetic, fractions,
 * equations, and every other topic must not offer one.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';
import { parseHTML } from 'linkedom';

const viewer = readFileSync(new URL('../public/worksheet-viewer-noam.html', import.meta.url), 'utf8');
const indexHtml = readFileSync(new URL('../../../index.html', import.meta.url), 'utf8');
const slice = (from: string, to: string) => {
  const start = viewer.indexOf(from);
  const end = viewer.indexOf(to, start + from.length);
  assert.ok(start >= 0 && end > start, from);
  return viewer.slice(start, end);
};
const topicFns = slice('var NOAM_DRAWING_HINT_GEOMETRY=', 'function noamCanOfferDrawing(');
const offerFns = slice('function noamCanOfferDrawing(', 'function noamConstructedVisual(');
const needFn = slice('function noamVisualNeed(', 'function noamRecentThreadText(');
const bubbleFns = slice('function setNoamDiagramButtonLabel(', 'function ensureNoamGlossaryPopover(');
const chatFns = slice('function noamLatestDrawingAnswer(', 'function localVisualExerciseSource(');

const catalogStart = indexHtml.indexOf('var DATA = {');
const catalogEnd = indexHtml.indexOf('/* ===================== מכאן ומטה');
const DATA = new Function(indexHtml.slice(catalogStart, catalogEnd) + '\nreturn DATA;')() as Record<string, { links: Record<number, { sourcePrefix?: string; sourceGrade?: number }>; topics: Array<{ id: number; x?: string; g: string; t: string }> }>;

/** Spec: catalog group, not a geometry word inside the hint text. */
const GRADE7_GEOMETRY = new Set([
  'G7-T11', 'G7-T12', 'G7-T13', 'G7-T14', 'G7-T15', 'G7-T16', 'G7-T17', 'G7-T18', 'G7-T19', 'G7-T20',
  'G7-T42', 'G7-T43', 'G7-T44', 'G7-T45', 'G7-T46', 'G7-T47', 'G7-T48',
]);
const GRADE8_BODY_GEOMETRY = new Set([
  'G8-T49', 'G8-T50', 'G8-T51', 'G8-T52', 'G8-T53', 'G8-T54', 'G8-T55', 'G8-T63',
]);

function expectedKind(topic: { x?: string; g: string; t: string }) {
  const prefix = topic.x || '';
  if (prefix === 'G9-T08' || (/ג(?:יאו|או)מטריה\s*אנליטית/.test(topic.t) && !prefix)) return 'analytic-geometry';
  if (topic.g === 'geo' || topic.g === 'spiral') return 'geometry';
  if (GRADE7_GEOMETRY.has(prefix) || GRADE8_BODY_GEOMETRY.has(prefix)) return 'geometry';
  if (prefix === 'G9-T33' || prefix === 'G9-T35') return 'geometry';
  return '';
}

function catalogSource(grade: number, topic: { id: number; x?: string; g: string; t: string }) {
  const row = DATA[grade].links[topic.id];
  const prefix = row?.sourcePrefix || topic.x!;
  const sourceTopic = row?.sourceGrade
    ? DATA[row.sourceGrade].topics.find((source) => source.x === prefix)
    : undefined;
  return { prefix, topic: sourceTopic || topic };
}

function pageApi(prefix: string, title: string) {
  return runInNewContext(topicFns + offerFns + needFn + '\n({noamDrawingHintTopic,noamPageAllowsDrawingHint,noamCanOfferDrawing,noamVisualNeed})', {
    manifest: { prefix, topic: title },
    x: prefix,
    ttl: title,
    window: { NoamLocalVisual: { wantsVisualSupport: () => true } },
    noamDiagramRuntime: () => ({ messages: new Map() }),
    noamRenderDrawingVisual: () => null,
    localVisualExerciseSource: () => 'ריבוע משולש משוואה ושבר',
    noamRecentThreadText: () => '',
    noamGeometryContext: () => true,
    noamNativeDataUrl: () => '/noam-ai/native/' + prefix + '/a/noam-ai.json',
    noamRenderAiDiagram: () => ({}),
    noamRenderGeometryGuide: () => ({}),
    noamRenderSourceVisual: () => ({}),
    noamRenderNativeFocus: () => ({}),
  });
}

const hintUser = { role: 'user', kind: 'רמז 1', text: 'אפשר רמז 1? סמן בשרטוט את הריבוע' };
const hintAnswer = { role: 'assistant', text: 'התבוננו בריבוע ובמשולש. אל תחשבו את התשובה.' };

test('catalog topics allow a drawing hint only for geometry and analytic geometry', () => {
  const api = pageApi('G8-T38', 'חפיפת משולשים');
  const seen = { geometry: 0, 'analytic-geometry': 0, denied: 0 };
  for (const grade of [7, 8, 9]) {
    for (const topic of DATA[grade].topics) {
      if (!topic.x) continue;
      // Declared reuse opens the original source worksheet and preserves its topic policy.
      const source = catalogSource(grade, topic);
      const expected = expectedKind(source.topic);
      const actual = api.noamDrawingHintTopic(source.prefix, topic.t);
      assert.equal(actual, expected, topic.x + ' ' + topic.t);
      if (expected) seen[expected as 'geometry' | 'analytic-geometry']++;
      else seen.denied++;
    }
  }
  assert.ok(seen.geometry >= 21, 'geometry topics stay allowed');
  assert.equal(seen['analytic-geometry'], 1);
  assert.ok(seen.denied > seen.geometry, 'most middle-school topics are not geometry');
});

test('a non-geometry page cannot show a drawing hint, even when the hint mentions a sketch or a square', () => {
  const blocked = [
    ['G8-T02', 'משוואות ליניאריות'],
    ['G7-T02', 'חיבור וחיסור מספרים מכוונים'],
    ['G7-T05', 'סדר פעולות החשבון במספרים מכוונים'],
    ['G7-T34', 'משוואות חד־שלביות'],
    ['G9-T04', 'צמצום שברים אלגבריים'],
    ['G9-T45', 'הפרש ריבועים'],
    ['G9-T31', 'משוואות ריבועיות ונוסחת השורשים'],
    ['G9-T06', 'הפונקציה הריבועית'],
    ['G8-T15', 'פונקציה קווית'],
    ['G8-T20', 'אחוזים — ייצוגים'],
    ['G9-T13', 'מעבר לחטיבה העליונה'],
  ];
  for (const [prefix, title] of blocked) {
    const api = pageApi(prefix, title);
    const thread = { messages: [hintUser, hintAnswer], history: [] };
    assert.equal(api.noamPageAllowsDrawingHint(), false, prefix);
    assert.equal(api.noamDrawingHintTopic(prefix, 'גיאומטריה אנליטית'), '', prefix + ' title spoof');
    assert.equal(api.noamCanOfferDrawing({ id: prefix }, thread, hintAnswer), false, prefix);
    assert.equal(api.noamCanOfferDrawing({ id: prefix }, thread, { ...hintAnswer, visual: { type: 'source-crop' } }), false, prefix + ' source crop');
    assert.equal(api.noamCanOfferDrawing({ id: prefix }, thread, { ...hintAnswer, visual: { type: 'ai-diagram' } }), false, prefix + ' failed diagram');
    assert.equal(api.noamVisualNeed('אפשר רמז בשרטוט', hintAnswer.text, 'hint', 1, title + ' משולש ריבוע'), false, prefix);
  }
});

test('geometry and analytic-geometry pages still offer a drawing hint', () => {
  for (const [prefix, title, kind] of [
    ['G8-T38', 'חפיפת משולשים', 'geometry'],
    ['G9-T46', 'דלתון', 'geometry'],
    ['G7-T14', 'סכום הזוויות במשולש ובמרובע', 'geometry'],
    ['G8-T49', 'פיתגורס', 'geometry'],
    ['G9-T33', 'גיאומטריה חישובית — משולש', 'geometry'],
    ['G9-T08', 'גיאומטריה אנליטית', 'analytic-geometry'],
  ] as const) {
    const api = pageApi(prefix, title);
    const thread = { messages: [hintUser, hintAnswer], history: [] };
    assert.equal(api.noamDrawingHintTopic(prefix, title), kind, prefix);
    assert.equal(api.noamPageAllowsDrawingHint(), true, prefix);
    assert.equal(api.noamCanOfferDrawing({ id: prefix }, thread, hintAnswer), true, prefix);
    assert.equal(api.noamVisualNeed('אפשר רמז 1?', hintAnswer.text, 'hint', 1, title), true, prefix);
  }
});

/** Render the actual composer and transcript; only visual assets and transport are doubles. */
function chatFixture(prefix: string, title: string) {
  const { document, window } = parseHTML('<html><body><button id="back"></button><main id="panel"></main></body></html>');
  const exercise = { id: prefix + '-A-Q01א', text: 'התבוננו בנתונים בשאלה.' };
  const message: any = { ...hintAnswer };
  const thread: any = { messages: [{ ...hintUser }, message], history: [], hintIndex: 1 };
  const runtime = { messages: new Map(), cache: new Map(), jobs: new Map() };
  const calls: unknown[] = [];
  const figure = (visual: any) => {
    if (visual.invalid) return null;
    const element = document.createElement('figure');
    element.className = 'noam-geometry';
    element.dataset.visualType = visual.type;
    return element;
  };
  const c: any = {
    document, window: { NoamLocalVisual: { wantsVisualSupport: () => true, render: figure } },
    selectedExercise: exercise, manifest: { prefix, topic: title, exercises: [exercise] }, x: prefix, ttl: title,
    panelBody: document.getElementById('panel'), panelBack: document.getElementById('back'),
    threads: { [exercise.id]: thread }, exerciseThread: () => thread, noamDrafts: {},
    busy: false, mathKeyboardOpen: false, activeGlossaryEntryId: null,
    localVisualExerciseSource: () => '', noamRecentThreadText: () => '', noamGeometryContext: () => true,
    noamNativeDataUrl: () => '/native', noamDiagramRuntime: () => runtime,
    noamRenderAiDiagram: figure, noamRenderGeometryGuide: figure, noamRenderSourceVisual: figure,
    noamRenderSourceCrop: figure, noamRenderNativeFocus: figure, noamRenderOriginalTable: figure,
    noamStripMarkdownEmphasis: (value: string) => value, esc: (value: string) => value,
    exerciseLabel: () => 'שאלה 1 · סעיף א', noamAddDiagramExpansion() {}, noamAppendSourceCropHelp() {}, noamAppendSourceDiagramHelp() {},
    hideNoamGlossaryPopover() {}, renderNoamAttachments() {}, locateSelectedExercise() {},
    noamKeepComposerFocusForSend() {},
    setNoamBusy() {}, renderNoamFractionMarkers() {}, renderPanelMath() {}, enhanceNoamGlossary() {},
    restoreNoamChatFocus() {}, renderExercisePreview() {}, saveNoamState() {},
  };
  runInNewContext(topicFns + offerFns + bubbleFns + chatFns, c);
  c.requestNoamDiagram = (_exercise: any, _thread: any, answer: any) => {
    calls.push(answer);
    answer.visual = { type: 'native-source-visual', exerciseId: exercise.id };
    c.renderNoamChat();
    return Promise.resolve(answer.visual);
  };
  return { c, document, window, exercise, message, thread, runtime, calls, render: () => c.renderNoamChat() };
}

const drawingTypes = [
  { type: 'source-crop' },
  { type: 'native-source-visual', presentation: 'source-context' },
  { type: 'native-source-visual', sourcePanelGroup: true },
  { type: 'geometry-guide' },
  { type: 'ai-diagram', plan: { version: 1 } },
  { type: 'ai-diagram', plan: { version: 2 } },
  { type: 'labeled-triangle' },
  { type: 'native-source-focus' },
];

function assertNoDrawingActions(document: any, label: string) {
  assert.equal(!!document.querySelector('#noamDraw'), false, label + ': composer button is absent, not disabled');
  assert.equal(!!document.querySelector('.noam-draw-action:not(.noam-diagram-expand)'), false, label + ': no inline retry/regeneration');
}

test('every catalog page renders the drawing control only on geometry, then removes it after one click', () => {
  const checked = { allowed: 0, blocked: 0 };
  for (const grade of [7, 8, 9]) for (const topic of DATA[grade].topics) {
    if (!topic.x) continue;
    const source = catalogSource(grade, topic);
    const f = chatFixture(source.prefix, topic.t);
    f.render();
    const button = f.document.getElementById('noamDraw');
    if (!expectedKind(source.topic)) {
      checked.blocked++;
      assertNoDrawingActions(f.document, topic.x);
      for (const visual of drawingTypes) {
        f.message.visual = { ...visual, exerciseId: f.exercise.id };
        f.render();
        assertNoDrawingActions(f.document, topic.x + ' saved ' + visual.type);
        assert.equal(!!f.document.querySelector('.noam-geometry'), false, topic.x + ': saved drawing stays suppressed');
      }
      assert.equal(f.calls.length, 0);
      continue;
    }
    checked.allowed++;
    assert.ok(button, topic.x + ': geometry offers one drawing');
    assert.equal(button!.hidden, false);
    button!.click();
    assert.equal(f.calls.length, 1, topic.x + ': one click starts one drawing');
    assertNoDrawingActions(f.document, topic.x);
    assert.equal(f.document.querySelectorAll('.noam-geometry').length, 1);
    button!.click();
    assert.equal(f.calls.length, 1, topic.x + ': stale click cannot generate again');
    f.thread.messages.push({ role: 'assistant', text: 'רמז נוסף לאותה השאלה.' });
    f.render();
    assertNoDrawingActions(f.document, topic.x + ' later hint');
    // Rehydrate the persisted transcript as a new set of objects, as after reload.
    f.thread.messages = JSON.parse(JSON.stringify(f.thread.messages));
    f.runtime.messages.clear();
    f.render();
    assertNoDrawingActions(f.document, topic.x + ' restored');
    assert.equal(f.document.querySelectorAll('.noam-geometry').length, 1);
  }
  assert.ok(checked.allowed > 20);
  assert.ok(checked.blocked > checked.allowed);
});

test('every permitted topic hides both drawing controls for every supported saved drawing type', () => {
  for (const grade of [7, 8, 9]) for (const topic of DATA[grade].topics) {
    if (!topic.x) continue;
    const source = catalogSource(grade, topic);
    if (!expectedKind(source.topic)) continue;
    for (const visual of drawingTypes) {
      const f = chatFixture(source.prefix, topic.t);
      f.message.visual = { ...visual, exerciseId: f.exercise.id };
      f.thread.messages.push({ role: 'assistant', text: 'המשיכו להתבונן באותו שרטוט.' });
      f.render();
      assertNoDrawingActions(f.document, topic.x + ' ' + visual.type);
      assert.equal(f.document.querySelectorAll('.noam-geometry').length, 1, topic.x + ' ' + visual.type);
    }
  }
});

test('saved duplicates keep one drawing and all answer text, with no regenerate action', () => {
  const f = chatFixture('G7-T17', 'שטחי מקבילית וטרפז');
  f.message.visual = { type: 'native-source-visual', exerciseId: f.exercise.id };
  f.thread.messages.push({ role: 'assistant', text: 'תשובה שנייה שנשמרה.', visual: { type: 'geometry-guide', exerciseId: f.exercise.id } });
  f.render();
  assert.equal(f.document.querySelectorAll('.noam-geometry').length, 1);
  assert.match(f.document.getElementById('noamTranscript')!.textContent!, /תשובה שנייה שנשמרה/);
  assertNoDrawingActions(f.document, 'saved duplicates');
});

test('a pending request disables drawing across later answers; failure restores a retry', () => {
  const f = chatFixture('G9-T08', 'גיאומטריה אנליטית');
  f.runtime.messages.set(f.message, Promise.resolve(null));
  f.thread.messages.push({ role: 'assistant', text: 'רמז נוסף.' });
  f.render();
  assert.equal((f.document.getElementById('noamDraw') as any)?.disabled, true);
  for (const button of f.document.querySelectorAll('.noam-draw-action:not(.noam-diagram-expand)')) {
    assert.equal((button as any).disabled, true, 'pending earlier answer disables every generation control');
  }
  f.runtime.messages.clear();
  f.message.diagramError = 'השרטוט עדיין לא מוכן.';
  f.render();
  assert.ok(f.document.getElementById('noamDraw'), 'failed first attempt remains retryable');
});

test('an invalid saved drawing is not treated as successfully rendered', () => {
  const f = chatFixture('G8-T38', 'חפיפת משולשים');
  f.message.visual = { type: 'ai-diagram', exerciseId: f.exercise.id, invalid: true };
  f.render();
  assert.equal(f.document.querySelectorAll('.noam-geometry').length, 0);
  assert.ok(f.document.getElementById('noamDraw'));
});
