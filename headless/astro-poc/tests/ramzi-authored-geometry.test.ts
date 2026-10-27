import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { it } from 'node:test';
import { parseHTML } from 'linkedom';

const root = new URL('../../../', import.meta.url);
const require = createRequire(import.meta.url);
const engine = require('../../../noam-authored-geometry.js');
const options = { drawCurrentStep: true, studentMessage: 'אפשר רמז 1?', helpKind: 'hint', answer: '' };
function authored(pkg: string, level: string, qid: string, item: string) {
  const data = JSON.parse(readFileSync(new URL(`noam-ai/native/${pkg}/${level}/noam-ai.json`, root), 'utf8'));
  const q = data.questions.find((q: any) => q.id === qid), p = q.items.find((p: any) => p.id === item);
  return { questionText: q.text, partText: p.text, questionId: q.id, itemId: p.id, exerciseId: pkg + '-' + item, hasFigure: !!p.figure_id };
}
function render(scene: any) { return engine.render(parseHTML('<html><body></body></html>').document, scene); }
const fixtures = {
  prism: authored('G7-T48', 'b', 'q4', 'q4d'),
  perimeter: authored('G7-T07', 'c', 'q8', 'q8b'),
  correspondence: authored('G8-T40', 'b', 'q4', 'q4c'),
  algebra: authored('G7-T36', 'b', 'q17', 'q17b'),
};

it('W04-Q2 constructs the given right-triangular prism without solving its missing axial length', () => {
  const spec = engine.resolve(fixtures.prism, options);
  assert.equal(spec.kind, 'authored-triangular-prism');
  assert.deepEqual(spec.data.sides, ['6','8','10']); assert.equal(spec.data.volume, '144'); assert.equal(spec.data.length, '?');
  const figure = render(spec); assert.ok(figure.querySelector('svg polygon'));
  assert.equal(figure.querySelector('[data-role="unknown-length"]').textContent, '?');
  assert.match(figure.textContent, /נפח נתון: 144/); assert.match(figure.textContent, /אורך המנסרה: \?/);
  assert.doesNotMatch(figure.textContent, /אורך המנסרה: 6|24|288|שטח הבסיס/);
});

it('the prism family supports independent authored triples and retains an explicitly named unknown parameter', () => {
  for (const [level, q, item, sides, length] of [
    ['b','q14','q14d',['5','12','13'],'?'], ['c','q18','q18a',['9','12','15'],'l'], ['a','q9','q9a',['3','4','5'],'?'],
  ] as any[]) {
    const spec = engine.resolve(authored('G7-T48', level, q, item), options);
    assert.deepEqual(spec.data.sides, sides); assert.equal(spec.data.length, length); assert.ok(render(spec));
  }
  assert.equal(engine.resolve(authored('G7-T47','a','q9','q9a'), options), null, 'a target volume does not authorize invented base dimensions');
  assert.equal(engine.resolve(authored('G7-T48','c','q18','q18e'), options), null, 'choosing new bases is not the original family');
});

it('W09-Q2 shows three equal-perimeter givens without computing missing lengths or areas', () => {
  const spec = engine.resolve(fixtures.perimeter, options), figure = render(spec);
  assert.equal(spec.kind, 'authored-equal-perimeter'); assert.equal(spec.data.perimeter, '64');
  assert.equal(spec.data.squareSide, '?'); assert.deepEqual(spec.data.rectangles, [{width:'28',height:'?'},{width:'19',height:'?'}]);
  assert.equal(figure.querySelectorAll('polygon').length, 3);
  assert.match(figure.textContent, /אינם השוואת שטחים/);
  const labels = [...figure.querySelectorAll('[data-role="given-label"]')].map((n:any)=>n.textContent);
  for (const answer of ['16','4','13','256','112','247','144','9']) assert.ok(!labels.includes(answer), answer);
});

it('a different equal-perimeter family retains the known rectangle but does not calculate its perimeter or the square side', () => {
  const spec = engine.resolve(authored('G7-T07','a','q16','q16b'), options);
  assert.equal(spec.kind, 'authored-equal-perimeter'); assert.equal(spec.data.perimeter, null);
  assert.deepEqual(spec.data.rectangles, [{width:'14',height:'2'}]); assert.equal(spec.data.squareSide, '?');
  assert.doesNotMatch(render(spec).textContent, /32|64|היקף נתון לכל צורה: 28/);
});

it('W12-Q1 preserves the given congruence order and highlights only RT mentioned in the current hint', () => {
  const spec = engine.resolve(fixtures.correspondence, {...options, answer:'האם הצלע RT מחברת את הקודקודים הראשון והשלישי של המשולש RST?'});
  assert.equal(spec.kind, 'authored-correspondence'); assert.deepEqual(spec.data.names, ['RST','UVW']); assert.deepEqual(spec.data.focusEdges, ['RT']);
  const figure=render(spec); assert.equal(figure.querySelectorAll('polygon').length,2);
  assert.equal(figure.querySelectorAll('line[stroke="#1769aa"]').length,1);
  assert.equal(figure.querySelectorAll('circle,path').length,0);
  assert.deepEqual([...figure.querySelectorAll('[data-role="vertex-label"]')].map((n:any)=>n.textContent),['R','S','T','U','V','W']);
  assert.doesNotMatch(figure.textContent, /RT.*UW|TRS.*WUV|נכון|אותה התאמה/);
});

