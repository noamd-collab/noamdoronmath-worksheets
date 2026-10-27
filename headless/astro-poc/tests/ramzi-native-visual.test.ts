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

it('the actual G8-T50 hint about בנוסחת focuses AC instead of treating it as בנו', () => {
  const f = fixture('G8-T50', 'q3', 'ד', 'c');
  const result = resolve(f, hint('כדי למצוא את אורך האלכסון AC, השתמשו בנוסחת המרחק בין שתי נקודות במערכת הצירים.'));
  assert.equal(result.kind, 'source-focus');
  assert.ok(result.objectIds.includes('seg-AC'));
  assert.equal(resolve(f, typed('בנו מעגל חדש דרך A ו-C')), null);
  assert.equal(resolve(f, typed('שרטט ישר מקביל ל-AC דרך B')), null);
});

it('a real draw-button request can plot the sole authored formula without revealing the requested input', () => {
  const f = fixture('G8-T12', 'q1', 'א', 'b');
  const options = hint('התבוננו בטבלה וחפשו את הפלט המבוקש.');
  assert.equal(resolve(f, options), null, 'automatic hints must not invent a drawing request');
  const drawn = resolve(f, { ...options, drawCurrentStep: true });
  assert.equal(drawn.kind, 'coordinate-illustration');
  assert.equal(drawn.formula.expression, 'y=2x-6');
  assert.equal(drawn.points.length, 0, 'the answer x=5 must not become a plotted point');
  assert.equal(render(f, { ...options, drawCurrentStep: true }).querySelectorAll('[data-role="given-function"]').length, 1);
  f.item.text += ' השוו גם לפונקציה y=x+1.';
  assert.equal(resolve(f, { ...options, drawCurrentStep: true }), null, 'two authored functions need a specific request');
});

it('a generic draw action cannot substitute source context for a hypothetical or new construction', () => {
  const f = fixture('G8-T12', 'q1', 'א', 'b');
  for (const request of ['בנו מעגל חדש', 'תן דוגמה נגדית', 'הראה גרף אחר', 'נניח שהפונקציה שונה']) {
    assert.equal(resolve(f, { ...typed(request), drawCurrentStep: true }), null, request);
  }
  const source = fixture();
  assert.equal(resolve(source, { ...hint('נסו לחשוב על דוגמה נגדית דרך A.'), drawCurrentStep: true }), null);
  assert.equal(resolve(f, typed('הראה גרף אחר y=x^2-4')).formula.expression, 'y=x^2-4', 'an explicitly supplied formula defines its own plot');
});

it('W03 q5d honors the selected counterexample task when the real hint omits that word', () => {
  const f = fixture('G9-3060', 'q5', 'ד', 'c');
  f.exercise.id = f.exercise.id.replace('G9-3060-', 'G9-T37-');
  const actual = hint('חשבו על משולש שיש בו זווית של 30° אך הוא אינו ישר-זווית, ובדקו האם הצלע שמול הזווית עדיין שווה למחצית הצלע הארוכה ביותר.');
  assert.doesNotMatch(actual.answer, /דוגמה נגדית/);
  assert.equal(resolve(f, actual), null);
  assert.equal(resolve(f, { ...actual, drawCurrentStep: true }), null);
  assert.equal(resolve(f, typed('הראה את השרטוט המקורי')).kind, 'source-context', 'explicit source viewing stays honest and available');
  assert.equal(resolve(f, { ...typed('שרטט y=x^2-4'), drawCurrentStep: true }).formula.expression, 'y=x^2-4');
  const sibling = fixture('G9-3060', 'q5', 'א', 'c');
  assert.equal(resolve(sibling, hint('התבוננו בקטע AF.')).kind, 'source-focus', 'counterexample intent must not leak to another part');
});

