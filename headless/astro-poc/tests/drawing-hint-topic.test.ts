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

function pageApi(prefix: string, title: string) {
  return runInNewContext(topicFns + offerFns + needFn + '\n({noamDrawingHintTopic,noamPageAllowsDrawingHint,noamCanOfferDrawing,noamVisualNeed})', {
    manifest: { prefix, topic: title },
    x: prefix,
    ttl: title,
    window: { NoamLocalVisual: { wantsVisualSupport: () => false } },
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
      const row = DATA[grade].links[topic.id];
      const sourcePrefix = row?.sourcePrefix || topic.x;
      const sourceTopic = row?.sourceGrade
        ? DATA[row.sourceGrade].topics.find((source) => source.x === sourcePrefix)
        : undefined;
      const expected = expectedKind(sourceTopic || topic);
      const actual = api.noamDrawingHintTopic(sourcePrefix, topic.t);
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

test('the transcript drawing-hint button is absent on algebra and present on geometry', () => {
  function render(prefix: string, title: string) {
    const { document } = parseHTML('<html><body><div id="host"></div></body></html>');
    const host = document.getElementById('host')!;
    const message = { ...hintAnswer };
    const thread = { messages: [hintUser, message], history: [] };
    const ctx: Record<string, unknown> = {
      document,
      selectedExercise: { id: prefix },
      manifest: { prefix, topic: title },
      x: prefix,
      ttl: title,
      window: { NoamLocalVisual: { wantsVisualSupport: () => false } },
      localVisualExerciseSource: () => '',
      noamRecentThreadText: () => '',
      noamGeometryContext: () => true,
      noamNativeDataUrl: () => '/native',
      noamRenderAiDiagram: () => ({}),
      noamRenderGeometryGuide: () => ({}),
      noamRenderSourceVisual: () => ({}),
      noamRenderNativeFocus: () => ({}),
      noamDiagramRuntime: () => ({ messages: new Map() }),
      noamStripMarkdownEmphasis: (value: string) => value,
      noamVisualCanExpand: () => false,
      requestNoamDiagram() { throw new Error('algebra must not request a drawing hint'); },
    };
    runInNewContext(topicFns + offerFns + bubbleFns, ctx);
    (ctx.addTranscriptBubble as Function)(host, 'assistant', message.text, '', null, message, thread);
    return host;
  }
  const algebra = render('G9-T45', 'הפרש ריבועים');
  assert.equal(algebra.querySelector('.noam-draw-action'), null);
  assert.equal(algebra.querySelector('#noamDraw'), null);
  assert.doesNotMatch(algebra.textContent || '', /שרטוט להמחשה|רמז בשרטוט/);
  const geometry = render('G8-T38', 'חפיפת משולשים');
  const button = geometry.querySelector('.noam-draw-action');
  assert.ok(button);
  assert.match(button!.textContent || '', /שרטוט להמחשה/);
});

test('the compose control #noamDraw stays hidden unless the page topic allows a drawing hint', () => {
  assert.match(viewer, /id="noamDraw"'\+\(\(drawingAnswer&&drawingHintsAllowed\)/);
  assert.match(viewer, /if\(!drawingHintsAllowed\|\|busy\|\|!drawingAnswer/);
  assert.match(viewer, /if\(typeof noamPageAllowsDrawingHint==='function'&&!noamPageAllowsDrawingHint\(\)\)\{return Promise\.resolve\(null\);\}/);
  assert.match(viewer, /if\(typeof noamPageAllowsDrawingHint==='function'&&!noamPageAllowsDrawingHint\(\)\)\{return Promise\.resolve\(null\);\}\s*if\(!window\.NoamNativeVisual/);
});

test('the twelve first567 geometry editions offer drawing hints in both viewer mirrors', () => {
  const ready = JSON.parse(readFileSync(new URL('../../../headless/catalog/worksheet-ramzi-ready.v1.json', import.meta.url), 'utf8'));
  const prefixes = ['G7-T86', 'G8-T84', 'G8-T87', 'G9-T85'];
  assert.equal(ready.units.length, 12);
  for (const prefix of prefixes) assert.deepEqual(ready.units.filter((u: any) => u.prefix === prefix).map((u: any) => u.level), ['a', 'b', 'c']);
  for (const path of ['../public/worksheet-viewer-noam.html', '../../../worksheet-viewer-noam.html']) {
    const html = readFileSync(new URL(path, import.meta.url), 'utf8');
    const policy = html.slice(html.indexOf('var NOAM_DRAWING_HINT_GEOMETRY='), html.indexOf('function noamConstructedVisual('));
    for (const unit of ready.units) {
      const manifest = JSON.parse(readFileSync(new URL('../public/noam-ai/manifests/' + unit.pdfId + '.json', import.meta.url), 'utf8'));
      assert.ok(prefixes.includes(manifest.prefix)); assert.equal(manifest.prefix, unit.prefix);
      const api = runInNewContext(policy + '\n({noamPageAllowsDrawingHint,noamCanOfferDrawing})', {
        manifest, x: 'G8-T02', ttl: 'unrelated URL title',
        window: { NoamLocalVisual: { wantsVisualSupport: () => true } },
        noamMessageVisualOptions: () => ({ helpKind: 'hint', studentMessage: 'אפשר רמז 1?' }),
        localVisualExerciseSource: () => '', noamRecentThreadText: () => '',
        noamNativeDataUrl: () => manifest.nativeExportUrl, noamGeometryContext: () => true,
      });
      const message = { role: 'assistant', text: 'התבוננו בנתונים המקוריים.', preparedHint: true };
      assert.equal(api.noamPageAllowsDrawingHint(), true, unit.prefix + '/' + unit.level);
      assert.equal(api.noamCanOfferDrawing(manifest.exercises[0], { messages: [hintUser, message] }, message), true);
    }
  }
});

test('unreviewed native identities stay denied despite analytic titles and explicit drawing requests', () => {
  for (const prefix of ['G7-T02', 'G8-T02', 'G9-T45', 'G9-T88', 'G9-T89', 'G9-T90', 'G9-T99']) {
    const api = pageApi(prefix, 'גיאומטריה אנליטית');
    const message = { ...hintAnswer, diagramOptions: { studentMessage: 'סמן בשרטוט את הנקודה A' } };
    assert.equal(api.noamPageAllowsDrawingHint(), false, prefix);
    assert.equal(api.noamCanOfferDrawing({ id: prefix }, { messages: [hintUser, message] }, message), false, prefix);
    assert.equal(api.noamVisualNeed('סמן בשרטוט את הנקודה A', message.text, 'hint', 1, 'גיאומטריה'), false, prefix);
  }
});

test('the narrow addition preserves the historical helper title fallback without admitting invalid viewer IDs', () => {
  for (const prefix of ['', 'not-a-prefix']) {
    const api = pageApi(prefix, 'גיאומטריה אנליטית');
    // Existing helper behavior, not a new authorization path: the real viewer
    // requires a numbered x and binds it to the manifest before enabling hints.
    assert.equal(api.noamDrawingHintTopic(prefix, 'גיאומטריה אנליטית'), 'analytic-geometry');
    assert.equal(api.noamDrawingHintTopic(prefix, 'אלגברה'), '');
    assert.equal(/^G[1-9]-T\d{2}$/.test(prefix), false);
  }
});
