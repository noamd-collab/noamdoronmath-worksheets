import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { it } from 'node:test';
import { parseHTML } from 'linkedom';
const app = new URL('../', import.meta.url);
const read = (p:string) => readFileSync(new URL(p, app), 'utf8');
const source = read('public/worksheet-viewer-noam.html');
const helpers = 'function noamNativeFigure' + source.split('function noamNativeFigure')[1].split('function showExercisePreview')[0];
const zoom = 'function noamAddDiagramExpansion' + source.split('function noamAddDiagramExpansion')[1].split('function noamDiagramRuntime')[0];
const label = 'function setNoamDiagramButtonLabel' + source.split('function setNoamDiagramButtonLabel')[1].split('function addTranscriptBubble')[0];
const sourceHelpers = 'var noamSourceVisualPackages=' + source.split('var noamSourceVisualPackages=')[1].split('function noamNativeFigure(')[0];
const modules = ['noam-native-visual.js','noam-source-panels.js'].map(name => read('public/'+name)).join('\n');
function fn(name:string) {
 const start=source.indexOf('function '+name+'(');assert.ok(start>=0,name);
 const tail=source.slice(start);return tail.slice(0,tail.indexOf('\nfunction ',1));
}
const rows = ['pilot','next-ten','second-ten','third-ten','fourth-ten','remaining-101'].flatMap(n => JSON.parse(read(`src/data/worksheet-${n}.v1.json`)).sheets);
const alternate:any[] = [];
for (const r of rows) {
 const data = JSON.parse(read('public'+r.nativeExport));
 const manifest = JSON.parse(read(`public/noam-ai/manifests/${r.pdfId}.json`));
 for (const ex of manifest.exercises) {
  const q = data.questions.find((q:any) => q.id===ex.nativeQuestionId);
  if (ex.nativeFigureId && ex.nativeFigureId!==q.figure_id) alternate.push({data,manifest,ex});
 }
}
function fixture(data:any, manifest:any, ex:any) {
 const {document,window}=parseHTML('<html><body><div id="noamTranscript"><div id="bubble"><button class="noam-draw-action"></button><span class="noam-draw-error">unsupported</span></div></div></body></html>');
 const calls:string[]=[],runtime={messages:new Map()},thread:any={messages:[],history:[]};
 const context:any={document,window,manifest,selectedExercise:ex,exerciseLabel:()=>ex.id,
  // This suite checks exact source wiring; catalog tests cover the page-policy gate.
  noamPageAllowsDrawingHint:()=>true,noamDiagramRuntime:()=>runtime,exerciseThread:()=>thread,
  noamDiagramSourceIdentity:(e:any)=>e.id,saveNoamState(){},announceNoam(){},
  noamStripMarkdownEmphasis:(text:string)=>text,
  cropExerciseCanvas:async()=>({width:640,height:1200,toDataURL:()=> 'data:image/png;base64,QUJD'}),
  renderNoamChat:()=>{
   const host=document.getElementById('noamTranscript')!;host.innerHTML='';
   thread.messages.forEach((message:any)=>context.addTranscriptBubble(host,message.role,message.text,'',message.visual,message,thread));
  },
  fetch:async(url:string)=>{calls.push(url);return {ok:true,json:async()=>data,text:async()=>read('public'+url)};}};
 runInNewContext(modules+'\n'+sourceHelpers+'\n'+label+'\n'+helpers+'\n'+zoom+'\n'+[
  'noamDiagramCurrent','noamDiagramRefresh','noamRenderDrawingVisual','noamQuestionDrawing',
  'noamPendingQuestionDrawing','noamQuestionDrawingBlocked','noamCanOfferDrawing','noamVisualCanExpand','addTranscriptBubble'
 ].map(fn).join('\n'),context);
 window.NoamNativeVisual=context.NoamNativeVisual;window.NoamSourcePanels=context.NoamSourcePanels;
 return {document,window,context,calls,thread};
}
it('all 85 real subsection-specific figures open their own original after unsupported generation',async()=>{
 assert.equal(alternate.length,85);
 for (const {data,manifest,ex} of alternate) {
  const f=fixture(data,manifest,ex), message:any={role:'assistant',text:'בדקו את נתוני הסעיף.',diagramErrorCode:'DIAGRAM_UNSUPPORTED',diagramError:'unsupported'};
  f.thread.messages.push(message);
  f.context.noamAppendSourceDiagramHelp(f.document.getElementById('bubble'),ex,message,f.thread);
  await new Promise(r=>setImmediate(r));
  assert.equal(message.visual?.type,'native-source-visual',ex.id);
  assert.equal(message.visual.presentation,'source-context',ex.id);
  assert.equal(f.thread.messages.filter((item:any)=>item.visual).length,1,ex.id);
  assert.equal(f.document.querySelectorAll('.noam-geometry').length,1,ex.id);
  const sources=Array.from(f.document.querySelectorAll('figure image')).map(image=>image.getAttribute('href'));
  assert.ok(sources.includes(ex.nativeFigureUrl),ex.id+' must retain its exact subsection figure');
  assert.match(f.document.querySelector('figcaption')!.textContent!,/מקור/);
  assert.equal(f.document.querySelector('.noam-draw-action:not(.noam-diagram-expand)'),null,ex.id);
  assert.equal(f.document.querySelector('.noam-draw-error'),null,ex.id);
  assert.equal(message.diagramError,undefined,ex.id);
  assert.equal(message.diagramErrorCode,undefined,ex.id);
  assert.equal(f.calls.filter(url=>url.endsWith('/noam-ai.json')).length,1,ex.id);
  assert.ok(f.calls.includes(ex.nativeFigureUrl),ex.id);
 }
});
it('coordinate-plane vertices labelled point can highlight an existing edge, preserving the source',async()=>{
 const row=rows.find(r=>r.package==='G7-T09'&&r.nativeLevel==='b');
 const data=JSON.parse(read('public'+row.nativeExport)), manifest=JSON.parse(read(`public/noam-ai/manifests/${row.pdfId}.json`));
 const ex=manifest.exercises.find((e:any)=>e.nativeQuestionId==='q13'&&e.part==='א'),f=fixture(data,manifest,ex);
 const visual=await f.context.noamPrepareNativeFocus(ex,{answer:'התבוננו בקטע AB.',helpKind:'hint',studentMessage:'אפשר רמז 1?'});
 assert.ok(visual);const figure=f.context.noamRenderNativeFocus(visual);
 assert.equal(figure.querySelector('image').getAttribute('href'),ex.nativeFigureUrl);
 assert.equal(figure.querySelectorAll('line').length,1);
 assert.equal(figure.querySelector('line').getAttribute('x1'),'43.1');
 assert.equal(figure.querySelector('line').getAttribute('x2'),'153.1');
 assert.equal(figure.querySelectorAll('circle,path,text').length,0);
 const mutated=structuredClone(data), sourceFigure=mutated.figures.find((x:any)=>x.id===ex.nativeFigureId);
 sourceFigure.objects.points.push({...sourceFigure.objects.points[0],svg_xy:[5,5]});
 assert.equal(f.context.noamNativeSegmentFocus(mutated,ex,'התבוננו בקטע AB.'),null,'ambiguous same-name points stay rejected');
 assert.equal(f.context.noamNativeSegmentFocus(data,{...ex,nativeFigureId:'other'},'התבוננו בקטע AB.'),null);
});
it('part figures with valid named edges never substitute the question default figure',()=>{
 let supported=0;
 for (const {data,manifest,ex} of alternate) {
  const f=fixture(data,manifest,ex), fig=data.figures.find((f:any)=>f.id===ex.nativeFigureId);
  for (const s of fig.objects?.segments||[]) {
   if(s.kind!=='segment'||s.role!=='edge'||!/^[A-Z]{2}$/.test(s.name))continue;
   const hint='התבוננו בקטע '+s.name;
   if(f.context.noamNativeSegmentFocus(data,ex,hint)) {
    supported++;
    assert.equal(f.context.noamNativeSegmentFocus(data,{...ex,nativeFigureId:'wrong'},hint),null);
   }
  }
 }
 assert.equal(supported,53);
});
it('scaled subsection figures use original SVG units for both validation and rendering',async()=>{
 const {data,manifest,ex}=alternate.find(x=>x.ex.id.startsWith('G9-T18-A-')&&x.data.figures.find((f:any)=>f.id===x.ex.nativeFigureId)?.objects?.segments?.some((s:any)=>s.name==='AB'));
 const f=fixture(data,manifest,ex), original=data.figures.find((f:any)=>f.id===ex.nativeFigureId);
 assert.notEqual(original.view.width_px,original.view.viewbox[0]);
 const visual=await f.context.noamPrepareNativeFocus(ex,{answer:'התבוננו בקטע AB.',helpKind:'hint',studentMessage:'אפשר רמז 1?'});
 assert.ok(visual);
 const svg=f.context.noamRenderNativeFocus(visual).querySelector('svg');
 assert.equal(svg.getAttribute('viewBox'),'0 0 '+original.view.viewbox.join(' '));
 assert.equal(svg.querySelector('image').getAttribute('width'),String(original.view.viewbox[0]));
 const endpoint=original.objects.points.find((p:any)=>p.name==='B').svg_xy;
 assert.equal(svg.querySelector('line').getAttribute('x2'),String(endpoint[0]));
 assert.equal(svg.querySelector('line').getAttribute('y2'),String(endpoint[1]));
 for (const box of [undefined, [], [0,100], [100,Infinity], [2001,100], [0,0,100,100]]) {
  const copy=structuredClone(data);copy.figures.find((x:any)=>x.id===ex.nativeFigureId).view.viewbox=box;
  assert.equal(f.context.noamNativeSegmentFocus(copy,ex,'התבוננו בקטע AB.'),null);
 }
});
