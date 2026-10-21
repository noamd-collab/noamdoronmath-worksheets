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
 const context:any={document,window,manifest:ex===exercise?manifest:{exercises:[ex]},selectedExercise:ex,exerciseLabel:()=> 'השאלה הנבחרת',
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

const lengthData=JSON.parse(readFileSync(new URL('../public/noam-ai/native/G8-T49/a/noam-ai.json',import.meta.url),'utf8'));
const lengthManifest=JSON.parse(readFileSync(new URL('../public/noam-ai/manifests/26fd1a0a92204cfb95855ff28bf0dfeb.json',import.meta.url),'utf8'));
const lengthHint='האם הצלע שצריכה להיות לבדה היא תמיד הארוכה ביותר או הקצרה ביותר?';
const lengthExercise=lengthManifest.exercises.find((e:any)=>e.q===13&&e.part==='א');

it('side-length comparison preserves the approved triangle, all three values and no inferred right angle',async()=>{
 const otherData=JSON.parse(readFileSync(new URL('../public/noam-ai/native/G7-T42/b/noam-ai.json',import.meta.url),'utf8'));
 const otherManifest=JSON.parse(readFileSync(new URL('../public/noam-ai/manifests/8a0161d5a04443e888011f4ba13062f8.json',import.meta.url),'utf8'));
 for(const sample of [{data:lengthData,ex:lengthExercise,values:[12,35,37]},
  {data:otherData,ex:otherManifest.exercises.find((e:any)=>e.q===14&&e.part==='א'),values:[15,20,25]}]){
  const ex=sample.ex,f=fixture(sample.data,ex),message:any={role:'assistant',text:lengthHint};
  f.context.window.NoamDiagramPlan=undefined;
  const visual=await f.context.requestNoamDiagram(ex,{messages:[message],history:[]},message,
   {answer:lengthHint,helpKind:'hint',studentMessage:'אפשר רמז 1?'});
  assert.equal(visual.type,'native-source-focus');
  const fig=f.context.noamRenderNativeFocus(visual),svg=fig.querySelector('svg');
  assert.equal(fig.querySelector('image').getAttribute('href'),ex.nativeFigureUrl);
  const lines=Array.from(fig.querySelectorAll('line')) as any[];
  assert.equal(lines.length,3);assert.equal(new Set(lines.map(l=>l.getAttribute('stroke'))).size,1);
  assert.equal(svg.querySelectorAll('text,path,circle,rect').length,0,'no computed label or angle mark is added');
  assert.match(fig.querySelector('figcaption').textContent,/השרטוט המקורי עם שלושת אורכי הצלעות הנתונים/);
  assert.match(svg.getAttribute('aria-label'),/שלושת אורכי הצלעות הנתונים/);
  assert.doesNotMatch(fig.textContent,/הארוכה|זווית ישרה|שהוזכרו ברמז/);
  const original=readFileSync(new URL('../public'+ex.nativeFigureUrl,import.meta.url),'utf8');
  for(const value of sample.values)assert.match(original,new RegExp('>'+value+'</text>'));
  const sourceFigure=sample.data.figures.find((a:any)=>a.id===ex.nativeFigureId);
  for(const line of lines){
   const a=[Number(line.getAttribute('x1')),Number(line.getAttribute('y1'))],b=[Number(line.getAttribute('x2')),Number(line.getAttribute('y2'))];
   assert.ok(sourceFigure.objects.segments.some((s:any)=>JSON.stringify(s.svg_xy)===JSON.stringify([a,b])||JSON.stringify(s.svg_xy)===JSON.stringify([b,a])));
  }
  assert.deepEqual(f.calls,[ex.nativeFigureUrl.replace(/figures\/[^/]+$/,'noam-ai.json')],'no protected AI request for an original-source aid');
 }
});

it('the length comparison uses metadata rather than exercise IDs or ABC point names',()=>{
 const copy=structuredClone(lengthData),question=copy.questions.find((q:any)=>q.id==='q13');
 const figure=copy.figures.find((f:any)=>f.id==='q13_head'),rename=(s:string)=>s.replace(/[ABC]/g,c=>({A:'R',B:'S',C:'T'}[c]!));
 question.id='q21';question.figure_id='q21_source';question.items[0].id='q21a';question.items[0].figure_id='q21_source';
 figure.id='q21_source';figure.question='q21';figure.svg='figures/q21_source.svg';
 for(const object of [...figure.objects.points,...figure.objects.segments,...figure.objects.labels]){
  if(object.name)object.name=rename(object.name);if(object.for)object.for=rename(object.for);
  if(object.role==='value')object.text=String(Number(object.text)/2);
 }
 const ex={...lengthExercise,id:'unseen-package-question',nativeQuestionId:'q21',nativeFigureId:'q21_source',nativeFigureUrl:lengthExercise.nativeFigureUrl.replace('q13_head','q21_source')};
 const f=fixture(copy,ex),focus=f.context.noamNativeSegmentFocus(copy,ex,lengthHint);
 assert.equal(focus.lengthComparison,true);assert.deepEqual(Array.from(focus.lines,(l:any)=>l.name).sort(),['RS','RT','ST']);
});

it('changed or later parts never reuse the original length-comparison drawing',async()=>{
 for(const mutate of [
  (q:any)=>q.items.unshift({id:'earlier',label:'לפני',figure_id:q.figure_id}),
  (q:any)=>q.items[0].given=[{text:'אורך אחר'}],
  (q:any)=>q.items[0].to_construct=[{text:'שרטטו משולש חדש'}],
  (q:any)=>q.to_construct=[{text:'בנו משולש חדש'}],
  (q:any)=>q.items[0].text='אם אחת הצלעות היא באורך 13, השוו את אורכי הצלעות.',
  (q:any)=>q.items[0].text='החליפו את המוט הקצר ובדקו את המצב החדש.',
  (q:any)=>q.items[0].text='הכפילו את אורך המוט הקצר. השוו בין אורכי הצלעות.',
  (q:any)=>q.text='לאחר שינוי האורך, השוו את אורכי הצלעות.'
 ]){
  const copy=structuredClone(lengthData);mutate(copy.questions.find((q:any)=>q.id==='q13'));
  assert.equal(await fixture(copy,lengthExercise).make(lengthHint),null);
 }
 for(const part of ['ב','ג','ד']){
  const ex=lengthManifest.exercises.find((e:any)=>e.q===13&&e.part===part);
  assert.equal(await fixture(lengthData,ex).make(lengthHint),null);
 }
});

it('ambiguous or incomplete length data cannot authorize the comparison aid',async()=>{
 for(const mutate of [
  (f:any)=>f.objects.labels=f.objects.labels.filter((l:any)=>l.for!=='AC'),
  (f:any)=>f.objects.labels.push({...f.objects.labels.find((l:any)=>l.role==='value')}),
  (f:any)=>f.objects.labels.find((l:any)=>l.for==='AC').text='0',
  (f:any)=>f.objects.labels.find((l:any)=>l.for==='AC').text='x',
  (f:any)=>f.objects.points.find((p:any)=>p.name==='C').svg_xy[0]-=40,
  (f:any)=>f.objects.segments.push({...f.objects.segments[0]}),
  (f:any)=>f.objects.points.push({kind:'point',name:'D',svg_xy:[80,80]})
 ]){
  const copy=structuredClone(lengthData);mutate(copy.figures.find((f:any)=>f.id==='q13_head'));
  assert.equal(await fixture(copy,lengthExercise).make(lengthHint),null);
 }
});

it('saved unlabelled outlines restore the original values without another model call or rewriting the conversation',async()=>{
 const f=fixture(lengthData,lengthExercise),compiled:any[]=[];
 const renderer='function noamRenderAiDiagram'+source.split('function noamRenderAiDiagram')[1].split('function noamDiagramError')[0];
 f.context.window.NoamDiagramPlan={compile:(...args:any[])=>{compiled.push(args);return{};}};
 f.context.window.NoamGeometry={render:()=>f.document.createElement('figure')};
 let refreshes=0;f.context.renderNoamChat=()=>refreshes++;
 runInNewContext(renderer,f.context);
 const visual={type:'ai-diagram',exerciseId:lengthExercise.id,sourceIdentity:f.context.noamDiagramSourceIdentity(lengthExercise),
  plan:{version:1,status:'ok',points:{A:[2,2],B:[0,0],C:[6,0]}},
  context:{hintText:lengthHint,studentMessage:'אפשר רמז 1?',sourceGivens:[]}};
 const unchanged=JSON.stringify(visual);
 assert.equal(f.context.noamRenderAiDiagram(visual),null,'wait for trusted static metadata');
 await new Promise(r=>setImmediate(r));
 const figure=f.context.noamRenderAiDiagram(visual);
 assert.equal(figure.querySelector('image').getAttribute('href'),lengthExercise.nativeFigureUrl);
 assert.equal(figure.querySelectorAll('line').length,3);assert.equal(compiled.length,0);
 assert.equal(JSON.stringify(visual),unchanged);assert.equal(refreshes,1);assert.equal(f.calls.length,1);
 visual.context.studentMessage='שרטט לי משהו אחר';
 f.context.noamRenderAiDiagram(visual);assert.equal(compiled.length,1,'free-form drawing keeps its own scope');
});

it('a late saved length-aid lookup does not redraw another selected question',async()=>{
 const f=fixture(lengthData,lengthExercise);
 f.context.window.NoamDiagramPlan={};f.context.window.NoamGeometry={};
 let refreshes=0;f.context.renderNoamChat=()=>refreshes++;
 const renderer='function noamRenderAiDiagram'+source.split('function noamRenderAiDiagram')[1].split('function noamDiagramError')[0];
 runInNewContext(renderer,f.context);
 const visual={exerciseId:lengthExercise.id,sourceIdentity:f.context.noamDiagramSourceIdentity(lengthExercise),
  context:{hintText:lengthHint,studentMessage:'אפשר רמז 1?',sourceGivens:[]}};
 f.context.noamRenderAiDiagram(visual);f.context.selectedExercise={id:'different-part'};
 await new Promise(r=>setImmediate(r));assert.equal(refreshes,0);
});

it('two saved diagrams sharing a pending package refresh only the currently selected one',async()=>{
 const f=fixture(lengthData,lengthExercise),other={...lengthExercise,id:'same-package-other-part',part:'ב'};
 f.context.manifest.exercises.push(other);f.context.window.NoamDiagramPlan={};f.context.window.NoamGeometry={};
 let resolve:any,fetches=0,refreshes=0;
 f.context.fetch=()=>{fetches++;return new Promise(r=>resolve=r);};f.context.renderNoamChat=()=>refreshes++;
 const renderer='function noamRenderAiDiagram'+source.split('function noamRenderAiDiagram')[1].split('function noamDiagramError')[0];
 runInNewContext(renderer,f.context);
 function saved(ex:any){return{exerciseId:ex.id,sourceIdentity:f.context.noamDiagramSourceIdentity(ex),
  context:{hintText:lengthHint,studentMessage:'אפשר רמז 1?',sourceGivens:[]}};}
 f.context.noamRenderAiDiagram(saved(lengthExercise));f.context.selectedExercise=other;
 const second=saved(other);f.context.noamRenderAiDiagram(second);f.context.noamRenderAiDiagram(second);
 resolve({ok:true,json:async()=>lengthData});await new Promise(r=>setImmediate(r));
 assert.equal(fetches,1);assert.equal(refreshes,1,'the current visual subscribes to an already pending lookup exactly once');
});
