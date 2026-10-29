import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { it } from 'node:test';
import { parseHTML } from 'linkedom';

const root = new URL('../../../', import.meta.url), pub = new URL('../public/', import.meta.url);
const read = (p: string) => readFileSync(new URL(p, pub), 'utf8');
const fixtures = {
  arithmetic: ['596c40e9ffb049e8b4e53a7960a9fef1', 'q6c'],
  probability: ['93d227a045fa4fdeb217597f630634eb', 'q6b'],
  algebra: ['5950ef9247f34453984c51b3a1baf3cd', 'q10a'],
  canonicalTable: ['084c58836048405aa2a2f97ba4396553', 'q16b'],
  geometry: ['162e9a4cd15e41c5bb68cc6a1b600e81', 'q20d'],
  axes: ['079c045ad82249d8914c70c422276ce6', 'q17a'],
  functions: ['f693012a04194166b37dd6127b4f345c', 'q2a'],
  algebraWithGraph: ['3ae0575b833f45a59616944111af5324', 'q22b'],
};
const moduleNames = ['noam-visual-policy', 'noam-native-visual', 'noam-source-panels', 'noam-authored-geometry',
  'noam-authored-visual', 'noam-visual-data', 'noam-visual-plan', 'noam-source-data-visual', 'noam-source-scaffold', 'noam-local-visual'];
