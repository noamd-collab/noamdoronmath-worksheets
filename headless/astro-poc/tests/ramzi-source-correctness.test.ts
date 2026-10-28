import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { it } from 'node:test';
import { parseHTML } from 'linkedom';

const root = new URL('../public/', import.meta.url);
const read = (path: string) => readFileSync(new URL(path.replace(/^\//, ''), root), 'utf8');
const { document } = parseHTML('<html><body></body></html>');
const c: any = { document }; c.window = c;
for (const file of ['noam-native-visual.js', 'noam-authored-geometry.js', 'noam-authored-visual.js', 'noam-visual-data.js', 'noam-visual-plan.js']) runInNewContext(read(file), c, { filename: file });
const native = c.NoamNativeVisual, authored = c.NoamAuthoredVisual, plans = c.NoamVisualPlan;
const draw = { studentMessage: 'אפשר רמז 1?', helpKind: 'hint', answer: 'התבוננו בגרף ובכלל הנתון.', drawCurrentStep: true };
const inVm = (value: any) => runInNewContext('JSON.parse(' + JSON.stringify(JSON.stringify(value)) + ')', c);
const exprs = (list: any) => list ? Array.from(list, (f: any) => f.label + '=' + f.expression) : null;
const manifests: Record<string, any> = {};
for (const grade of JSON.parse(readFileSync(new URL('../src/data/catalog.v1.json', import.meta.url), 'utf8')).grades)
  for (const topic of grade.topics) for (const level of topic.levels) {
    try { const m = JSON.parse(read(`noam-ai/manifests/${level.pdfId}.json`)); if (m.nativeExportUrl) manifests[m.nativeExportUrl] = m; } catch {}
  }
function section(pkg: string, q: number, part: string) {
  const manifest = manifests[`/noam-ai/native/${pkg}/noam-ai.json`], exercise = manifest.exercises.find((e: any) => e.q === q && e.part === part);
  const data = JSON.parse(read(manifest.nativeExportUrl)), svg = exercise.nativeFigureUrl ? read(exercise.nativeFigureUrl) : '';
  const context = native.authoredContext(data, exercise, svg); assert.ok(context, `${pkg} q${q}${part} context`);
  return { data, exercise, svg, context, typed: (hint = '', student = '') => inVm({ ...context, hintText: hint, studentMessage: student }) };
}
const functionPlan = (quotes: Array<[string, string]>) => inVm({ version: 2, status: 'ok', family: 'function', evidence: quotes.map(([source, quote]) => ({ source, quote })) });

const operations = (quote: string) => inVm({ version: 2, status: 'ok', family: 'operations', expression: quote.slice(1, -1), evidence: [{ source: 'question', quote }] });
it('q17ב: an operations plan cannot import the other system from the shared stem', () => {
  const f = section('G9-T13/a', 17, 'ב'), context = f.typed('פתרו את המערכת השנייה.');
  for (const quote of ['$y=x−3$', '$y=x ^2−5x+2$']) {
    assert.ok(f.context.questionText.includes(quote), quote + ' is printed in the stem');
    assert.deepEqual({ ...plans.inspect(operations(quote), context), scene: null }, { ok: false, scene: null, reason: 'ambiguous_function_scope' }, quote);
  }
  // The second system is printed under 'בשנייה', so its own formulas remain usable.
  for (const quote of ['$y=x ^2−2$', '$y=2x+1$']) {
    const own = plans.inspect(operations(quote), context);
    assert.equal(own.ok, true, quote); assert.equal(own.scene.kind, 'typed-operations');
  }
  // Ordinary operations plans keep working.
  const plain = inVm({ questionText: 'נתון הביטוי $8/(x-2)$.', partText: 'התבוננו בסדר הפעולות.', hasFigure: false, hintText: '', studentMessage: '' });
  const ok = plans.inspect(inVm({ version: 2, status: 'ok', family: 'operations', expression: '8/(x-2)', evidence: [{ source: 'question', quote: plain.questionText }] }), plain);
  assert.equal(ok.ok, true); assert.equal(ok.scene.kind, 'typed-operations');
});

it('equation, substitution and input conditions are not new functions', () => {
  // 'רשמו את הקלט שעבורו f(x)=4' with no formula given: keep the original graph.
  assert.equal(authored.functionSources(section('G8-T16/a', 1, 'ב').context), null);
  assert.equal(authored.fromContext(section('G8-T16/a', 1, 'ב').context, draw), null);
  // 'הציבו y = 0 במשוואת הפונקציה' and three equations on a piecewise graph.
  assert.equal(authored.functionSources(section('G9-T34/b', 8, 'ג').context), null);
  assert.equal(authored.functionSources(section('G9-T12/b', 5, 'ג').context), null);
  assert.deepEqual(exprs(authored.functionSources(section('G9-T34/a', 8, 'ב').context)), ['y=6x − 54'.replace('−', '-')]);
  // 'פתרו f(x)=0' keeps only the declared f, and a plan cannot draw y=0 as f.
  const q23 = section('G9-T12/b', 23, 'ב');
  assert.deepEqual(exprs(authored.functionSources(q23.context)), ['f(x)=(x+4) ^2-1']);
  const scene = authored.fromContext(q23.context, draw); assert.equal(scene.expressions.length, 1);
  assert.equal(authored.render(document, scene).querySelectorAll('[data-role="given-function"]').length, 1);
  const stem = q23.context.questionText.match(/\$f\(x\)=[^$]+\$/)![0];
  assert.equal(plans.inspect(functionPlan([['question', stem], ['part', '$f(x)=0$']]), q23.typed()).reason, 'partial_function_set');
  assert.equal(plans.inspect(functionPlan([['question', stem]]), q23.typed()).ok, true);
  assert.deepEqual(exprs(authored.formulas('כמה פתרונות יש למשוואות $f(x)=2$, $f(x)=4$ ו־$f(x)=−3$?')), []);
  assert.deepEqual(exprs(authored.formulas('בדקו בהצבה של $y = 1$.')), []);
  assert.deepEqual(exprs(authored.formulas('קו אופקי נתון על ידי $y=7$. מתכנת טוען שהצבת $y=0$ מספיקה.')), ['y=7']);
});

it('real constant lines and student formulas remain functions', () => {
  assert.deepEqual(exprs(authored.formulas('שלושת הישרים בשרטוט הם $f(x)=x$, $g(x)=-x+6$ ו־$h(x)=2$.')), ['f(x)=x', 'g(x)=-x+6', 'h(x)=2']);
  assert.deepEqual(exprs(authored.formulas('שני שבילים אופקיים הם $y=-2$ ו־$y=10$.')), ['y=-2', 'y=10']);
  assert.deepEqual(exprs(authored.formulas('כמה מפגשים יהיו עם הישר $y = 6$ בכל תוצאה?')), ['y=6']);
  const f = section('G9-T13/a', 17, 'ב'), own = authored.resolve(f.data, f.exercise, { studentMessage: 'שרטט y=3', helpKind: 'free_question' }, f.svg);
  assert.deepEqual(Array.from(own.expressions, (e: any) => e.expression), ['3']);
  assert.deepEqual(Array.from(authored.fromContext(section('G9-T12/a', 24, 'א').context, draw).expressions, (e: any) => e.expression), ['-(x+3) ^2+16']);
});

it('a part that replaces a stem declaration no longer draws the replaced curve', () => {
  const q22 = section('G9-T31/a', 22, 'ג');
  assert.deepEqual(exprs(authored.functionSources(q22.context)), ['y=x^{2} + 6x + 1', 'y=-8', 'y=-10']);
  const quote = (text: string, re: RegExp) => text.match(re)![0];
  const first = quote(q22.context.questionText, /\$y = x\^\{2\} \+ 6x \+ 1\$/), second = quote(q22.context.questionText, /\$y = 2x \+ 13\$/);
  const minus8 = quote(q22.context.partText, /\$y = −8\$/), minus10 = quote(q22.context.partText, /\$y = −10\$/);
  assert.equal(plans.inspect(functionPlan([['question', first], ['part', minus8], ['part', minus10]]), q22.typed()).ok, true);
  assert.equal(plans.inspect(functionPlan([['question', first], ['question', second], ['part', minus8], ['part', minus10]]), q22.typed()).reason, 'partial_function_set');
  // The other parts still work with both channels.
  for (const part of ['א', 'ב', 'ד']) assert.deepEqual(exprs(authored.functionSources(section('G9-T31/a', 22, part).context)), ['y=x^{2} + 6x + 1', 'y=2x + 13'], part);
  assert.deepEqual(exprs(authored.functionSources(section('G9-T08/c', 11, 'ה').context)), ['y=5']);
  // An unclear replacement keeps the original instead of guessing.
  assert.equal(authored.functionSources({ questionText: 'נתונים $y=x+1$ ו־$y=2x$.', partText: 'כעת $y=3$. כמה מפגשים יש?' }), null);
});

it('two typed formulas joined by ו- or ו־ are both drawn, without weakening the minus guard', () => {
  const f = section('G9-T13/a', 17, 'ב');
  for (const message of ['שרטט y=x^2-2 ו-y=2x+1', 'שרטט $y=x^2-2$ ו־$y=2x+1$', 'שרטט y=x^2-2 וגם y=2x+1']) {
    const scene = authored.resolve(f.data, f.exercise, { studentMessage: message, helpKind: 'free_question' }, f.svg);
    assert.equal(scene.kind, 'authored-function', message);
    assert.deepEqual(Array.from(scene.expressions, (e: any) => e.expression), ['x^2-2', '2x+1'], message);
  }
  for (const text of ['x-y=4 ו-y=2', '2x-y=3', '3-y=x']) assert.equal(authored.formulas(text).invalid, true, text);
});

it('"לא שלמים" is continuous, integer requirements stay discrete, and fractions read as fractions', () => {
  const waiting = authored.fromContext(section('G8-T28/a', 4, 'א').context, draw);
  assert.equal(waiting.kind, 'authored-intervals'); assert.equal(waiting.discrete, false); assert.doesNotMatch(waiting.caption, /שלמים/);
  assert.equal(authored.fromContext(section('G8-T28/a', 4, 'ד').context, draw).discrete, false);
  assert.equal(authored.fromContext(section('G8-T28/a', 18, 'א').context, draw).discrete, true);
  for (const [raw, shown] of [['\\f{x}{2}', 'x/2'], ['-\\f{x}{2}+6', '-x/2+6'], ['2(2-\\f{x}{2})', '2(2-x/2)'], ['\\f{11}{8}x', '(11/8)x'], ['\\f{x+1}{3}', '(x+1)/3'], ['x^2-2', 'x^2-2']])
    assert.equal(authored.displayExpression(raw), shown, raw);
  const lines = authored.fromContext(section('G8-T06/a', 8, 'א').context, draw), figure = authored.render(document, lines);
  assert.equal(figure.querySelectorAll('[data-role="given-function"]').length, 2);
  const legend = Array.from(figure.querySelectorAll('bdi'), (b: any) => b.textContent);
  assert.ok(legend.some((text: string) => /x\/2/.test(text)), legend.join(' | ')); assert.doesNotMatch(legend.join(' '), /\\f/);
});

it('ordinal parts over printed equation lists reject other equations and keep the labelled own one', () => {
  for (const [pkg, q, part, other, own] of [['G8-T07/b', 4, 'ג', '$3x + 4y = 27$', '$2x + 3y = 18$'], ['G7-T33/a', 3, 'א', '$5x = 8$', '$9x = 0$']] as const) {
    const f = section(pkg, q, part); assert.ok(f.context.questionText.includes(other) && f.context.questionText.includes(own), `${pkg} quotes`);
    assert.equal(plans.inspect(operations(other), f.typed()).reason, 'ambiguous_function_scope', `${pkg} q${q}${part} other`);
    assert.equal(plans.inspect(operations(own), f.typed()).ok, true, `${pkg} q${q}${part} own`);
  }
});

it('substituted values and output conditions are not lines; typed requests and printed line equations are', () => {
  assert.equal(authored.functionSources(section('G7-T23/a', 2, 'א').context), null);
  assert.equal(authored.fromContext(section('G7-T23/a', 2, 'ד').context, draw), null);
  assert.equal(authored.functionSources(section('G8-T15/b', 1, 'ג').context), null);
  assert.deepEqual(exprs(authored.functionSources(section('G8-T15/b', 14, 'ב').context)), ['y=5x - 10']);
  assert.deepEqual(exprs(authored.formulas('נתונה המשוואה $y=-2$ של ישר אופקי.')), ['y=-2']);
  assert.deepEqual(exprs(authored.formulas('נתונות המשוואות $y=3$ ו־$y=2x+1$.')), ['y=3', 'y=2x+1']);
  const f = section('G9-T13/a', 17, 'ב');
  for (const [message, expected] of [['שרטט את המשוואה y=3', ['3']], ['שרטט את y=x^2 ואת הישר שבו y=5', ['x^2', '5']], ['שרטט את המשוואות y=4 ו-y=x^2', ['4', 'x^2']]] as const) {
    const scene = authored.resolve(f.data, f.exercise, { studentMessage: message, helpKind: 'free_question' }, f.svg);
    assert.deepEqual(Array.from(scene.expressions, (e: any) => e.expression), expected, message);
  }
});

it('replacement needs a named target; otherwise the original figure stays', () => {
  const sources = (questionText: string, partText: string) => exprs(authored.functionSources({ questionText, partText }));
  assert.deepEqual(sources('שני ערוצים: הראשון מחזיר $y=x^2+1$, והשני $y =2x+1$.', 'ערוץ שני מחזיר כעת $y=3$.'), ['y=x^2+1', 'y=3']);
  assert.equal(sources('נתונה הפרבולה $y=x^2-4$.', 'הפרבולה נחתכת כעת בישר $y=5$. כמה מפגשים?'), null);
  assert.equal(sources('שני ערוצים: הראשון מחזיר $y=x^2+1$, והשני $y=2x+1$.', 'שני הערוצים מחזירים כעת $y=3$.'), null);
  assert.equal(sources('נתונים $y=x^2$ ו־$y=x+2$.', 'בשלב השני מוסיפים כעת $y=4$.'), null);
  assert.deepEqual(sources('נתונה הפונקציה $f(x)=x^2$.', 'הפונקציה מוגדרת כעת $f(x)=5$.'), ['f(x)=5']);
  for (const [raw, shown] of [['2\\f{1}{x}', '2(1/x)'], ['x+2\\f{1}{2}', 'x+2(1/2)'], ['\\f{x}{2}^2', '(x/2)^2'], ['\\f{1}{2x}', '1/(2x)'], ['x\\f{1}{2}', 'x(1/2)']])
    assert.equal(authored.displayExpression(raw), shown, raw);
});

it('an ordinal check follows the drawn expression inside the quote, not where the quote starts', () => {
  const plan = (expression: string, quote: string) => inVm({ version: 2, status: 'ok', family: 'operations', expression, evidence: [{ source: 'question', quote }] });
  const first = section('G7-T33/a', 3, 'א'), stem = first.context.questionText;
  const from = (start: string, end: string) => stem.slice(stem.indexOf(start), stem.indexOf(end) + end.length);
  for (const [expression, quote] of [['x + 4 = x + 7', from('$9x = 0$', '$x + 4 = x + 7$')], ['5x = 8', from('$9x = 0$', '$5x = 8$')], ['5x = 8', stem]])
    assert.equal(plans.inspect(plan(expression, quote), first.typed()).reason, 'ambiguous_function_scope', expression + ' in a long quote');
  // The selected equation stays usable inside the same long quote.
  assert.equal(plans.inspect(plan('9x = 0', from('$9x = 0$', '$5x = 8$')), first.typed()).ok, true);
  const second = section('G8-T07/b', 4, 'ג'), s2 = second.context.questionText, span = (a: string, b: string) => s2.slice(s2.indexOf(a), s2.indexOf(b) + b.length);
  assert.equal(plans.inspect(plan('5x − 4y = 13', span('$3x + 4y = 27$', '$5x − 4y = 13$')), second.typed()).reason, 'ambiguous_function_scope');
  for (const expression of ['−2x + 5y = 14', '2x + 3y = 18'])
    assert.equal(plans.inspect(plan(expression, span('$3x + 4y = 27$', '$2x + 3y = 18$')), second.typed()).ok, true, expression + ' is printed under the second system');
  const synthetic = inVm({ questionText: 'מערכת ראשונה: $y=x+1$. מערכת שנייה: $y=x+2$. מערכת שלישית: $y=x+3$.', partText: 'פתרו את המערכת השנייה.', hintText: '', studentMessage: '' });
  assert.equal(plans.inspect(plan('y=x+3', synthetic.questionText), synthetic).reason, 'ambiguous_function_scope');
  assert.equal(plans.inspect(plan('y=x+2', synthetic.questionText), synthetic).ok, true);
});

it('fraction display keeps the value across spaces, coefficients, powers and signs', () => {
  for (const [raw, shown] of [['\\f{x}{2} ^2', '(x/2) ^2'], ['\\f{11}{8} x', '(11/8) x'], ['2 \\f{1}{x}', '2 (1/x)'], ['\\f{x+1}{2} ^2', '((x+1)/2) ^2'], ['-\\f{x}{2} ^2', '-(x/2) ^2'], ['1/\\f{x}{2}', '1/(x/2)']])
    assert.equal(authored.displayExpression(raw), shown, raw);
  const cases = ['\\f{x}{2} ^2', '\\f{11}{8} x', '2 \\f{1}{x}', '\\f{x+1}{2} ^2', '\\f{x}{2}^2', '-\\f{x}{2}', '-\\f{x}{2} ^2', '\\f{-x}{2}', '-2 \\f{1}{x}', 'x-\\f{1}{2} x', '\\f{x}{2}-\\f{1}{2}', '3-\\f{x+1}{2}', '2(2-\\f{x}{2})', '1/\\f{x}{2}', '\\f{\\f{x}{2}}{3}'];
  for (const raw of cases) {
    const original = authored.parseExpression(raw), shown = authored.parseExpression(authored.displayExpression(raw));
    assert.ok(original && shown, raw + ' parses before and after display');
    for (const x of [-3, -0.5, 1, 2.5, 4]) {
      const a = authored.evaluate(original, x), b = authored.evaluate(shown, x);
      assert.ok(Number.isNaN(a) ? Number.isNaN(b) : Math.abs(a - b) < 1e-9, `${raw} at x=${x}: ${a} vs ${b}`);
    }
  }
});

it('explicitly selecting several or all systems keeps every selected system and still rejects the rest', () => {
  const plan = (expression: string, quote = '$' + expression + '$') => inVm({ version: 2, status: 'ok', family: 'operations', expression, evidence: [{ source: 'question', quote }] });
  // 'באילו מהמערכות… בכל מערכת כזאת': every printed system, including the third.
  const all = section('G8-T07/c', 12, 'א');
  for (const expression of ['4x + 10y = 14', '6x + 15y = 21', 'x − 4y = 3', '3x − 12y = 8', '5x + 2y = 11', '10x + 3y = 19']) {
    assert.ok(all.context.questionText.includes('$' + expression + '$'), expression);
    assert.equal(plans.inspect(plan(expression), all.typed()).ok, true, expression);
  }
  const stem = 'מערכת ראשונה: $y=x+1$ ו־$y=2x$. מערכת שנייה: $y=x+2$ ו־$y=3x$. מערכת שלישית: $y=x+3$ ו־$y=4x$.';
  const ask = (partText: string, expression: string) => plans.inspect(plan(expression), inVm({ questionText: stem, partText, hintText: '', studentMessage: '' }));
  for (const partText of ['פתרו את המערכת הראשונה ואת השנייה.', 'בשתי המערכות הראשונות פתרו כל מערכת.']) {
    assert.equal(ask(partText, 'y=2x').ok, true, partText); assert.equal(ask(partText, 'y=3x').ok, true, partText);
    assert.equal(ask(partText, 'y=4x').reason, 'ambiguous_function_scope', partText + ' leaves out the third');
  }
  for (const partText of ['בכל מערכת פתרו את המשוואה השנייה.', 'באילו מהמערכות המשוואה השנייה היא כפולה של הראשונה?'])
    assert.equal(ask(partText, 'y=4x').ok, true, partText);
  // Every system, but only its first equation.
  assert.equal(ask('בשלוש המערכות בדקו את המשוואה הראשונה.', 'y=x+3').ok, true);
  assert.equal(ask('בשלוש המערכות בדקו את המשוואה הראשונה.', 'y=4x').reason, 'ambiguous_function_scope');
  // 'שתי המערכות' of three names no specific pair: the single selection rule still applies.
  assert.equal(ask('בשתי המערכות פתרו את המערכת השנייה.', 'y=4x').reason, 'ambiguous_function_scope');
  assert.equal(plans.inspect(plan('3x + 4y = 27'), section('G8-T07/b', 4, 'ג').typed()).reason, 'ambiguous_function_scope');
  assert.equal(plans.inspect(plan('y=x−3'), section('G9-T13/a', 17, 'ב').typed()).reason, 'ambiguous_function_scope');
});

it('equation scope inside a selected system never widens to the other systems', () => {
  const plan = (expression: string) => inVm({ version: 2, status: 'ok', family: 'operations', expression, evidence: [{ source: 'question', quote: '$' + expression + '$' }] });
  const stem = 'מערכת ראשונה: $y=x+1$ ו־$y=2x$. מערכת שנייה: $y=x+2$ ו־$y=3x$. מערכת שלישית: $y=x+3$ ו־$y=4x$.';
  const ask = (partText: string, expression: string) => plans.inspect(plan(expression), inVm({ questionText: stem, partText, hintText: '', studentMessage: '' }));
  for (const partText of ['פתרו את המערכת השנייה.', 'במערכת השנייה, בדקו כל משוואה.', 'פתרו את המערכת השנייה. השוו את המקדמים בכל משוואה.',
    'במערכת השנייה, בדקו את המשוואה הראשונה ואת המשוואה השנייה.', 'במערכת השנייה, בדקו בשתי המשוואות שלה את המקדמים.']) {
    assert.equal(ask(partText, 'y=3x').ok, true, partText);
    assert.equal(ask(partText, 'y=2x').reason, 'ambiguous_function_scope', partText + ' / first system');
    assert.equal(ask(partText, 'y=4x').reason, 'ambiguous_function_scope', partText + ' / third system');
  }
  // An equation ordinal inside the selected system selects that equation only.
  assert.equal(ask('במערכת השנייה, בדקו את המשוואה הראשונה.', 'y=x+2').ok, true);
  assert.equal(ask('במערכת השנייה, בדקו את המשוואה הראשונה.', 'y=3x').reason, 'ambiguous_function_scope');
  for (const partText of ['פתרו את המערכת הראשונה ואת השנייה.', 'בשתי המערכות הראשונות פתרו כל מערכת.']) {
    assert.equal(ask(partText, 'y=2x').ok, true, partText); assert.equal(ask(partText, 'y=3x').ok, true, partText);
    assert.equal(ask(partText, 'y=4x').reason, 'ambiguous_function_scope', partText);
  }
  // Unlabelled stems: 'הגרף הראשון … הגרף השני' names both printed formulas;
  // 'רק את המשוואה הראשונה' only the first; 'בשני משתנים' is a number.
  const graphs = section('G9-T06/c', 11, 'ג');
  for (const expression of ['y = x²', 'y = (x + 8)²']) assert.equal(plans.inspect(plan(expression), graphs.typed()).ok, true, expression);
  const onlyFirst = section('G8-T07/b', 16, 'ג');
  assert.equal(plans.inspect(plan('2x + 3y = 22'), onlyFirst.typed()).ok, true);
  assert.equal(plans.inspect(plan('x − 3y = −7'), onlyFirst.typed()).reason, 'ambiguous_function_scope');
  for (const [pkg, q, part, expression] of [['G9-T12/c', 15, 'א', 'y=x ^2−3x+1'], ['G8-T06/a', 3, 'א', 'y=−x+5'], ['G8-T25/c', 15, 'ג', '20 · 121 = 2420']] as const)
    assert.equal(plans.inspect(plan(expression), section(pkg, q, part).typed()).ok, true, `${pkg} q${q}${part} has no ordinal selection`);
  // Equation labels nested under system labels also need their enclosing system.
  const nested = 'מערכת ראשונה: המשוואה הראשונה $x+1=2$. המשוואה השנייה $y+1=3$. מערכת שנייה: המשוואה הראשונה $x+4=7$. המשוואה השנייה $y+5=9$.';
  const inNested = (partText: string, expression: string) => plans.inspect(inVm({ version: 2, status: 'ok', family: 'operations', expression, evidence: [{ source: 'question', quote: nested }] }), inVm({ questionText: nested, partText, hintText: '', studentMessage: '' }));
  for (const [expression, ok] of [['x+1=2', false], ['y+1=3', false], ['x+4=7', true], ['y+5=9', false]] as const)
    assert.equal(inNested('במערכת השנייה, בדקו את המשוואה הראשונה.', expression).ok, ok, 'nested ' + expression);
  for (const expression of ['x+1=2', 'x+4=7']) assert.equal(inNested('בכל מערכת בדקו את המשוואה הראשונה.', expression).ok, true, 'every system ' + expression);
  assert.equal(inNested('בכל מערכת בדקו את המשוואה הראשונה.', 'y+5=9').ok, false);
  assert.equal(inNested('בדקו את המשוואה הראשונה.', 'x+4=7').ok, false, 'no system named: unclear');
  // The actual all-systems item keeps all six equations.
  const all = section('G8-T07/c', 12, 'א');
  for (const m of all.context.questionText.matchAll(/\$([^$]+)\$/g)) assert.equal(plans.inspect(plan(m[1]), all.typed()).ok, true, m[1]);
});
