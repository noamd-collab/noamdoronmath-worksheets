import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { it } from 'node:test';
import { parseHTML } from 'linkedom';

const app=new URL('../',import.meta.url);
const read=(p:string)=>readFileSync(new URL(p,app),'utf8');
const manifests=['fc62c3516b5c4f4c8e3f433792c84c40','993467c2757a4950abd2a0237f18a48c','1626318ee2c94f6a9b53ffcaf289ec83',
 'e4da722565a942e482c9e4dbf6ee41b5','0b79f523d8ea4598a85d5320d6acd823','b74fba1acf804f27be8dc4f785d1a002',
 '5be1af0651d142648da6c08d0ff028f4','5dbd91577b8f4ac1a94947583a6e5140','e411b71b6b02446ea943eef41430f56a',
 '7cf739195a244b8aad4a77a4a35230b8','425c4cfaa0834530abde0f5aa8347128','3f9546987fea4b9aa4294249ea017278',
 '3329215ba8e24999b3522228011baae2','9764420460f84628acbffb2ea2ee53a5'];
const actual=JSON.parse(read('public/noam-ai/manifests/'+manifests[11]+'.json'));
const extract=(s:string,start:string,end:string)=>start+s.split(start)[1].split(end)[0];
const drain=()=>new Promise(r=>setImmediate(r));

