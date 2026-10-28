import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {it} from 'node:test';
import {parseHTML} from 'linkedom';
const root=new URL('../../../',import.meta.url),api=createRequire(import.meta.url)('../../../noam-visual-data.js');
const op=(expression:string,quote:string,source='part')=>({version:2,status:'ok',family:'operations',expression,evidence:[{source,quote}]});
const check=(expression:string,partText='$'+expression+'$',hintText='')=>api.inspect(op(expression,partText),{questionText:'חשבו.',partText,hintText});
const number=(value:string)=>({type:'number',value,children:[]});
const operator=(value:string,...children:any[])=>({type:'operator',value,children});

it('W37-Q2 keeps the exact authored square brackets and ordered operation tree without calculating',()=>{
  const d=JSON.parse(readFileSync(new URL('noam-ai/native/G7-T05/a/noam-ai.json',root),'utf8'));
  const q=d.questions.find((q:any)=>q.id==='q5'),part=q.items.find((p:any)=>p.id==='q5c');
  assert.equal(part.text,'$20 − [(−4) − 8 · (−2)]$');
  const expression=part.text.slice(1,-1),context={questionText:q.text,partText:part.text,hintText:''};
  const r=api.inspect(op(expression,part.text),context);assert.equal(r.ok,true);assert.equal(r.scene.expression,expression);
  assert.deepEqual(r.scene.tree,operator('−',number('20'),operator('−',operator('−',number('4')),operator('×',number('8'),operator('−',number('2'))))));
  const figure=api.render(parseHTML('<html/>').document,r.scene);assert.ok(figure.querySelector('svg'));assert.match(figure.textContent,/תוצאה: \?/);
  assert.equal(api.inspect(op('8',part.text),context).ok,false,'a computed answer is not the authored expression');
  const spelling=api.inspect(op('20 - ((-4) - 8 * (-2))',part.text),context);assert.equal(spelling.ok,true);assert.equal(spelling.scene.expression,expression);
});

it('nested square brackets keep grouping, unary signs, implicit products and power precedence',()=>{
  for(const [expression,tree] of [
    ['[2+3]*4',operator('×',operator('+',number('2'),number('3')),number('4'))],
    ['2+[3*4]',operator('+',number('2'),operator('×',number('3'),number('4')))],
    ['2[3+4]',operator('×',number('2'),operator('+',number('3'),number('4')))],
    ['[2+3]^2',operator('^',operator('+',number('2'),number('3')),number('2'))],
    ['-[2+3]',operator('−',operator('+',number('2'),number('3')))],
    ['[2+{3*(4-1)}]',operator('+',number('2'),operator('×',number('3'),operator('−',number('4'),number('1'))))]
  ] as [string,any][]){const r=check(expression);assert.equal(r.ok,true,expression);assert.deepEqual(r.scene.tree,tree,expression);}
});

it('each opening bracket needs its matching closer, bounded nesting and a complete expression',()=>{
  for(const e of ['[2+3)','(2+3]','[2+{3*4])','[2+[3*4]','2+3]','[]','2[ ]','[[[[[[[2+3]]]]]]]','[2,3]','[2+3][','2[3+4].','x[0]','y [2]','2x[0]'])assert.equal(check(e).ok,false,e);
});

it('plaintext bracket runs and mixed math boundaries cannot supply partial source proof',()=>{
  assert.equal(check('2+[3*4]','חשבו 2+[3*4]').ok,true);
  assert.equal(check('[2+3]:[4+5]').ok,true);
  for(const [partText,expression] of [['$2+3$ : [4+5]','2+3'],['[2+3] : $4+5$','4+5']])assert.equal(api.inspect(op(expression,partText),{questionText:'',partText,hintText:''}).ok,false,partText);
  for(const partText of ['חשבו [2+3','חשבו 2+3]','חשבו [2+3)*4','$x$[2+3]','[2+$3$]','$2+3$[4+5]']){
    assert.equal(api.inspect(op('2+3',partText),{questionText:'',partText,hintText:''}).ok,false,partText);
  }
});

it('bracket support does not weaken exact evidence, selected-part scope or hinted-subtree proof',()=>{
  const partText='$20 − [(−4) − 8 · (−2)]$',context={questionText:'נתון $7+3$.',partText,hintText:''};
  assert.equal(api.inspect(op('20-[(-4)-8*(-2)]','$20-[(-4)-8*(-2)]$'),context).reason,'evidence-mismatch');
  assert.equal(api.inspect(op('7+3',context.questionText,'question'),context).reason,'selected-part-scope');
  assert.equal(api.inspect(op('8*(-2)',partText),context).ok,false,'subtrees still require current hint focus');
  assert.equal(api.inspect(op('8*(-2)',partText),{...context,hintText:'התבוננו בכפל $8 · (−2)$.'}).ok,true);
  assert.equal(api.inspect(op('20-(-4)-8*(-2)',partText),{...context,hintText:'בדקו $20-(-4)-8*(-2)$.'}).ok,false,'flattening changes the authored tree');
});

it('root and public bracket compilers are byte-identical',()=>assert.equal(readFileSync(new URL('noam-visual-data.js',root),'utf8'),readFileSync(new URL('headless/astro-poc/public/noam-visual-data.js',root),'utf8')));
