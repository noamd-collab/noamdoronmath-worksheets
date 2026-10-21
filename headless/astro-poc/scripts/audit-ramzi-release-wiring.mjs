// Offline integration audit of the released worksheets. Never calls an AI API,
// rereads a PDF, or treats synthetic hints as evidence of model answer quality.
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { runInNewContext } from 'node:vm';
import { execFileSync } from 'node:child_process';
const app = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pub = resolve(app, 'public');
const sha = b => createHash('sha256').update(b).digest('hex');
const inputs = new Map();
function read(path) { const b = readFileSync(path); inputs.set(path.slice(app.length + 1), sha(b)); return b.toString(); }
const json = path => JSON.parse(read(path));
const source = read(resolve(pub, 'worksheet-viewer-noam.html'));
function fn(name) {
  const start = source.indexOf('function ' + name + '(');
  if (start < 0) throw Error('Missing runtime function ' + name);
  const rest = source.slice(start), end = rest.indexOf('\nfunction ', 1);
  return end < 0 ? rest : rest.slice(0, end);
}
const packages = new Map(), dataCache = new Map(), failures = [], alternates = [];
const c = { exercises: 0, selectedTaskMatches: 0, sourceRequestMatches: 0,
  nativeFigures: 0, validFigureLinks: 0, sourceGivensMatchSelectedFigure: 0, nativeHintsHaveDrawingAction: 0,
  edgeProbes: 0, supportedEdgeProbes: 0, figureKinds: {}, unsupportedReasons: {} };
const vm = { Promise, console, noamNativeFocusPackages: {}, noamSourceGivensCache: {},
  window: { NoamLocalVisual: { wantsVisualSupport: () => false } }, ttl: '', analysisCache: {}, noamRecentThreadText: () => '',
  fetch: async url => {
    if (!url.startsWith('/noam-ai/native/') || url.includes('..')) throw Error('Non-static fetch attempted');
    if (!dataCache.has(url)) dataCache.set(url, json(resolve(pub, url.slice(1))));
    return { ok: true, json: async () => dataCache.get(url) };
  }, cropExerciseImage: async e => 'audit-crop:' + e.id,
  getExerciseAnalysis: () => { throw Error('Unexpected unreviewed analysis route'); }
};
runInNewContext(['noamNativeFocusUrl', 'noamSourceCoordinateView', 'noamNativeSegmentFocus', 'noamSourceGivens', 'noamDiagramSourceInput',
  'noamCanOfferDrawing', 'noamMessageVisualOptions', 'localVisualExerciseSource', 'noamGeometryContext']
  .map(fn).join('\n'), vm);
const rows = ['pilot', 'next-ten', 'second-ten', 'third-ten', 'fourth-ten', 'remaining-101']
  .flatMap(n => json(resolve(app, `src/data/worksheet-${n}.v1.json`)).sheets);
