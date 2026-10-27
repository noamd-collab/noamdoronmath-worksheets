import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { it } from 'node:test';
import { parseHTML } from 'linkedom';
const scope:any={};
for(const f of ['noam-native-visual.js','noam-authored-geometry.js','noam-authored-visual.js','noam-visual-data.js','noam-visual-plan.js'])runInNewContext(readFileSync(new URL('../public/'+f,import.meta.url),'utf8'),scope);
const options={studentMessage:'אפשר רמז 1?',helpKind:'hint',answer:'התבוננו בגרף הנתון.',drawCurrentStep:true};
function plan(context:any){return {version:2,status:'ok',family:'function',evidence:[{source:'question',quote:context.questionText},{source:'part',quote:context.partText}]};}
it('explicit function domains cannot silently become the default unrestricted plot',()=>{
  for(const domain of ['$0≤x≤4$','$-2<x<4$','$x\\in[0,4]$','$0\\leq x\\leq4$','בתחום 0 עד 4','עבור קלטים חיוביים']){
    const context={questionText:'נתונה הפונקציה $y=x^2$ '+domain+'.',partText:'שרטטו את הגרף.'};
    assert.equal(scope.NoamAuthoredVisual.fromContext(context,options),null,domain);
    assert.equal(scope.NoamVisualPlan.inspect(plan(context),context).ok,false,domain);
  }
});
it('an unqualified explicit rule remains available and typed domain restrictions stay restrictive',()=>{
  const context={questionText:'נתונה הפונקציה $y=x^2$.',partText:'שרטטו את הגרף.'};
  assert.equal(scope.NoamVisualPlan.inspect(plan(context),context).ok,true);
  assert.equal(scope.NoamAuthoredVisual.fromContext(context,{studentMessage:'שרטט y=x^2 עבור 0≤x≤4',helpKind:'free_question'}),null);
});
it('actual integer bins use discrete points, while the following mass question retains continuous intervals',()=>{
  const data=JSON.parse(readFileSync(new URL('../public/noam-ai/native/G8-T28/a/noam-ai.json',import.meta.url),'utf8'));
  const q=data.questions.find((q:any)=>q.id==='q18');
  const context=(i:number)=>({questionText:q.text,partText:q.items[i].text});
  const a=scope.NoamAuthoredVisual.fromContext(context(0),{...options,answer:'התבוננו במחלקות.'});
  assert.equal(a.discrete,true);
  const {document}=parseHTML('<html></html>'),figure=scope.NoamAuthoredVisual.render(document,a);
  assert.equal(figure.querySelectorAll('[data-role="given-integer"]').length,15);
  assert.equal(figure.querySelectorAll('line[data-role="given-interval"]').length,0);
  const b=scope.NoamAuthoredVisual.fromContext(context(1),{...options,answer:'התבוננו במחלקות.'});
  assert.equal(b.discrete,false);assert.equal(scope.NoamAuthoredVisual.render(document,b).querySelectorAll('line[data-role="given-interval"]').length,3);
  for(const index of [2,3])assert.equal(scope.NoamAuthoredVisual.fromContext(context(index),{...options,answer:'התבוננו במחלקות.'}),null,'new student partition must not reuse old bins');
});
it('actual viewer formula route cannot bypass strict authored guards with the old native parser',()=>{
  const {document}=parseHTML('<html></html>');
  const native=JSON.parse(readFileSync(new URL('../public/noam-ai/native/G8-T11/b/noam-ai.json',import.meta.url),'utf8'));
  const exercise={id:'G8-T11-B-Q14א',part:'א',nativeQuestionId:'q14',nativeItemId:'q14a'};
  native.questions.find((q:any)=>q.id==='q14').text='נתונה $y=x^2$ בתחום $0≤x≤4$.';
  native.questions.find((q:any)=>q.id==='q14').items.find((p:any)=>p.id==='q14a').text='שרטטו את הגרף.';
  const viewer=readFileSync(new URL('../public/worksheet-viewer-noam.html',import.meta.url),'utf8');
  function fn(name:string){const chunk=viewer.slice(viewer.indexOf('function '+name+'('));return chunk.slice(0,chunk.indexOf('\nfunction ',1));}
  const c:any={window:scope,document,noamNativeDataUrl:()=>'/noam-ai/native/G8-T11/b/noam-ai.json'};
  runInNewContext(fn('noamSourcePresentation')+'\n'+fn('noamParsedLocalVisual'),c);
  assert.equal(c.noamSourcePresentation({data:native,svgText:''},exercise,options),null);
  c.window.NoamLocalVisual={parseShiftedParabolaExample:()=>{throw Error('legacy parser reached');}};
  assert.equal(c.noamParsedLocalVisual(exercise),null);
  const own=c.noamSourcePresentation({data:native,svgText:''},exercise,{studentMessage:'שרטט y=2x-6',helpKind:'free_question'});
  assert.equal(own.kind,'authored-function');assert.match(own.figure.textContent,/2x-6/);
});
it('constant authored functions render horizontal lines, including the real three-line comparison',()=>{
  const {document}=parseHTML('<html></html>');
  for(const expression of ['y=5','f(x)=0']){
    const context={questionText:'נתונה הפונקציה $'+expression+'$.',partText:'שרטטו את הגרף.'};
    const verdict=scope.NoamVisualPlan.inspect(plan(context),context);assert.equal(verdict.ok,true);
    const figure=scope.NoamVisualPlan.render(document,verdict.scene);assert.ok(figure);
    const path=figure.querySelector('[data-role="given-function"]').getAttribute('d');
    const ys=Array.from(path.matchAll(/[ML][\d.-]+ ([\d.-]+)/g),(m:any)=>m[1]);assert.ok(ys.length>3);assert.equal(new Set(ys).size,1);
  }
  const data=JSON.parse(readFileSync(new URL('../public/noam-ai/native/G8-T06/a/noam-ai.json',import.meta.url),'utf8')),q=data.questions.find((q:any)=>q.id==='q10');
  const context={questionText:q.text,partText:q.items[0].text};
  const verdict=scope.NoamVisualPlan.inspect(plan(context),context);assert.equal(verdict.ok,true,verdict.reason);
  assert.equal(scope.NoamVisualPlan.render(document,verdict.scene).querySelectorAll('[data-role="given-function"]').length,3);
  for(const text of ['$y=c$','$y=5$ וגם $y=m$','$x=-2$ וגם $y=5$'])assert.equal(scope.NoamAuthoredVisual.formulas(text).length,0);
});
it('zero-to-zero stays undefined and a plotted zero power cannot connect across its missing input',()=>{
  const api=scope.NoamAuthoredVisual,ast=api.parseExpression('x^0');
  assert.ok(Number.isNaN(api.evaluate(ast,0)));assert.equal(api.evaluate(ast,1),1);
  assert.equal(api.range(ast,-.01,.01),null);assert.equal(api.range(api.parseExpression('0^0'),-1,1),null);
  const {document}=parseHTML('<html></html>'),figure=api.render(document,{kind:'authored-function',expression:'(x-.013)^0',caption:'מקור'});
  assert.ok((figure.querySelector('[data-role="given-function"]').getAttribute('d').match(/M/g)||[]).length>=2);
});
