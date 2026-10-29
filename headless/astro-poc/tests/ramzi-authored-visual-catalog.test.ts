import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { it } from 'node:test';
import { parseHTML } from 'linkedom';

const pub = new URL('../public/', import.meta.url);
const json = (path: string) => JSON.parse(readFileSync(new URL(path, pub), 'utf8'));
const fixtures = JSON.parse(readFileSync(new URL('./fixtures/ramzi-authored-catalog-fixtures.json', import.meta.url), 'utf8'));
const runtime: any = {};
for (const name of ['noam-native-visual.js', 'noam-authored-geometry.js', 'noam-authored-visual.js']) {
  const file = new URL(name, pub);
  if (name === 'noam-authored-geometry.js' && !existsSync(file)) continue;
  runInNewContext(readFileSync(file, 'utf8'), runtime, { filename: name });
}
const api = runtime.NoamAuthoredVisual;
const opts = { helpKind: 'hint', studentMessage: 'אפשר רמז 1?', answer: 'התבוננו בנתונים המפורשים בשאלה.', drawCurrentStep: true };
const clone = (value: any) => JSON.parse(JSON.stringify(value));
function source(f: any) {
  const data = json(f.nativeExport.replace(/^\//, ''));
  const manifest = json(`noam-ai/manifests/${f.pdfId}.json`);
  const exercise = manifest.exercises.find((e: any) => e.id === f.exerciseId);
  assert.ok(exercise, f.exerciseId);
  assert.equal(exercise.nativeFigureUrl, undefined, f.exerciseId + ': no native SVG fixture');
  return { data, exercise };
}
function resolve(f: any) { const s = source(f); return api.resolve(s.data, s.exercise, opts, ''); }

it('manually reviewed catalog fixtures retain exact authored source hashes and selected identities', () => {
  assert.equal(fixtures.cases.length, 48);
  assert.equal(new Set(fixtures.cases.map((f: any) => f.exerciseId)).size, 48);
  for (const f of fixtures.cases) {
    const nativeBytes = readFileSync(new URL(f.nativeExport.replace(/^\//, ''), pub));
    assert.equal(createHash('sha256').update(nativeBytes).digest('hex'), f.nativeSha256, f.key);
    const { data, exercise } = source(f);
    const q = data.questions.find((q: any) => q.id === f.questionId);
    const item = q.items.find((p: any) => p.id === f.itemId);
    assert.equal(exercise.nativeQuestionId, q.id); assert.equal(exercise.nativeItemId, item.id);
    assert.equal(item.label, f.part); assert.equal(item.text, f.partText);
    assert.equal(Array.isArray(q.text) ? q.text.join('\n') : q.text, f.questionText);
  }
});

for (const f of fixtures.cases) {
  it(`actual ${f.key}/${f.itemId}: ${f.expected} ${f.family} — ${f.requirement}`, () => {
    const scene = resolve(f);
    if (f.expected === 'unsupported') {
      assert.equal(scene, null, `${f.exerciseId}: unsafe or unimplemented data must not become a completed illustration`);
      return;
    }
    assert.ok(scene, `${f.exerciseId}: authored ${f.family} scaffold missing`);
    assert.match(scene.kind, /^authored-/);
    const { document } = parseHTML('<html><body></body></html>');
    const figure = api.render(document, scene);
    assert.ok(figure, `${f.exerciseId}: scene must render, not merely resolve`);
    assert.equal(figure.querySelectorAll('svg').length, 1);
    assert.ok(figure.querySelector('path,line,polygon,polyline,rect,circle'), f.exerciseId);
    assert.ok(figure.querySelector('figcaption')?.textContent.trim(), 'the limited scaffold must have an honest caption');
    assert.equal(figure.querySelectorAll('script,foreignObject,iframe,image').length, 0);
    assert.doesNotMatch(figure.outerHTML, /(?:NaN|Infinity|undefined)/);
    if (f.family === 'function') {
      const expectedCurves = f.exerciseId === 'G9-T31-A-Q11א' ? 1 : 2;
      assert.equal(figure.querySelectorAll('[data-role="given-function"]').length, expectedCurves, 'do not silently discard one member of an authored function set');
    }
  });
}

it('every no-SVG selected subsection in all412 canonical PDFs has a safe exact context', () => {
  let sheets = 0, sections = 0, arrays = 0;
  const failures: string[] = [];
  for (const registry of ['pilot', 'next-ten', 'second-ten', 'third-ten', 'fourth-ten', 'remaining-101']) {
    const data = JSON.parse(readFileSync(new URL(`../src/data/worksheet-${registry}.v1.json`, import.meta.url), 'utf8'));
    for (const sheet of data.sheets) {
      sheets++;
      const native = json(sheet.nativeExport.replace(/^\//, ''));
      const manifest = json(`noam-ai/manifests/${sheet.pdfId}.json`);
      for (const exercise of manifest.exercises) {
        if (exercise.nativeFigureUrl) continue;
        sections++;
        const ctx = runtime.NoamNativeVisual.authoredContext(native, exercise, '');
        if (!ctx) { failures.push(exercise.id); continue; }
        const q = native.questions.find((q: any) => q.id === exercise.nativeQuestionId);
        const item = q.items.find((p: any) => p.id === exercise.nativeItemId);
        const qtext = Array.isArray(q.text) ? q.text.join('\n') : q.text || '';
        assert.equal(ctx.questionText, qtext, exercise.id + ': exact question text, no flattened parent givens');
        assert.equal(ctx.partText, item.text, exercise.id + ': exact selected part');
        if (Array.isArray(q.text)) arrays++;
      }
    }
  }
  assert.equal(sheets, 412); assert.equal(sections, 16290); // Includes fifteen parts explicitly outside their question figure scope.
  assert.ok(arrays > 0, 'actual array-valued question text must be exercised');
  assert.deepEqual(failures, [], 'valid historical IDs must not disable entire released sheets');
});

it('verified level aliases agree with coherent canonical manifests, and unrelated levels remain rejected', () => {
  for (const alias of fixtures.verifiedIdentityAliases) {
    const data = json(alias.nativeExportUrl.replace(/^\//, ''));
    const manifest = json(`noam-ai/manifests/${alias.pdfId}.json`);
    assert.equal(manifest.sourceSha256, alias.pdfSha256);
    assert.equal(manifest.nativeExportUrl, alias.nativeExportUrl);
    assert.equal(data.package, alias.package); assert.equal(data.level, alias.nativeLevel);
    const exercise = manifest.exercises.find((e: any) => !e.nativeFigureUrl);
    assert.ok(runtime.NoamNativeVisual.authoredContext(data, exercise, ''), alias.package);
    const wrong = clone(exercise);
    const badCode = alias.exerciseLevelCode === 'B' ? 'E' : 'B';
    wrong.id = wrong.id.replace(`-${alias.exerciseLevelCode}-Q`, `-${badCode}-Q`);
    assert.equal(runtime.NoamNativeVisual.authoredContext(data, wrong, ''), null, alias.package + ': not a global level bypass');
  }
});

it('unrelated parent givens, sibling parts and other questions cannot influence the selected authored scene', () => {
  const f = fixtures.cases.find((f: any) => f.exerciseId === 'G8-T06-B-Q06ד');
  const { data, exercise } = source(f);
  const original = api.resolve(data, exercise, opts, ''); assert.ok(original);
  const poisoned = clone(data), q = poisoned.questions.find((q: any) => q.id === exercise.nativeQuestionId);
  q.given.push({ text: 'y=99x+998; P(900,900); בנו מעגל חדש' });
  q.items.filter((p: any) => p.id !== exercise.nativeItemId).forEach((p: any) => { p.text = 'שרטטו y=999x+777, נקודה Z(999,999)'; });
  poisoned.questions.filter((p: any) => p.id !== q.id).forEach((p: any) => { p.text = 'שרטטו y=888x+666'; });
  assert.deepEqual(clone(api.resolve(poisoned, exercise, opts, '')), clone(original));
  for (const change of [{ nativeItemId: 'q999a' }, { nativeQuestionId: 'q999' }, { part: 'זז' }, { id: exercise.id.replace(/^G8-T06/, 'G9-T99') }]) {
    assert.equal(api.resolve(data, { ...exercise, ...change }, opts, ''), null);
  }
  assert.equal(api.resolve(data, exercise, { helpKind: 'hint', studentMessage: 'אפשר רמז 1?', answer: 'חשבו על סימני המספרים בלבד.' }, ''), null, 'unrelated automatic hint is not a graph request');
});

it('rendered curve paths preserve a non-grid domain hole and the real square-root domain', () => {
  const f = fixtures.cases.find((f: any) => f.exerciseId === 'G8-T06-B-Q06ד');
  const { data, exercise } = source(f);
  function curve(expression: string) {
    const scene = api.resolve(data, exercise, { helpKind: 'free_question', studentMessage: `שרטט y=${expression}`, answer: '', drawCurrentStep: true }, '');
    assert.ok(scene, expression);
    const { document } = parseHTML('<html><body></body></html>');
    const figure = api.render(document, scene); assert.ok(figure);
    const paths = figure.querySelectorAll('[data-role="given-function"]'); assert.equal(paths.length, 1);
    const d = paths[0].getAttribute('d');
    return Array.from(d.matchAll(/([ML])\s*([\d.e+\-]+)\s+([\d.e+\-]+)/g), (m: any) => ({ command: m[1], x: Number(m[2]), y: Number(m[3]) }));
  }
  // A removable hole has y=1 on both sides, so clipping large y values cannot
  // accidentally make this test pass. The denominator zero is between samples.
  const hole = curve('(x-0.013)/(x-0.013)');
  assert.ok(hole.filter((p: any) => p.command === 'M').length >= 2);
  const polePixel = 45 + (0.013 + 10) * 20;
  let previous: any = null;
  for (const point of hole as any[]) {
    if (point.command === 'L' && previous) assert.ok((point.x - polePixel) * (previous.x - polePixel) > 0, 'a drawn segment crosses an undefined input');
    previous = point;
  }
  const root = curve('sqrt(x-2)') as any[];
  assert.ok(root.length > 20);
  assert.ok(root.every(p => p.x >= 45 + (2 + 10) * 20), 'square root plotted at x<2');
});
