import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { it } from 'node:test';
import { parseHTML } from 'linkedom';

const source = readFileSync(new URL('../public/noam-native-visual.js', import.meta.url), 'utf8');
const context: any = {};
runInNewContext(source, context);
const api = context.NoamNativeVisual;
function json(path: string) { return JSON.parse(readFileSync(new URL('../public/' + path, import.meta.url), 'utf8')); }
function fixture(pkg = 'G7-T09', q = 'q1', part = 'א', level = 'a') {
  const data = json(`noam-ai/native/${pkg}/${level}/noam-ai.json`);
  const question = data.questions.find((x: any) => x.id === q);
  const item = question.items.find((x: any) => x.label === part);
  const figure = data.figures.find((x: any) => x.id === item.figure_id);
  const exercise: any = { id: `${pkg}-${({ a: 'A', b: 'B', c: 'E' } as any)[level]}-Q${q.slice(1).padStart(2, '0')}${part}`, part,
    nativeQuestionId: q, nativeItemId: item.id };
  if (figure) Object.assign(exercise, { nativeFigureId: figure.id, nativeFigureUrl: `/noam-ai/native/${pkg}/${level}/${figure.svg}` });
  const svg = figure ? readFileSync(new URL('../public' + exercise.nativeFigureUrl, import.meta.url), 'utf8') : '';
  return { data, exercise, svg, figure, item, question };
}
const hint = (answer: string) => ({ answer, studentMessage: 'אפשר רמז 1?', helpKind: 'hint' });
const typed = (studentMessage: string, answer = 'התבוננו בקטע BC') => ({ answer, studentMessage, helpKind: 'free_question' });
function resolve(f: any, options: any) { return api.resolve(f.data, f.exercise, options, f.svg); }
function render(f: any, options: any) {
  const { document } = parseHTML('<html><body></body></html>');
  return api.render(document, f.data, f.exercise, options, f.svg);
}

it('coordinate-reading hint rings A without revealing its numeric coordinates', () => {
  const f = fixture(), result = resolve(f, hint('התבוננו בנקודה A.'));
  assert.equal(result.kind, 'source-focus');
  assert.deepEqual(Array.from(result.objectIds), ['pt-A']);
  assert.deepEqual(Array.from(result.markers[0]), [65.1, 96.93]);
  const figure = render(f, hint('התבוננו בנקודה A.'));
  assert.equal(figure.querySelectorAll('[data-role="focus-point"]').length, 1);
  assert.equal(figure.querySelectorAll('text').length, 0);
  assert.doesNotMatch(figure.textContent, /-4|−4|\(-4,\s*3\)/);
});

it('the actual coordinate route accepts data-role segments and highlights AC then CB', () => {
  const f = fixture('G7-T09', 'q3'), result = resolve(f, hint('עקבו אחר המסלול A אל C ומשם אל B.'));
  assert.equal(result.kind, 'source-focus');
  assert.equal(result.shapes.length, 2);
  assert.ok(result.objectIds.includes('seg-AC')); assert.ok(result.objectIds.includes('seg-BC'));
  assert.ok(!result.objectIds.includes('seg-AB'));
});

it('G8-T15 q2a calibrates actual SVG tick labels to identify (0,-9), ignoring other parts', () => {
  const f = fixture('G8-T15', 'q2'), options = hint('שים לב לנקודה (0,−9) ולציר y.'), result = resolve(f, options);
  assert.equal(result.kind, 'source-focus');
  assert.ok(result.objectIds.includes('mark:P')); assert.ok(!result.objectIds.includes('mark:Q'));
  assert.deepEqual(Array.from(result.markers[0]), [29.2, 196.89]);
  // Parent givens also contain (-2,5), belonging to q2b. It is not in q2a.
  assert.equal(resolve(f, hint('התבונן בנקודה (-2,5).')), null);
  assert.equal(render(f, options).querySelectorAll('[data-role="focus-point"]').length, 1);
});