it('congruence recognition is general but does not discard additional angle/length constraints', () => {
  const spec = engine.resolve(authored('G8-T40','a','q7','q7d'), options);
  assert.deepEqual(spec.data.names,['KLM','RST']); assert.ok(render(spec));
  assert.equal(engine.resolve(authored('G8-T40','a','q19','q19d'), options),null,'46 degrees and13 units require a constrained renderer');
  assert.equal(engine.resolve({...fixtures.correspondence,questionText:'האם △RST חופף ל-△UVW לפי הסדר?'}, options),null,'a claim to prove is not a given');
  assert.equal(engine.resolve({...fixtures.correspondence,questionText:'לא נתון כי △RST חופף ל-△UVW לפי הסדר.'}, options),null,'negated congruence is not an affirmative given');
});

it('W08-Q3 labels the three authored algebraic sides and given perimeter without choosing an equation or solving x', () => {
  const spec=engine.resolve(fixtures.algebra,options), figure=render(spec);
  assert.equal(spec.kind,'authored-triangle-sides'); assert.deepEqual(spec.data.sides,['x + 11','6x','7x - 9']);assert.equal(spec.data.perimeter,'58');
  assert.match(figure.textContent,/x \+ 11/);assert.match(figure.textContent,/7x - 9/);
  assert.doesNotMatch(figure.textContent,/14x|x\s*=|x \+ 11 \+ 6x|58\s*-/);
  for(const label of figure.querySelectorAll('[data-role="given-label"]')) assert.equal(label.getAttribute('direction'),'ltr');
});

it('ordinary rectangle givens render without computing area or reinterpreting a relation as a length', () => {
  const c={questionText:'למלבן יש אורך של $x + 5$ ס״מ ורוחב של $3x$ ס״מ. היקף המלבן $48$ ס״מ.',partText:'מצאו את x.',hasFigure:false};
  const spec=engine.resolve(c,options);assert.equal(spec.kind,'authored-rectangle');assert.equal(spec.data.width,'x + 5');assert.equal(spec.data.height,'3x');assert.equal(spec.data.perimeter,'48');assert.ok(render(spec));
  assert.equal(engine.resolve({...c,questionText:'אורך המלבן גדול ב-$10$ ס״מ מרוחבו. רוחב המלבן $x$.'},options),null);
});

it('whole-catalog counterexamples do not turn a sequence index, wire length or second prism into a side', () => {
  for(const [pkg,level,q,item] of [['G7-T21','b','q15','q15a'],['G7-T23','c','q7','q7a'],['G7-T48','b','q19','q19a']]) {
    const context=authored(pkg,level,q,item);
    if(Array.isArray(context.questionText)) context.questionText=context.questionText.join('\n');
    assert.equal(engine.resolve(context,options),null,pkg+' '+q);
  }
});

it('only explicit drawing intent and exact nonfigure authored content can create these diagrams', () => {
  for(const c of Object.values(fixtures)) {
    assert.equal(engine.resolve(c,{studentMessage:'אפשר רמז 1?',helpKind:'hint',answer:'האם תוכל לחשב?'}),null);
    assert.equal(engine.resolve({...c,hasFigure:true},options),null);
    assert.equal(engine.resolve({...c,questionText:'אין נתוני צורה.',partText:'חשבו.',given:[c.questionText]},options),null);
    assert.equal(engine.resolve(c,{...options,studentMessage:'שרטט משולש חדש עם צלעות3,4,5'}),null);
    assert.equal(engine.resolve(c,{...options,studentMessage:'הראה את השרטוט המקורי'}),null);
    assert.equal(engine.resolve({...c,partText:'מצאו דוגמה נגדית.'},options),null);
  }
  assert.ok(engine.resolve(fixtures.algebra,{studentMessage:'הראה את המשולש מהשאלה'}));
});

it('incorrect lengths, unsupported expressions and hypothetical claims fail instead of producing decorative shapes', () => {
  for(const questionText of [
    'מנסרה שבסיסה ישר-זווית בעל צלעות $6,8,11$ ס״מ.',
    'לצלעות של משולש יש אורכים של $1$, $2$ ו-$9$ ס״מ.',
    'לצלעות של משולש יש אורכים של $x/2$, $6x$ ו-$7x - 9$ ס״מ.',
    'לצלעות של משולש יש אורכים של $x(2+3)$, $6x$ ו-$7x - 9$ ס״מ.',
    'נניח שמנסרה שבסיסה ישר-זווית בעל צלעות $3,4,5$ ס״מ.',
  ])assert.equal(engine.resolve({questionText,partText:'שרטטו.',hasFigure:false},options),null,questionText);
});

it('render rejects tampered scenes, extra fields, source markup and unbounded values', () => {
  const original=engine.resolve(fixtures.algebra,options);
  for(const mutate of [
    (s:any)=>s.data.sides[0]='<script>alert(1)</script>',(s:any)=>s.data.sides[0]='100000000x',
    (s:any)=>s.data.sides=['1','2','9'],(s:any)=>s.data.url='https://example.test/image.svg',
    (s:any)=>s.caption='different caption',(s:any)=>s.kind='question-image',(s:any)=>s.version=2,
  ]){const copy=structuredClone(original);mutate(copy);assert.equal(render(copy),null);}
  const getter=structuredClone(original);Object.defineProperty(getter.data,'sides',{get(){throw Error('must not execute');},enumerable:true});assert.equal(render(getter),null);
  for(const f of Object.values(fixtures)){const figure=render(engine.resolve(f,options));assert.equal(figure.querySelectorAll('script,image,foreignObject').length,0);}
});

it('root and public authored geometry implementations are identical',()=>{
  assert.equal(readFileSync(new URL('noam-authored-geometry.js',root),'utf8'),readFileSync(new URL('headless/astro-poc/public/noam-authored-geometry.js',root),'utf8'));
});