const modules = () => moduleNames.map(n => read(n + '.js')).join('\n');
function fn(html: string, name: string) {
  const start = html.indexOf('function ' + name + '('), end = html.indexOf('\nfunction ', start + 1);
  assert.ok(start >= 0 && end > start, name); return html.slice(start, end);
}
function harness(viewer: string, key: keyof typeof fixtures) {
  const html = readFileSync(new URL(viewer, root), 'utf8'), [pdf, item] = fixtures[key];
  const manifest = JSON.parse(read('noam-ai/manifests/' + pdf + '.json'));
  const exercise = manifest.exercises.find((e: any) => e.nativeItemId === item); assert.ok(exercise, key);
  const { document, window } = parseHTML('<html><body><div id="worksheetPdf">original PDF</div><button id="back"></button><main></main></body></html>');
  const thread: any = { messages: [{ role: 'assistant', text: 'בדקו את הנתונים המודפסים.' }], history: [], hintIndex: 1 };
  const calls: any = { static: [], protected: [], ocr: 0, saved: 0, preview: 0 };
  const s: any = { document, window, manifest, selectedExercise: exercise, pdf, g: manifest.grade, lv: manifest.level,
    ttl: 'כותרת מזויפת: גאומטריה', LEVEL: { a: 'רמה א׳', b: 'רמה ב׳', c: 'מצוינות' }, API: '/offline', MIN_WAIT: 0,
    Promise, Map, Set, WeakMap, WeakSet, TextDecoder, TextEncoder, console, setTimeout,
    panelBody: document.querySelector('main'), panelBack: document.getElementById('back'), busy: false,
    noamDrafts: {}, threads: {}, analysisCache: {}, activeGlossaryEntryId: null, mathKeyboardOpen: false,
    currentAttachments: () => [], exerciseThread: () => thread, saveNoamState: () => calls.saved++,
    noamNativeFocusUrl: () => manifest.nativeExportUrl,
    hideNoamGlossaryPopover() {}, restoreNoamChatFocus() {}, announceNoam() {},
    renderNoamAttachments() {}, addNoamAttachments() {}, locateSelectedExercise() {}, insertNoamMath() {},
    renderPanelMath() {}, renderNoamFractionMarkers() {}, enhanceNoamGlossary() {},
    noamStripMarkdownEmphasis: (x: string) => x, exerciseLabel: () => 'שאלה',
    esc: (x: any) => String(x ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'),
    escAttr: (x: any) => String(x ?? ''),
    renderExercisePreview: () => calls.preview++, setNoamBusy: (value: boolean) => { s.busy = value; },
    noamDidacticGuide: () => null, noamDidacticPrompt: () => '', noamDidacticResponse: () => null,
    noamGuardGeometryResult: (x: any) => x, noamGuardSignedAddResult: (x: any) => x,
    noamClarifySignedAddLanguage: (x: string) => x, isBotProtectionError: () => false,
    getExerciseAnalysis: async () => { calls.ocr++; throw Error('Unexpected OCR in policy flow'); },
    postJson: async (url: string, payload: any) => {
      calls.protected.push({ url, payload });
      assert.equal(url, '/offline/noamImageSolve', 'no diagram/provider route');
      return { ok: true, answer: 'בדקו את הנתונים בטבלה המודפסת.' };
    },
    fetch: async (url: string) => { calls.static.push(url); const bytes = read(url.slice(1));
      return { ok: true, text: async () => bytes, json: async () => JSON.parse(bytes),
        arrayBuffer: async () => new TextEncoder().encode(bytes).buffer }; },
  };
  runInNewContext(modules(), s);
  for (const name of Object.keys(s)) if (name.startsWith('Noam')) window[name] = s[name];
  const names = ['noamVisualsAllowed', 'noamInterceptBlockedDrawing', 'noamDiagramSourceIdentity',
    'noamManifestOcrUnreliable', 'noamExerciseSectionLabel', 'localVisualExerciseSource', 'noamNativeFocusUrl',
    'noamSourceCropIdentity', 'noamSourceCropExercise', 'noamSourceCropRequested', 'noamLoadSourceCrop',
    'noamRenderSourceCrop', 'noamRequestSourceCrop', 'noamAppendSourceCropHelp', 'setNoamDiagramButtonLabel',
    'noamVisualCanExpand', 'addTranscriptBubble', 'noamLatestDrawingAnswer', 'renderNoamChat',
    'noamParsedLocalVisual', 'tryNoamLocalVisual', 'noamRetryActionLabel'];
  const helpers = 'var noamSourceVisualPackages=' + html.split('var noamSourceVisualPackages=')[1].split('function noamNativeFigure(')[0];
  runInNewContext(html.slice(html.indexOf('var SOLVER_MESSAGE_MAX ='), html.indexOf('var GRADE_NAME =')) + '\n' +
    helpers + '\n' + names.filter(n => html.includes('function ' + n + '(')).map(n => fn(html, n)).join('\n') + '\n' +
    html.slice(html.indexOf('function noamGeometryContext(text){'), html.indexOf('function postJson(endpoint,payload){')), s);
  // Only external services and unrelated response guards are replaced.
  s.noamGuardGeometryResult = (x: any) => x; s.noamGuardSignedAddResult = (x: any) => x;
  s.noamClarifySignedAddLanguage = (x: string) => x;
  return { s, calls, thread, manifest, exercise, html, document };
}
async function settle(s: any) {
  const deadline = Date.now() + 5000;
  do { await new Promise(resolve => setTimeout(resolve, 5)); } while (s.busy && Date.now() < deadline);
  assert.equal(s.busy, false);
}

for (const viewer of ['worksheet-viewer-noam.html', 'headless/astro-poc/public/worksheet-viewer-noam.html']) {
  it(viewer + ': arithmetic, probability and algebra suppress every saved visual and manual/typed draw before requests', async () => {
    for (const key of ['arithmetic', 'probability', 'algebra', 'algebraWithGraph'] as const) {
      const f = harness(viewer, key);
      assert.equal(f.s.noamVisualsAllowed(f.exercise), false, key);
      for (const type of ['native-source-visual', 'native-original-table', 'source-crop', 'ai-diagram', 'geometry-guide', 'labeled-triangle']) {
        f.thread.messages[0].visual = { type, exerciseId: f.exercise.id, sourceIdentity: 'old-saved-source' };
        const saved = JSON.stringify(f.thread);
        f.s.renderNoamChat();
        assert.equal(f.document.getElementById('noamDraw')!.hidden, true);
        assert.equal(f.document.querySelector('#noamTranscript figure'), null);
        assert.equal(f.document.querySelector('.noam-diagram-expand'), null);
        assert.equal(JSON.stringify(f.thread), saved, 'saved visual remains stored but not displayed');
        f.document.getElementById('noamDraw')!.click();
        assert.equal(await f.s.requestNoamDiagram(f.exercise, f.thread, f.thread.messages[0], { drawCurrentStep: true }), null);
      }
      for (const text of ['שרטט משולש ABC', 'סרטט פונקציה', 'הכן לי איור', 'אפשר סקיצה', 'הצג את השרטוט המקורי', 'plot y=x^2']) {
        f.document.getElementById('noamQuestion')!.value = text;
        f.document.getElementById('noamSend')!.click();
        assert.match(f.thread.messages.at(-1).text, /בטקסט בלבד/);
      }
      f.s.askNoam('free_question', 'draw a geometry diagram');
      assert.equal(f.s.noamResponseVisual(f.exercise, f.thread, 'שרטט', 'רמז', 'hint', 0, {}), null);
      assert.equal(await f.s.noamAttachSourceHint(f.exercise, f.thread, f.thread.messages[0], {}), null);
      assert.equal(await f.s.noamRequestSourceFirst(f.exercise, f.thread, f.thread.messages[0], {}), null);
      assert.deepEqual(f.calls.static, []); assert.deepEqual(f.calls.protected, []); assert.equal(f.calls.ocr, 0);
      assert.equal(f.document.getElementById('worksheetPdf')!.textContent, 'original PDF');
    }
  });

  it(viewer + ': blocked arithmetic still uses exact canonical table source for the actual hint button with no OCR or illustration', async () => {
    const f = harness(viewer, 'canonicalTable'); f.thread.messages = []; f.thread.hintIndex = 0;
    f.s.renderNoamChat(); assert.equal(f.calls.preview, 1, 'original question preview remains');
    f.document.getElementById('noamHint')!.click(); await settle(f.s);
    assert.equal(f.calls.protected.length, 1);
    assert.equal(f.calls.protected[0].payload.imageAnalysis.content_type, 'native_source_canonical');
    assert.equal(f.calls.ocr, 0); assert.equal(f.thread.messages.at(-1).visual, null);
    assert.equal(f.document.querySelector('#noamTranscript figure'), null);
    assert.equal(f.document.getElementById('noamDraw')!.hidden, true);
    assert.ok(f.calls.static.includes(f.manifest.nativeExportUrl));
  });

  it(viewer + ': textual help and original-question access never become a blocked drawing reply', async () => {
    for (const text of ['תראה לי איך לפתור 2x+3=7', 'לא רואה את השאלה', 'הצג את השאלה המקורית', 'מהי פרבולה?']) {
      const f = harness(viewer, 'canonicalTable'); f.s.renderNoamChat();
      assert.equal(f.s.noamInterceptBlockedDrawing(text), false, text);
      assert.equal(f.s.tryNoamLocalVisual(text), false, text);
      f.document.getElementById('noamQuestion')!.value = text;
      f.document.getElementById('noamSend')!.click(); await settle(f.s);
      assert.equal(f.calls.protected.length, 1, text);
      assert.equal(f.calls.protected[0].url, '/offline/noamImageSolve');
      assert.equal(f.calls.ocr, 0);
      assert.doesNotMatch(f.thread.messages.at(-1).text, /בטקסט בלבד/);
    }
  });

  it(viewer + ': geometry, coordinate axes and authored function graphs retain actual drawing, saved replay and expansion control', async () => {
    for (const key of ['geometry', 'axes', 'functions'] as const) {
      const f = harness(viewer, key); assert.equal(f.s.noamVisualsAllowed(f.exercise), true, key);
      f.thread.messages.unshift({ role: 'user', text: 'אפשר רמז 1?', kind: 'רמז 1' });
      const message = f.thread.messages[1];
      const options = { ...f.s.noamMessageVisualOptions(f.thread, message), drawCurrentStep: true };
      assert.ok(await f.s.noamPrepareSourceVisual(f.exercise, options), key + ' has a local source visual');
      f.s.renderNoamChat(); assert.equal(f.document.getElementById('noamDraw')!.hidden, false, key);
      f.document.getElementById('noamDraw')!.click();
      const deadline = Date.now() + 5000;
      while (!message.visual && Date.now() < deadline) await new Promise(r => setTimeout(r, 5));
      assert.ok(message.visual, key);
      f.s.renderNoamChat(); assert.ok(f.document.querySelector('#noamTranscript figure'), key);
      assert.ok(f.document.querySelector('.noam-diagram-expand'), key);
      const saved = JSON.stringify(f.thread); f.s.renderNoamChat(); assert.equal(JSON.stringify(f.thread), saved);
      assert.deepEqual(f.calls.protected, [], 'authored drawing stays local');
    }
  });

  it(viewer + ': unknown metadata, mismatched identities and absent policy deny without accepting title/prompt opt-ins', () => {
    const f = harness(viewer, 'geometry');
    const grade = f.manifest.grade, prefix = f.manifest.prefix;
    delete f.manifest.grade; assert.equal(f.s.noamVisualsAllowed(f.exercise), false);
    f.manifest.grade = grade; f.manifest.prefix = 'G8-T32'; assert.equal(f.s.noamVisualsAllowed(f.exercise), false);
    f.manifest.prefix = prefix; assert.equal(f.s.noamVisualsAllowed({ id: 'G9-T31-A-Q22ב' }), false);
    f.s.window.NoamVisualPolicy = null; assert.equal(f.s.noamVisualsAllowed(f.exercise), false);
  });

  it(viewer + ': a policy change while loading prevents late attachment and a stale expansion click', async () => {
    const f = harness(viewer, 'geometry');
    const figure = f.document.createElement('figure'), container = f.document.createElement('div');
    f.document.body.append(container); f.s.noamAddDiagramExpansion(container, figure);
    const button = container.querySelector('button'); assert.ok(button);
    const originalFetch = f.s.fetch; let resume: any;
    f.s.fetch = (url: string) => new Promise(resolve => { resume = async () => resolve(await originalFetch(url)); });
    const message = f.thread.messages[0];
    const pending = f.s.noamRequestSourceFirst(f.exercise, f.thread, message, { drawCurrentStep: true });
    f.manifest.grade = 7; f.manifest.prefix = 'G7-T04';
    await resume(); assert.equal(await pending, null); assert.equal(message.visual, undefined);
    button.click(); assert.equal(f.document.querySelector('dialog'), null);
    assert.deepEqual(f.calls.protected, []);
  });

  it(viewer + ': server domain refusal is shown as text without CAPTCHA wording or a drawing retry', async () => {
    const f = harness(viewer, 'geometry'), message = f.thread.messages[0];
    f.s.isBotProtectionError = () => true;
    const error = { code: 'DIAGRAM_TOPIC_NOT_ALLOWED', status: 403, message: 'backend policy' };
    message.diagramErrorCode = error.code; message.diagramError = f.s.noamDiagramError(error);
    assert.match(message.diagramError, /בטקסט בלבד/); assert.doesNotMatch(message.diagramError, /אבטחה|אימות|שוב/);
    f.s.renderNoamChat();
    assert.equal(f.document.getElementById('noamDraw')!.hidden, true);
    assert.equal(f.document.querySelector('.noam-draw-action'), null);
    assert.match(f.document.querySelector('.noam-draw-policy-note')!.textContent!, /בטקסט בלבד/);
    assert.equal(await f.s.requestNoamDiagram(f.exercise, f.thread, message, {}), null);
    assert.deepEqual(f.calls.protected, []);
  });
}
