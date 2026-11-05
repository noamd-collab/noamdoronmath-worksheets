import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { it } from 'node:test';
import { parseHTML } from 'linkedom';
const source=readFileSync(new URL('../public/worksheet-viewer-noam.html',import.meta.url),'utf8');
const helper='function noamNativeFigure'+source.split('function noamNativeFigure')[1].split('function showExercisePreview')[0];
const zoom='function noamAddDiagramExpansion'+source.split('function noamAddDiagramExpansion')[1].split('function noamDiagramRuntime')[0];
const label='function setNoamDiagramButtonLabel'+source.split('function setNoamDiagramButtonLabel')[1].split('function addTranscriptBubble')[0];
const data=JSON.parse(readFileSync(new URL('../public/noam-ai/native/G8-T39/a/noam-ai.json',import.meta.url),'utf8'));
const manifest=JSON.parse(readFileSync(new URL('../public/noam-ai/manifests/9448157f4ecb463489417696230f0e57.json',import.meta.url),'utf8'));
const exercise=manifest.exercises.find((e:any)=>e.q===1&&e.part==='ג');
const legacy='עדיין לא הצלחתי להכין המחשה מדויקת לשלב הזה. אפשר לכתוב אילו קטעים או זוויות להדגיש.';
const message={diagramErrorCode:'DIAGRAM_UNSUPPORTED',role:'assistant',text:'האם שוויון הזוויות נובע מהצלעות השוות או מהצלע המשותפת?',diagramError:legacy};
const topicHelpers=source.slice(source.indexOf('var NOAM_DRAWING_HINT_GEOMETRY='),source.indexOf('function noamConstructedVisual('));
const bubbleHelpers=source.slice(source.indexOf('function setNoamDiagramButtonLabel('),source.indexOf('function ensureNoamGlossaryPopover('));
function fixture(payload:any=data, ex:any=exercise, msg:any=message, prepare?:Function, start=true){
 const {document,window}=parseHTML('<html><body><div id="host"><div id="bubble"><button class="noam-draw-action">השרטוט לא הופיע — נסו שוב</button><span class="noam-draw-error"></span></div></div></body></html>');
 const answer:any=structuredClone(msg), selected:any=structuredClone(ex);
 const thread={messages:[answer],history:[]};
 const calls:any[]=[], runtime={messages:new Map(),jobs:new Map(),cache:new Map()};
 const context:any={document,window:{NoamLocalVisual:{wantsVisualSupport:()=>true}},exercise:selected,message:answer,selectedExercise:selected,thread,
  manifest:{...manifest,prefix:'G8-T39',exercises:[selected]},exerciseLabel:()=> 'שאלה 1 · סעיף ג',
  noamDiagramSourceIdentity:(e:any)=>e.id+':'+(e.version||''),
  noamSourceVisualIdentity:(e:any)=>JSON.stringify([e.id,e.version||'',e.nativeFigureUrl||'']),
  noamDiagramRuntime:()=>runtime, activeThread:thread,
  noamDiagramCurrent:(e:any,t:any)=>context.selectedExercise.id===e.id&&context.activeThread===t,
  noamPrepareSourceVisual:async(e:any,options:any)=>{calls.push(options);return prepare?prepare(e,options):{type:'native-source-visual',exerciseId:e.id,sourceIdentity:context.noamSourceVisualIdentity(e),presentation:'source-context'};},
  noamRenderSourceVisual:(visual:any)=>{
   if(visual.sourceIdentity!==context.noamSourceVisualIdentity(selected)||visual.invalid)return null;
   const figure=document.createElement('figure');figure.className='noam-geometry';return figure;
  },
  noamStripMarkdownEmphasis:(value:string)=>value,noamAddDiagramExpansion(){},noamAppendSourceCropHelp(){},
  saveNoamState(){calls.push('saved');},
  noamDiagramRefresh(){
   const host=document.getElementById('host')!;host.innerHTML='';
   thread.messages.forEach((m:any)=>context.addTranscriptBubble(host,m.role,m.text,'',m.visual,m,thread));
  },
  fetch:async(url:string)=>({ok:true,json:async()=>payload}),container:document.getElementById('bubble'),
 };
 runInNewContext(helper+'\n'+topicHelpers+'\n'+bubbleHelpers,context);
 if(start)context.noamAppendSourceDiagramHelp(context.container,selected,answer,thread);
 return {document,window,context,calls,thread,message:answer,runtime,
  settle:()=>new Promise(resolve=>setImmediate(resolve)),
  aid:()=>runInNewContext('noamSourceVertexAid('+JSON.stringify(payload)+',exercise)',context)};
}

it('an unsupported source recovery persists one validated drawing and removes the generation action',async()=>{
 const f=fixture(),originalText=f.message.text;
 await f.settle();
 assert.equal(f.message.visual.type,'native-source-visual');
 assert.equal(f.message.visual.presentation,'source-context');
 assert.equal(f.message.text,originalText,'keep the historical answer');
 assert.equal(f.message.diagramError,undefined);
 assert.equal(f.message.diagramErrorCode,undefined);
 assert.equal(f.document.querySelectorAll('.noam-geometry').length,1);
 assert.equal(!!f.document.querySelector('.noam-draw-action'),false,'no regeneration action');
 assert.equal(f.calls.filter(call=>typeof call==='object').length,1);
 assert.equal(f.calls[0].studentMessage,'הראה את השרטוט המקורי');
 assert.equal(f.calls[0].drawCurrentStep,undefined,'recovery requests the source without new construction');
});

