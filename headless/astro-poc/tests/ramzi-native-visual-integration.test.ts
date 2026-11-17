import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { it } from 'node:test';
import { parseHTML } from 'linkedom';

const viewer = readFileSync(new URL('../public/worksheet-viewer-noam.html', import.meta.url), 'utf8');
const sourceModule = readFileSync(new URL('../public/noam-native-visual.js', import.meta.url), 'utf8');
const authoredModule = readFileSync(new URL('../public/noam-authored-visual.js', import.meta.url), 'utf8');

// Actual first-release packages, with static fetches only. This exercises the
// page gate and real source-first renderer, not a substitute drawing function.
it('all twelve first567 units reach source focus and preserve prepared text and source SVG', async () => {
  const ready = JSON.parse(readFileSync(new URL('../../../headless/catalog/worksheet-ramzi-ready.v1.json', import.meta.url), 'utf8'));
  assert.equal(ready.units.length, 12);
  for (const viewerPath of ['../public/worksheet-viewer-noam.html', '../../../worksheet-viewer-noam.html']) {
    const html = readFileSync(new URL(viewerPath, import.meta.url), 'utf8');
    const take = (start: string, end: string) => html.slice(html.indexOf(start), html.indexOf(end, html.indexOf(start) + start.length));
    const policy = take('var NOAM_DRAWING_HINT_GEOMETRY=', 'function noamCanOfferDrawing(');
    const native = take('var noamSourceVisualPackages=', 'function noamNativeFigure(');
    const request = take('function requestNoamDiagram(', 'function noamVisualAnswer(');
    for (const unit of ready.units) {
      const manifest = JSON.parse(readFileSync(new URL('../public/noam-ai/manifests/' + unit.pdfId + '.json', import.meta.url), 'utf8'));
      const exercise = manifest.exercises.find((e: any) => e.q === 1 && e.part === 'א');
      assert.ok(exercise?.nativeFigureUrl, unit.prefix + '/' + unit.level);
      const body = readFileSync(new URL('../public' + manifest.nativeExportUrl, import.meta.url), 'utf8');
      const data = JSON.parse(body), originalSvg = readFileSync(new URL('../public' + exercise.nativeFigureUrl, import.meta.url), 'utf8');
      const point = unit.prefix === 'G8-T87' ? 'S' : 'A';
      const answer = unit.prefix === 'G7-T86' && unit.level === 'a' ? 'התבוננו בקטע AB.' : 'התבוננו בנקודה ' + point + '.';
      const options = { answer, studentMessage: 'אפשר רמז 1?', helpKind: 'hint' };
      const { document, window } = parseHTML('<html><body></body></html>');
      const message: any = { role: 'assistant', text: answer, preparedHint: true };
      const thread = { messages: [message], history: [] };
      const calls: string[] = [], runtime = { messages: new Map(), jobs: new Map(), cache: new Map() };
      const c: any = { document, window, manifest, selectedExercise: exercise, Map, WeakMap, WeakSet, Promise,
        noamDiagramSourceIdentity: (e: any) => manifest.pdfHash + ':' + e.id,
        noamDiagramRuntime: () => runtime, noamDiagramRefresh() {}, saveNoamState() {}, renderNoamChat() {},
        noamMessageVisualOptions: () => options, noamSourceCropRequested: () => false, noamNativeFocusUrl: () => null,
        noamConstructedVisual: () => { throw new Error('source-first focus must not fall through'); },
        fetch: async (url: string) => {
          calls.push(url); assert.ok([manifest.nativeExportUrl, exercise.nativeFigureUrl].includes(url), url);
          return { ok: true, json: async () => data, text: async () => originalSvg };
        },
      };
      runInNewContext(sourceModule + '\n' + native + '\n' + policy + '\n' + request, c);
      (window as any).NoamNativeVisual = c.NoamNativeVisual;
      assert.equal(c.noamPageAllowsDrawingHint(), true);
      const visual = await c.requestNoamDiagram(exercise, thread, message, options);
      assert.equal(visual.type, 'native-source-visual', unit.prefix + '/' + unit.level);
      assert.equal(visual.presentation, 'source-focus');
      const figure = c.noamRenderSourceVisual(visual);
      assert.ok(figure?.querySelector('[data-role="focus-point"], line, path'), unit.prefix + '/' + unit.level);
      assert.equal(figure.querySelector('image').getAttribute('href'), exercise.nativeFigureUrl);
      assert.equal(message.text, answer); assert.equal(message.preparedHint, true); assert.equal(thread.history.length, 0);
      assert.deepEqual(calls, [manifest.nativeExportUrl, exercise.nativeFigureUrl]);
      assert.equal(JSON.stringify(data), JSON.stringify(JSON.parse(body)), 'source unchanged');
      for (const prefix of ['G8-T02', 'G9-T99', 'G9-T88', 'G9-T89', 'G9-T90']) {
        c.manifest = { ...manifest, prefix, topic: 'גיאומטריה אנליטית' };
        const before = calls.length;
        assert.equal(await c.requestNoamDiagram(exercise, thread, message, { ...options, studentMessage: 'סמן בשרטוט את הנקודה A' }), null);
        assert.equal(calls.length, before);
      }
    }
  }
});
const helper = 'var noamSourceVisualPackages=' + viewer.split('var noamSourceVisualPackages=')[1].split('function noamNativeFigure(')[0];
function fn(name: string) {
  const text = viewer.slice(viewer.indexOf('function ' + name + '('));
  return text.slice(0, text.indexOf('\nfunction ', 1));
}
const refresh = fn('noamDiagramCurrent') + '\n' + fn('noamDiagramRefresh');
const data = JSON.parse(readFileSync(new URL('../public/noam-ai/native/G8-T15/a/noam-ai.json', import.meta.url), 'utf8'));
const svg = readFileSync(new URL('../public/noam-ai/native/G8-T15/a/figures/q2a.svg', import.meta.url), 'utf8');
const opts = { answer: 'שים לב לנקודה (0,-9) ולציר y.', studentMessage: 'אפשר רמז 1?', helpKind: 'hint' };
const ex = { id: 'G8-T15-A-Q02א', part: 'א', nativeQuestionId: 'q2', nativeItemId: 'q2a', nativeFigureId: 'q2a',
  nativeFigureUrl: '/noam-ai/native/G8-T15/a/figures/q2a.svg' };