it('bad axis calibration cannot highlight the wrong source point; explicit given points get a separate plot', () => {
  const f = fixture('G8-T15', 'q2');
  f.svg = f.svg.replace('>−9</text>', '>−3</text>');
  const result = resolve(f, hint('התבונן בנקודה (0,-9).'));
  assert.equal(result.kind, 'coordinate-illustration');
  assert.equal(result.objectIds, undefined);
  assert.deepEqual(Array.from(result.points[0]), [0, -9]);
});

it('an angle is identified from its two existing source sides without asserting equality', () => {
  const f = fixture('G8-T39', 'q2', 'ד'), result = resolve(f, typed('הראה את הזווית ABC'));
  assert.equal(result.kind, 'source-focus'); assert.equal(result.arcs.length, 1);
  const figure = render(f, typed('הראה את הזווית ABC'));
  assert.equal(figure.querySelectorAll('path').length, 1);
  assert.doesNotMatch(figure.textContent, /שוות|שווים/);
});

it('trusted source polygons, circles, chart sectors and function curves are highlighted as existing objects', () => {
  for (const [pkg, q, level, request, id] of [
    ['G7-T08', 'q8', 'b', 'הדגש את המשולש ABC', 'poly-ABC'],
    ['G7-T11', 'q3', 'a', 'הדגש את המעגל', 'cir-7d0708'],
    ['G7-T24', 'q5', 'a', 'הדגש את הגזרה A', 'sector:qe:a'],
    ['G8-T15', 'q4', 'a', 'הדגש את הגרף', 'curve:f'],
  ]) {
    const f = fixture(pkg, q, 'א', level), result = resolve(f, typed(request));
    assert.equal(result.kind, 'source-focus', pkg);
    assert.ok(result.objectIds.includes(id), id);
    const figure = render(f, typed(request));
    assert.equal(figure.getAttribute('data-visual-kind'), 'source-focus');
    assert.ok(figure.querySelector('image'));
    assert.ok(figure.querySelector('line,path,circle,polygon'));
  }
});

it('typed focus owns its scope and cannot inherit the previous answer', () => {
  const f = fixture(), result = resolve(f, typed('סמן לי את B', 'התבונן בנקודה A'));
  assert.deepEqual(Array.from(result.objectIds), ['pt-B']);
  assert.equal(resolve(f, typed('בנה מעגל חדש דרך A ו-B', 'התבונן בנקודה A')), null);
  assert.equal(resolve(f, typed('שרטט ישר מקביל ל-AB דרך C')), null);
  assert.equal(resolve(f, typed('סמן את הקטע ZZ', 'התבונן בנקודה A')), null);
});

it('a combined focus is rejected when one named object is unresolved, including hint buttons', () => {
  const f = fixture('G7-T48', 'q1');
  assert.equal(resolve(f, hint('התבונן ב-BH וב-CH המאונכים')), null);
});

it('plain source-context is explicitly labeled and does not claim a newly generated drawing', () => {
  const f = fixture(), figure = render(f, typed('הראה את השרטוט המקורי'));
  assert.equal(figure.getAttribute('data-visual-kind'), 'source-context');
  assert.equal(figure.querySelectorAll('image').length, 1);
  assert.match(figure.textContent, /השרטוט המקורי.*לא נוספה הדגשה/);
});

it('empty action lists and partial semantic coverage still allow honest original source display', () => {
  for (const [pkg, q] of [['G8-T26', 'q3'], ['G7-T31', 'q9']]) {
    const f = fixture(pkg, q), result = resolve(f, typed('הראה את השרטוט המקורי'));
    assert.equal(result.kind, 'source-context', pkg);
    assert.ok(render(f, typed('הראה את השרטוט המקורי')).querySelector('image'));
  }
});

