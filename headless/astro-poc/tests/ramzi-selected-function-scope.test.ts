import { runVisualCompilerInNewContext } from './helpers/visual-compiler-vm';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { it } from 'node:test';
import { parseHTML } from 'linkedom';

const root=new URL('../public/',import.meta.url);
const files=['noam-native-visual.js','noam-authored-visual.js','noam-visual-plan.js','noam-source-panels.js','noam-geometry.js','noam-diagram-plan.js'];
const draw={studentMessage:'אפשר רמז 1?',helpKind:'hint',answer:'האם שווית את שני הביטויים של y זה לזה כדי ליצור משוואה אחת?',drawCurrentStep:true};
function fn(v:string,name:string){const start=v.indexOf('function '+name+'(');assert.ok(start>=0,name);const tail=v.slice(start);return tail.slice(0,tail.indexOf('\nfunction ',1));}
function fixture(part='ב',viewer='../public/worksheet-viewer-noam.html'){
 const manifest=JSON.parse(readFileSync(new URL('noam-ai/manifests/e10786e0b31e4de894b0778da9d12495.json',root),'utf8'));
 const exercise=manifest.exercises.find((e:any)=>e.q===17&&e.part===part);
 const data=JSON.parse(readFileSync(new URL(manifest.nativeExportUrl.slice(1),root),'utf8'));
 const svgText=readFileSync(new URL(exercise.nativeFigureUrl.slice(1),root),'utf8'),source={data,svgText};
 const {document}=parseHTML('<html><body></body></html>'),c:any={document,manifest,selectedExercise:exercise};c.window=c;
 for(const file of files)runVisualCompilerInNewContext(readFileSync(new URL(file,root),'utf8'),c,{filename:file});
 const context=c.NoamNativeVisual.authoredContext(data,exercise,svgText);assert.ok(context);
 const v=readFileSync(new URL(viewer,import.meta.url),'utf8');
 Object.assign(c,{noamCachedSourceVisual:()=>source,noamSourcePanelModuleMissing:()=>false,
  noamSourcePanelReviewed:(e:any)=>c.NoamSourcePanels.isReviewed(e),
  noamDiagramSourceIdentity:()=> 'current-pdf',noamSourceVisualIdentity:()=> 'current-native',
  noamSourceVisualOptions:(o:any)=>o});
 for(const name of ['noamSourcePresentation','noamTypedVisualContext','noamInspectVisualPlan','noamRenderVisualPlan','noamRenderAiDiagram','noamCanOfferDrawing','noamRenderSourceVisual'])runVisualCompilerInNewContext(fn(v,name),c);
 return {c,source,data,exercise,context,svgText};
}
function plan(context:any){return {version:2,status:'ok',family:'function',evidence:[{source:'question',quote:context.questionText}]};}
function plain(v:any){return JSON.parse(JSON.stringify(v));}