function fixture(fetcher?: (url: string, fallback: () => any) => any) {
  const { document, window } = parseHTML('<html><body></body></html>');
  const calls: string[] = [], fallback: any[] = [], runtime = { messages: new Map() };
  const message: any = { role: 'assistant', text: opts.answer }, thread: any = { messages: [message], history: [] };
  const exercise = { ...ex }, manifest = { nativeExportUrl: '/noam-ai/native/G8-T15/a/noam-ai.json', nativeExportSha256: 'version-1', exercises: [exercise] };
  const c: any = { document, window, manifest, selectedExercise: exercise, Map, WeakSet, Promise,
    noamNativeFocusUrl: () => manifest.nativeExportUrl,
    noamDiagramSourceIdentity: (e: any) => e.id + ':pdf-v1', noamDiagramRuntime: () => runtime,
    noamMessageVisualOptions: () => opts, exerciseThread: () => thread,
    renderCount: 0, savedCount: 0, renderNoamChat: () => { c.renderCount++; }, saveNoamState: () => { c.savedCount++; }, announceNoam() {},
    fetch: async (url: string) => { calls.push(url); const result = () => ({ ok: true, json: async () => data, text: async () => svg }); return fetcher ? fetcher(url, result) : result(); },
    requestNoamDiagram: async (...args: any[]) => { fallback.push(args); return 'protected-fallback'; }
  };
  runInNewContext(sourceModule + '\n' + helper + '\n' + refresh, c);
  window.NoamNativeVisual = c.NoamNativeVisual;
  return { c, calls, fallback, exercise, message, thread, runtime };
}
async function flush() { for (let i = 0; i < 12; i++) await Promise.resolve(); }

