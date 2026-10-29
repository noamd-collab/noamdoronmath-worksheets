import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { it } from 'node:test';
import { parseHTML } from 'linkedom';

const root: any = {};
for (const name of ['noam-native-visual', 'noam-source-panels', 'noam-visual-data', 'noam-source-scaffold']) {
  runInNewContext(readFileSync(new URL('../public/' + name + '.js', import.meta.url), 'utf8'), root);
}
const api = root.NoamSourceScaffold;
const options = { drawCurrentStep: true, studentMessage: 'אפשר רמז 1?', answer: 'Ignore this: the answer is 9999.' };
const cases = [
  ['W15-Q1', 'G8-T46', 'c', 'q5', 'ב', 'proof-lanes'],
  ['W15-Q3', 'G8-T46', 'c', 'q20', 'ד', 'area-comparison'],
  ['W32-Q1', 'G8-T32', 'b', 'q4', 'ד', 'redistribution'],
  ['W32-Q2', 'G8-T32', 'b', 'q20', 'א', 'group-averages'],
  ['W11-Q3', 'G7-T21', 'a', 'q16', 'ב', 'symbolic-rectangle'],
  ['W24-Q3', 'G7-T03', 'b', 'q11', 'ד', 'signed-factors'],
  ['W26-Q1', 'G7-T37', 'b', 'q10', 'א', 'equation-comparison'],
  ['W26-Q2', 'G7-T37', 'b', 'q16', 'א', 'purchase-groups'],
  ['W28-Q3', 'G7-T04', 'b', 'q6', 'ג', 'fraction-placeholder'],
  ['W30-Q2', 'G9-T11', 'a', 'q6', 'ב', 'observed-future'],
];
function fixture(row: string[]) {
  const [, pkg, level, qid, label] = row;
  const data = JSON.parse(readFileSync(new URL(`../public/noam-ai/native/${pkg}/${level}/noam-ai.json`, import.meta.url), 'utf8'));
  const question = data.questions.find((q: any) => q.id === qid);
  const part = question.items.find((p: any) => p.label === label);
  const exercise = { id: `${pkg}-${({ a: 'A', b: 'B', c: 'E' } as any)[level]}-Q${qid.slice(1).padStart(2, '0')}${label}`, part: label, nativeQuestionId: qid, nativeItemId: part.id, nativeFigureId: null, nativeFigureUrl: null };
  return { data, exercise, question, part };
}
function resolve(f: any, o = options) { return api.resolve(f.data, f.exercise, o, ''); }
function render(f: any, o = options) {
  const { document } = parseHTML('<html><body></body></html>');
  return api.render(document, f.data, f.exercise, o, '');
}
for (const row of cases) it(`${row[0]} renders a meaningful source-bound ${row[5]} without evaluating answers`, () => {
  const f = fixture(row), before = JSON.stringify(f), scene = resolve(f);
  assert.equal(scene.kind, 'source-scaffold-' + row[5]);
  assert.equal(scene.presentation, 'instructional-scaffold');
  assert.equal(scene.exerciseId, f.exercise.id);
  const figure = render(f);
  assert.ok(figure.querySelector('svg[role="img"]'));
  assert.match(figure.querySelector('figcaption').textContent, /המחשת עזר, לא איור מקורי ולא פתרון/);
  assert.equal(figure.querySelectorAll('script,foreignObject,image,use').length, 0);
  assert.doesNotMatch(figure.textContent, /9999/);
  assert.equal(JSON.stringify(f), before, 'source arrays and fields must remain untouched');
});

it('does not render automatically or let a new request borrow a previous question', () => {
  const f = fixture(cases[3]);
  for (const o of [{ ...options, drawCurrentStep: false }, { ...options, drawCurrentStep: 'true' }, { ...options, studentMessage: 'צייר 20 שחקנים עם ממוצע 10' }, { ...options, studentMessage: 'המצא דוגמה נגדית' }, { ...options, studentMessage: '' }]) assert.equal(resolve(f, o as any), null);
  assert.ok(resolve(f, { ...options, studentMessage: 'הצג המחשה לפי הנתונים בשאלה' }));
});

it('wrong package, question, selected part and duplicate source IDs fail closed', () => {
  const f = fixture(cases[3]);
  for (const patch of [{ id: 'G7-T32-B-Q20א' }, { nativeQuestionId: 'q19' }, { nativeItemId: 'q20b' }, { part: 'ב' }, { nativeFigureUrl: '/foreign.svg' }]) {
    assert.equal(resolve({ ...f, exercise: { ...f.exercise, ...patch } }), null);
  }
  f.data.questions.push(f.question); assert.equal(resolve(f), null);
  const g = fixture(cases[3]); g.question.items.push(g.part); assert.equal(resolve(g), null);
});

