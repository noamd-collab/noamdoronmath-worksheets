import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { it } from 'node:test';
import { parseHTML } from 'linkedom';
const pub=new URL('../public/',import.meta.url),read=(p:string)=>readFileSync(new URL(p,pub),'utf8');
const legacy=JSON.parse(readFileSync(new URL('./fixtures/ramzi-source-priority-legacy-messages.json',import.meta.url),'utf8'));
const clone=(v:any)=>JSON.parse(JSON.stringify(v));
function fn(v:string,n:string){const s=v.slice(v.indexOf('function '+n+'('));assert.ok(s.startsWith('function '+n+'('));return s.slice(0,s.indexOf('\nfunction ',1));}
function fixture(v:string,kind='dots'){
 const id=kind==='dots'?'8474535578894a669c6847e57a83dc30':'c5910c37949b48a488ec5e3732c48601';
 const manifest=JSON.parse(read('noam-ai/manifests/'+id+'.json')),exercise=manifest.exercises.find((e:any)=>e.nativeItemId===(kind==='dots'?'q21d':'q7b'));
 const {document,window}=parseHTML('<html><body></body></html>'),calls:string[]=[],attachments:any[]=[],thread:any={messages:[],history:[],hintIndex:0};
 const c:any={document,window,manifest,selectedExercise:exercise,pdf:id,Promise,Map,WeakMap,WeakSet,currentAttachments:()=>attachments,
  noamNativeFocusUrl:()=>manifest.nativeExportUrl,exerciseThread:()=>thread,saveNoamState(){},renderNoamChat(){},announceNoam(){},
  cropExerciseCanvas:async()=>({width:640,height:1200,toDataURL:()=> 'data:image/png;base64,QUJD'}),
  fetch:async(url:string)=>{calls.push(url);const body=read(url.slice(1));return {ok:true,json:async()=>JSON.parse(body),text:async()=>body,arrayBuffer:async()=>new TextEncoder().encode(body).buffer};},TextDecoder};
 runInNewContext(read('noam-native-visual.js')+'\n'+read('noam-source-panels.js'),c);window.NoamNativeVisual=c.NoamNativeVisual;window.NoamSourcePanels=c.NoamSourcePanels;
 const helpers='var noamSourceVisualPackages='+v.split('var noamSourceVisualPackages=')[1].split('function noamNativeFigure(')[0];
 runInNewContext(v.slice(v.indexOf('var SOLVER_MESSAGE_MAX ='),v.indexOf('var GRADE_NAME ='))+'\n'+fn(v,'noamDiagramSourceIdentity')+'\n'+fn(v,'noamManifestOcrUnreliable')+'\n'+fn(v,'noamExerciseSectionLabel')+'\n'+helpers+'\n'+v.slice(v.indexOf('function noamGeometryContext(text){'),v.indexOf('function postJson(')),c);
 return {c,exercise,manifest,calls,attachments,thread};
}
function contradictory(){return {readable:true,transcription:'OCR: n²',math_content:'n²',problem_statement:'OCR square pattern',diagram_description:'OCR:9,16,25',extracted_entities:{expressions:['n²'],numbers:[9,16,25]}};}
async function settled(){for(let i=0;i<12;i++){await new Promise(r=>setImmediate(r));for(let j=0;j<120;j++)await Promise.resolve();}}
for(const relative of ['../public/worksheet-viewer-noam.html','../../../worksheet-viewer-noam.html']){
 const v=readFileSync(new URL(relative,import.meta.url),'utf8'),name=relative.includes('public')?'public':'root';
 it(name+': verified dots and printed labels receive private priority while conflicting OCR and cache remain intact',async()=>{
  for(const kind of ['dots','labels']){
   const f=fixture(v,kind),ocr=contradictory(),before=JSON.stringify(ocr),enriched=await f.c.noamEnrichSourceAnalysis(f.exercise,ocr);
   const instruction=f.c.noamSourcePriorityInstruction(enriched,f.exercise);assert.match(instruction,/העדף את נתוני המקור המאומתים/);assert.match(instruction,/אל תחשוף תשובה/);
   assert.notEqual(enriched,ocr);assert.equal(JSON.stringify(ocr),before);assert.equal(f.c.noamSourcePriorityInstruction(ocr,f.exercise),'');
   for(const key of ['transcription','math_content','problem_statement','extracted_entities'])assert.equal(JSON.stringify(enriched[key]),JSON.stringify((ocr as any)[key]));
   assert.equal(Object.keys(enriched).join(','),Object.keys(ocr).join(','));assert.ok(enriched.diagram_description.includes(ocr.diagram_description));
   const first800=enriched.diagram_description.slice(0,800);
   if(kind==='dots'){for(const n of [9,18,27])assert.ok(first800.includes(n+' נקודות'));}else assert.match(first800,/על קטע אנכי מודפס 2/);
  }
 });
 it(name+': cloned or mutated analysis, foreign identity, changed source and attachments cannot reuse provenance',async()=>{
  const f=fixture(v),enriched=await f.c.noamEnrichSourceAnalysis(f.exercise,contradictory());
  for(const a of [clone(enriched),{...enriched,verifiedSource:true},{diagram_description:enriched.diagram_description,sourcePriority:true}])assert.equal(f.c.noamSourcePriorityInstruction(a,f.exercise),'');
  const original=enriched.diagram_description;enriched.diagram_description='forged';assert.equal(f.c.noamSourcePriorityInstruction(enriched,f.exercise),'');enriched.diagram_description=original;
  const sibling={...f.exercise,nativeItemId:'q21a',part:'א',id:f.exercise.id.replace('ד','א')};assert.equal(f.c.noamSourcePriorityInstruction(enriched,sibling),'');
  f.attachments.push({name:'student.png'});assert.equal(f.c.noamSourcePriorityInstruction(enriched,f.exercise),'');f.attachments.length=0;
  f.manifest.nativeExportSha256='0'.repeat(64);assert.equal(f.c.noamSourcePriorityInstruction(enriched,f.exercise),'');
 });
 it(name+': failed or invalid source retains the existing no-priority fallback',async()=>{
  for(const mode of ['missing','wrong-item','hidden-dot','changed-svg','missing-module']){
   const f=fixture(v),ocr=contradictory();
   if(mode==='missing')f.c.noamLoadSourceVisual=async()=>null;
   if(mode==='wrong-item')f.exercise.nativeItemId='q21a';
   if(mode==='missing-module')delete f.c.window.NoamSourcePanels;
   if(mode==='hidden-dot'||mode==='changed-svg'){
    const load=f.c.noamLoadSourceVisual;f.c.noamLoadSourceVisual=async(e:any)=>{const s=await load(e);if(mode==='hidden-dot')s.data.figures.find((x:any)=>x.id==='q21_head_2').visual_model.objects[0].role='answer';else s.sourcePanelSvgById.q21_head_2=s.sourcePanelSvgById.q21_head_2.replace('fill="#111"','fill="#fff"');return s;};
   }
   const enriched=await f.c.noamEnrichSourceAnalysis(f.exercise,ocr);assert.equal(f.c.noamSourcePriorityInstruction(enriched,f.exercise),'',mode);
  }
 });
 it(name+': priority and non-disclosure survive the actual700-character cap without answers or inferred stages',async()=>{
  for(const kind of ['dots','labels'])for(const guide of ['','מדריך מאומת '.repeat(120)]){
   const f=fixture(v,kind),enriched=await f.c.noamEnrichSourceAnalysis(f.exercise,contradictory()),instruction=f.c.noamSourcePriorityInstruction(enriched,f.exercise);
   const message=f.c.noamSolverMessage('אני מבקש עזרה '.repeat(150),{history:[{role:'assistant',content:'הקשר '.repeat(200)}]},'תבניות',guide,enriched,f.exercise);
   assert.equal(f.c.SOLVER_MESSAGE_MAX,700);assert.ok(message.length<=700,message.length);assert.ok(message.startsWith(instruction));assert.ok(message.endsWith(f.c.MATH_OUTPUT_INSTRUCTION));assert.ok(message.includes('הודעת התלמיד עכשיו:'));
   assert.doesNotMatch(message,/9n|n²|n\^2|שלב 1|שלב 2|שלב 3/);
   if(name==='public')assert.ok(message.includes('שאלה '+f.exercise.q+' סעיף '+f.exercise.part));
  }
 });
 it(name+': no-source messages are byte-identical to the reviewed f786 baseline',()=>{
  const f=fixture(v);legacy.cases.forEach((row:any,i:number)=>assert.equal(f.c.noamSolverMessage(row.student,{history:row.history||[]},row.topic,row.guide||'',row.analysis,legacy.exercise),legacy.expected[name][i],row.name));
 });
 it(name+': actual hint sends the canonical source analysis in one existing solve request and skips it for student attachments',async()=>{
  for(const attachment of [false,true]){
   const f=fixture(v),ocr=contradictory(),requests:any[]=[];let analysisCalls=0;if(attachment)f.attachments.push({name:'student.png'});
   Object.assign(f.c,{busy:false,panelBody:f.c.document.body,noamDrafts:{},MIN_WAIT:0,API:'/model',g:7,lv:'a',LEVEL:{a:'רמה א׳'},ttl:'תבניות',
    setNoamBusy:(b:boolean)=>{f.c.busy=b;},restoreNoamChatFocus(){},exerciseLabel:()=> 'שאלה21ד',noamDidacticGuide:()=>null,noamDidacticPrompt:()=>'',noamDidacticResponse:()=>null,
    getExerciseAnalysis:async()=>{analysisCalls++;return ocr;},postJson:async(url:string,payload:any)=>{requests.push({url,payload});return {ok:true,answer:'בדקו את השורות והעמודות.'};},
    noamGuardGeometryResult:(r:any)=>r,noamGuardSignedAddResult:(r:any)=>r,noamClarifySignedAddLanguage:(s:string)=>s,noamResponseVisual:()=>null,noamVisualAnswer:(_:string,s:string)=>s,noamAttachSourceHint(){},setTimeout:(cb:any,ms:number)=>{if(ms<25000)cb();return 0;}});
   f.c.askNoam('hint','תן לי רמז אחד בלבד.');await settled();assert.equal(requests.length,1);assert.equal(requests[0].url,'/model/noamImageSolve');assert.equal(requests[0].payload.exerciseId,f.exercise.id);
   const sent=requests[0].payload.imageAnalysis,text=JSON.stringify(sent);
   assert.equal(requests[0].payload.studentMessage.includes('ניתוח השאלה נבנה מהטקסט המודפס ומנתוני המקור המאומתים'),!attachment);
   assert.equal(requests[0].payload.studentMessage.includes('העדף את נתוני המקור המאומתים'),false);
   assert.equal(sent.content_type==='native_source_canonical',!attachment);assert.equal(analysisCalls,attachment?1:0);
   if(!attachment){assert.doesNotMatch(text,/OCR|16|25|n²/);assert.match(sent.diagram_description,/לוח עם הכיתוב "שלב 2": 3 שורות, 6 נקודות בכל שורה/);}
   assert.equal(f.calls.length>0,!attachment);assert.equal(ocr.diagram_description,'OCR:9,16,25');
  }
 });
}