const fail = (e, reason) => failures.push({ exercise: e.id, reason });
for (const row of rows) {
  const manifest = json(resolve(pub, `noam-ai/manifests/${row.pdfId}.json`));
  const data = json(resolve(pub, row.nativeExport.slice(1))); dataCache.set(row.nativeExport, data);
  const stats = packages.get(row.package) || { levels: 0, exercises: 0, nativeFigures: 0, edgeProbes: 0, supportedEdgeProbes: 0 };
  packages.set(row.package, stats); stats.levels++;
  if (manifest.nativeExportSha256 && manifest.nativeExportSha256 !== sha(readFileSync(resolve(pub, row.nativeExport.slice(1)))))
    failures.push({ package: row.package, level: row.nativeLevel, reason: 'native-export-hash' });
  for (const e of manifest.exercises) {
    c.exercises++; stats.exercises++;
    const q = data.questions.find(q => q.id === e.nativeQuestionId);
    const part = q?.items.find(i => i.label === e.part);
    if (part && part.id === e.nativeItemId && part.text === e.text &&
        e.prompt.includes('הסעיף הנבחר: ' + part.text)) c.selectedTaskMatches++;
    else fail(e, 'selected-task-mapping');
    try {
      const request = await vm.noamDiagramSourceInput(e);
      if (request.questionText.includes('הסעיף הנבחר: ' + e.text) && request.imageDataUrl === 'audit-crop:' + e.id) c.sourceRequestMatches++;
      else fail(e, 'diagram-request-scope');
    } catch (err) { fail(e, 'diagram-request:' + err.message); }
    if (!e.nativeFigureUrl) continue;
    c.nativeFigures++; stats.nativeFigures++;
    const f = data.figures.find(f => f.id === part?.figure_id);
    const expectedUrl = row.nativeExport.replace('noam-ai.json', '') + f?.svg;
    if (!f || f.question !== q.id || f.id !== e.nativeFigureId || e.nativeFigureUrl !== expectedUrl ||
        vm.noamNativeFocusUrl(e) !== row.nativeExport || !existsSync(resolve(pub, expectedUrl.slice(1)))) {
      fail(e, 'native-figure-mapping'); continue;
    }
    c.validFigureLinks++;
    const hint = { role: 'assistant', text: 'התבוננו בנתונים של הסעיף.' };
    if (vm.noamCanOfferDrawing(e, { messages: [{ role: 'user', text: 'אפשר רמז 1?', kind: 'רמז 1' }, hint] }, hint)) c.nativeHintsHaveDrawingAction++;
    else fail(e, 'native-hint-has-no-drawing-action');
    // Hash existing SVG, without repeating its mathematical/visual acceptance.
    const svg = read(resolve(pub, expectedUrl.slice(1)));
    const actualView = svg.match(/viewBox="([^"]+)"/)?.[1].split(/\s+/).map(Number);
    const declaredView = [0, 0, ...(f.view?.viewbox || [])];
    if (!actualView || actualView.length !== 4 || declaredView.length !== 4 ||
        actualView.some((n, i) => !Number.isFinite(n) || Math.abs(n - declaredView[i]) > 0.02)) fail(e, 'svg-coordinate-space');
    const kind = f.visual_model?.kind || 'unspecified'; c.figureKinds[kind] = (c.figureKinds[kind] || 0) + 1;
    if (f.id !== q.figure_id) alternates.push({ exercise: e.id, selected: f.id, question: q.figure_id });
    const ticks = Object.fromEntries((f.objects?.marks || []).filter(m => m.kind === 'ticks').map(m => [String(m.name).split('').sort().join(''), m.n]));
    const givens = await vm.noamSourceGivens(e);
    if (givens.every(g => g.segments.every(s => ticks[s.slice().sort().join('')] === g.count))) c.sourceGivensMatchSelectedFigure++;
    else fail(e, 'given-marks-from-another-figure');
    for (const s of f.objects?.segments || []) {
      if (s.kind !== 'segment' || s.role !== 'edge' || !/^[A-Z]{2}$/.test(s.name)) continue;
      c.edgeProbes++; stats.edgeProbes++;
      if (vm.noamNativeSegmentFocus(data, e, 'התבוננו בקטע ' + s.name)) { c.supportedEdgeProbes++; stats.supportedEdgeProbes++; }
      else {
        const reason = f.id !== q.figure_id ? 'alternate-part-figure' :
          (f.objects.points || []).some(p => p.role !== 'vertex') ? 'point-role-or-schema' : 'ambiguous-or-unsupported-geometry';
        c.unsupportedReasons[reason] = (c.unsupportedReasons[reason] || 0) + 1;
      }
    }
  }
}
const reuseBase = 'e414ccb61936d810aab972850d41acb12b2bdc13';
const changed = execFileSync('git', ['diff', '--name-only', reuseBase, '--',
  'headless/astro-poc/public/noam-ai', 'headless/astro-poc/src/data'], { cwd: resolve(app, '../..'), encoding: 'utf8' }).trim();
const report = { at: new Date().toISOString(), revision: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: app, encoding: 'utf8' }).trim(),
  packages: packages.size, levels: rows.length, counts: c, failures, alternatePartFigures: alternates,
  perPackage: Object.fromEntries(packages), inputs: Object.fromEntries(inputs),
  previousAcceptance: { revision: reuseBase, dataDiff: changed, reusedUnchangedContent: !changed },
  scope: 'Real client source-selection and native-focus functions with exact released data. Crop calls are stubbed to verify identity; no PDF/content re-audit, model calls, auth requests, or production writes. Synthetic named-edge probes are not AI acceptance.',
  limitations: ['Dynamic model plans and answer quality are not proven per section.',
    'No native figure is not a missing package; arithmetic and other tasks may use other visual routes.',
    'Unsupported native edge focus can fall through to protected generation; it is not a missing source asset.'] };
if (process.argv[2]) writeFileSync(resolve(process.argv[2]), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ packages: report.packages, levels: report.levels, counts: c, failures: failures.length,
  failureExamples: failures.slice(0, 8), reusedUnchangedContent: !changed }, null, 2));
process.exitCode = failures.length ? 1 : 0;
