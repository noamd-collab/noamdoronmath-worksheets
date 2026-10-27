import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { it } from 'node:test';
import { parseHTML } from 'linkedom';
const root = new URL('../../../', import.meta.url), require = createRequire(import.meta.url);
const compiler = require('../../../noam-visual-data.js');
function context(pkg:string,level:string,qid:string,pid:string) {
  const data=JSON.parse(readFileSync(new URL(`noam-ai/native/${pkg}/${level}/noam-ai.json`,root),'utf8'));
  const q=data.questions.find((q:any)=>q.id===qid),p=q.items.find((p:any)=>p.id===pid);
  return {questionText:Array.isArray(q.text)?q.text.join('\n'):q.text,partText:Array.isArray(p.text)?p.text.join('\n'):p.text,questionTable:q.table,partTable:p.table,hintText:'',studentMessage:'שרטט להמחשה'};
}
function op(expression:string,quote:string,source='part') { return {version:2,status:'ok',family:'operations',expression,evidence:[{source,quote}]}; }
function tab(c:any,family='table',source='question') {return {version:2,status:'ok',family,tableSource:source,evidence:[{source,quote:source==='part'?c.partText:c.questionText}]};}
function render(scene:any) {return compiler.render(parseHTML('<html><body></body></html>').document,scene);}
const blanks=context('G8-T03','a','q1','q1a'),soups=context('G7-T24','b','q3','q3a'),expand=context('G7-T29','a','q5','q5d');

it('an exact selected expression produces a grouping tree without expanding or evaluating it',()=>{
  const result=compiler.inspect(op('11(x + 6)',expand.partText),expand);assert.equal(result.ok,true);
  assert.equal(result.scene.kind,'typed-operations');assert.equal(result.scene.tree.value,'×');
  assert.deepEqual(result.scene.tree.children.map((n:any)=>n.value),['11','+']);
  const figure=render(result.scene);assert.ok(figure.querySelector('svg'));assert.match(figure.textContent,/תוצאה: \?/);assert.doesNotMatch(figure.textContent,/66|11x|121/);
  const other=compiler.inspect(op('5(4x + 5)',expand.partText),expand);assert.equal(other.ok,true);assert.ok(render(other.scene));
});

it('operation notation supports exact fractions, powers, unary signs and variables with bounded parsing',()=>{
  for(const expression of ['\\f{x}{10} − 1','-3 + 2*(5 - 1)','2a + 3b','(x+2)^2','\\frac{3}{4} + \\frac{1}{2}','A − C','A = 10x − (3x − 6)']) {
    const c={questionText:'',partText:`פשטו: $${expression}$.`},r=compiler.inspect(op(expression,c.partText),c);assert.equal(r.ok,true,expression);assert.ok(render(r.scene),expression);
  }
  const r=compiler.inspect(op('\\f{x}{10} − 1',blanks.questionText,'question'),blanks);
  assert.equal(r.ok,true);assert.ok(render(r.scene).querySelector('math mfrac'));
});

it('the planner cannot inject computed answers, hint-only expressions or partial tokens as authored expressions',()=>{
  for(const [expression,quote]of[['11x + 66',expand.partText],['66',expand.partText],['1(x + 6)','1(x + 6)']])assert.equal(compiler.inspect(op(expression,quote),expand).ok,false);
  const c={questionText:'נתון הביטוי $111(x + 6)$.',partText:'פשטו.',hintText:'נסה 2 + 3'};
  assert.equal(compiler.inspect(op('1(x + 6)','1(x + 6)','question'),c).ok,false,'an exact quoted substring is insufficient if it cuts a larger math token');
  assert.equal(compiler.inspect(op('2 + 3','2 + 3','hint'),c).ok,false);
  assert.equal(compiler.inspect(op('x + 6','x + 6','question'),c).ok,false,'a subexpression does not silently replace the full authored expression');
});

it('a current self-contained expression blocks an earlier common-stem expression',()=>{
  const c={questionText:'פתחו את $3(x+4)$.',partText:'עתה פתחו $5(x+7)$.'};
  assert.equal(compiler.inspect(op('3(x+4)',c.questionText,'question'),c).reason,'selected-part-scope');
  assert.equal(compiler.inspect(op('5(x+7)',c.partText),c).ok,true);
});

