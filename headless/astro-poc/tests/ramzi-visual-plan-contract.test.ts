import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { it } from 'node:test';
import { parseHTML } from 'linkedom';

const pub = new URL('../public/', import.meta.url);
const runtime: any = {};
// Load order mirrors the viewer. The plan is data; only these local reviewed
// compilers are allowed to produce SVG or other DOM nodes.
for (const file of ['noam-native-visual.js', 'noam-authored-geometry.js', 'noam-authored-visual.js', 'noam-visual-data.js', 'noam-visual-plan.js']) {
  runInNewContext(readFileSync(new URL(file, pub), 'utf8'), runtime, { filename: file });
}
const api = runtime.NoamVisualPlan;
it('instructs the planner to quote a complete authored operation span and preserve its structure', () => {
  assert.match(api.PROMPT_SCHEMA, /complete authored equation or expression by default/);
  assert.match(api.PROMPT_SCHEMA, /including both sides of an equation/);
  assert.match(api.PROMPT_SCHEMA, /same ordered subtree occurs in the current hint/);
  assert.match(api.PROMPT_SCHEMA, /quote the entire containing authored expression or equation/);
  assert.match(api.PROMPT_SCHEMA, /never simplify, rearrange, solve or evaluate/);
});
const clone = (value: any) => JSON.parse(JSON.stringify(value));
function authored(pkg: string, level: string, questionId: string, itemId: string) {
  const native = JSON.parse(readFileSync(new URL(`noam-ai/native/${pkg}/${level}/noam-ai.json`, pub), 'utf8'));
  const q = native.questions.find((q: any) => q.id === questionId);
  const item = q.items.find((item: any) => item.id === itemId);
  assert.ok(q && item, `${pkg}/${level}/${questionId}/${itemId}`);
  return {
    questionText: Array.isArray(q.text) ? q.text.join('\n') : q.text || '',
    partText: item.text || '',
    questionTable: q.table || null,
    partTable: item.table || null,
    hasFigure: Boolean(item.figure_id || q.figure_id),
    hintText: 'התבוננו בנתונים המפורשים בשאלה.',
    studentMessage: 'הראה המחשה לשלב הנוכחי'
  };
}
const functions = authored('G8-T06', 'b', 'q6', 'q6d');
const coordinates = authored('G8-T50', 'b', 'q2', 'q2a');
const numberline = authored('G7-ASSESS1', 'b', 'q8', 'q8a');
const prism = authored('G7-T48', 'b', 'q4', 'q4d');
const blankTable = authored('G8-T03', 'a', 'q1', 'q1a');
const soup = authored('G7-T24', 'b', 'q3', 'q3a');
const algebra = authored('G7-T29', 'a', 'q5', 'q5d');
function plan(family: string, context: any, fields: any = {}) {
  return { version: 2, status: 'ok', family, evidence: [{ source: 'question', quote: context.questionText }, { source: 'part', quote: context.partText }], ...fields };
}
function inspect(candidate: any, context: any) {
  // Worker JSON is parsed in the same realm as the validator. Model payloads
  // cannot contain accessors or prototypes supplied by another JS realm.
  runtime.__inspection = JSON.stringify({ candidate, context });
  return runInNewContext(`(() => { const v = JSON.parse(__inspection); const before = JSON.stringify(v.context); const result = NoamVisualPlan.inspect(v.candidate, v.context); if (JSON.stringify(v.context) !== before) throw new Error('Compiler mutated trusted source context'); return result; })()`, runtime);
}
function rejected(candidate: any, context = functions) {
  const result = inspect(candidate, context);
  assert.equal(result.ok, false);
  assert.ok(result.reason, 'rejection must have a diagnostic reason');
  assert.ok(!result.scene, 'rejected model data must not carry a renderable scene');
}
function compiled(candidate: any, context: any) {
  const result = inspect(candidate, context);
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.ok(result.scene);
  const { document } = parseHTML('<html><body></body></html>');
  const figure = api.render(document, result.scene);
  assert.ok(figure, 'accepted model data must render through a local compiler');
  assert.ok(figure.querySelector('svg,table'), 'the accepted plan must create an actual visual');
  assert.equal(figure.querySelectorAll('script,foreignObject,iframe,image').length, 0);
  assert.doesNotMatch(figure.outerHTML, /(?:NaN|Infinity|undefined|onload=|javascript:)/i);
  return { scene: result.scene, figure };
}