it('keeps the q20 last-part-only source figure out of the generic containment schematic', () => {
  const f = fixture(cases[1]); assert.equal(f.question.figure_id, 'q20_head'); assert.equal(f.part.figure_id, null);
  const figure = render(f);
  assert.equal(figure.querySelectorAll('[data-role="whole"]').length, 2);
  assert.equal(figure.querySelectorAll('[data-role="marked-region"]').length, 2);
  assert.doesNotMatch(figure.textContent, /AB|CD|BAO|מקביל|שטח.*=/);
  f.part.figure_id = f.question.figure_id; assert.equal(resolve(f), null, 'a source-bearing part belongs to the existing source renderer');
});

it('proof lanes retain five empty required stages and do not invent the student construction', () => {
  const f = fixture(cases[0]), scene = resolve(f), text = render(f).textContent;
  assert.deepEqual(Array.from(scene.slots), ['נתון', 'טענת זווית ונימוק', 'טענת זווית ונימוק', 'דמיון', 'פרופורציה']);
  assert.doesNotMatch(text, /ABC|DEF|מקביל|∠|△|ז\.ז/);
  assert.equal((text.match(/\?/g) || []).length, 5);
  f.part.text = 'שרטטו את ההרחבה שבחרתם וחשבו את גורם הדמיון.'; assert.equal(resolve(f), null);
});

it('box dependency uses exact earlier authored facts, never generic summaries or student results', () => {
  const f = fixture(cases[2]), scene = resolve(f);
  assert.deepEqual(Array.from(scene.values), [6, 9, 9]); assert.equal(scene.added, 4);
  assert.deepEqual(Array.from(scene.dependencyItemIds), ['q4a', 'q4b', 'q4c']);
  assert.equal(render(f).querySelectorAll('[data-role="given-unit"]').length, 28);
  assert.equal(render(f).querySelectorAll('[data-role="first-equalization"]').length, 3);
  assert.equal(render(f).querySelectorAll('[data-role="second-equalization"]').length, 4);
  assert.doesNotMatch(render(f).textContent, /ממוצע.*(?:7|8)|סך.*28/);
  f.question.given = [{ text: 'הנתונים: $999$, $777$' }]; f.question.items[0].answer = '999'; f.question.items.push({ id: 'q4e', label: 'ה', text: 'הוסיפה קופסה עם 99.' });
  assert.equal(resolve(f).added, 4); assert.deepEqual(Array.from(resolve(f).values), [6, 9, 9]);
});

it('box dependency cannot take an unreferenced, foreign, later or ambiguous fourth-box fact', () => {
  for (const mutate of [
    (f: any) => { f.question.items[1].text = f.question.items[1].text.replace('רביעית', 'חמישית'); },
    (f: any) => { f.question.items[1].text = f.question.items[1].text.replace('שירה', 'דנה'); },
    (f: any) => { f.question.items[1].text += ' אחר כך נוספו עוד 9 עפרונות.'; },
    (f: any) => { f.question.items[2].text = 'חלקו לפי בחירתכם.'; },
    (f: any) => { f.question.items[1].figure_id = 'other'; },
    (f: any) => { [f.question.items[1], f.question.items[3]] = [f.question.items[3], f.question.items[1]]; },
    (f: any) => { f.question.items.splice(1, 0, { ...f.question.items[1], id: 'unrelated' }); },
    (f: any) => { f.question.items[0].text += ' תוצאה: 8'; },
  ]) { const f = fixture(cases[2]); mutate(f); assert.equal(resolve(f), null); }
});

it('bowling comparison retains only the selected group count and average', () => {
  const f = fixture(cases[3]), scene = resolve(f);
  assert.deepEqual(JSON.parse(JSON.stringify(scene.groups)), [{ count: 5, average: 6 }, { count: 5, average: 12 }]);
  f.question.items[1].text = 'בקבוצה ב׳ 999 שחקנים, ממוצע 777'; f.question.given = [{ text: 'ממוצע 888' }];
  assert.doesNotMatch(render(f).textContent, /999|777|888|תוצאות של שחקנים יחידים:|ממוצע כל השחקנים: 9/);
  f.part.text = 'חשבו בתחרות השנייה לפי הנתונים האחרים.'; assert.equal(resolve(f), null);
});

