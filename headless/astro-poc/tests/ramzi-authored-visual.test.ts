import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { it } from 'node:test';
import { parseHTML } from 'linkedom';
const context: any = {};
for (const file of ['noam-native-visual.js', 'noam-authored-visual.js']) runInNewContext(readFileSync(new URL('../public/' + file, import.meta.url), 'utf8'), context);
const api = context.NoamAuthoredVisual;
function fixture(pkg: string, level: string, id: string, label: string) {
  const data = JSON.parse(readFileSync(new URL(`../public/noam-ai/native/${pkg}/${level}/noam-ai.json`, import.meta.url), 'utf8'));
  const q = data.questions.find((q: any) => q.id === id), part = q.items.find((p: any) => p.label === label);
  return { data, q, part, exercise: { id: `${data.package}-${({ a: 'A', b: 'B', c: 'E' } as any)[level]}-Q${id.slice(1).padStart(2, '0')}${label}`, part: label, nativeQuestionId: id, nativeItemId: part.id } };
}
const draw = { studentMessage: 'אפשר רמז 1?', helpKind: 'hint', answer: 'התבוננו בנתונים הנתונים.', drawCurrentStep: true };
const typed = (studentMessage: string) => ({ studentMessage, helpKind: 'free_question' });
function resolve(f: any, options: any = draw) { return api.resolve(f.data, f.exercise, options, ''); }
function render(scene: any) { const { document } = parseHTML('<html><body></body></html>'); return api.render(document, scene); }
const plain = (value: any) => JSON.parse(JSON.stringify(value));
it('parses complete bounded ASTs without executing code or accepting prefixes', () => {
  for (const [expression, value] of [['x/2', 1.5], ['-x^2+2', -7], ['x(x+1)', 12], ['\\frac{x}{2}+3', 4.5], ['\\f{x}{2}+3', 4.5], ['\\sqrt{x+1}', 2]] as const) assert.equal(api.evaluate(api.parseExpression(expression), 3), value, expression);
  for (const expression of ['x/2xxx', 'x;alert(1)', 'x.constructor', 'x^9', 'x+Infinity', 'Math.sin(x)', 'x+1/', '\\frac{x}{2}oops', 'x'.repeat(500)]) assert.equal(api.parseExpression(expression), null, expression);
  assert.ok(Number.isNaN(api.evaluate(api.parseExpression('1/(x-2)'), 2)));
});
it('rejects a coefficient LHS and a valid half of a parameterized system', () => {
  assert.deepEqual(plain(api.formulas('$15-3y=x$')), []);
  assert.deepEqual(plain(api.formulas('$y=mx+2$, $y=3x-4$')), []);
  assert.deepEqual(plain(api.formulas('$y=x/2$')).map((f: any) => f.expression), ['x/2']);
});
it('draws original proposed intervals without repairing the answer', () => {
  const f = fixture('G8-T28', 'b', 'q8', 'ב'), scene = resolve(f,{...draw,answer:'האם יש מספרים בין 20 ל-21 שאינם נכללים במחלקה?'});
  assert.equal(scene.kind, 'authored-intervals');
  assert.deepEqual(plain(scene.intervals), [{ start: 16, end: 20, closedStart: true, closedEnd: true }, { start: 21, end: 25, closedStart: true, closedEnd: true }]);
  const card = render(scene); assert.equal(card.querySelectorAll('[data-role="given-interval"]').length, 2);
  assert.match(card.textContent, /לא תוקנה/); assert.doesNotMatch(card.textContent, /20\.5/);
  assert.equal(resolve(f, typed('מה התשובה?')), null); assert.equal(resolve(f, typed('הראה את השאלה המקורית')), null);
});
it('shows rational input operation without forbidden input or computed output', () => {
  const scene = resolve(fixture('G8-T11', 'b', 'q14', 'א'));
  assert.equal(scene.kind, 'authored-input-machine'); assert.equal(scene.expression, '8/(x-2)');
  const card = render(scene); assert.match(card.textContent, /x-2/); assert.match(card.textContent, /\?/); assert.doesNotMatch(card.textContent, /x=2|אסור.*2|undefined|NaN/);
});
it('rational plotting breaks at poles and rejects executable trailing content', () => {
  const f = fixture('G8-T11', 'b', 'q14', 'א'), scene = resolve(f, typed('שרטט y=8/(x-2)'));
  assert.equal(scene.kind, 'authored-function'); const card = render(scene), path = card.querySelector('[data-role="given-function"]').getAttribute('d');
  assert.ok((path.match(/M/g) || []).length >= 2);
  assert.equal(api.range(api.parseExpression('8/(x-2)'), 1.9, 2.1), null);
  assert.equal(api.range(api.parseExpression('8/(x-2)^2'), 1.9, 2.1), null);
  assert.equal(card.querySelector('bdi').dir, 'ltr'); assert.equal(resolve(f, typed('שרטט y=x;alert(1)')), null);
});
it('plots both authored functions without intersection answers and rejects missing parameters/domain', () => {
  const scene = resolve(fixture('G8-T06', 'b', 'q6', 'ד')); assert.equal(scene.expressions.length, 2);
  const card = render(scene); assert.equal(card.querySelectorAll('[data-role="given-function"]').length, 2); assert.equal(card.querySelectorAll('circle').length, 0);
  assert.equal(resolve(fixture('G8-T06', 'c', 'q2', 'ד')), null); assert.equal(resolve(fixture('G7-T31', 'a', 'q12', 'ד')), null);
});
it('number-line source points do not include targets from a later part', () => {
  const scene = resolve(fixture('G7-ASSESS1', 'b', 'q8', 'א')); assert.equal(scene.kind, 'authored-number-line');
  assert.deepEqual(plain(scene.points), [{ name: 'P', value: 6 }, { name: 'Q', value: -7 }]); assert.equal(render(scene).querySelectorAll('[data-role="given-point"]').length, 2);
  assert.equal(resolve(fixture('G7-ASSESS1', 'b', 'q8', 'ב')), null);
});
it('given physical inequality does not acquire an unstated nonnegative constraint', () => {
  const scene = resolve(fixture('G8-T04', 'a', 'q16', 'ג')); assert.deepEqual(plain(scene.condition), { operator: '<', boundary: 2.5 }); assert.equal(scene.tick, .5);
  const card = render(scene); assert.equal(card.querySelector('[data-role="given-inequality"]').getAttribute('x1'), '30'); assert.doesNotMatch(card.textContent, /x\s*[≥>]\s*0/);
});
it('selection checks the actual exercise question/part against native pointers', () => {
  const f = fixture('G8-T28', 'b', 'q8', 'ב'); f.exercise.id = 'G8-T28-B-Q09ב'; assert.equal(resolve(f), null); f.exercise.id = 'G8-T28-B-Q08א'; assert.equal(resolve(f), null);
});
it('render validates scenes and uses text nodes for text containing markup', () => {
  assert.equal(render({ kind: 'authored-function', caption: 'x', expression: 'x.constructor' }), null);
  assert.equal(render({ kind: 'authored-number-line', caption: 'x', min: 0, max: 1, points: [{ name: '<img>', value: .5 }] }), null);
  const card = render({ kind: 'authored-function', caption: '<img src=x onerror=alert(1)>', expression: 'x/2' }); assert.equal(card.querySelector('img,script'), null); assert.match(card.textContent, /<img/);
});