it('compiles both explicitly authored function rules without a computed intersection', () => {
  const { figure } = compiled(plan('function', functions), functions);
  assert.equal(figure.querySelectorAll('[data-role="given-function"]').length, 2);
  assert.doesNotMatch(figure.textContent, /\(-2\s*,\s*1\)/);
});
it('compiles only authored coordinate tuples, preserving both given labels', () => {
  const { figure } = compiled(plan('coordinates', coordinates), coordinates);
  assert.match(figure.textContent, /A/); assert.match(figure.textContent, /B/);
});
it('compiles the actual assessment numberline with the two given points', () => {
  const { figure } = compiled(plan('numberline', numberline), numberline);
  assert.match(figure.textContent, /P/); assert.match(figure.textContent, /Q/);
});
it('compiles the exact singular class declarations without completing their membership', () => {
  const context = authored('G8-T28', 'b', 'q15', 'q15a');
  const { scene, figure } = compiled(plan('numberline', context), context);
  assert.deepEqual(clone(scene.intervals), [{ start: 3, end: 7, closedStart: true, closedEnd: false }, { start: 7, end: 10, closedStart: true, closedEnd: true }]);
  assert.equal(figure.querySelectorAll('[data-role="given-interval"]').length, 2);
  assert.doesNotMatch(figure.textContent, /3\.5|6\.2|8\.1|9\.5/);
});
it('compiles an actual prism scaffold and leaves the uncomputed axial length unknown', () => {
  const { figure } = compiled(plan('given-geometry', prism), prism);
  assert.match(figure.textContent, /\?/);
});
it('retains the exact source table cells including all six unanswered cells', () => {
  const before = clone(blankTable);
  const { scene, figure } = compiled(plan('table', blankTable, { tableSource: 'question' }), blankTable);
  assert.deepEqual(blankTable, before, 'compilation must not complete the source table in place');
  assert.deepEqual(clone(scene.table.rows), [['0', '?', '?'], ['30', '?', '?'], ['60', '?', '?']]);
  assert.equal(Array.from(figure.querySelectorAll('tbody td')).filter((td: any) => td.textContent === '?').length, 6);
  assert.doesNotMatch(figure.textContent, /2\.5|1\.5/);
});
it('compiles a frequency chart from source data without inventing a fifth total category', () => {
  const { figure } = compiled(plan('bar-chart', soup, { tableSource: 'question' }), soup);
  assert.match(figure.textContent, /עדשים/); assert.match(figure.textContent, /אפונה/);
  assert.deepEqual(Array.from(figure.querySelectorAll('svg rect[data-value]'), (rect: any) => rect.getAttribute('data-value')), ['40', '20', '12', '8']);
  assert.match(figure.querySelector('table').textContent, /80/, 'the source total remains visible in the accompanying table');
});
it('compiles an operation scaffold from an exact authored expression without solving it', () => {
  const { figure } = compiled(plan('operations', algebra, { expression: '11(x + 6)' }), algebra);
  assert.doesNotMatch(figure.textContent, /11x\s*\+\s*66/);
});

it('rejects a quote that belongs to another question, another part, or the model answer', () => {
  const original = plan('function', functions);
  for (const evidence of [
    [{ source: 'question', quote: 'y=99x+998' }],
    [{ source: 'part', quote: functions.questionText }],
    [{ source: 'question', quote: functions.partText }],
    [{ source: 'answer', quote: functions.hintText }],
    [{ source: 'student', quote: functions.studentMessage }],
    [{ source: 'question', quote: functions.questionText.replace('x+3', 'x+4') }]
  ]) rejected({ ...original, evidence });
});
it('requires nonempty bounded evidence rather than accepting a family name alone', () => {
  for (const evidence of [undefined, [], [{ source: 'question', quote: '' }], [{ source: 'question', quote: ' ' }], Array(101).fill({ source: 'question', quote: functions.questionText })]) {
    rejected({ ...plan('function', functions), evidence });
  }
});
it('rejects wrong versions, non-ok statuses and unsupported family names', () => {
  const original = plan('function', functions);
  for (const patch of [{ version: 1 }, { version: '2' }, { status: 'success' }, { status: 'none' }, { family: 'raw-svg' }, { family: 'solved-answer' }]) rejected({ ...original, ...patch });
});
it('the model cannot add coordinates, table cells, SVG, HTML, source identities, or executable fields', () => {
  const original = plan('function', functions);
  for (const patch of [
    { points: [{ name: 'Z', x: 900, y: 900 }] }, { cells: [['solved', 42]] },
    { svg: '<svg onload="alert(1)"></svg>' }, { html: '<img src=x onerror=alert(1)>' },
    { exerciseId: 'G9-T99-A-Q99א' }, { source: 'https://example.com/private' },
    { expression: 'x+99' }, { tableSource: 'question' },
    JSON.parse('{"__proto__":{"polluted":true}}')
  ]) rejected({ ...original, ...patch });
});
it('rejects expression injection or a computed expression absent from the cited source', () => {
  for (const expression of ['7x+6', 'process.exit()', 'x;alert(1)', '<svg/>', 'x.constructor', 'x'.repeat(20000)]) rejected(plan('operations', algebra, { expression }), algebra);
});
it('table plans cannot select an absent part table or supply replacement cells', () => {
  rejected(plan('table', blankTable, { tableSource: 'part' }), blankTable);
  rejected(plan('table', blankTable, { tableSource: 'question', rows: [['0', 'answer', 'answer']] }), blankTable);
});
it('malformed or ragged authoritative table data fails closed', () => {
  for (const table of [null, { head: ['x', 'y'], rows: [['0']] }, { head: ['x', 'y'], rows: [[0, { html: '<svg/>' }]] }]) {
    const ctx = { ...blankTable, questionTable: table };
    rejected(plan('table', ctx, { tableSource: 'question' }), ctx);
  }
});
it('unknown parameters and altered-geometry tasks do not become completed source scenes', () => {
  const implicit = authored('G8-T06', 'a', 'q13', 'q13a');
  const changed = authored('G9-T15', 'c', 'q20', 'q20c');
  rejected(plan('function', implicit), implicit);
  rejected(plan('given-geometry', changed), changed);
});
it('extra parent, sibling or answer fields cannot override exact selected source evidence', () => {
  const original = inspect(plan('function', functions), functions);
  const poisoned = { ...functions, given: ['y=999x+777'], siblings: [{ text: 'y=888x+666' }], answer: 'y=777x+555' };
  assert.deepEqual(clone(inspect(plan('function', functions), poisoned)), clone(original));
});

