import { runVisualCompilerInNewContext } from './helpers/visual-compiler-vm';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

import { it } from 'node:test';

const pub=new URL('../public/',import.meta.url),root=new URL('../../../',import.meta.url);
const read=(path:string,base=pub)=>readFileSync(new URL(path,base),'utf8'),json=(path:string,base=pub)=>JSON.parse(read(path,base));
const sha=(value:string)=>createHash('sha256').update(value).digest('hex'),clone=(v:any)=>JSON.parse(JSON.stringify(v));
const specs=[
 {path:'G7-T12/b',q:'q14',part:'א',pdf:'e6bad05438cb48f4ab5f7d894727625f',
  svg:'f69733ad29146b2350bf5067d76339de602132eb27524174e85685c6183a54b6',pdfSha:'85e3772616d36ab6b6d1eaba2eb21e219f8fa52a023f1159c0af993b1e333cd0',given:[]},
 {path:'G8-T46/a',q:'q20',part:'ה',pdf:'1447b1c93a0f481abbd1eccbef8a7551',
  svg:'47c9ff13e243289e8294086fd8ec60376208c204036f352238d1ac5799ca31dd',pdfSha:'dd34cf6b135a218683bd0571ca9142483ad88d6d9db491c52cec78ab3fe1b40c',given:['∠BAC = ∠DAE','∠ABC = ∠ADE']},
 {path:'G8-T46/b',q:'q20',part:'ה',pdf:'7b2d78cef1f44268ba9265392320ad26',
  svg:'fecd9b0ece946ce0bff90b8d07c86d2293264e65e64259212997984ec02a4861',pdfSha:'6d9737cb2fa6870c7964752cd0c415e3ded8dac990b62ee5a360926c69a721b2',given:['AB ⊥ AC','DE ⊥ DF']},
 {path:'G8-T46/c',q:'q20',part:'ה',pdf:'162e9a4cd15e41c5bb68cc6a1b600e81',
  svg:'ea78687e3d6c48a9798f55e5aa6971f3e68d4afaa2a1fe7c333fa4d714656a7d',pdfSha:'77fadbb315b5c9f58b4afe1863b830bfb4aa466376f2b877bd17cccb994cf005',given:['AB ∥ CD']},
];
const native:any={};runVisualCompilerInNewContext(read('noam-native-visual.js'),native);
function fixture(s:typeof specs[number]){
 const manifest=json('noam-ai/manifests/'+s.pdf+'.json'),data=json('noam-ai/native/'+s.path+'/noam-ai.json');
 const question=data.questions.find((q:any)=>q.id===s.q),figure=data.figures.find((f:any)=>f.id===question.figure_id);
 return {manifest,data,question,figure,svg:read('noam-ai/native/'+s.path+'/'+figure.svg)};
}
function fn(v:string,n:string){const start=v.indexOf('function '+n+'(');assert.ok(start>=0,n);const tail=v.slice(start);return tail.slice(0,tail.indexOf('\nfunction ',1));}
it('the four printed part-only restrictions bind their figure to only the permitted item',()=>{
 let removed=0;
 for(const s of specs){
  const {manifest,data,question,figure,svg}=fixture(s),allowed=question.items.find((p:any)=>p.label===s.part);
  assert.equal(figure.item,allowed.id);assert.equal(figure.visual_model.item,allowed.id);
  assert.deepEqual(question.given,[]);assert.deepEqual(allowed.given.map((g:any)=>g.text),s.given);
  assert.ok(figure.visual_model.relations.every((r:any)=>!r.item||r.item===allowed.id));
  for(const item of question.items){
   const ex=manifest.exercises.find((e:any)=>e.nativeItemId===item.id),show={studentMessage:'הראה את השרטוט המקורי',helpKind:'free_question'};
   if(item.id===allowed.id){
    assert.equal(item.figure_id,figure.id);assert.equal(ex.nativeFigureId,figure.id);
    assert.equal(native.NoamNativeVisual.resolve(data,ex,show,svg)?.kind,'source-context');
    for(const g of s.given)assert.ok(ex.context.includes(g),'allowed item retains its printed given');
   }else{
    removed++;assert.equal(item.figure_id,null);assert.equal(ex.nativeFigureId,undefined);assert.equal(ex.nativeFigureUrl,undefined);
    assert.equal(native.NoamNativeVisual.resolve(data,ex,show,''),null,'no question-figure inheritance');
    const context=native.NoamNativeVisual.authoredContext(data,ex,'');assert.equal(context.hasFigure,false);assert.equal(context.partText,item.text);
    assert.ok(ex.prompt.includes(`האיור בשאלה מיועד רק לסעיף ${s.part} ואינו נתון של הסעיף הנבחר`));
    for(const g of s.given){assert.ok(!ex.context.includes(g));assert.ok(!ex.prompt.includes(g));assert.ok(!JSON.stringify(context).includes(g));}
    assert.equal(native.NoamNativeVisual.resolve(data,{...ex,nativeFigureId:figure.id,nativeFigureUrl:`/noam-ai/native/${s.path}/${figure.svg}`},show,svg),null,'stale manifest figure cannot reattach');
   }
  }
 }
 assert.equal(removed,15);
});
it('the reported W15-Q3 containment task has neither the final-part bow tie nor its parallel given',()=>{
 const {manifest,data}=fixture(specs[3]),ex=manifest.exercises.find((e:any)=>e.id==='G8-T46-E-Q20ד');
 assert.equal(ex.text,'מה יש לדרוש לפני שמחסרים שטח פנימי מן השלם?');
 assert.doesNotMatch(ex.context+'\n'+ex.prompt,/AB\s*∥\s*CD|△BAO/);
 const context=native.NoamNativeVisual.authoredContext(data,ex,'');assert.equal(context.hasFigure,false);assert.doesNotMatch(JSON.stringify(context),/AB\s*∥\s*CD|△BAO/);
 const last=manifest.exercises.find((e:any)=>e.id==='G8-T46-E-Q20ה');assert.match(last.text,/AB∥CD.*△BAO/);assert.ok(last.nativeFigureUrl.endsWith('q20_head.svg'));
});
it('source SVG bytes, PDF identity, native twin bytes and exact package digests remain verified',()=>{
 for(const s of specs){
  const {manifest,svg}=fixture(s);assert.equal(sha(svg),s.svg);assert.equal(manifest.sourceSha256,s.pdfSha);
  for(const relative of ['noam-ai/native/'+s.path+'/noam-ai.json','noam-ai/native/'+s.path+'/figures/'+s.q+'_head.svg','noam-ai/manifests/'+s.pdf+'.json'])assert.equal(read(relative),read(relative,root));
  assert.equal(manifest.nativeExportSha256,sha(read(manifest.nativeExportUrl.slice(1))));
 }
});
it('all canonical questions with these explicit source restrictions use the reviewed per-item scope',()=>{
 const rows=['pilot','next-ten','second-ten','third-ten','fourth-ten','remaining-101'].flatMap(n=>json(`../src/data/worksheet-${n}.v1.json`).sheets),matched:string[]=[];
 for(const row of rows){const data=json(row.nativeExport.slice(1));for(const q of data.questions){
  const text=Array.isArray(q.text)?q.text.join('\n'):q.text||'';
  if(!/האיור מתייחס רק לסעיף האחרון|האיור של שני המשולשים ישרי־הזווית משמש רק בסעיף האחרון|השרטוט מתאר את החלוקה בסעיף [א-ת] בלבד/.test(text))continue;
  const path=row.nativeExport.split('/native/')[1].split('/noam-ai.json')[0],s=specs.find(s=>s.path===path&&s.q===q.id);assert.ok(s,path+'/'+q.id);
  assert.deepEqual(q.items.filter((p:any)=>p.figure_id).map((p:any)=>p.label),[s.part]);matched.push(path+'/'+q.id);
 }}
 assert.equal(rows.length,412);assert.deepEqual(matched.sort(),specs.map(s=>s.path+'/'+s.q).sort());
});
for(const relative of ['worksheet-viewer-noam.html','../../../worksheet-viewer-noam.html']){
 const viewer=relative.startsWith('../')?readFileSync(new URL(relative,import.meta.url),'utf8'):read(relative),prefix=relative.startsWith('../')?'root':'public';
 it(prefix+': only the four corrected PDFs rotate OCR caches, while conversation keys stay unchanged',()=>{
  const source=viewer.slice(viewer.indexOf('var NOAM_NUMBER_SUMMARY_PDFS ='),viewer.indexOf('try{',viewer.indexOf('var NOAM_NUMBER_SUMMARY_PDFS =')));
  for(const pdf of [...specs.map(s=>s.pdf),'unrelated-pdf']){
   const c:any={pdf,HEADLESS_MANIFEST_BASE:'/noam-ai/manifests/'};runVisualCompilerInNewContext(source,c);
   assert.equal(c.ANALYSIS_STORAGE_KEY,'noam-static-analysis-v2-crop-geometry:'+pdf+(pdf==='unrelated-pdf'?'':':item-figure-scope-20261028'));
   assert.equal(c.THREAD_STORAGE_KEY,'noam-static-threads-v1:'+pdf);assert.match(c.MANIFEST_PATH,/item-figure-scope/);
  }
 });
 it(prefix+': the ordinary hint semantic payload starts with the corrected selected-part restriction',()=>{
  const c:any={};for(const n of ['noamManifestOcrUnreliable','noamExerciseSectionLabel','noamScopedExerciseSemantic','syntheticAnalysis'])runVisualCompilerInNewContext(fn(viewer,n),c);
  for(const s of specs){const {manifest,question}=fixture(s);
   for(const ex of manifest.exercises.filter((e:any)=>e.nativeQuestionId===question.id&&e.part!==s.part)){
    const semantic=c.noamScopedExerciseSemantic(ex),analysis=c.syntheticAnalysis(ex);
    assert.equal(semantic,ex.prompt);assert.equal(analysis.transcription,semantic);assert.equal(analysis.problem_statement,semantic);
    assert.ok(semantic.includes(ex.text));assert.ok(semantic.includes(`האיור בשאלה מיועד רק לסעיף ${s.part} ואינו נתון של הסעיף הנבחר`));
    for(const given of s.given)assert.ok(!semantic.includes(given));
   }
  }
 });
 it(prefix+': old saved native and generated visuals cannot reintroduce the sibling-only source',()=>{
  const {manifest,figure}=fixture(specs[3]),exercise=manifest.exercises.find((e:any)=>e.id==='G8-T46-E-Q20ד');
  let cacheReads=0;
  const c:any={manifest,pdf:manifest.pdfHash,selectedExercise:exercise,window:{NoamNativeVisual:native.NoamNativeVisual},
   noamCachedSourceVisual:()=>{cacheReads++;throw new Error('passed identity guard');}};
  for(const n of ['noamDiagramSourceIdentity','noamNativeDataUrl','noamSourceVisualIdentity','noamRenderSourceVisual','noamRenderAiDiagram'])runVisualCompilerInNewContext(fn(viewer,n),c);
  // Only the public adapter has the older native-focus persistence route.
  if(viewer.includes('function noamNativeFocusIdentity('))for(const n of ['noamNativeFocusIdentity','noamRenderNativeFocus'])runVisualCompilerInNewContext(fn(viewer,n),c);
  const stale=clone(exercise);stale.nativeFigureId=figure.id;stale.nativeFigureUrl='/noam-ai/native/G8-T46/c/'+figure.svg;stale.context+='\nAB ∥ CD';stale.prompt+='\nAB ∥ CD';
  const oldSource=c.noamSourceVisualIdentity(stale),oldDiagram=c.noamDiagramSourceIdentity(stale);
  assert.notEqual(oldSource,c.noamSourceVisualIdentity(exercise));assert.notEqual(oldDiagram,c.noamDiagramSourceIdentity(exercise));
  assert.equal(c.noamRenderSourceVisual({type:'native-source-visual',exerciseId:exercise.id,sourceIdentity:oldSource,options:{}}),null);
  if(c.noamRenderNativeFocus)assert.equal(c.noamRenderNativeFocus({type:'native-source-focus',exerciseId:exercise.id,sourceIdentity:c.noamNativeFocusIdentity(stale),hint:'AB וCD'}),null);
  for(const version of [1,2])assert.equal(c.noamRenderAiDiagram({type:'ai-diagram',exerciseId:exercise.id,sourceIdentity:oldDiagram,plan:{version,status:'ok'}}),null);
  assert.equal(cacheReads,0,'stale source is rejected before any cached figure is read');
  assert.throws(()=>c.noamRenderSourceVisual({type:'native-source-visual',exerciseId:exercise.id,sourceIdentity:c.noamSourceVisualIdentity(exercise),options:{}}),/passed identity guard/,'control: a matching identity reaches the cache');
 });
}