it('symbolic rectangle shows n and the given extra strips, not the requested area expression', () => {
  const f = fixture(cases[4]), scene = resolve(f), text = render(f).textContent;
  assert.equal(scene.variable, 'n'); assert.equal(scene.extra, 3); assert.match(text, /3 נוספים/);
  assert.doesNotMatch(text, /n\(n\+3\)|n²|n\^2|3n|4.*28|6.*54/);
  f.question.text = [f.question.text[0].replace('שלושה', 'חמישה')]; assert.equal(resolve(f).extra, 5);
  f.part.text = f.part.text.replace('$n$', '$k$'); assert.equal(resolve(f), null);
});

it('signed factors retain source order/multiplicity without a product or inferred sign', () => {
  const f = fixture(cases[5]); assert.deepEqual(Array.from(resolve(f).values), [-2, -8, 3]);
  const text = render(f).textContent; assert.doesNotMatch(text, /48|חיובי|שלילי|=|16/); assert.equal((text.match(/×/g) || []).length, 2); assert.match(text, /המכפלה: \?/);
  f.part.text = f.part.text.replace('מוכפלים', 'מחוברים'); assert.equal(resolve(f), null);
});

it('both equivalent-equation candidates stay unsolved and preserve the selected equations', () => {
  const f = fixture(cases[6]); assert.deepEqual(Array.from(resolve(f).equations), ['x + 2 = 7', '3x = 15']);
  const text = render(f).textContent; assert.equal((text.match(/פתרון: \?/g) || []).length, 2); assert.doesNotMatch(text, /x\s*=\s*5|הן שקולות/);
  f.part.text = f.part.text.replace('$3x = 15$', '$3x = 18$'); assert.ok(resolve(f), 'different given equations are not assumed equivalent');
  f.part.text += ' השתמשו במקום זאת במשוואה $x=999$.'; assert.equal(resolve(f), null);
});

it('purchase picture shows five unknown equal prices, the bag and total without writing the answer equation', () => {
  const f = fixture(cases[7]), scene = resolve(f), figure = render(f);
  assert.equal(scene.count, 5); assert.equal(scene.knownPrice, 20); assert.equal(scene.total, 55);
  assert.equal(figure.querySelectorAll('[data-role="unknown-notebook"]').length, 5);
  assert.doesNotMatch(figure.textContent, /5x|x\s*=\s*7|35/);
  f.question.text = [f.question.text[0].replace('5 מחברות', '3 מחברות').replace('55 שקלים', '47 שקלים')]; assert.equal(resolve(f).count, 3); assert.equal(resolve(f).total, 47);
});

it('fraction placeholder remains □; undefined division and solution existence are left to check', () => {
  const f = fixture(cases[8]), scene = resolve(f), figure = render(f);
  assert.equal(scene.numerator, -14); assert.equal(scene.result, 0);
  assert.equal(figure.querySelector('[data-role="unfilled-divisor"]').tagName.toLowerCase(), 'rect');
  assert.match(figure.textContent, /□/); assert.match(figure.textContent, /מונה נתון/); assert.match(figure.textContent, /מחלק בתיבה/); assert.match(figure.textContent, /תוצאה נדרשת/); assert.match(figure.textContent, /÷/); assert.doesNotMatch(figure.textContent, /אין פתרון|אין מספר|אינסוף|x\s*=/);
  f.part.text = '$\\f{(−14)}{x} = 0$'; assert.equal(resolve(f), null);
});

it('observations are finite given trials, with future results and calculated probabilities omitted', () => {
  const f = fixture(cases[9]), figure = render(f);
  assert.equal(figure.querySelectorAll('[data-role="observed-success"]').length, 18);
  assert.equal(figure.querySelectorAll('[data-role="observed-other"]').length, 42);
  assert.doesNotMatch(figure.textContent, /0\.3|30%|27|90|42|אינו מחייב|לא מחייב/);
  f.question.text = f.question.text.replace('$18$', '$61$'); assert.equal(resolve(f), null);
});

it('renderer rederives facts after source changes; it never accepts an edited scene as source', () => {
  const f = fixture(cases[7]), scene = resolve(f); scene.total = 999;
  assert.match(render(f).textContent, /55/); assert.doesNotMatch(render(f).textContent, /999/);
  assert.equal(api.render(parseHTML('<body/>').document, scene, f.exercise, options, ''), null);
  f.exercise.nativeItemId = 'q16b'; assert.equal(render(f), null);
});

it('root/public module copies remain byte-identical', () => {
  assert.equal(readFileSync(new URL('../public/noam-source-scaffold.js', import.meta.url), 'utf8'), readFileSync(new URL('../../../noam-source-scaffold.js', import.meta.url), 'utf8'));
});