it('real native drawing request resolves from static sources without protected generation', async () => {
  const f = fixture();
  const result = await f.c.noamRequestSourceFirst(f.exercise, f.thread, f.message, opts);
  assert.equal(result.type, 'native-source-visual'); assert.equal(result.presentation, 'source-focus');
  assert.equal(f.fallback.length, 0);
  assert.ok(f.calls.every(url => url.startsWith('/noam-ai/native/')));
  assert.equal(f.message.visual, result); assert.equal(f.runtime.messages.size, 0);
  assert.ok(f.c.noamRenderSourceVisual(result).querySelector('[data-role="focus-point"]'));
});

it('typed Send path creates transcript and completes the native request from an empty conversation', async () => {
  const f = fixture(); f.thread.messages.length = 0;
  f.c.busy = false; f.c.noamDrafts = {}; f.c.noamConstructedVisual = () => null; f.c.noamParsedLocalVisual = () => null;
  f.c.noamSourceCropRequested = () => false;
  const local = readFileSync(new URL('../public/noam-local-visual.js', import.meta.url), 'utf8');
  runInNewContext(local + '\n' + fn('noamMessageVisualOptions') + '\n' + fn('tryNoamLocalVisual') + '\n' + fn('requestNoamDiagram'), f.c);
  f.c.window.NoamLocalVisual = f.c.NoamLocalVisual; f.c.window.NoamDiagramPlan = {};
  assert.equal(f.c.tryNoamLocalVisual('תראה לי את הנקודה (0,-9) ואת ציר y'), true);
  assert.equal(f.thread.messages.length, 2);
  const message = f.thread.messages[1]; await f.runtime.messages.get(message);
  assert.equal(message.visual.presentation, 'source-focus');
  assert.equal(f.thread.messages[0].text, 'תראה לי את הנקודה (0,-9) ואת ציר y');
  assert.ok(f.c.renderCount > 0);
});

it('direct highlight/show imperatives route visually without intercepting ordinary mathematical questions', () => {
  const c: any = {};
  runInNewContext(readFileSync(new URL('../public/noam-local-visual.js', import.meta.url), 'utf8'), c);
  for (const request of ['סמן את A', 'סמני את הנקודה B', 'הדגש את ציר y', 'הראה את הזווית ABC', 'בבקשה הצג את הקטע AB']) {
    assert.equal(c.NoamLocalVisual.wantsVisualSupport(request), true, request);
  }
  for (const request of ['מה השיפוע?', 'איך מחשבים את השטח?', 'מדוע הסימון הזה נכון?', 'איך יודעים ש-AB שווה ל-CD?']) {
    assert.equal(c.NoamLocalVisual.wantsVisualSupport(request), false, request);
  }
});

it('duplicate pending drawing clicks share one request and do not produce repeated protected calls', async () => {
  const f = fixture();
  const p = f.c.noamRequestSourceFirst(f.exercise, f.thread, f.message, opts);
  assert.equal(f.c.noamRequestSourceFirst(f.exercise, f.thread, f.message, opts), p);
  await p; assert.equal(f.calls.length, 2); assert.equal(f.fallback.length, 0);
});

it('typed request keeps its own point and transcript labels source-context honestly', async () => {
  const f = fixture(); f.message.diagramTyped = true;
  await f.c.noamRequestSourceFirst(f.exercise, f.thread, f.message, { ...opts, helpKind: 'free_question', studentMessage: 'סמן את (2,1)' });
  const figure = f.c.noamRenderSourceVisual(f.message.visual);
  assert.equal(figure.querySelector('[data-role="focus-point"]').getAttribute('cx'), '60.15');
  assert.equal(f.thread.history.length, 2); assert.equal(f.message.diagramTyped, undefined);
  const g = fixture(); g.message.diagramTyped = true;
  await g.c.noamRequestSourceFirst(g.exercise, g.thread, g.message, { helpKind: 'free_question', studentMessage: 'הראה את השרטוט המקורי' });
  assert.equal(g.message.visual.presentation, 'source-context'); assert.match(g.message.text, /המקורי.*לא נוספה/);
});

