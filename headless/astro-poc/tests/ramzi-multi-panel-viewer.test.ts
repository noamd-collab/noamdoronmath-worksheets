import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { it } from 'node:test';
import { parseHTML } from 'linkedom';
const root=new URL('../public/',import.meta.url);
const native=readFileSync(new URL('noam-native-visual.js',root),'utf8'),panels=readFileSync(new URL('noam-source-panels.js',root),'utf8');
const manifests=readdirSync(new URL('noam-ai/manifests/',root)).map(f=>JSON.parse(readFileSync(new URL('noam-ai/manifests/'+f,root),'utf8'))).filter(m=>m.nativeExportUrl&&!m.questionPagesIdenticalTo);
const clone=(v:any)=>JSON.parse(JSON.stringify(v)),opts={answer:'בדקו את הנקודה A בשרטוטים.',studentMessage:'אפשר רמז 1?',helpKind:'hint',hintIndex:0};
function fn(v:string,n:string){const s=v.slice(v.indexOf('function '+n+'('));return s.slice(0,s.indexOf('\nfunction ',1));}
function fixture(v:string,path='G8-TWOSRC/a',qid='q3',part='ג',hooks:any={}){
 const manifest=clone(manifests.find(m=>m.nativeExportUrl==='/noam-ai/native/'+path+'/noam-ai.json'));
 const exercise=manifest.exercises.find((e:any)=>e.nativeQuestionId===qid&&e.part===part);assert.ok(exercise);
 const {document,window}=parseHTML('<html><body></body></html>'),create=document.createElement.bind(document);
 document.createElement=((tag:string)=>{const e:any=create(tag);if(tag==='dialog'){e.showModal=()=>e.open=true;e.close=()=>e.dispatchEvent(new window.Event('close'));}return e;}) as any;
 const calls:string[]=[],crops:any[]=[],fallback:any[]=[],runtime={messages:new Map()},message:any={role:'assistant',text:opts.answer},thread:any={messages:[message],history:[]};
 const c:any={document,window,manifest,selectedExercise:exercise,pdf:manifest.pdfHash,Map,WeakSet,Promise,
 noamNativeFocusUrl:()=>manifest.nativeExportUrl,noamDiagramRuntime:()=>runtime,noamMessageVisualOptions:()=>opts,exerciseThread:()=>thread,
 renderCount:0,savedCount:0,renderNoamChat(){c.renderCount++;},saveNoamState(){c.savedCount++;},announceNoam(){},
 cropExerciseCanvas:async(e:any,o:any)=>{crops.push({exercise:clone(e),options:clone(o)});return {width:640,height:1200,toDataURL:()=> 'data:image/png;base64,QUJD'};},
 fetch:async(url:string)=>{calls.push(url);if(hooks.wait)await hooks.wait;if(hooks.fail===url)return {ok:false};const body=readFileSync(new URL(url.slice(1),root),'utf8');return {ok:true,json:async()=>JSON.parse(body),text:async()=>hooks.svg?hooks.svg(url,body):body};},
 requestNoamDiagram:async(...args:any[])=>{fallback.push(args);return 'protected-fallback';}};
 const helper='var noamSourceVisualPackages='+v.split('var noamSourceVisualPackages=')[1].split('function noamNativeFigure(')[0];
 runInNewContext(native+'\n'+panels+'\n'+fn(v,'noamDiagramSourceIdentity')+'\n'+helper+'\n'+['noamDiagramCurrent','noamDiagramRefresh','noamTypedVisualContext','noamAddDiagramExpansion','noamRenderAiDiagram'].map(n=>fn(v,n)).join('\n'),c);
 window.NoamNativeVisual=c.NoamNativeVisual;window.NoamSourcePanels=c.NoamSourcePanels;
 return {c,manifest,exercise,message,thread,calls,crops,fallback,runtime,document,window};
}
async function settled(){for(let i=0;i<70;i++)await Promise.resolve();}
for(const relative of ['../public/worksheet-viewer-noam.html','../../../worksheet-viewer-noam.html']){
 const v=readFileSync(new URL(relative,import.meta.url),'utf8'),prefix=relative.includes('public')?'public':'root';
 it(prefix+': actual TWOSRC hint shows one original aid, all panels and full PDF crops, with no bare-A focus',async()=>{
  const f=fixture(v),visual=await f.c.noamAttachSourceHint(f.exercise,f.thread,f.message,opts);
  assert.equal(visual.presentation,'source-context');assert.equal(visual.sourcePanelGroup,true);assert.deepEqual(clone(visual.panelIds),['q3_head','q3_head_2']);
  assert.equal(f.fallback.length,0);assert.equal(f.crops.length,1);assert.equal(f.exercise.crop.page,3);assert.equal(f.crops[0].exercise.crops[0].page,2);
  assert.deepEqual(f.crops[0].exercise.crops,f.exercise.crops);assert.equal(f.crops[0].options.exactSourceCrops,true);
  const figure=f.c.noamRenderSourceVisual(visual);assert.equal(figure.dataset.visualType,'source-panel-group');
  assert.equal(figure.querySelectorAll('svg image').length,2);assert.equal(figure.querySelectorAll('img.noam-source-panel-overview').length,1);assert.equal(figure.querySelectorAll('[data-role^="focus"],circle,path').length,0);
  assert.match(figure.textContent,/לא נוצר שרטוט חדש ולא נבחר לוח כתשובה/);assert.doesNotMatch(figure.textContent,/q3_head|דנה|איתי|ימין|שמאל/);
  assert.doesNotMatch(JSON.stringify(visual),/data:image|<svg/);
 });
 it(prefix+': actual transcript Beta click renders the complete source gallery without a protected request',async()=>{
  const f=fixture(v);f.message.diagramOptions=opts;
  f.c.noamSourceCropRequested=()=>false;f.c.noamStripMarkdownEmphasis=(text:string)=>text;
  f.c.postJson=()=>{throw new Error('Group overview must not request protected generation');};
  runInNewContext(['setNoamDiagramButtonLabel','noamVisualCanExpand','noamCanOfferDrawing','addTranscriptBubble','requestNoamDiagram'].map(n=>fn(v,n)).join('\n'),f.c);
  const host=f.document.createElement('div');f.document.body.appendChild(host);
  f.c.addTranscriptBubble(host,'assistant',f.message.text,'',f.message.visual,f.message,f.thread);
  const button=host.querySelector('button.noam-draw-action:not(.noam-diagram-expand)') as any;
  assert.match(button.textContent,/Beta/);button.click();await f.runtime.messages.get(f.message);
  assert.equal(f.message.visual.presentation,'source-context');assert.equal(f.message.visual.sourcePanelGroup,true);
  assert.equal(f.message.visual.options.drawCurrentStep,true);assert.equal(f.crops.length,1);
 });
 it(prefix+': a restored old first-panel visual stays hidden and the real enabled retry button repairs it to the full group',async()=>{
  const seed=fixture(v),old=clone(await seed.c.noamPrepareSourceVisual(seed.exercise,opts)),f=fixture(v);
  delete old.sourcePanelGroup;delete old.sourcePanelIdentity;delete old.panelIds;old.presentation='source-focus';f.message.visual=old;
  f.c.noamSourceCropRequested=()=>false;f.c.noamStripMarkdownEmphasis=(text:string)=>text;
  f.c.postJson=()=>{throw new Error('Saved group repair must not call generation');};
  runInNewContext(['setNoamDiagramButtonLabel','noamVisualCanExpand','noamCanOfferDrawing','addTranscriptBubble','requestNoamDiagram'].map(n=>fn(v,n)).join('\n'),f.c);
  assert.equal(f.c.noamRenderSourceVisual(old),null);assert.equal(f.c.noamCanOfferDrawing(f.exercise,f.thread,f.message),true);
  const host=f.document.createElement('div');f.document.body.appendChild(host);f.c.addTranscriptBubble(host,'assistant',f.message.text,'',old,f.message,f.thread);
  assert.equal(host.querySelectorAll('svg image').length,0);const button=host.querySelector('button.noam-draw-action') as any;assert.equal(button.disabled,false);button.click();await f.runtime.messages.get(f.message);
  assert.equal(f.message.visual.sourcePanelGroup,true);assert.equal(f.c.noamRenderSourceVisual(f.message.visual).querySelectorAll('svg image').length,2);assert.equal(f.runtime.messages.size,0);
 });
 it(prefix+': stage-sequence clicked aid and rehydration preserve all three panels and preceding-page crop',async()=>{
  const f=fixture(v,'G7-T22/a','q21','ד');f.message.diagramTyped=true;
  const result=await f.c.noamRequestSourceFirst(f.exercise,f.thread,f.message,{...opts,drawCurrentStep:true});
  assert.equal(result.presentation,'source-context');assert.match(f.message.text,/לוחות המקור.*לא נוצר שרטוט חדש/);assert.equal(f.exercise.crop.page,12);assert.equal(f.crops[0].exercise.crops[0].page,11);
  assert.equal(f.c.noamRenderSourceVisual(result).querySelectorAll('svg image').length,3);
  const stored=clone(result);stored.svgText='<script>bad()</script>';stored.panels=['answer'];
  const g=fixture(v,'G7-T22/a','q21','ד');assert.equal(g.c.noamRenderSourceVisual(stored),null);await settled();
  assert.equal(g.c.noamRenderSourceVisual(stored).querySelectorAll('svg image').length,3);
  stored.panelIds.pop();assert.equal(g.c.noamRenderSourceVisual(stored),null);stored.panelIds=clone(result.panelIds);g.manifest.nativeExportSha256='a'.repeat(64);assert.equal(g.c.noamRenderSourceVisual(stored),null);
 });
 it(prefix+': six singular remaps keep exact primary; comparison sibling gets both',async()=>{
  for(const [path,q,part] of [['G9-T13/a','q17','ב'],['G7-T24/a','q20','ג'],['G7-T24/a','q20','ד'],['G8-T29/c','q20','א'],['G8-T29/c','q20','ג'],['G8-T35/a','q7','ד']]){
   const f=fixture(v,path,q,part),visual=await f.c.noamPrepareSourceVisual(f.exercise,{studentMessage:'הראה את השרטוט המקורי'});
   assert.ok(visual);assert.equal(visual.sourcePanelGroup,undefined);assert.equal(f.crops.length,0);assert.ok(f.c.noamRenderSourceVisual(visual).querySelector('image').getAttribute('href').endsWith('_head_2.svg'));
  }
  const f=fixture(v,'G9-T13/a','q17','ג'),visual=await f.c.noamPrepareSourceVisual(f.exercise,opts);assert.equal(f.c.noamRenderSourceVisual(visual).querySelectorAll('svg image').length,2);
 });
 it(prefix+': missing/malformed secondary SVG or unchecked/out-of-bounds/incomplete crops never fall through to primary focus',async()=>{
  const fail='/noam-ai/native/G8-TWOSRC/a/figures/q3_head_2.svg';
  for(const mode of ['missing','malformed','module','module-and-package','unapproved','bounds','sibling','wrong-item','wrong-pdf']){
   const hooks=mode==='module-and-package'?{fail:'/noam-ai/native/G8-TWOSRC/a/noam-ai.json'}:mode==='missing'?{fail}:mode==='malformed'?{svg:(u:string,b:string)=>u===fail?'<svg viewBox="0 0 1 1"></svg>':b}:{};
   const f=fixture(v,undefined,undefined,undefined,hooks);
   if(mode==='module'||mode==='module-and-package')f.window.NoamSourcePanels=undefined;if(mode==='unapproved')f.manifest.pdfHash='0'.repeat(32);if(mode==='bounds')f.exercise.crops[0].w=2;if(mode==='sibling')f.exercise.crops=[f.exercise.crop];if(mode==='wrong-item')f.exercise.nativeItemId='q4a';if(mode==='wrong-pdf')f.manifest.sourceSha256='unverified';
   assert.equal(await f.c.noamAttachSourceHint(f.exercise,f.thread,f.message,opts),null,mode);assert.equal(f.message.visual,undefined,mode);assert.equal(f.c.noamTypedVisualContext(f.exercise,{}),null,mode);
   await f.c.noamRequestSourceFirst(f.exercise,f.thread,f.message,opts);assert.equal(f.fallback.length,0,mode);assert.equal(f.message.visual,undefined,mode);assert.equal(f.message.diagramErrorCode,'DIAGRAM_UNAVAILABLE',mode);assert.match(f.message.diagramError,/אפשר לנסות שוב/,mode);
  }
 });
 it(prefix+': saved v1 and v2 generic plans resolve only the complete current original group, including cold reload',async()=>{
  for(const version of [1,2]){
   const f=fixture(v,'G8-T17/a','q9','ב');
   f.window.NoamDiagramPlan={compile(){throw new Error('Old primary-only plan compiled');}};f.window.NoamGeometry={render(){throw new Error('Old geometry rendered');}};
   f.window.NoamVisualPlan={inspect(){throw new Error('Typed primary-only plan inspected');}};
   const data=JSON.parse(readFileSync(new URL('noam-ai/native/G8-T17/a/noam-ai.json',root),'utf8'));
   const visual:any={type:'ai-diagram',exerciseId:f.exercise.id,sourceIdentity:f.c.noamDiagramSourceIdentity(f.exercise),nativeSourceIdentity:f.c.noamSourceVisualIdentity(f.exercise),plan:{version,status:'ok',family:'function',evidence:[{source:'question',quote:data.questions.find((q:any)=>q.id==='q9').text}]},context:{hintText:'התבוננו בגרפים.',studentMessage:'הצג המחשה'}};
   assert.equal(f.c.noamRenderAiDiagram(visual),null);await settled();
   const figure=f.c.noamRenderAiDiagram(visual);assert.ok(figure);assert.equal(figure.dataset.visualType,'source-panel-group');assert.equal(figure.querySelectorAll('svg image').length,2);assert.equal(figure.querySelectorAll('[data-role="given-function"]').length,0);assert.equal(visual.presentation,'source-context');
   const bad=clone(visual);if(version===2)bad.nativeSourceIdentity='stale-package';else bad.sourceIdentity='wrong-pdf';assert.equal(f.c.noamRenderAiDiagram(bad),null);
  }
 });
 it(prefix+': failed saved generic group loads never compile a primary plan and can be retried without a model call',async()=>{
  const hooks:any={fail:'/noam-ai/native/G8-T17/a/figures/q9_head_2.svg'},f=fixture(v,'G8-T17/a','q9','ב',hooks);
  f.window.NoamDiagramPlan={compile(){throw new Error('Old primary-only compile');}};f.window.NoamGeometry={render(){throw new Error('Old geometry');}};
  const visual={type:'ai-diagram',exerciseId:f.exercise.id,sourceIdentity:f.c.noamDiagramSourceIdentity(f.exercise),plan:{version:1},context:{}};
  assert.equal(f.c.noamRenderAiDiagram(visual),null);await settled();assert.equal(f.c.noamRenderAiDiagram(visual),null);await settled();assert.equal(f.c.renderCount,0);
  f.message.visual=visual;await f.c.noamRequestSourceFirst(f.exercise,f.thread,f.message,opts);assert.equal(f.fallback.length,0);assert.equal(f.message.visual,undefined);assert.equal(f.message.diagramErrorCode,'DIAGRAM_UNAVAILABLE');assert.equal(f.runtime.messages.size,0);
  delete hooks.fail;const retried=await f.c.noamRequestSourceFirst(f.exercise,f.thread,f.message,opts);assert.equal(retried.sourcePanelGroup,true);assert.equal(retried.presentation,'source-context');assert.equal(f.message.diagramError,undefined);assert.equal(f.fallback.length,0);
 });
 it(prefix+': grouped model context keeps identities separate, preserves OCR, and requires all panels',async()=>{
  const f=fixture(v);assert.equal(f.c.noamTypedVisualContext(f.exercise,{}),null);const original={readable:true,diagram_description:'תיאור מודפס מאומת'};
  const analysis=await f.c.noamEnrichSourceAnalysis(f.exercise,original);assert.match(analysis.diagram_description,/כמה לוחות מקור נפרדים/);assert.match(analysis.diagram_description,/אין לאחד נקודות/);assert.match(analysis.diagram_description,/תיאור מודפס מאומת/);assert.equal(original.diagram_description,'תיאור מודפס מאומת');
  const context=f.c.noamTypedVisualContext(f.exercise,{});assert.equal(context.sourcePanels.length,2);assert.deepEqual(Object.keys(context.sourcePanels[0]),['id','kind','visibleNames']);
 });
 it(prefix+': worked-example/practice sources never present example point names as selected givens',async()=>{
  for(const [path,q,part] of [['G8-TWOSRC/a','q7','א'],['G8-TWOSRC/b','q2','א']]){
   const f=fixture(v,path,q,part),analysis=await f.c.noamEnrichSourceAnalysis(f.exercise,{diagram_description:'הכיתובים המקוריים'});
   assert.match(analysis.diagram_description,/אין לראות נתוני דוגמה כנתוני הסעיף/);
   const context=f.c.noamTypedVisualContext(f.exercise,{});assert.ok(context.sourcePanels.every((p:any)=>p.visibleNames.length===0));
   const visual=await f.c.noamPrepareSourceVisual(f.exercise,opts);assert.equal(visual.sourcePanelGroup,true);assert.equal(visual.presentation,'source-context');
  }
 });
 it(prefix+': late groups reject deleted messages/changed source; switching does not refresh another section',async()=>{
  for(const mode of ['delete','source','switch']){
   let release!:()=>void;const wait=new Promise<void>(r=>release=r),f=fixture(v,undefined,undefined,undefined,{wait});const pending=f.c.noamAttachSourceHint(f.exercise,f.thread,f.message,opts);
   if(mode==='delete')f.thread.messages.length=0;if(mode==='source')f.manifest.nativeExportSha256='b'.repeat(64);if(mode==='switch')f.c.selectedExercise={id:'elsewhere'};release();await pending;
   if(mode==='switch'){assert.ok(f.message.visual);assert.equal(f.c.renderCount,0);}else assert.equal(f.message.visual,undefined);
  }
 });
 it(prefix+': expansion clones full source gallery, with honest title and no additional fetch/model call',async()=>{
  const f=fixture(v),visual=await f.c.noamPrepareSourceVisual(f.exercise,opts),figure=f.c.noamRenderSourceVisual(visual),host=f.document.createElement('div');f.document.body.appendChild(host);f.c.noamAddDiagramExpansion(host,figure);host.appendChild(figure);
  const before=f.calls.length;host.querySelector('button')!.click();const dialog=f.document.querySelector('dialog')!;assert.equal(dialog.querySelector('h2')!.textContent,'לוחות המקור של השאלה');assert.equal(dialog.querySelectorAll('svg image').length,2);assert.equal(dialog.querySelectorAll('.noam-source-panel-overview').length,1);assert.equal(f.calls.length,before);assert.equal(f.fallback.length,0);
  if(prefix==='public'){const canvas=dialog.querySelector('.noam-diagram-canvas') as any;assert.equal(canvas.querySelectorAll('svg image').length,2);assert.ok(canvas.querySelector('.noam-source-panel-overview'));(dialog.querySelector('[aria-label="הגדלת השרטוט בזום"]') as any).click();assert.equal(canvas.style.width,'125%');const fit=Array.from(dialog.querySelectorAll('button')).find((b:any)=>b.textContent==='התאמה למסך') as any;fit.click();assert.equal(canvas.style.width,'100%');}
  (dialog.querySelector('.noam-diagram-dialog-close') as any).click();assert.equal(f.document.querySelector('dialog'),null);
 });
}
it('all 181 reviewed items in 52 questions have complete matching sibling crops within PDF bounds',async()=>{
 const v=readFileSync(new URL('../public/worksheet-viewer-noam.html',import.meta.url),'utf8'),api:any={};runInNewContext(native+'\n'+panels,api);let count=0;const questions=new Set<string>();
 for(const m of manifests)for(const ex of m.exercises){if(!api.NoamSourcePanels.isReviewed(ex))continue;const path=m.nativeExportUrl.split('/native/')[1].split('/noam-ai.json')[0],f=fixture(v,path,ex.nativeQuestionId,ex.part),visual=await f.c.noamPrepareSourceVisual(f.exercise,opts);assert.equal(visual?.sourcePanelGroup,true,ex.id);count++;questions.add(path+'/'+ex.nativeQuestionId);}
 assert.equal(count,181);assert.equal(questions.size,52);
});