it('does not silently drop an unsupported point from a quoted coordinate set', () => {
  const tooLarge = { ...coordinates, questionText: 'נתונות $A(2,2)$ ו־$B(200,6)$.' };
  rejected(plan('coordinates', tooLarge), tooLarge);
  const tooMany = { ...coordinates, questionText: Array.from({ length: 9 }, (_, i) => `${String.fromCharCode(65 + i)}(${i},${i + 1})`).join(', ') };
  rejected(plan('coordinates', tooMany), tooMany);
});

it('exact selected native tables are copied without exposing another item or mutating source data', () => {
  const native = JSON.parse(readFileSync(new URL('noam-ai/native/G8-T03/a/noam-ai.json', pub), 'utf8'));
  const manifest = JSON.parse(readFileSync(new URL('noam-ai/manifests/cb58f1eed5014be086fd0ce42935ebf5.json', pub), 'utf8'));
  const exercise = manifest.exercises.find((e: any) => e.id === 'G8-T03-A-Q01א');
  const q = native.questions.find((q: any) => q.id === 'q1');
  const original = clone(q.table);
  const context = runtime.NoamNativeVisual.authoredContext(native, exercise, '');
  assert.deepEqual(clone(context.questionTable), original);
  assert.equal(context.partTable, null);
  context.questionTable.rows[0][1] = '999';
  assert.deepEqual(q.table, original, 'a caller cannot fill canonical native table cells by mutating compiled context');
  const wrong = { ...exercise, nativeItemId: 'q99a' };
  assert.equal(runtime.NoamNativeVisual.authoredContext(native, wrong, ''), null);
});

it('an otherwise valid authored function cannot replace a complete reviewed source-panel group',()=>{
 const source=authored('G8-T17','a','q9','q9b'),candidate=plan('function',source);
 assert.equal(inspect(candidate,source).ok,true);
 for(const sourcePanels of [[{id:'q9_head',kind:'function_graph',visibleNames:['f']},{id:'q9_head_2',kind:'function_graph',visibleNames:['g']}],[],null,{},'q9_head',false]){
  const result=inspect(candidate,{...source,sourcePanels});assert.equal(result.ok,false);assert.equal(result.reason,'source_panel_context_only');assert.equal(result.scene,null);
 }
 assert.equal(api.inspect(candidate,{...source,sourcePanels:undefined}).reason,'source_panel_context_only');
 const inherited=Object.assign(Object.create({sourcePanels:[]}),source);assert.equal(api.inspect(candidate,inherited).reason,'source_panel_context_only');
});
it('source-panel ownership also blocks operations and table routes before family dispatch',()=>{
 for(const[candidate,source]of [[plan('table',blankTable,{tableSource:'question'}),blankTable],[plan('operations',algebra,{expression:'11(x+6)'}),algebra]]){
  const result=inspect(candidate,{...source,sourcePanels:[]});assert.equal(result.ok,false);assert.equal(result.reason,'source_panel_context_only');
 }
});