for(const file of ['public/worksheet-viewer-noam.html','../../worksheet-viewer-noam.html']){
 const source=read(file);
 const helpers=extract(source,'var noamSourceCropCache=new Map();','// Resolve every illustration');
 const crops=extract(source,'function cropExerciseCanvasFromPdf','function cropExerciseCanvasFromView');
 const identity=extract(source,'function noamDiagramSourceIdentity','function noamDiagramAnalysis');
 const nativeIdentity=['noamNativeDataUrl','noamSourceVisualIdentity'].map(name=>{
  const text=source.slice(source.indexOf('function '+name+'('));return text.slice(0,text.indexOf('\nfunction ',1));
 }).join('\n');
 const request=extract(source,'function requestNoamDiagram','function noamVisualAnswer');
 const typed=extract(source,'function tryNoamLocalVisual','function insertNoamMath');
 const offer=extract(source,'function noamCanOfferDrawing','function noamManualVisual');
 const zoom=extract(source,'function noamAddDiagramExpansion','function noamDiagramRuntime');
 const label=extract(source,'function setNoamDiagramButtonLabel','function addTranscriptBubble');
 function fixture(m:any=structuredClone(actual)){
  const {document,window}=parseHTML('<html><body><div id="bubble"><button class="noam-draw-action">retry</button><span class="noam-draw-error">unsupported</span></div></body></html>');
  const create=document.createElement.bind(document);
  document.createElement=(name:string)=>{const el=create(name);if(name==='dialog'){el.showModal=()=>el.setAttribute('open','');el.close=()=>el.dispatchEvent(new window.Event('close'));}return el;};
  const calls:any[]=[],runtime={messages:new Map(),jobs:new Map(),cache:new Map()};
  const ex=m.exercises[0],message:any={role:'assistant',text:'בדקו את נתוני השאלה.',diagramError:'unsupported',diagramErrorCode:'DIAGRAM_UNSUPPORTED'};
  const thread={messages:[message],history:[]};
  const context:any={document,window,manifest:m,selectedExercise:ex,pdf:m.pdfHash,pdfDocument:{},
   exerciseLabel:()=>ex.id,renderNoamChat:()=>calls.push('render'),saveNoamState:()=>{},noamDiagramRefresh:()=>{},
   ensurePdfDocumentForCrop:async()=>{},cropExerciseSegment:async(c:any)=>{calls.push(structuredClone(c));return c;},
   stitchCropSegments:(segments:any[])=>{calls.push({stitched:segments.length});return{width:900,height:420,toDataURL:(type:string)=>{assert.equal(type,'image/png');return 'data:image/png;base64,YQ==';}};},
   noamManifestOcrUnreliable:()=>true,noamRebuildSelectedPartExpression:()=>{throw new Error('source crops must not be rebuilt');},
   noamDiagramRuntime:()=>runtime,noamSourceVisualOptions:(o:any)=>({...o}),noamMessageVisualOptions:()=>message.diagramOptions||{},
   noamConstructedVisual:()=>null,noamPrepareNativeFocus:async()=>null,noamSourceGivens:async()=>null,
   noamDiagramSourceInput:async()=>{calls.push('generation');throw new Error('protected route reached');},
   noamDiagramError:()=> 'unavailable',fetch:()=>{throw new Error('source crops must not fetch a generated image');}};
  runInNewContext(helpers+'\n'+identity+'\n'+nativeIdentity+'\n'+crops+'\n'+zoom+'\n'+label+'\n'+offer+'\n'+request,context);
  return {document,window,context,calls,ex,message,thread,runtime,container:document.getElementById('bubble')!};
 }
 it(file+': G9-T41 q1a displays every reviewed crop, preserving unsupported state and generation retry',async()=>{
  const f=fixture(),before=JSON.stringify(f.message);
  f.context.noamAppendSourceCropHelp(f.container,f.ex,f.message);await drain();
  assert.deepEqual(f.calls.filter(c=>c.page),f.ex.crops);
  assert.deepEqual(f.calls.find(c=>c.stitched),{stitched:3});
  assert.equal(f.document.querySelector('details')!.open,true);
  assert.equal(f.document.querySelector('figure')!.getAttribute('data-visual-type'),'source-crop');
  assert.match(f.document.querySelector('figcaption')!.textContent!,/השאלה המקורית.*ללא שרטוט/);
  assert.equal(f.document.querySelector('.noam-draw-error')!.textContent,'unsupported');
  f.document.querySelector('figure img')!.dispatchEvent(new f.window.Event('load'));
  assert.match(f.document.querySelector('.noam-draw-error')!.textContent!,/לא נוצר שרטוט חדש/);
  assert.match(f.document.querySelector('.noam-draw-action')!.textContent!,/המחשה נוספת/);
  assert.equal(JSON.stringify(f.message),before);
  f.document.querySelector('.noam-diagram-expand')!.click();
  assert.equal(f.document.querySelector('dialog h2')!.textContent,'השאלה המקורית מהדף');
  assert.ok(f.document.querySelector('dialog img'));
  if(file.startsWith('public/'))assert.ok(f.document.querySelector('dialog .noam-diagram-zoom'));
  assert.equal(f.calls.filter(c=>c.page).length,3,'zoom reuses the stitched source');
 });
 it(file+': a single source crop bypasses OCR expression recropping',async()=>{
  const f=fixture();f.ex.crops=[f.ex.crops[2]];f.ex.crop=f.ex.crops[0];
  assert.ok(await f.context.noamLoadSourceCrop(f.ex));
  assert.deepEqual(f.calls.filter(c=>c.page),f.ex.crops);
 });
 it(file+': all 698 exercises across the remaining 14 reviewed sheets have usable exact original crops',()=>{
  let count=0,multiple=0;
  for(const id of manifests){
   const m=JSON.parse(read('public/noam-ai/manifests/'+id+'.json')),f=fixture(m);
   for(const ex of m.exercises){assert.equal(f.context.noamSourceCropExercise(ex),ex,id+':'+ex.id);count++;if(ex.crops.length>1)multiple++;}
  }
  assert.equal(count,698);assert.equal(multiple,458);
 });
 it(file+': source fallback is unavailable for network/security errors, answer failures and stale or unchecked crops',async()=>{
  for(const patch of [{diagramErrorCode:'DIAGRAM_UNAVAILABLE'},{diagramErrorCode:'SECURITY'},{diagramErrorCode:undefined},{answerError:true},{role:'user'}]){
   const f=fixture();Object.assign(f.message,patch);f.context.noamAppendSourceCropHelp(f.container,f.ex,f.message);await drain();assert.equal(f.document.querySelector('details'),null);assert.equal(f.calls.length,0);
  }
  for(const mutate of [(f:any)=>f.context.manifest.reviewRequired=true,(f:any)=>f.ex.crops[0].x=-1,(f:any)=>f.ex.crops[0].page=8,
   (f:any)=>f.ex.nativeQuestionId='q1',(f:any)=>f.context.manifest.sourceSha256='missing']){
   const f=fixture();mutate(f);assert.equal(f.context.noamSourceCropExercise(f.ex),null);
  }
  const f=fixture();assert.equal(f.context.noamSourceCropExercise({...f.ex,crops:[f.ex.crop]}),null,'a supplied partial crop cannot replace the approved collection');
 });
 it(file+': late crops cannot attach to another part, a revised source or a removed message bubble',async()=>{
  for(const mutate of [(f:any)=>f.context.selectedExercise={...f.ex,id:'other'},(f:any)=>f.context.manifest.sourceSha256='b'.repeat(64),(f:any)=>f.container.remove()]){
   const f=fixture();f.context.noamAppendSourceCropHelp(f.container,f.ex,f.message);mutate(f);await drain();assert.equal(f.document.querySelector('details'),null);
  }
 });
 it(file+': explicit original requests bypass generation, stored source intent rehydrates and retry can request a new drawing',async()=>{
  const f=fixture(),options={studentMessage:'תראה את השרטוט המקורי מהדף',helpKind:'free_question'};
  f.message.diagramTyped=true;
  const visual=await f.context.requestNoamDiagram(f.ex,f.thread,f.message,options);
  assert.equal(visual.type,'source-crop');assert.equal(visual.dataUrl,undefined);assert.match(f.message.text,/לא נוצר שרטוט חדש/);
  assert.equal(f.calls.includes('generation'),false);assert.equal(f.runtime.messages.size,0);
  assert.equal(f.context.noamCanOfferDrawing(f.ex,f.thread,f.message),true);
  f.context.window.NoamDiagramPlan={};await f.context.requestNoamDiagram(f.ex,f.thread,f.message,options);
  assert.ok(f.calls.includes('generation'),'source viewing does not disable an attempt to create a new drawing');
  const reload=fixture();
  assert.equal(reload.context.noamRenderSourceCrop({...visual,dataUrl:'https://evil.test/image.png'}),null);await drain();
  const figure=reload.context.noamRenderSourceCrop(visual);assert.equal(figure.querySelector('img').src,'data:image/png;base64,YQ==');
  reload.context.manifest.sourceSha256='b'.repeat(64);assert.equal(reload.context.noamRenderSourceCrop(visual),null);
 });
 it(file+': the real typed Send handler recognizes an original question request without a diagram engine',async()=>{
  const f=fixture();Object.assign(f.context,{busy:false,noamDrafts:{},exerciseThread:()=>f.thread});
  runInNewContext(typed,f.context);
  assert.equal(f.context.tryNoamLocalVisual('אפשר לראות את השאלה המקורית'),true);
  const reply=f.thread.messages.at(-1)!;
  assert.equal(reply.text,'טוען את השאלה המקורית מהדף…');
  await Promise.all(f.runtime.messages.values());
  assert.equal(reply.visual.type,'source-crop');assert.equal(reply.diagramTyped,undefined);
  assert.equal(f.calls.includes('generation'),false);
  assert.equal(f.thread.messages.at(-2)!.text,'אפשר לראות את השאלה המקורית');
 });
 it(file+': requesting a new or highlighted drawing never reports the original crop as a successful construction',()=>{
  const f=fixture();
  for(const text of ['תשרטט לי משולש','אפשר רמז?','תראה את השרטוט המקורי ותוסיף גובה','הצג את המקור עם הדגשה','תראה את השרטוט החדש'])
   assert.equal(f.context.noamSourceCropRequested(f.ex,{studentMessage:text}),false,text);
  for(const text of ['הצג את השאלה המקורית','תראה את השרטוט מהדף','show the original diagram'])
   assert.equal(f.context.noamSourceCropRequested(f.ex,{studentMessage:text}),true,text);
 });
 it(file+': loading failures show no source success and deleted typed messages cannot receive a result',async()=>{
  const f=fixture();f.context.cropExerciseCanvas=async()=>{throw new Error('PDF unavailable');};
  f.context.noamAppendSourceCropHelp(f.container,f.ex,f.message);await drain();assert.equal(f.document.querySelector('details'),null);
  const result=await f.context.requestNoamDiagram(f.ex,f.thread,f.message,{studentMessage:'הצג את המקור'});
  assert.equal(result,null);assert.equal(f.message.diagramErrorCode,'DIAGRAM_UNAVAILABLE');assert.equal(f.message.visual,undefined);
  const g=fixture(),pending=g.context.requestNoamDiagram(g.ex,g.thread,g.message,{studentMessage:'הצג את המקור'});
  g.thread.messages=[];assert.equal(await pending,null);assert.equal(g.message.visual,undefined);assert.equal(g.runtime.messages.size,0);
 });
 it(file+': source image failure removes the aid and restores original failure feedback',async()=>{
  const f=fixture();f.context.noamAppendSourceCropHelp(f.container,f.ex,f.message);await drain();
  const image=f.document.querySelector('figure img')!;image.dispatchEvent(new f.window.Event('load'));image.dispatchEvent(new f.window.Event('error'));
  assert.equal(f.document.querySelector('details'),null);assert.equal(f.document.querySelector('.noam-draw-error')!.textContent,'unsupported');
 });
}