it('unhandled current request falls back once with nativeAttempted, preserving scope', async () => {
  const f = fixture(); const request = { ...opts, helpKind: 'free_question', studentMessage: 'בנה מעגל חדש' };
  const result = await f.c.noamRequestSourceFirst(f.exercise, f.thread, f.message, request);
  assert.equal(result, 'protected-fallback'); assert.equal(f.fallback.length, 1);
  assert.equal(f.fallback[0][3].nativeAttempted, true);
  assert.equal(f.fallback[0][3].studentMessage, request.studentMessage);
  assert.equal(f.message.visual, undefined);
});

it('saved visuals rehydrate from fresh source and reject a changed package identity', async () => {
  const f = fixture(), visual = await f.c.noamPrepareSourceVisual(f.exercise, opts);
  const stored = JSON.parse(JSON.stringify(visual)); stored.svgText = '<script>ignored()</script>'; stored.coordinates = [[999,999]];
  const g = fixture(); assert.equal(g.c.noamRenderSourceVisual(stored), null); await flush();
  assert.ok(g.c.noamRenderSourceVisual(stored).querySelector('[data-role="focus-point"]'));
  assert.equal(g.calls.length, 2);
  g.c.manifest.nativeExportSha256 = 'version-2';
  assert.equal(g.c.noamRenderSourceVisual(stored), null); assert.equal(g.calls.length, 2);
});

it('section switching preserves the original result without rendering the new section', async () => {
  let release!: () => void; const wait = new Promise<void>(r => { release = r; });
  const f = fixture(async (_url, fallback) => { await wait; return fallback(); });
  const p = f.c.noamRequestSourceFirst(f.exercise, f.thread, f.message, opts);
  const before = f.c.renderCount; f.c.selectedExercise = { id: 'other-section' }; release();
  await p; assert.ok(f.message.visual); assert.equal(f.c.renderCount, before);
});

it('deleted messages or a changed source cannot receive an old visual or start fallback generation', async () => {
  for (const change of ['delete', 'source']) {
    let release!: () => void; const wait = new Promise<void>(r => { release = r; });
    const f = fixture(async (_url, fallback) => { await wait; return fallback(); });
    const p = f.c.noamRequestSourceFirst(f.exercise, f.thread, f.message, opts);
    if (change === 'delete') f.thread.messages.length = 0; else f.c.manifest.nativeExportSha256 = 'changed';
    release(); await p;
    assert.equal(f.message.visual, undefined); assert.equal(f.fallback.length, 0); assert.equal(f.runtime.messages.size, 0);
  }
});

it('automatic hint attachment adds focus, but never automatically attaches source-only context', async () => {
  const f = fixture(); await f.c.noamAttachSourceHint(f.exercise, f.thread, f.message, opts);
  assert.equal(f.message.visual.presentation, 'source-focus'); assert.equal(f.fallback.length, 0);
  const g = fixture(); await g.c.noamAttachSourceHint(g.exercise, g.thread, g.message, { ...opts, answer: 'חשבו מה נתון בשאלה.' });
  assert.equal(g.message.visual, undefined); assert.equal(g.fallback.length, 0);
});

it('source analysis includes only current text and visible object identities, preserving cached OCR', async () => {
  const f = fixture();
  const cached = { transcription: 'OCR text', diagram_description: 'original OCR diagram', extracted_entities: { labels: ['legacy'] } };
  const before = JSON.stringify(cached), enriched = await f.c.noamEnrichSourceAnalysis(f.exercise, cached);
  assert.notEqual(enriched, cached); assert.equal(JSON.stringify(cached), before);
  assert.equal(enriched.transcription, cached.transcription);
  assert.match(enriched.diagram_description, /function_graph/);
  assert.match(enriched.diagram_description, /axis:x.*axis:y/);
  assert.match(enriched.diagram_description, /\(0,−9\).*\(2,1\)/);
  for (const forbidden of ['(−2,5)', '(1,−10)', '(−3,−11)', '29.2', '196.89', 'svg_xy', 'data_to_svg', 'y=5x-9']) {
    assert.ok(!enriched.diagram_description.includes(forbidden), forbidden);
  }
  assert.match(enriched.diagram_description, /original OCR diagram/);
  assert.match(enriched.diagram_description, /אל תחשוף שיעורים/);
});