it('authored equations show both exact sides without solving and only an actual hinted subtree may become focus',()=>{
  const c={questionText:'נתונה המשוואה $12+9+21=7x$.',partText:'פתרו.',hintText:'מהו הסכום 12+9+21?'};
  const whole=compiler.inspect(op('12+9+21=7x',c.questionText,'question'),c);assert.equal(whole.ok,true);assert.equal(whole.scene.tree.value,'=');
  const fig=render(whole.scene);assert.match(fig.textContent,/פתרון: \?/);assert.doesNotMatch(fig.textContent,/42|x\s*=\s*6/);
  const focus=compiler.inspect(op('12+9+21',c.questionText,'question'),c);assert.equal(focus.ok,true);assert.equal(focus.scene.tree.value,'+');
  assert.equal(compiler.inspect(op('12+9+21',c.questionText,'question'),{...c,hintText:''}).ok,false,'a subtree requires actual current focus');
  assert.equal(compiler.inspect(op('9+21',c.questionText,'question'),{...c,hintText:'חשבו 9+21'}).ok,false,'a token substring is not necessarily a complete AST subtree');
  assert.equal(compiler.inspect(op('42',c.questionText,'question'),{...c,hintText:'הסכום 42'}).ok,false,'a computed hint result is not source evidence');
});

it('unsupported or executable expression syntax is rejected rather than evaluated',()=>{
  for(const expression of ['globalThis.alert(1)','x.constructor','x[0]','f(x)','sin(x)','1e3+2','x^99','x^x','2=2=2','2 3','2+','1'.repeat(210)+'+1','((((((((x+2))))))))']) {
    const c={questionText:'',partText:`$${expression}$`};assert.equal(compiler.inspect(op(expression,c.partText),c).ok,false,expression);
  }
});

it('the actual native table preserves six blanks and never calculates its function values',()=>{
  const before=JSON.stringify(blanks),r=compiler.inspect(tab(blanks),blanks);assert.equal(r.ok,true);assert.equal(JSON.stringify(blanks),before);
  assert.deepEqual(r.scene.table.rows,[['0','?','?'],['30','?','?'],['60','?','?']]);
  const figure=render(r.scene);assert.equal(figure.querySelectorAll('tbody td').length,9);
  assert.equal([...figure.querySelectorAll('tbody td')].filter((n:any)=>n.textContent==='?').length,6);
  assert.equal(figure.querySelectorAll('thead mfrac').length,2);assert.equal(figure.querySelectorAll('tbody td').item(0).textContent,'0');
  assert.equal(compiler.inspect(tab(blanks,'bar-chart'),blanks).reason,'incomplete-chart-data');
});

it('given category counts render as bars while an authored total remains only in the reference table',()=>{
  const r=compiler.inspect(tab(soups,'bar-chart'),soups);assert.equal(r.ok,true);
  assert.deepEqual(r.scene.table.rows.map((row:any)=>row[1]),['40','20','12','8','80']);
  const figure=render(r.scene),bars=[...figure.querySelectorAll('rect[data-value]')];
  assert.deepEqual(bars.map((n:any)=>n.getAttribute('data-value')),['40','20','12','8']);
  assert.equal(figure.querySelectorAll('tbody tr').length,5);assert.match(figure.textContent,/אינה קטגוריה/);
  assert.doesNotMatch(figure.textContent,/50%|25%|15%|10%|0\.5/);
});

it('a real blank-corner table remains renderable without inventing a header or any output value',()=>{
  const c=context('G7-T30','a','q15','q15a'),r=compiler.inspect(tab(c),c);assert.equal(r.ok,true);
  assert.equal(r.scene.table.head[0],'?');assert.deepEqual(r.scene.table.rows.map((row:any)=>row[0]),['A','B','C']);
  const figure=render(r.scene);assert.equal([...figure.querySelectorAll('tbody td')].filter((n:any)=>n.textContent==='?').length,15);
  assert.equal(figure.querySelectorAll('tbody td').length,18);
});

