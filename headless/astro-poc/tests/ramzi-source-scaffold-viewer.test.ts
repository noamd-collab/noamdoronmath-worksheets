import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { it } from 'node:test';
import { runInNewContext } from 'node:vm';
import { parseHTML } from 'linkedom';

const root = new URL('../../../', import.meta.url);
const pub = new URL('../public/', import.meta.url);
const options = { drawCurrentStep: true, studentMessage: 'אפשר רמז 1?', helpKind: 'hint', answer: 'תוצאה מומצאת: 9999' };
const cases = [
  ['162e9a4cd15e41c5bb68cc6a1b600e81', 'G8-T46-E-Q05ב', 'proof-lanes'],
  ['162e9a4cd15e41c5bb68cc6a1b600e81', 'G8-T46-E-Q20ד', 'area-comparison'],
  ['45ab1aedeacb4ed5b8b40b4fec71af5b', 'G8-T32-B-Q04ד', 'redistribution'],
  ['45ab1aedeacb4ed5b8b40b4fec71af5b', 'G8-T32-B-Q20א', 'group-averages'],
  ['084c58836048405aa2a2f97ba4396553', 'G7-T21-A-Q16ב', 'symbolic-rectangle'],
  ['c9acfbe1c4c14f318cdf9f977e088df0', 'G7-T03-B-Q11ד', 'signed-factors'],
  ['5950ef9247f34453984c51b3a1baf3cd', 'G7-T37-B-Q10א', 'equation-comparison'],
  ['5950ef9247f34453984c51b3a1baf3cd', 'G7-T37-B-Q16א', 'purchase-groups'],
  ['596c40e9ffb049e8b4e53a7960a9fef1', 'G7-T04-B-Q06ג', 'fraction-placeholder'],
  ['93d227a045fa4fdeb217597f630634eb', 'G9-T11-A-Q06ב', 'observed-future'],
];
function fixture(row = cases[4]) {
  const manifest = JSON.parse(readFileSync(new URL(`noam-ai/manifests/${row[0]}.json`, pub), 'utf8'));
  const bytes = readFileSync(new URL(manifest.nativeExportUrl.slice(1), pub));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), manifest.nativeExportSha256);
  const exercise = manifest.exercises.find((e: any) => e.id === row[1]);
  assert.ok(exercise);
  return { manifest, exercise, data: JSON.parse(bytes.toString()), pdf: row[0] };
}
function harness(viewer: string, f = fixture()) {
  const html = readFileSync(new URL(viewer, root), 'utf8');
  const fn = (name: string) => {
    const start = html.indexOf(`function ${name}(`);
    assert.ok(start >= 0, name);
    const end = html.indexOf('\nfunction ', start + 1);
    assert.ok(end > start, name);
    return html.slice(start, end);
  };
  const calls = { fetch: 0, save: 0, refresh: 0, repaint: 0, fallback: 0, sourceData: 0 };
  const s: any = {
    document: parseHTML('<html><body></body></html>').document,
    manifest: f.manifest, selectedExercise: f.exercise, pdf: f.pdf,
    noamSourceVisualPackages: {}, WeakSet, Promise,
    // Local source transport only. All identity/selection/presentation functions
    // below are the real viewer functions; this suite makes no network request.
    fetch: async (url: string, init: any) => {
      assert.equal(url, f.manifest.nativeExportUrl);
      assert.equal(init.cache, 'no-cache');
      calls.fetch++;
      return { ok: true, json: async () => JSON.parse(JSON.stringify(f.data)) };
    },
    noamLoadSourcePanels: async (_: any, source: any) => source,
    saveNoamState: () => calls.save++,
    noamDiagramRefresh: () => calls.refresh++,
    renderNoamChat: () => calls.repaint++,
    requestNoamDiagram: () => { calls.fallback++; return null; },
  };
  s.window = s;
  for (const name of ['noam-native-visual', 'noam-source-panels', 'noam-authored-geometry', 'noam-authored-visual', 'noam-visual-data', 'noam-visual-plan', 'noam-source-data-visual', 'noam-source-scaffold']) {
    runInNewContext(readFileSync(new URL(name + '.js', pub), 'utf8'), s, { filename: name });
  }
  const sourceData = s.NoamSourceDataVisual;
  s.NoamSourceDataVisual = { ...sourceData, resolve(...args: any[]) { calls.sourceData++; return sourceData.resolve(...args); } };
  runInNewContext([
    'noamDiagramSourceIdentity', 'noamNativeDataUrl', 'noamSourceVisualIdentity',
    'noamSourceVisualOptions', 'noamSourcePanelReviewed', 'noamSourcePanelModuleMissing',
    'noamSourcePanelBlocksFallback', 'noamLoadSourceVisual', 'noamCachedSourceVisual',
    'noamSourcePresentation', 'noamPrepareSourceVisual', 'noamRenderSourceVisual',
    'noamDiagramRuntime', 'noamRequestSourceFirst', 'noamAttachSourceHint',
  ].map(fn).join('\n'), s);
  return { s, f, calls, html };
}

