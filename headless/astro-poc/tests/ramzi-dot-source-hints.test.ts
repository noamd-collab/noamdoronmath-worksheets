import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { it } from 'node:test';
import { parseHTML } from 'linkedom';

const root=new URL('../public/',import.meta.url);
const native=readFileSync(new URL('noam-native-visual.js',root),'utf8'),panels=readFileSync(new URL('noam-source-panels.js',root),'utf8');
const manifests=readdirSync(new URL('noam-ai/manifests/',root)).map(f=>JSON.parse(readFileSync(new URL('noam-ai/manifests/'+f,root),'utf8'))).filter(m=>m.nativeExportUrl);
const clone=(v:any)=>JSON.parse(JSON.stringify(v));
function fn(v:string,n:string){const s=v.slice(v.indexOf('function '+n+'('));assert.ok(s.startsWith('function '+n+'('));return s.slice(0,s.indexOf('\nfunction ',1));}
function fixture(v:string,path='G7-T22/a',qid='q21',part='ד',mutate?:(url:string,body:string)=>string|null){
 const manifest=clone(manifests.find(m=>m.nativeExportUrl==='/noam-ai/native/'+path+'/noam-ai.json'));
 const exercise=manifest.exercises.find((e:any)=>e.nativeQuestionId===qid&&e.part===part);assert.ok(exercise);
 const {document,window}=parseHTML('<html><body></body></html>');
 const crops:any[]=[],calls:string[]=[],thread:any={messages:[],history:[],hintIndex:0};
 const c:any={document,window,manifest,selectedExercise:exercise,pdf:manifest.pdfHash,Map,WeakSet,Promise,
  noamNativeFocusUrl:()=>manifest.nativeExportUrl,exerciseThread:()=>thread,renderNoamChat(){},saveNoamState(){},announceNoam(){},
  cropExerciseCanvas:async(e:any)=>{crops.push(clone(e.crops));return {width:640,height:1200,toDataURL:()=> 'data:image/png;base64,QUJD'};},
  fetch:async(url:string)=>{calls.push(url);const original=readFileSync(new URL(url.slice(1),root),'utf8'),body=mutate?mutate(url,original):original;return {ok:body!==null,json:async()=>JSON.parse(body!),text:async()=>body,arrayBuffer:async()=>new TextEncoder().encode(body!).buffer};},TextDecoder};
 const helper='var noamSourceVisualPackages='+v.split('var noamSourceVisualPackages=')[1].split('function noamNativeFigure(')[0];
 runInNewContext(native+'\n'+panels+'\n'+fn(v,'noamDiagramSourceIdentity')+'\n'+helper,c);
 window.NoamNativeVisual=c.NoamNativeVisual;window.NoamSourcePanels=c.NoamSourcePanels;
 return {c,manifest,exercise,crops,calls,thread};
}
async function settled(){for(let i=0;i<12;i++){await new Promise(r=>setImmediate(r));for(let j=0;j<100;j++)await Promise.resolve();}}
function expectSourceFacts(value:string){
 for(const [id,total,columns] of [['q21_head',9,3],['q21_head_2',18,6],['q21_head_3',27,9]]){
  assert.ok(value.includes(`לוח ${id}: ${total} נקודות; 3 שורות, ${columns} נקודות בכל שורה.`),id as string);
 }
 assert.match(value,/האם יש שלב שבו בדיוק \$100\$ נקודות/);
 assert.doesNotMatch(value,/9\s*[*×]?\s*n|n\s*\^\s*2|ריבוע|שלב [123]|אין שלב|לא קיים/);
}
for(const relative of ['../public/worksheet-viewer-noam.html','../../../worksheet-viewer-noam.html']){
 const v=readFileSync(new URL(relative,import.meta.url),'utf8'),prefix=relative.includes('public')?'public':'root';
 it(prefix+': MP02 source facts survive the actual solver and review field limits without a formula or answer',async()=>{
  const f=fixture(v),original={readable:true,transcription:'original transcription',diagram_description:'תיאור OCR קודם. '.repeat(400)},before=JSON.stringify(original);
  const analysis=await f.c.noamEnrichSourceAnalysis(f.exercise,original);
  // noamSolver.normalizeAnalysis bounds this field at 3000; buildHintReviewMessages at 800.
  const normalized=analysis.diagram_description.slice(0,3000),reviewed=normalized.slice(0,800);
  expectSourceFacts(normalized);expectSourceFacts(reviewed);
  assert.match(reviewed,/עדיפים על השערת OCR/);assert.match(reviewed,/אין להסיק מספר שלב/);assert.match(reviewed,/אל תחשוף ספירה, כלל או תשובה/);
  assert.equal(JSON.stringify(original),before);assert.equal(analysis.transcription,original.transcription);
  assert.deepEqual(f.crops[0],f.exercise.crops);assert.deepEqual(f.crops[0].map((c:any)=>c.page),[11,12]);
 });
 it(prefix+': ordinary image analysis receives both original pages, never just the selected-part crop',async()=>{
  const f=fixture(v),captured:any[]=[];
  Object.assign(f.c,{analysisCache:{},syntheticAnalysis:()=>({readable:true}),ensurePdfDocumentForCrop:async()=>{},noamRebuildSelectedPartExpression:async()=>null,
   cropExerciseImage:async(e:any)=>{captured.push(clone(e));return 'data:image/png;base64,QUJD';},
   postJson:async()=>({ok:true,analysis:{readable:true,diagram_description:'צילום כל השאלה'}}),API:'/model',isBotProtectionError:()=>false});
  runInNewContext(['noamManifestOcrUnreliable','noamExerciseNeedsLiveVision','noamScopedExerciseSemantic','getExerciseAnalysis'].map(n=>fn(v,n)).join('\n'),f.c);
  await f.c.getExerciseAnalysis(f.exercise);
  assert.equal(captured.length,1);assert.equal(captured[0].crop.page,12);assert.deepEqual(captured[0].crops.map((c:any)=>c.page),[11,12]);
 });
 it(prefix+': an additional question sends the canonical dot arrays with verified printed captions in its single existing solve request',async()=>{
  const f=fixture(v),cached={diagram_description:'original OCR'},requests:any[]=[];
  Object.assign(f.c,{busy:false,panelBody:f.c.document.body,noamDrafts:{},MIN_WAIT:0,API:'/model',g:7,lv:'a',LEVEL:{a:'רמה א׳'},ttl:'תבניות',
   setNoamBusy:(busy:boolean)=>{f.c.busy=busy;},restoreNoamChatFocus(){},exerciseLabel:()=> 'שאלה 21ד',
   noamDidacticGuide:()=>null,noamDidacticPrompt:()=>'',noamDidacticResponse:()=>null,getExerciseAnalysis:async()=>cached,
   noamSolverMessage:(s:string)=>s,postJson:async(url:string,payload:any)=>{requests.push({url,payload});return {ok:true,answer:'השוו את מספר הנקודות בשורות.'};},
   noamGuardGeometryResult:(r:any)=>r,noamGuardSignedAddResult:(r:any)=>r,noamClarifySignedAddLanguage:(s:string)=>s,
   noamResponseVisual:()=>null,noamVisualAnswer:(_:string,s:string)=>s,setTimeout:(cb:any,ms:number)=>{if(ms<25000)cb();return 0;}});
  runInNewContext(fn(v,'askNoam'),f.c);f.c.askNoam('free_question','אפשר להסביר איך משתמשים בנתונים המודפסים בסעיף הזה?');await settled();
  assert.equal(requests.length,1);assert.equal(requests[0].url,'/model/noamImageSolve');assert.equal(requests[0].payload.exerciseId,f.exercise.id);
  const sent=requests[0].payload.imageAnalysis,description=sent.diagram_description.slice(0,800);
  assert.equal(sent.content_type,'native_source_canonical');assert.doesNotMatch(JSON.stringify(sent),/original OCR/);
  for(const [caption,columns] of [['שלב 1',3],['שלב 2',6],['שלב 3',9]])assert.ok(description.includes(`לוח עם הכיתוב "${caption}": 3 שורות, ${columns} נקודות בכל שורה.`),caption as string);
  assert.match(sent.transcription,/הסעיף הנבחר: האם יש שלב שבו בדיוק \$100\$ נקודות/);
  assert.doesNotMatch(JSON.stringify(sent),/(?:9|18|27) נקודות[;.]|9\s*[*×]?\s*n|n\s*\^\s*2|ריבוע|אין שלב|לא קיים|q21_head/);
  assert.equal(cached.diagram_description,'original OCR');assert.equal(f.thread.messages[1].text,'השוו את מספר הנקודות בשורות.');
 });
 it(prefix+': incomplete groups, changed model dots, non-dot marks and hidden dots never become structural givens',async()=>{
  for(const mode of ['missing','blank','answer','hidden-model','extra-circle','missing-circle','model-location','overlap','transform','white','opacity','line','wrong-namespace','missing-namespace']){
   const f=fixture(v,undefined,undefined,undefined,(url,body)=>{
    if(url.endsWith('noam-ai.json')&&['answer','hidden-model','model-location'].includes(mode)){
     const d=JSON.parse(body),o=d.figures.find((x:any)=>x.id==='q21_head_2').visual_model.objects[0];
     if(mode==='answer')o.role='answer';if(mode==='hidden-model')o.display='hidden';if(mode==='model-location')o.svg_xy[0]+=1;return JSON.stringify(d);
    }
    if(!url.endsWith('q21_head_2.svg'))return body;
    if(mode==='missing')return null;
    if(mode==='blank')return body.replace(/<circle\b[^>]*\/>/g,'');
    if(mode==='extra-circle')return body.replace('</svg>','<circle id="extra" cx="3" cy="3" r="1" fill="#111"/></svg>');
    if(mode==='missing-circle')return body.replace(/<circle\b[^>]*\/>/,'');
    if(mode==='overlap')return body.replace(/r="2.00"/g,'r="4.00"');
    if(mode==='transform')return body.replace('<circle','<circle transform="translate(1)"');
    if(mode==='white')return body.replace('fill="#111"','fill="#fff"');
    if(mode==='opacity')return body.replace('<circle','<circle opacity="0"');
    if(mode==='wrong-namespace')return body.replace('http://www.w3.org/2000/svg','http://example.invalid/not-svg');
    if(mode==='missing-namespace')return body.replace(' xmlns="http://www.w3.org/2000/svg"','');
    if(mode==='line')return body.replace('</svg>','<line x1="1" y1="1" x2="2" y2="2"/></svg>');return body;
   });
   const result=await f.c.noamEnrichSourceAnalysis(f.exercise,{diagram_description:'original'});
   assert.doesNotMatch(result.diagram_description,/נתונים גלויים מאומתים|נקודות בכל שורה/,mode);
  }
 });
 it(prefix+': example/practice and non-dot panels keep their existing source context without promoted counts',async()=>{
  for(const [path,q,part] of [['G8-TWOSRC/a','q7','א'],['G8-TWOSRC/b','q2','א'],['G8-T17/a','q9','ב']]){
   const f=fixture(v,path,q,part),result=await f.c.noamEnrichSourceAnalysis(f.exercise,{diagram_description:'original'});
   assert.match(result.diagram_description,/כמה לוחות מקור נפרדים/);assert.doesNotMatch(result.diagram_description,/נתונים גלויים מאומתים|נקודות בכל שורה/);
  }
 });
 it(prefix+': source identities and panel order never assign stage numbers or change stored analysis',async()=>{
  const f=fixture(v);f.exercise.nativeItemId='q21a';const original={diagram_description:'original'};
  assert.equal(await f.c.noamEnrichSourceAnalysis(f.exercise,original),original);
  const g=fixture(v),source=await g.c.noamLoadSourceVisual(g.exercise),group=g.c.NoamSourcePanels.resolve(source.data,g.exercise,source.sourcePanelSvgById),context=g.c.NoamNativeVisual.authoredContext(source.data,g.exercise,source.svgText);
  const facts=g.c.noamSourcePanelDotFacts(source,group,context);group.panels.reverse();
  assert.deepEqual(clone(g.c.noamSourcePanelDotFacts(source,group,context)).reverse(),clone(facts));
  assert.ok(facts.every((p:any)=>Object.keys(p).join(',')==='id,dots,rows,dotsPerRow'));
 });
}