it('source analysis fails safely when exact selected item or source identity no longer matches', async () => {
  const f = fixture(), cached = { diagram_description: 'original' };
  f.exercise.nativeItemId = 'q2b';
  assert.equal(await f.c.noamEnrichSourceAnalysis(f.exercise, cached), cached);
  let release!: () => void; const wait = new Promise<void>(r => { release = r; });
  const g = fixture(async (_url, fallback) => { await wait; return fallback(); });
  const pending = g.c.noamEnrichSourceAnalysis(g.exercise, cached);
  g.c.manifest.nativeExportSha256 = 'replacement'; release();
  assert.equal(await pending, cached);
});

it('an additional question sends the original image once without false enrichment and an explicit drawing request still focuses the source', async () => {
  const f = fixture(); f.thread.messages.length = 0; f.thread.hintIndex = 0;
  const cached = { diagram_description: 'OCR original' }, requests: any[] = [];
  const worksheetImage = 'data:image/png;base64,d29ya3NoZWV0';
  Object.assign(f.c, {
    busy: false, panelBody: f.c.document.body, noamDrafts: {}, MIN_WAIT: 0, API: '/model', g: 8, lv: 'a', LEVEL: { a: 'רמה א׳' }, ttl: 'פונקציה קווית',
    setNoamBusy: (busy: boolean) => { f.c.busy = busy; }, restoreNoamChatFocus() {}, exerciseLabel: () => 'שאלה 2א',
    noamDidacticGuide: () => null, noamDidacticPrompt: () => '', noamDidacticResponse: () => null,
    getExerciseAnalysis: async () => { throw Error('direct questions must not call the analyzer'); },
    cropExerciseImage: async (exercise: any) => { assert.equal(exercise, f.exercise); return worksheetImage; },
    noamEnrichSourceAnalysis: () => { throw Error('the image has not been analyzed and cannot gain source provenance'); },
    noamSolverMessage: (s: string) => s,
    postJson: async (url: string, payload: any) => { requests.push({url, payload}); return { ok: true, answer: opts.answer }; },
    noamGuardGeometryResult: (r: any) => r, noamGuardSignedAddResult: (r: any) => r,
    noamClarifySignedAddLanguage: (text: string) => text, noamResponseVisual: () => null,
    noamVisualAnswer: (_student: string, answer: string) => answer, setTimeout: (callback: any, ms: number) => { if (ms < 25000) callback(); return 0; }
  });
  runInNewContext(fn('askNoam'), f.c);
  const question = 'איך יודעים איזו מהנקודות נמצאת על ציר y?';
  f.c.askNoam('free_question', question);
  for (let i = 0; i < 60; i++) await Promise.resolve();
  assert.equal(f.thread.messages[0].text, question);
  const delivered = f.thread.messages[1];
  assert.equal(delivered.text, opts.answer);
  assert.equal(delivered.visual, null, 'an ordinary additional question does not automatically attach a drawing');
  assert.equal(f.thread.hintIndex, 0, 'additional questions do not consume prepared hints');
  await f.c.noamRequestSourceFirst(f.exercise, f.thread, delivered, {
    answer: delivered.text, helpKind: 'free_question', studentMessage: 'סמן את הנקודה (0,-9) ואת ציר y'
  });
  assert.equal(delivered.visual.presentation, 'source-focus');
  assert.equal(delivered.visual.options.studentMessage, 'סמן את הנקודה (0,-9) ואת ציר y');
  assert.equal(f.fallback.length, 0, 'the explicit source drawing needs no protected generation');
  assert.equal(requests.length, 1); assert.equal(requests[0].url, '/model/noamImageSolve');
  assert.equal(requests[0].payload.imageDataUrl, worksheetImage);
  assert.equal(requests[0].payload.hasStudentAttachments, false);
  assert.equal(requests[0].payload.selectedPart, f.exercise.part);
  assert.deepEqual(JSON.parse(JSON.stringify(requests[0].payload.imageAnalysis)), {});
  assert.equal(cached.diagram_description, 'OCR original');
});

