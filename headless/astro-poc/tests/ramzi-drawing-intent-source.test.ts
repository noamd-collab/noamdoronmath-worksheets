import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { it } from 'node:test';
import { parseHTML } from 'linkedom';

const root = new URL('../../../', import.meta.url);
const nativeModule = readFileSync(new URL('noam-native-visual.js', root), 'utf8');
const originalData = JSON.parse(readFileSync(new URL('noam-ai/native/G8-T50/c/noam-ai.json', root), 'utf8'));
const originalManifest = JSON.parse(readFileSync(new URL('noam-ai/manifests/62b3609adaaf466c810cfa15cef7d748.json', root), 'utf8'));
const originalExercise = originalManifest.exercises.find((e: any) => e.id === 'G8-T50-E-Q03ד');
const originalSvg = readFileSync(new URL(originalExercise.nativeFigureUrl.slice(1), root), 'utf8');

for (const file of ['worksheet-viewer-noam.html', 'headless/astro-poc/public/worksheet-viewer-noam.html']) {
  const html = readFileSync(new URL(file, root), 'utf8');
  function fn(name: string) {
    const start = html.indexOf('function ' + name + '(');
    const next = html.indexOf('\nfunction ', start + 1);
    return html.slice(start, next);
  }
  function fixture() {
    const { document, window } = parseHTML('<html><body><button id="noamDraw"></button></body></html>');
    const data = structuredClone(originalData), exercise = structuredClone(originalExercise);
    const manifest = { ...originalManifest, exercises: [exercise] };
    const calls: any[] = [], runtime = { messages: new Map(), jobs: new Map(), cache: new Map() };
    const answer = 'כדי למצוא את אורך האלכסון AC, השתמשו בנוסחת המרחק בין שתי נקודות במערכת הצירים.';
    const message: any = { role: 'assistant', text: answer };
    const thread: any = { messages: [{ role: 'user', text: 'אפשר רמז 1?', kind: 'רמז 1' }, message], history: [] };
    const c: any = { document, window, manifest, Map, WeakSet, Promise, console, selectedExercise: exercise,
      noamNativeFocusUrl: () => '/noam-ai/native/G8-T50/c/noam-ai.json',
      noamDiagramSourceIdentity: () => 'original-pdf-v1', noamDiagramRuntime: () => runtime,
      fetch: async (url: string) => ({ ok: true, json: async () => data, text: async () => originalSvg }),
      cropExerciseImage: async () => { calls.push('original-crop'); return 'data:image/png;base64,ORIGINAL'; },
      getExerciseAnalysis: async () => { calls.push('analysis'); return { transcription: 'legacy analysis' }; },
      noamDiagramAnalysis: (a: any) => a, noamDiagramQuestionText: () => 'legacy source',
      noamDiagramRefresh() {}, saveNoamState() {}, noamSourceCropRequested: () => false,
      noamConstructedVisual: () => null, noamParsedLocalVisual: () => null, noamPrepareNativeFocus: async () => null,
      noamSourceGivens: async () => [], noamRenderAiDiagram: () => null,
      API: '/api', g: 8, lv: 'c', LEVEL: { c: 'E' }, ttl: 'פיתגורס מורכב', ownerKey: 'test-owner-key-1234',
      postJson: async (url: string, payload: any) => { calls.push({ url, payload }); return { ok: true, accepted: true, jobId: 'job' }; },
      pollNoamDiagramJob: async () => ({ ok: true, plan: { status: 'unsupported' } }),
      noamDiagramError: () => 'unsupported', busy: false, drawingAnswer: message,
    };
    const sourceHelpers = html.slice(html.indexOf('var noamSourceVisualPackages='), html.indexOf('function noamNativeFigure('));
    runInNewContext(nativeModule + '\n' + sourceHelpers + '\n' + ['noamMessageVisualOptions', 'noamNativeDiagramContext', 'noamDiagramSourceInput', 'requestNoamDiagram'].map(fn).join('\n'), c);
    window.NoamNativeVisual = c.NoamNativeVisual;
    window.NoamDiagramPlan = { inspect: () => ({ ok: false, reason: 'unsupported' }) };
    return { c, calls, data, exercise, manifest, message, thread, runtime };
  }

  it(file + ': actual composer and answer buttons mark explicit draw intent without altering hint scope', () => {
    const f = fixture(), received: any[] = [];
    f.c.requestNoamDiagram = (...args: any[]) => received.push(args);
    f.c.thread = f.thread;
    const start = html.indexOf('document.getElementById("noamDraw").addEventListener("click",function(){');
    runInNewContext(html.slice(start, html.indexOf('\n  });', start) + 6), f.c);
    f.c.document.getElementById('noamDraw').click();
    assert.equal(received.length, 1);
    assert.equal(received[0][3].drawCurrentStep, true);
    assert.equal(received[0][3].studentMessage, 'אפשר רמז 1?');
    assert.equal(received[0][3].answer, f.message.text);
    const button = f.c.document.createElement('button');
    Object.assign(f.c, { drawButton: button, drawingExercise: f.exercise, message: f.message });
    const inline = html.indexOf('drawButton.addEventListener("click",function(){');
    runInNewContext(html.slice(inline, html.indexOf('\n    });', inline) + 8), f.c);
    button.click(); assert.equal(received.length, 2); assert.equal(received[1][3].drawCurrentStep, true);
    assert.equal(f.c.noamSourceVisualOptions({ drawCurrentStep: 'true' }).drawCurrentStep, false);
    assert.equal(f.c.noamSourceVisualOptions({ drawCurrentStep: true }).drawCurrentStep, true);
    assert.equal(f.c.noamMessageVisualOptions(f.thread, f.message).drawCurrentStep, undefined);
  });

  it(file + ': native drawing payload keeps original image and only selected authored text and visible identities', async () => {
    const f = fixture();
    f.data.questions.find((q: any) => q.id === 'q3').given.push({ text: 'FORBIDDEN_PARENT_GIVEN_9876' });
    const source = await f.c.noamDiagramSourceInput(f.exercise);
    assert.equal(source.imageDataUrl, 'data:image/png;base64,ORIGINAL');
    assert.deepEqual(f.calls, ['original-crop']);
    assert.match(source.questionText, /הסעיף הנבחר: מצאו בדיוק את האלכסון/);
    assert.match(source.questionText, /segment:AC/);
    assert.match(source.questionText, /נקודות A, B, C, D, E/);
    for (const excluded of ['FORBIDDEN_PARENT_GIVEN_9876', 'סעיף קודם', '247.71', 'svg_xy', 'DIAGRAM_FACTS_JSON']) {
      assert.ok(!source.questionText.includes(excluded), excluded);
    }
    assert.match(source.questionText, /סמנים מודפסים.*תמונת המקור/);
  });

  it(file + ': native source mismatch or replacement never crosses into another selected part', async () => {
    const f = fixture(); f.exercise.nativeItemId = 'q3a';
    assert.equal(await f.c.noamNativeDiagramContext(f.exercise), null);
    const g = fixture(); let release!: () => void;
    g.c.fetch = async () => { await new Promise<void>(r => { release = r; }); return { ok: true, json: async () => g.data, text: async () => originalSvg }; };
    // One deferred source avoids fetching an SVG in parallel in this identity check.
    g.c.noamLoadSourceVisual = async () => { await new Promise<void>(r => { release = r; }); return { data: g.data, svgText: originalSvg }; };
    const pending = g.c.noamNativeDiagramContext(g.exercise);
    g.manifest.nativeExportSha256 = 'replacement'; release();
    assert.equal(await pending, null);
  });

  it(file + ': real protected request sends explicit draw intent and exact current hint, preserving source crop', async () => {
    const f = fixture();
    const options = { ...f.c.noamMessageVisualOptions(f.thread, f.message), drawCurrentStep: true, nativeAttempted: true };
    assert.equal(await f.c.requestNoamDiagram(f.exercise, f.thread, f.message, options), null);
    const request = f.calls.find((call: any) => call.payload);
    assert.equal(request.payload.currentHint, f.message.text);
    assert.match(request.payload.studentMessage, /^אפשר רמז 1\?\nהצג המחשה/);
    assert.match(request.payload.questionText, /segment:AC/);
    assert.equal(request.payload.imageDataUrl, 'data:image/png;base64,ORIGINAL');
    assert.equal(f.message.diagramOptions.drawCurrentStep, true);
    assert.equal(f.message.diagramErrorCode, 'DIAGRAM_UNSUPPORTED');
    assert.equal(f.message.visual, undefined);
  });

  it(file + ': legacy source and typed requests retain their own input without new intent or fabricated native topology', async () => {
    const f = fixture(); delete f.exercise.nativeQuestionId;
    const source = await f.c.noamDiagramSourceInput(f.exercise);
    assert.equal(source.questionText, f.exercise.prompt); assert.equal(source.imageDataUrl, 'data:image/png;base64,ORIGINAL');
    await f.c.requestNoamDiagram(f.exercise, f.thread, f.message, { studentMessage: 'הראה את הקטע AC', answer: f.message.text });
    const request = f.calls.find((call: any) => call.payload);
    assert.equal(request.payload.studentMessage, 'הראה את הקטע AC');
    assert.equal(f.message.diagramOptions.drawCurrentStep, false);
  });
}