for (const viewer of ['worksheet-viewer-noam.html', 'headless/astro-poc/public/worksheet-viewer-noam.html']) {
  it(`${viewer}: loads scaffold dependencies and the corrected glossary`, () => {
    const { html } = harness(viewer);
    const scripts = [...html.matchAll(/<script src="([^"]+)"/g)].map(m => m[1]);
    const scaffold = scripts.indexOf('noam-source-scaffold.js?v=20261029-scaffold1');
    assert.ok(scaffold > scripts.findIndex(x => x.startsWith('noam-native-visual.js?')));
    assert.ok(scaffold > scripts.findIndex(x => x.startsWith('noam-visual-data.js?')));
    assert.equal(scripts.filter(x => x.startsWith('noam-source-scaffold.js?')).length, 1);
    assert.ok(scripts.includes('noam-glossary.js?v=20261029-context4'));
  });

  it(`${viewer}: explicit draw uses all ten exact source aids before original-data fallback`, async () => {
    for (const row of cases) {
      const { s, f, calls } = harness(viewer, fixture(row));
      const message: any = { role: 'assistant', text: 'רמז' }, thread = { messages: [message], history: [] };
      const visual = await s.noamRequestSourceFirst(f.exercise, thread, message, options);
      assert.equal(visual?.presentation, 'source-scaffold-' + row[2], row[1]);
      assert.equal(message.visual, visual);
      assert.equal(calls.sourceData, 0, 'a recognized aid preempts the original table');
      assert.equal(calls.fallback, 0, 'no legacy/model fallback is requested');
      assert.equal(calls.fetch, 1);
      const figure = s.noamRenderSourceVisual(visual);
      assert.equal(figure?.dataset.presentation, 'instructional-scaffold');
      assert.match(figure?.textContent || '', /לא איור מקורי ולא פתרון/);
      assert.doesNotMatch(figure?.textContent || '', /9999/);
    }
  });

  it(`${viewer}: ordinary hints never attach a scaffold, including an accidental draw flag`, async () => {
    const { s, f, calls } = harness(viewer);
    for (const drawCurrentStep of [undefined, false, true]) {
      const message: any = { role: 'assistant', text: 'מה אורך המלבן?' }, thread = { messages: [message], history: [] };
      assert.equal(await s.noamAttachSourceHint(f.exercise, thread, message, { ...options, drawCurrentStep }), null);
      assert.equal(message.visual, undefined);
    }
    assert.equal(calls.save, 0);
    assert.equal(calls.refresh, 0);
    assert.equal(calls.fallback, 0);
  });

  it(`${viewer}: persisted intent is rederived through current source and exact identity after reload`, async () => {
    const { s, f, calls } = harness(viewer);
    const visual = await s.noamPrepareSourceVisual(f.exercise, options);
    assert.equal(visual.presentation, 'source-scaffold-symbolic-rectangle');
    assert.equal(visual.sourceIdentity, s.noamSourceVisualIdentity(f.exercise));
    assert.equal(visual.scene, undefined);
    assert.equal(visual.svg, undefined);
    const saved = JSON.parse(JSON.stringify(visual));
    saved.scene = { variable: 'forged', extra: 9999 };
    saved.svg = '<svg><text>9999</text></svg>';
    const current = s.noamRenderSourceVisual(saved);
    assert.match(current.textContent, /3 נוספים/);
    assert.doesNotMatch(current.textContent, /9999|forged/);

    s.noamSourceVisualPackages = {};
    assert.equal(s.noamRenderSourceVisual(saved), null, 'a cold reload must first retrieve current source');
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(calls.repaint, 1);
    assert.ok(s.noamRenderSourceVisual(saved));

    const nativeSha = f.manifest.nativeExportSha256;
    f.manifest.nativeExportSha256 = '0'.repeat(64);
    assert.equal(s.noamRenderSourceVisual(saved), null, 'a different published export invalidates saved intent');
    f.manifest.nativeExportSha256 = nativeSha;
    const originalItemId = f.exercise.nativeItemId;
    f.exercise.nativeItemId = 'q16a';
    assert.equal(s.noamRenderSourceVisual(saved), null, 'another selected item cannot borrow the saved aid');
    f.exercise.nativeItemId = originalItemId;

    const source = s.noamCachedSourceVisual(f.exercise);
    const part = source.data.questions.find((q: any) => q.id === 'q16').items.find((p: any) => p.id === originalItemId);
    const originalPartId = part.id;
    part.id = 'unknown-selected-item';
    assert.equal(s.noamRenderSourceVisual(saved), null, 'even cached data must resolve the exact current q/item again');
    part.id = originalPartId;
    assert.ok(s.noamRenderSourceVisual(saved));
    saved.options.drawCurrentStep = false;
    assert.equal(s.noamRenderSourceVisual(saved), null, 'saved data cannot create automatic scaffold intent');
  });

  it(`${viewer}: absent scaffold keeps the original-table path and unrelated authored data working`, async () => {
    const { s, f } = harness(viewer);
    s.NoamSourceScaffold = undefined;
    const table = await s.noamPrepareSourceVisual(f.exercise, options);
    assert.equal(table.presentation, 'source-context');
    const figure = s.noamRenderSourceVisual(table);
    assert.ok(figure.querySelector('table'));
    assert.match(figure.textContent, /הטבלה המקורית כפי שהודפסה/);
    const expression = fixture(['8d3c20dc5ae444019c70ae8458e7273b', 'G9-T02-B-Q17ב']);
    const result = s.noamSourcePresentation({ data: expression.data, svgText: '' }, expression.exercise, options);
    assert.equal(result.kind, 'typed-operations');
    assert.match(result.figure.textContent, /לא חושבה תוצאה/);
  });
}