it('signed authored values use a zero baseline and retain original signs, without generated axis values',()=>{
  const c=context('G7-T01','a','q1','q1a'),r=compiler.inspect(tab(c,'bar-chart'),c),figure=render(r.scene);
  assert.equal(r.ok,true);assert.deepEqual([...figure.querySelectorAll('rect[data-value]')].map((n:any)=>n.getAttribute('data-value')),['-11','-2','+5','+8']);
  for(const n of figure.querySelectorAll('rect[data-value]'))assert.ok(Number(n.getAttribute('width'))>=0);
});

it('table and bar plans cannot supply cells or use another selected part table',()=>{
  for(const patch of [{rows:[['fake','99']]},{table:{head:['x','y'],rows:[['1','2']]}},{expression:'2+3'}])assert.equal(compiler.inspect({...tab(soups),...patch},soups).ok,false);
  const c={...soups,partText:'בטבלה זו נתונים אחרים.',partTable:{head:['סוג','כמות'],rows:[['א','2'],['ב','3']]}};
  assert.equal(compiler.inspect(tab(c),c).reason,'selected-part-scope');
  assert.deepEqual(compiler.inspect(tab(c,'table','part'),c).scene.table.rows,[['א','2'],['ב','3']]);
  assert.equal(compiler.inspect(tab({...c,partText:'החליפו את הטבלה.'}),{...c,partTable:undefined,partText:'החליפו את הטבלה.'}).reason,'selected-part-scope');
});

it('incomplete, ambiguous or malformed data is not promoted into a computed chart',()=>{
  for(const rows of [[['א','?']],[['א','2'],['א','3']],[['א','2+3']],[['א','1000000']],[['?','2']],[['סך הכול','80']]]) {
    const c={questionText:'הנתונים בטבלה.',partText:'השוו.',questionTable:{head:['קטגוריה','כמות'],rows}};assert.equal(compiler.inspect(tab(c,'bar-chart'),c).ok,false,JSON.stringify(rows));
  }
  const c={...soups,questionTable:{head:['סוג','כמות'],rows:[['א']]}};assert.equal(compiler.inspect(tab(c),c).ok,false);
});

it('both exact evidence and strict plan keys are required, with no getters or markup execution',()=>{
  for(const patch of [{evidence:[]},{evidence:[{source:'question',quote:'invented'}]},{url:'https://example.test'},{svg:'<svg/>'},{version:1},{status:'unsupported'},{family:'question-image'}])assert.equal(compiler.inspect({...tab(soups),...patch},soups).ok,false);
  const getter=tab(soups);Object.defineProperty(getter,'family',{get(){throw Error('must not run');},enumerable:true});assert.equal(compiler.inspect(getter,soups).ok,false);
  const c={questionText:'נתונים.',partText:'השוו.',questionTable:{head:['שם','ערך'],rows:[['<img src=x onerror=alert(1)>','2']]}};
  const fig=render(compiler.inspect(tab(c),c).scene);assert.equal(fig.querySelectorAll('img,script,foreignObject').length,0);assert.match(fig.textContent,/<img/);
});

it('render revalidates compiled trees and tables instead of trusting stored scene markup or altered ASTs',()=>{
  const good=compiler.inspect(op('11(x + 6)',expand.partText),expand).scene;
  for(const mutate of [(s:any)=>s.tree.children[0].value='66',(s:any)=>s.tree.url='https://example.test',(s:any)=>s.caption='wrong',(s:any)=>s.table={},(s:any)=>s.expression='eval(1)']) {const s=structuredClone(good);mutate(s);assert.equal(render(s),null);}
  const bar=compiler.inspect(tab(soups,'bar-chart'),soups).scene;bar.table.rows[0][1]='?';assert.equal(render(bar),null);
});

it('root and public data compilers are byte-identical',()=>assert.equal(readFileSync(new URL('noam-visual-data.js',root),'utf8'),readFileSync(new URL('headless/astro-poc/public/noam-visual-data.js',root),'utf8')));