it('student attachment solve skips worksheet source enrichment and automatic source illustration', async () => {
  const f = fixture(); f.thread.messages.length = 0; f.thread.hintIndex = 0;
  const attached = { diagram_description: 'student attachment' }, requests: any[] = [];
  const photo = { name: 'student-photo' }, composite = 'data:image/png;base64,Y29tcG9zaXRl';
  let compositeCalls = 0;
  Object.assign(f.c, {
    busy: false, panelBody: f.c.document.body, noamDrafts: {}, MIN_WAIT: 0, API: '/model', g: 8, lv: 'a', LEVEL: { a: 'רמה א׳' }, ttl: 'פונקציה קווית',
    setNoamBusy: (busy: boolean) => { f.c.busy = busy; }, restoreNoamChatFocus() {}, exerciseLabel: () => 'שאלה 2א',
    currentAttachments: () => [photo],
    exerciseImageWithAttachments: async (exercise: any, snapshot: any[]) => {
      compositeCalls++; assert.equal(exercise, f.exercise); assert.equal(snapshot.length, 1); assert.equal(snapshot[0], photo); return composite;
    },
    noamEnrichSourceAnalysis: () => { throw Error('must not enrich student attachments'); },
    noamDidacticGuide: () => null, noamDidacticPrompt: () => '', noamDidacticResponse: () => null,
    getExerciseAnalysis: async () => { throw Error('student photos must not enter the old analyzer'); }, noamSolverMessage: (s: string) => s,
    postJson: async (url: string, payload: any) => { requests.push({url, payload}); return { ok: true, answer: opts.answer }; },
    noamGuardGeometryResult: (r: any) => r, noamGuardSignedAddResult: (r: any) => r,
    noamClarifySignedAddLanguage: (text: string) => text, noamResponseVisual: () => null,
    noamVisualAnswer: (_student: string, answer: string) => answer, setTimeout: (callback: any, ms: number) => { if (ms < 25000) callback(); return 0; }
  });
  runInNewContext(fn('askNoam'), f.c);
  f.c.askNoam('free_question', 'אפשר לבדוק איך השתמשתי בנתונים שבתמונה שצירפתי?');
  for (let i = 0; i < 60; i++) await Promise.resolve();
  assert.equal(requests.length, 1); assert.equal(requests[0].url, '/model/noamImageSolve');
  assert.equal(requests[0].payload.imageDataUrl, composite); assert.equal(requests[0].payload.hasStudentAttachments, true);
  assert.deepEqual(JSON.parse(JSON.stringify(requests[0].payload.imageAnalysis)), {});
  assert.equal(compositeCalls, 1); assert.equal(f.calls.length, 0); assert.equal(attached.diagram_description, 'student attachment');
  assert.equal(f.thread.messages[1].text, opts.answer); assert.equal(f.thread.messages[1].visual, null);
});

it('transient static fetch failures can be retried and do not poison package/figure caches', async () => {
  for (const failing of ['json', 'svg']) {
    let failed = false;
    const f = fixture((url, fallback) => {
      if (!failed && url.endsWith('.' + failing)) { failed = true; return { ok: false }; }
      return fallback();
    });
    assert.equal(await f.c.noamPrepareSourceVisual(f.exercise, opts), null);
    assert.equal((await f.c.noamPrepareSourceVisual(f.exercise, opts)).presentation, 'source-focus');
  }
});