it('explicit formulas produce a new coordinate graph; unsupported expressions never truncate', () => {
  const f = fixture('G8-T15', 'q2');
  for (const expression of ['y=x/2', 'y=x+1/2', 'y=2x(x+1)', 'y=x^3', 'y=x\\frac{1}{2}', 'y=mx+b']) {
    assert.equal(api.formula('שרטט ' + expression), null, expression);
  }
  const figure = render(f, typed('שרטט y=2x+3'));
  assert.equal(figure.getAttribute('data-visual-kind'), 'coordinate-illustration');
  assert.equal(figure.querySelectorAll('[data-role="given-function"]').length, 1);
  assert.match(figure.textContent, /y=2x\+3/);
  const existingCurve = fixture('G8-T15', 'q4');
  assert.equal(resolve(existingCurve, typed('שרטט גרף y=x/2')), null);
});

it('hint points can be plotted without connecting them or computing the requested function', () => {
  const f = fixture('G8-T15', 'q2');
  // No figure/metadata simulates a native text-only task with explicit point givens.
  f.item.figure_id = null; f.data.figures = [];
  delete f.exercise.nativeFigureUrl; delete f.exercise.nativeFigureId; f.svg = '';
  const figure = render(f, hint('התבונן בנקודה (0,-9). המשוואה היא y=5x-9.'));
  assert.equal(figure.getAttribute('data-visual-kind'), 'coordinate-illustration');
  assert.equal(figure.querySelectorAll('[data-role="given-function"]').length, 0);
  assert.equal(figure.querySelectorAll('[data-role="explicit-point"]').length, 1);
  assert.doesNotMatch(figure.textContent, /y=5x-9/);
});

it('source identity, exact selected item and SVG coordinate space are validated', () => {
  const f = fixture();
  assert.equal(api.resolve(f.data, { ...f.exercise, nativeItemId: 'q1b' }, hint('נקודה A'), f.svg), null);
  assert.equal(api.resolve(f.data, { ...f.exercise, nativeFigureUrl: 'https://example.com/a.svg' }, hint('נקודה A'), f.svg), null);
  assert.equal(api.resolve(f.data, { ...f.exercise, id: 'G8-T15-A-Q01א' }, hint('נקודה A'), f.svg), null);
  assert.equal(resolve({ ...f, svg: f.svg.replace('viewBox="0 0 297.5 272.0"', 'viewBox="0 0 300 300"') }, hint('נקודה A')), null);
});

it('malformed or ambiguous coordinates fail closed and saved injected coordinates are ignored', () => {
  const f = fixture(), p = f.figure.visual_model.objects.find((o: any) => o.id === 'pt-A');
  assert.deepEqual(Array.from(resolve(f, { ...hint('נקודה A'), markers: [[999, 999]], url: 'https://example.com' }).markers[0]), [65.1, 96.93]);
  p.svg_xy = [99999, 0]; assert.equal(resolve(f, hint('נקודה A')), null);
  const g = fixture(); g.figure.visual_model.objects.push({ ...g.figure.visual_model.objects.find((o: any) => o.id === 'pt-A'), id: 'pt-A-copy' });
  assert.equal(resolve(g, hint('נקודה A')), null);
});

it('renderer never inserts source script/event markup or arbitrary external URLs', () => {
  const f = fixture('G8-T15', 'q2');
  f.svg = f.svg.replace('<svg ', '<svg onload="evil()" ').replace('</svg>', '<script>evil()</script><image href="https://example.com/tracker"/></svg>');
  const figure = render(f, hint('התבונן בנקודה (0,-9) ובציר y.'));
  assert.equal(figure.querySelectorAll('script,[onload]').length, 0);
  assert.equal(figure.querySelectorAll('image').length, 1);
  assert.equal(figure.querySelector('image').getAttribute('href'), f.exercise.nativeFigureUrl);
});

it('root and public consumers remain identical', () => {
  assert.equal(readFileSync(new URL('../../../noam-native-visual.js', import.meta.url), 'utf8'), source);
});
