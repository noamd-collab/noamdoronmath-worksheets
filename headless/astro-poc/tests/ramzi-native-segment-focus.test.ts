import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { it } from 'node:test';
import { parseHTML } from 'linkedom';
const source=readFileSync(new URL('../public/worksheet-viewer-noam.html',import.meta.url),'utf8');
const helper='function noamNativeFigure'+source.split('function noamNativeFigure')[1].split('function noamSourceVertexAid')[0];
const request='function requestNoamDiagram'+source.split('function requestNoamDiagram')[1].split('function noamVisualAnswer')[0];
const data=JSON.parse(readFileSync(new URL('../public/noam-ai/native/G8-T39/a/noam-ai.json',import.meta.url),'utf8'));
const manifest=JSON.parse(readFileSync(new URL('../public/noam-ai/manifests/9448157f4ecb463489417696230f0e57.json',import.meta.url),'utf8'));
const exercise=manifest.exercises.find((e:any)=>e.q===2&&e.part==='ד');
const hint='האם הצלע \\(BC\\) נמצאת בין שתי הזוויות המסומנות במשולש \\(ABC\\), או מול אחת מהן?';
function fixture(payload:any=data,ex:any=exercise){
 const {document,window}=parseHTML('<html><body></body></html>');
 const calls:string[]=[];const runtime={messages:new Map(),jobs:new Map(),cache:new Map()};
 const context:any={document,window,manifest,selectedExercise:ex,exerciseLabel:()=> 'שאלה 2 · סעיף ד',
  noamDiagramSourceIdentity:(e:any)=>e.id+':'+(e.version||''),renderNoamChat:()=>{},
  fetch:async(url:string)=>{calls.push(url);return{ok:true,json:async()=>payload};},
  noamDiagramRuntime:()=>runtime,noamConstructedVisual:()=>null,saveNoamState:()=>{},noamDiagramRefresh:()=>{},
  noamDiagramError:(e:any)=>e.message,Map,WeakSet,Promise};
 runInNewContext(helper+'\n'+request,context);
 return {document,context,calls,make:(answer=hint)=>context.noamPrepareNativeFocus(ex,{answer,helpKind:"hint",studentMessage:"אפשר רמז 1?"})};
}
it('actual Q2d draws only BC on the approved source, without model/auth calls or an EF answer',async()=>{
 const f=fixture();const visual=await f.make();assert.equal(visual.type,'native-source-focus');
 const fig=f.context.noamRenderNativeFocus(visual);assert.ok(fig);
 assert.equal(fig.querySelector('image').getAttribute('href'),exercise.nativeFigureUrl);
 const lines=fig.querySelectorAll('line');assert.equal(lines.length,1);
 assert.equal(lines[0].getAttribute('x1'),'123.09');assert.equal(lines[0].getAttribute('x2'),'38.03');
 assert.equal(fig.querySelectorAll('text,path,circle').length,0);
 assert.match(fig.querySelector('figcaption').textContent,/עזר מהדף/);
 assert.doesNotMatch(fig.textContent,/EF|11|שוות/);
 assert.deepEqual(f.calls,['/noam-ai/native/G8-T39/a/noam-ai.json']);
});
it('the real request handler completes a retry locally without entering protected generation',async()=>{
 const f=fixture();f.context.window.NoamDiagramPlan=undefined;
 const message:any={role:'assistant',text:hint,diagramError:'לא ניתן להשלים את הבקשה כרגע.',diagramErrorCode:'DIAGRAM_UNAVAILABLE'};
 const thread={messages:[message],history:[]};
 const visual=await f.context.requestNoamDiagram(exercise,thread,message,{answer:hint,helpKind:'hint',studentMessage:'אפשר רמז 1?'});
 assert.equal(visual.type,'native-source-focus');assert.equal(message.text,hint);
 assert.equal(message.diagramError,undefined);assert.equal(thread.history.length,0);
 assert.equal(f.calls.length,1,'only a public static package, not Google or any AI endpoint');
});
it('no named segment, unknown segment, and requested construction keep the protected fallback',async()=>{
 for(const answer of ['התבוננו בקודקודים','בדקו את XY','משולש ABC','הוסיפו גובה אל BC','הארך את BC','הארכה של BC']){
  const f=fixture();assert.equal(await f.make(answer),null);
 }
 const f=fixture();assert.equal(await f.context.noamPrepareNativeFocus(exercise,{answer:hint,studentMessage:'הוסף גובה'}),null);
 const message:any={role:'assistant',text:'בדקו את XY'};
 await f.context.requestNoamDiagram(exercise,{messages:[message]},message,{answer:message.text});
 assert.equal(message.visual,undefined);assert.equal(message.diagramError,'diagram compiler unavailable');
});
it('exact figure, subsection, coordinates and source identity are required',async()=>{
 for(const delta of [{nativeQuestionId:'q1'},{part:'לא קיים'},{nativeFigureUrl:'/noam-ai/native/G8-T39/a/figures/q1_head.svg'},
  {nativeFigureUrl:'https://other.example/q2.svg'},{nativeFigureUrl:'/noam-ai/native/G8-T39/a/../q2.svg'}]){
  assert.equal(await fixture(data,{...exercise,...delta}).make(),null);
 }
 for(const mutate of [(f:any)=>f.svg='elsewhere/q2_head.svg',(f:any)=>f.question='q1',
  (f:any)=>f.objects.points[0].svg_xy=[Infinity,0],(f:any)=>f.objects.segments.find((s:any)=>s.name==='BC').svg_xy=[[0,0],[1,1]]]){
  const copy=structuredClone(data);mutate(copy.figures.find((f:any)=>f.id==='q2_head'));
  assert.equal(await fixture(copy).make(),null);
 }
 const f=fixture();const visual=await f.make();visual.sourceIdentity='changed';assert.equal(f.context.noamRenderNativeFocus(visual),null);
});
it('saved focus rehydrates from static data; stored coordinates and URLs are ignored',async()=>{
 const first=fixture();const visual=await first.make();visual.url='https://other.example';visual.lines=[[[0,0],[100,100]]];
 const next=fixture();assert.equal(next.context.noamRenderNativeFocus(visual),null);
 await new Promise(r=>setImmediate(r));const fig=next.context.noamRenderNativeFocus(visual);
 assert.equal(fig.querySelector('image').getAttribute('href'),exercise.nativeFigureUrl);
 assert.equal(fig.querySelector('line').getAttribute('x1'),'123.09');assert.equal(next.calls.length,1);
});
it('a late local illustration stays attached to its original message after a section switch',async()=>{
 const f=fixture();const message:any={role:'assistant',text:hint};const thread={messages:[message]};
 const pending=f.context.requestNoamDiagram(exercise,thread,message,{answer:hint,helpKind:"hint",studentMessage:"אפשר רמז 1?"});
 f.context.selectedExercise={...exercise,id:'another-part'};
 const result=await pending;assert.equal(result.exerciseId,exercise.id);assert.equal(message.visual.exerciseId,exercise.id);
});

it('free drawing requests cannot inherit an old hint and a typed draw retains the protected route',async()=>{
 for(const studentMessage of ['הדגש את EF','הארך את BC','סמן את הזווית ABC']){
  for(const helpKind of ['free_question','hint']){
   const f=fixture();assert.equal(await f.context.noamPrepareNativeFocus(exercise,{answer:hint,studentMessage,helpKind}),null);assert.equal(f.calls.length,0);
  }
 }
 const f=fixture();const message:any={role:'assistant',text:hint,diagramTyped:true};
 await f.context.requestNoamDiagram(exercise,{messages:[message]},message,{answer:hint,helpKind:'hint',studentMessage:'אפשר רמז 1?'});
 assert.equal(message.visual,undefined);assert.equal(message.diagramError,'diagram compiler unavailable');assert.equal(f.calls.length,0);
});