it('actual MP04 second system and its first-system sibling cannot collect all four stem formulas',()=>{
 for(const part of ['א','ב']){
  const f=fixture(part);
  assert.equal(f.c.NoamAuthoredVisual.formulas(f.context.questionText).length,4,'real shared stem fixture');
  assert.equal(f.c.NoamAuthoredVisual.resolve(f.data,f.exercise,draw,f.svgText),null);
  const checked=f.c.NoamVisualPlan.inspect(plan(f.context),f.context);
  assert.equal(checked.ok,false);assert.equal(checked.reason,'ambiguous_function_scope');
 }
});
it('ordinal selection spelling does not become a formula-to-panel assignment',()=>{
 const f=fixture();
 for(const partText of ['פתרו את המערכת הראשונה.','פתרו את המערכת השנייה.','פתרו את המערכת השניה.','בדקו את הבדיקה השנייה.','הציגו את הגרף השני.','הציגו את הפונקציה השנייה.']){
  const context={...f.context,partText};
  assert.equal(f.c.NoamAuthoredVisual.fromContext(context,draw),null,partText);
  assert.equal(f.c.NoamVisualPlan.inspect(plan(context),context).ok,false,partText);
 }
});
it('an explicit selected pair never imports the other system from its shared stem',()=>{
 const f=fixture();
 const context={...f.context,partText:'פתרו את המערכת השנייה: $y=x^2-2$ ו־$y=2x+1$.'};
 assert.equal(f.c.NoamAuthoredVisual.fromContext(context,draw),null);
 const evidence=[{source:'question',quote:context.questionText},{source:'part',quote:context.partText}];
 const checked=f.c.NoamVisualPlan.inspect({version:2,status:'ok',family:'function',evidence},context);
 assert.equal(checked.ok,false);assert.equal(checked.reason,'ambiguous_function_scope');
});
it('ordinary shared comparisons and exact current-part declarations retain all authored functions',()=>{
 const f=fixture(),api=f.c.NoamAuthoredVisual;
 for(const context of [
  {questionText:'נתונות $y=x^2-2$ ו־$y=2x+1$.',partText:'השוו את שני הגרפים.'},
  {questionText:'בדקו את המערכת הנתונה.',partText:'במערכת השנייה נתונות $y=x^2-2$ ו־$y=2x+1$.'},
  {questionText:'נתונה $f(x)=x^2-2$.',partText:'השוו אותה עם $g(x)=2x+1$.'},
 ]){
  const scene=api.fromContext(context,draw);assert.equal(scene.kind,'authored-function');
  assert.deepEqual(plain(scene.expressions).map((x:any)=>x.expression),['x^2-2','2x+1']);
  const evidence=[{source:'question',quote:context.questionText},{source:'part',quote:context.partText}];
  assert.equal(f.c.NoamVisualPlan.inspect({version:2,status:'ok',family:'function',evidence},context).ok,true);
 }
 const own=api.resolve(f.data,f.exercise,{studentMessage:'שרטט y=x^2-2',helpKind:'free_question'},f.svgText);
 assert.equal(own.expressions.length,1);assert.equal(own.expression,'x^2-2');
});
for(const viewer of ['../public/worksheet-viewer-noam.html','../../../worksheet-viewer-noam.html']){
 it(viewer+': actual Beta presentation falls back to only the validated u/v original',()=>{
  const f=fixture('ב',viewer);assert.equal(f.c.NoamSourcePanels.isReviewed(f.exercise),false,'verified singular exception');
  const shown=f.c.noamSourcePresentation(f.source,f.exercise,draw);
  assert.equal(shown.kind,'source-context');assert.ok(shown.figure.querySelector('image'));
  assert.equal(shown.figure.querySelectorAll('[data-role="given-function"]').length,0);
  const href=shown.figure.querySelector('image').getAttribute('href');
  assert.match(href,/q17_head_2\.svg$/);assert.match(shown.figure.textContent,/מקור/);
 });
 it(viewer+': saved four-curve v2 is rejected with retry available; saved local scene re-resolves the original',()=>{
  const f=fixture('ב',viewer),visual={type:'ai-diagram',exerciseId:f.exercise.id,sourceIdentity:'current-pdf',nativeSourceIdentity:'current-native',plan:plan(f.context),context:{hintText:draw.answer,studentMessage:draw.studentMessage}};
  assert.equal(f.c.noamRenderAiDiagram(visual),null);
  assert.equal(f.c.noamCanOfferDrawing(f.exercise,{messages:[]},{role:'assistant',text:draw.answer,visual}),true);
  const restored=f.c.noamRenderSourceVisual({type:'native-source-visual',exerciseId:f.exercise.id,sourceIdentity:'current-native',options:draw,presentation:'authored-function'});
  assert.ok(restored.querySelector('image'));assert.equal(restored.querySelectorAll('[data-role="given-function"]').length,0);
  assert.match(restored.querySelector('image').getAttribute('href'),/q17_head_2\.svg$/);
 });
}