it('transcript rendering starts source recovery before the new bubble is attached, then completes after attachment',async()=>{
 const f=fixture(data,exercise,message,undefined,false);
 const host=f.document.getElementById('host')!;host.innerHTML='';
 f.context.addTranscriptBubble(host,'assistant',f.message.text,'',null,f.message,f.thread);
 assert.equal(f.calls.filter(call=>typeof call==='object').length,1,'a newly created bubble is not connected yet');
 await f.settle();
 assert.equal(f.message.visual.type,'native-source-visual');
 assert.equal(f.document.querySelectorAll('.noam-geometry').length,1);
 assert.equal(!!f.document.querySelector('.noam-draw-action'),false);
});

it('security and transport failures, non-assistant messages and answer errors never start source recovery',async()=>{
 for(const msg of [{...message,diagramErrorCode:'DIAGRAM_UNAVAILABLE'},
  {...message,diagramErrorCode:undefined,diagramError:'לא הצלחנו להשלים את בדיקת האבטחה.'},
  {...message,answerError:true},{...message,role:'user'}]){
  const f=fixture(data,exercise,msg);await f.settle();
  assert.equal(f.calls.length,0);assert.equal(f.message.visual,undefined);
 }
});

it('failed, invalid or unrenderable source recovery keeps the original error retryable',async()=>{
 for(const prepare of [async()=>null,async()=>{throw Error('source unavailable');},async()=>({type:'native-source-visual',invalid:true})]){
  const f=fixture(data,exercise,message,prepare);await f.settle();
  assert.equal(f.message.visual,undefined);
  assert.equal(f.message.diagramError,legacy);
  assert.equal(f.message.diagramErrorCode,'DIAGRAM_UNSUPPORTED');
  assert.equal(f.document.querySelectorAll('.noam-geometry').length,0);
  assert.ok(f.document.querySelector('.noam-draw-action'));
 }
});

it('late recovery cannot attach to another section, source revision, reset conversation or detached bubble',async()=>{
 for(const change of [
  (f:any)=>{f.context.selectedExercise={...f.context.selectedExercise,id:'other'};},
  (f:any)=>{f.context.exercise.version='changed';},
  (f:any)=>{f.context.activeThread={messages:[]};},
  (f:any)=>{f.context.container.remove();},
 ]){
  let resolve!:Function;
  const gate=new Promise(r=>{resolve=r;});
  const f=fixture(data,exercise,message,()=>gate),identity=f.context.noamSourceVisualIdentity(f.context.exercise);
  change(f);
  resolve({type:'native-source-visual',exerciseId:f.context.exercise.id,sourceIdentity:identity});
  await f.settle();assert.equal(f.message.visual,undefined);
  assert.equal(f.calls.includes('saved'),false);
 }
});

it('a manual drawing or another pending request wins over late recovery, without a second figure',async()=>{
 for(const pending of [false,true]){
  let resolve!:Function;const gate=new Promise(r=>{resolve=r;});
  const f=fixture(data,exercise,message,()=>gate);
  const other:any={role:'assistant',text:'תשובה נוספת'};f.thread.messages.push(other);
  const visual={type:'native-source-visual',exerciseId:f.context.exercise.id,sourceIdentity:f.context.noamSourceVisualIdentity(f.context.exercise)};
  if(pending)f.runtime.messages.set(other,Promise.resolve(visual));else other.visual=visual;
  resolve(visual);await f.settle();
  assert.equal(f.message.visual,undefined,'late recovery must not claim a second drawing slot');
  assert.equal(f.calls.includes('saved'),false);
 }
});

it('two simultaneous source recoveries retain only the first completed drawing',async()=>{
 const f=fixture();
 const other:any={role:'assistant',text:'תשובה נוספת',diagramError:legacy,diagramErrorCode:'DIAGRAM_UNSUPPORTED'};
 f.thread.messages.push(other);
 f.context.noamAppendSourceDiagramHelp(f.context.container,f.context.exercise,other,f.thread);
 await f.settle();
 assert.equal(f.thread.messages.filter((m:any)=>m.visual).length,1);
 assert.equal(f.document.querySelectorAll('.noam-geometry').length,1);
 assert.equal(!!f.document.querySelector('.noam-draw-action'),false);
});
it('aid is tied to the exact approved subsection, figure and finite named source coordinates',()=>{
 for(const part of ['א','ב','ד'])assert.equal(fixture(data,{...exercise,part}).aid(),null);
 assert.equal(fixture(data,{...exercise,nativeQuestionId:'q2'}).aid(),null);
 assert.equal(fixture(data,{...exercise,nativeFigureUrl:'/noam-ai/native/G8-T39/a/figures/q2_head.svg'}).aid(),null);
 for(const mutate of [(f:any)=>f.question='q2',(f:any)=>f.svg='figures/q2_head.svg',(f:any)=>f.svg='elsewhere/q1_head.svg',
   (f:any)=>f.objects.points[0].svg_xy=[Infinity,2],(f:any)=>f.objects.points[0].svg_xy=[-1,2],
   (f:any)=>f.objects.points[1].name='A',(f:any)=>f.objects.points[1].svg_xy=f.objects.points[0].svg_xy,
   (f:any)=>f.objects.points.push(f.objects.points[0])]){
  const copy=structuredClone(data);mutate(copy.figures.find((f:any)=>f.id==='q1_head'));
  assert.equal(fixture(copy).aid(),null);
 }
});