it('only the two approved one-level packages map site B identities to native a', () => {
  for (const [pkg, pdf] of [['G8-T01', '8adcec2943024c2ab1c55a9153263c63'], ['G8-T35', '0b35039ff7184b488eb37f1c0e37b493']]) {
    const manifest = json(`noam-ai/manifests/${pdf}.json`);
    const exercise = manifest.exercises.find((e: any) => e.nativeFigureUrl);
    const f = fixture(pkg, exercise.nativeQuestionId, exercise.part);
    f.exercise = exercise;
    assert.match(f.exercise.id, /-B-Q/);
    assert.equal(resolve(f, typed('הראה את השרטוט המקורי')).kind, 'source-context');
    assert.equal(api.resolve(f.data, { ...f.exercise, nativeFigureUrl: f.exercise.nativeFigureUrl.replace('/a/', '/b/') }, typed('הראה את השרטוט המקורי'), f.svg), null);
  }
  const other = fixture('G8-T15', 'q2');
  other.exercise.id = other.exercise.id.replace('-A-Q', '-B-Q');
  assert.equal(resolve(other, typed('הראה את השרטוט המקורי')), null);
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

it('formula captions keep the full expression in one LTR island, including expanded clones', () => {
  const f = fixture('G8-T15', 'q2');
  for (const expression of ['y=x^2-4', 'y=2x+3', 'y=-2.5x^2+3']) {
    const options = typed('שרטט ' + expression), figure = render(f, options);
    for (const rendered of [figure, figure.cloneNode(true)]) {
      const caption = rendered.querySelector('figcaption'), token = caption.querySelector('bdi');
      assert.equal(caption.textContent, resolve(f, options).caption);
      assert.equal(caption.querySelectorAll('bdi').length, 1);
      assert.equal(token.textContent, expression);
      assert.equal(token.getAttribute('dir'), 'ltr');
      assert.equal(token.style.direction, 'ltr');
      assert.equal(token.style.unicodeBidi, 'isolate');
      assert.equal(token.style.whiteSpace, 'nowrap');
      assert.equal(token.childNodes.length, 1, 'math must remain one text run, including powers and signs');
      assert.equal(token.firstChild.nodeType, 3);
      assert.equal(caption.firstChild.nodeType, 3, 'Hebrew prose remains available to the glossary');
    }
  }
});

it('source-focus captions isolate existing Latin names and angle notation without changing their text', () => {
  for (const [f, options, expected] of [
    [fixture(), hint('התבוננו בנקודה A.'), 'A'],
    [fixture('G8-T15', 'q2'), hint('התבונן בנקודה (0,-9) ובציר y.'), 'y'],
    [fixture('G8-T39', 'q2', 'ד'), typed('הראה את הזווית ABC'), '∠ABC'],
  ] as const) {
    const caption = render(f, options).querySelector('figcaption');
    assert.equal(caption.textContent, resolve(f, options).caption);
    assert.ok(Array.from(caption.querySelectorAll('bdi')).some((node: any) =>
      node.textContent === expected && node.getAttribute('dir') === 'ltr'));
    assert.ok(Array.from(caption.childNodes).some((node: any) => node.nodeType === 3 && /[א-ת]/.test(node.textContent)));
  }
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

it('the actual W34 given tuples keep labels away from both axes, including expanded clones', () => {
  const f = fixture('G7-T09', 'q3', 'א', 'b');
  const figure = render(f, typed('סמן במערכת צירים רק את הנקודות הנתונות E(-1,-1), F(3,-1), G(3,3), ללא חיבור ביניהן.'));
  const given = [[-1, -1], [3, -1], [3, 3]];
  for (const rendered of [figure, figure.cloneNode(true)]) {
    assert.equal(rendered.getAttribute('data-visual-kind'), 'coordinate-illustration');
    const points = Array.from(rendered.querySelectorAll('[data-role="explicit-point"]')) as any[];
    assert.equal(points.length, 3, 'only the three given points are plotted; no computed fourth vertex');
    assert.equal(rendered.querySelectorAll('path,image').length, 0);
    given.forEach(([x, y], i) => {
      const label = Array.from(rendered.querySelectorAll('text')).find((node: any) => node.textContent === `(${x}, ${y})`) as any;
      assert.ok(label, 'the literal coordinate pair is preserved');
      const pointX = Number(points[i].getAttribute('cx')), pointY = Number(points[i].getAttribute('cy'));
      assert.equal(label.getAttribute('text-anchor'), x < 0 ? 'end' : 'start');
      assert.ok(x < 0 ? Number(label.getAttribute('x')) < pointX : Number(label.getAttribute('x')) > pointX, 'the label extends away from the vertical axis');
      assert.ok(y < 0 ? Number(label.getAttribute('y')) > pointY + 13 : Number(label.getAttribute('y')) < pointY, 'the whole text height stays away from the horizontal axis');
    });
  }
});

it('explicit point label directions cover every quadrant without changing the plotted values', () => {
  const figure = render(fixture('G7-T09', 'q3', 'א', 'b'), typed('סמן את הנקודות (-2,2), (2,2), (-2,-2), (2,-2)'));
  const points = Array.from(figure.querySelectorAll('[data-role="explicit-point"]')) as any[];
  assert.equal(points.length, 4);
  [[-2, 2], [2, 2], [-2, -2], [2, -2]].forEach(([x, y], i) => {
    const label = Array.from(figure.querySelectorAll('text')).find((node: any) => node.textContent === `(${x}, ${y})`) as any;
    assert.ok(label);
    assert.equal(label.getAttribute('text-anchor'), x < 0 ? 'end' : 'start');
    assert.equal(Math.sign(Number(label.getAttribute('x')) - Number(points[i].getAttribute('cx'))), Math.sign(x));
    assert.equal(Math.sign(Number(label.getAttribute('y')) - Number(points[i].getAttribute('cy'))), -Math.sign(y));
  });
});

it('far-left and far-right tuples stay inside the existing canvas without moving points or axes', () => {
  const figure = render(fixture('G7-T09', 'q3', 'א', 'b'), typed('סמן את הנקודות (-100,-100), (100,-100)'));
  assert.equal(figure.querySelector('svg').getAttribute('viewBox'), '0 0 440 340');
  const points = Array.from(figure.querySelectorAll('[data-role="explicit-point"]')) as any[];
  assert.equal(points.length, 2);
  [-100, 100].forEach((x, i) => {
    const label = Array.from(figure.querySelectorAll('text')).find((node: any) => node.textContent === `(${x}, -100)`) as any;
    const labelX = Number(label.getAttribute('x')), width = label.textContent.length * 13 * .65;
    const left = labelX - (label.getAttribute('text-anchor') === 'end' ? width : 0);
    const right = labelX + (label.getAttribute('text-anchor') === 'start' ? width : 0);
    assert.ok(left >= 4 && right <= 436, 'the complete numeric text has a conservative margin within the original viewBox');
    assert.equal(Number(points[i].getAttribute('cx')), 42 + (x + 101) * (440 - 84) / 202, 'given x coordinates retain the original transform');
    assert.equal(Number(points[i].getAttribute('cy')), 340 - 42 - (1 * (340 - 84) / 106), 'given y coordinates retain the original transform');
  });
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