it('rehydration pending guard clears after failure so a later render retries', async () => {
  const good = fixture(), visual = await good.c.noamPrepareSourceVisual(good.exercise, opts);
  let failed = false;
  const f = fixture((url, fallback) => { if (!failed && url.endsWith('.svg')) { failed = true; return { ok: false }; } return fallback(); });
  assert.equal(f.c.noamRenderSourceVisual(visual), null); await flush();
  assert.equal(f.c.noamRenderSourceVisual(visual), null); await flush();
  assert.ok(f.c.noamRenderSourceVisual(visual));
});

it('source helper blocks are identical in root and released viewer', () => {
  const root = readFileSync(new URL('../../../worksheet-viewer-noam.html', import.meta.url), 'utf8');
  assert.equal('var noamSourceVisualPackages=' + root.split('var noamSourceVisualPackages=')[1].split('function noamNativeFigure(')[0], helper);
});

it('generic draw action resolves authored intervals without protected generation, and rehydrates intent', async () => {
  const packageData=JSON.parse(readFileSync(new URL('../public/noam-ai/native/G8-T28/b/noam-ai.json',import.meta.url),'utf8'));
  const f=fixture(async()=>({ok:true,json:async()=>packageData}));
  Object.assign(f.exercise,{id:'G8-T28-B-Q08ב',part:'ב',nativeQuestionId:'q8',nativeItemId:'q8b'});
  delete (f.exercise as any).nativeFigureId;delete (f.exercise as any).nativeFigureUrl;
  f.c.manifest.nativeExportUrl='/noam-ai/native/G8-T28/b/noam-ai.json';
  runInNewContext(authoredModule,f.c);f.c.window.NoamAuthoredVisual=f.c.NoamAuthoredVisual;
  const options={...opts,answer:'האם יש מספרים בין 20 ל-21 שאינם נכללים במחלקה?',drawCurrentStep:true};
  const result=await f.c.noamRequestSourceFirst(f.exercise,f.thread,f.message,options);
  assert.equal(result.presentation,'authored-intervals');assert.equal(f.fallback.length,0);assert.equal(f.calls.length,1);
  assert.equal(result.options.drawCurrentStep,true);assert.equal(result.expression,undefined);assert.equal(result.intervals,undefined);
  assert.equal(f.c.noamRenderSourceVisual(result).querySelectorAll('[data-role="given-interval"]').length,2);
  result.intervals=[{start:0,end:999}];
  assert.doesNotMatch(f.c.noamRenderSourceVisual(result).textContent,/999/);
  f.c.manifest.nativeExportSha256='changed';assert.equal(f.c.noamRenderSourceVisual(result),null);
});
it('auto authored aid requires a matching focus and does not attach to an unrelated hint', async()=>{
  const packageData=JSON.parse(readFileSync(new URL('../public/noam-ai/native/G8-T28/b/noam-ai.json',import.meta.url),'utf8'));
  const f=fixture(async()=>({ok:true,json:async()=>packageData}));Object.assign(f.exercise,{id:'G8-T28-B-Q08ב',part:'ב',nativeQuestionId:'q8',nativeItemId:'q8b'});
  delete (f.exercise as any).nativeFigureId;delete (f.exercise as any).nativeFigureUrl;f.c.manifest.nativeExportUrl='/noam-ai/native/G8-T28/b/noam-ai.json';
  runInNewContext(authoredModule,f.c);f.c.window.NoamAuthoredVisual=f.c.NoamAuthoredVisual;
  assert.equal(await f.c.noamAttachSourceHint(f.exercise,f.thread,f.message,{...opts,answer:'קראו את המשפט הראשון.'}),null);
  const visual=await f.c.noamAttachSourceHint(f.exercise,f.thread,f.message,{...opts,answer:'האם יש מספרים בין 20 ל-21 שאינם נכללים במחלקה?'});
  assert.equal(visual.presentation,'authored-intervals');assert.equal(f.fallback.length,0);
});
