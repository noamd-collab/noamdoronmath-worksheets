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
function fixture(pkg: string, level: string, q: string, part = 'א') {
  const data = json(`noam-ai/native/${pkg}/${level}/noam-ai.json`);
  const item = data.questions.find((x: any) => x.id === q).items.find((x: any) => x.label === part);
  const figure = data.figures.find((x: any) => x.id === item.figure_id);
  const exercise: any = { id: `${pkg}-${({ a: 'A', b: 'B', c: 'E' } as any)[level]}-Q${q.slice(1).padStart(2, '0')}${part}`, part,
    nativeQuestionId: q, nativeItemId: item.id, nativeFigureId: figure.id, nativeFigureUrl: `/noam-ai/native/${pkg}/${level}/${figure.svg}` };
  const svg = readFileSync(new URL('../public' + exercise.nativeFigureUrl, import.meta.url), 'utf8');
  return { data, exercise, svg };
}
const hint = (answer: string) => ({ answer, studentMessage: 'אפשר רמז 1?', helpKind: 'hint' });
const resolve = (f: any, text: string) => api.resolve(f.data, f.exercise, hint(text), f.svg);
const render = (f: any, text: string) => api.render(parseHTML('<html><body></body></html>').document, f.data, f.exercise, hint(text), f.svg);
const trapezoid = () => fixture('G9-TRAP', 'b', 'q1');
const angles = (s: any) => Array.from(s.caption.match(/∠[A-Z]{3}/g) || []).sort();

it('the trapezoid angles beside each leg are drawn as four arcs, with no side painted in their place', () => {
  const text = 'בדקו את הזוויות שליד השוק EH ושליד השוק FG, בין הבסיסים המקבילים.';
  const s = resolve(trapezoid(), text);
  assert.equal(s.kind, 'source-focus');
  assert.equal(s.arcs.length, 4);
  assert.equal(s.shapes.length, 0);
  assert.deepEqual(angles(s), ['∠EFG', '∠EHG', '∠FEH', '∠FGH']);
  const figure = render(trapezoid(), text);
  assert.equal(figure.querySelectorAll('path[data-role="focus-angle"]').length, 4);
  assert.equal(figure.querySelectorAll('line').length, 0);
});

it('single-letter, vertex-phrase and base-phrase angles resolve to the polygon angle at that vertex', () => {
  assert.deepEqual(angles(resolve(trapezoid(), 'האם ∠E ו־∠H משלימות זו את זו?')), ['∠EHG', '∠FEH']);
  assert.deepEqual(angles(resolve(trapezoid(), 'האם הזוויות E ו־H משלימות?')), ['∠EHG', '∠FEH']);
  assert.deepEqual(angles(resolve(trapezoid(), 'חשבו את שתי הזוויות שליד הבסיס HG.')), ['∠EHG', '∠FGH']);
  assert.deepEqual(angles(resolve(trapezoid(), 'מה ידוע על הזווית שבקודקוד F?')), ['∠EFG']);
  const all = resolve(trapezoid(), 'האם זוויות הטרפז EFGH מסתכמות ב־360°?');
  assert.equal(all.arcs.length, 4);
  assert.equal(all.shapes.length, 0, 'the polygon only located the angles');
});

it('explicit three-letter angles keep their arcs and an explicitly named side stays a side', () => {
  const s = resolve(trapezoid(), 'השוו את ∠FEH ו־∠EFG ואת האורך EF.');
  assert.deepEqual(angles(s), ['∠EFG', '∠FEH']);
  assert.equal(s.shapes.length, 1);
  assert.match(s.caption, /EF/);
});

it('an angle hint whose angle cannot be identified shows the source unmarked instead of painting sides', () => {
  const generic = resolve(trapezoid(), 'בכל טרפז יש זוויות סמוכות. איזה זוג בטרפז EFGH?');
  assert.equal(generic.kind, 'source-context');
  assert.equal(generic.shapes.length + generic.arcs.length + generic.markers.length, 0);
  // E meets EF, EH and the diagonal EG: without a named polygon the angle is ambiguous.
  const diagonal = fixture('G9-T40', 'b', 'q4');
  for (const text of ['∠E', 'האם ∠E שווה ל־∠G?', 'האם ∠E שווה ל־∠F?']) {
    const ambiguous = resolve(diagonal, text);
    assert.equal(ambiguous.kind, 'source-context');
    assert.equal(ambiguous.shapes.length + ambiguous.arcs.length + ambiguous.markers.length, 0);
    assert.match(ambiguous.caption, /אינה חד־משמעית/);
    assert.ok(render(diagonal, text), 'the exact source remains renderable without generation');
  }
  assert.equal(resolve(diagonal, 'האם ∠E שווה ל־∠Z?'), null, 'an unknown vertex is still rejected');
  assert.deepEqual(angles(resolve(diagonal, 'במרובע EFGH, האם ∠E שווה ל־∠G?')), ['∠FEH', '∠FGH']);
});

it('sides-only hints and the right-triangle adjective keep their existing side focus', () => {
  const sides = resolve(trapezoid(), 'מה ידוע על השוקיים EH ו־FG?');
  assert.equal(sides.arcs.length, 0);
  assert.equal(sides.shapes.length, 2);
  const right = fixture('G7-T48', 'b', 'q20');
  const triangle = resolve(right, 'הבסיס הוא משולש ישר־זווית ABC.');
  assert.equal(triangle.arcs.length, 0, '"ישר־זווית" names the triangle, not an angle');
  assert.ok(triangle.shapes.length >= 3);
});

it('the highlight over the black source figure is a distinct orange at full opacity', () => {
  const sides = render(trapezoid(), 'מה ידוע על השוקיים EH ו־FG?');
  const lines = Array.from(sides.querySelectorAll('line')) as any[];
  assert.equal(lines.length, 2);
  for (const line of lines) { assert.equal(line.getAttribute('stroke'), '#e8590c'); assert.equal(line.getAttribute('stroke-opacity'), '1'); }
  const arcs = Array.from(render(trapezoid(), 'האם ∠E ו־∠H משלימות?').querySelectorAll('path[data-role="focus-angle"]')) as any[];
  assert.ok(arcs.length && arcs.every(a => a.getAttribute('stroke') === '#e8590c'));
  assert.doesNotMatch(source.match(/function shapeOverlay[\s\S]*?\n  }/)![0], /#1769aa/);
});
