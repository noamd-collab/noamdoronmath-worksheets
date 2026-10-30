import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { it } from 'node:test';
import { parseHTML } from 'linkedom';

function fn(source:string,name:string){const start=source.indexOf('function '+name+'(');assert.ok(start>=0,name);const end=source.indexOf('\nfunction ',start+1);return source.slice(start,end<0?undefined:end);}
function deferred(){let resolve:any,reject:any;const promise=new Promise<any>((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};}
async function drain(){for(let i=0;i<60;i++)await Promise.resolve();}
function setup(source:string){
 let now=0,nextTimer=0;const timers=new Map<number,{at:number,fn:()=>void}>(),threads=new Map<string,any>(),requests:any[]=[],photos:any[]=[];
 const {document,window}=parseHTML('<html><body><button id="noamHint"></button><button id="noamSend"></button><button id="noamNewThread"></button></body></html>');
 const c:any={document,window,panelBody:document.body,AbortController,Promise,Map,WeakMap,WeakSet,Uint8Array,TextDecoder,
  Date:class extends Date {static now(){return now;}},setTimeout:(f:()=>void,ms:number)=>{const id=++nextTimer;timers.set(id,{at:now+ms,fn:f});return id;},clearTimeout:(id:number)=>timers.delete(id),
  selectedExercise:{id:'G9-T39-E-Q03ב',part:'ב',requiresVision:true,crop:{page:2}},busy:false,manifest:{},noamDrafts:{},MIN_WAIT:0,API:'/api',TIMEOUT:20000,BOT_GUARD_ENABLED:true,g:9,lv:'c',LEVEL:{c:'מצוינות'},ttl:'טרפז',
  exerciseThread:(id:string)=>{if(!threads.has(id))threads.set(id,{messages:[],history:[],hintIndex:0});return threads.get(id);},
  saveNoamState(){},renderNoamChat(){},announceNoam(){},restoreNoamChatFocus(){},exerciseLabel:()=> 'שאלה 3 סעיף ב',currentAttachments:()=>photos.slice(),clearNoamAttachments:()=>{photos.splice(0);},
  noamDidacticGuide:()=>null,noamDidacticPrompt:()=>'',noamDidacticResponse:()=>null,
  noamQuestionAnalysis:async()=>({readable:true,transcription:'original'}),noamEnrichSourceAnalysis:(_:any,a:any)=>a,noamSolverMessage:(s:string)=>s,
  noamGuardGeometryResult:(r:any)=>r,noamGuardSignedAddResult:(r:any)=>r,noamClarifySignedAddLanguage:(s:string)=>s,noamResponseVisual:()=>null,noamVisualAnswer:(_:any,s:string)=>s,noamAttachSourceHint(){},
  isBotProtectionError:(e:any)=>/^BOT_/.test(e?.code||''),postJson:async(url:string,payload:any)=>{requests.push({url,payload});return {ok:true,answer:'בדקו את הזוויות.'};},
  analysisCache:{},exercisePreviewCache:{},console:{warn(){}}};
 function load(...names:string[]){runInNewContext(names.map(n=>fn(source,n)).join('\n'),c);}
 load('setNoamBusy','askNoam');
 async function advance(ms:number){now+=ms;for(let rounds=0;rounds<8;rounds++){for(const [id,t] of timers)if(t.at<=now){timers.delete(id);t.fn();}await drain();}}
 function thread(){return c.exerciseThread(c.selectedExercise.id);}
 return {c,load,advance,timers,requests,photos,thread,threads};
}
for(const path of ['../public/worksheet-viewer-noam.html','../../../worksheet-viewer-noam.html']){
 const source=readFileSync(new URL(path,import.meta.url),'utf8'),label=path.includes('public')?'public':'root';
 it(label+': stalled source is bounded to25s and releases composer/new-chat controls',async()=>{
  const h=setup(source);h.c.noamQuestionAnalysis=()=>new Promise(()=>{});h.c.askNoam('hint','רמז');await h.advance(24999);assert.equal(h.c.busy,true);await h.advance(1);
  assert.equal(h.c.busy,false);assert.equal(h.thread().messages.at(-1).answerErrorCode,'HINT_REQUEST_TIMEOUT');assert.equal(h.thread().hintIndex,0);assert.equal(h.thread().history.length,0);assert.equal(h.requests.length,0);
  for(const id of ['noamHint','noamSend','noamNewThread'])assert.equal(h.c.document.getElementById(id).disabled,false);
 });
 it(label+': synchronous preflight exception cannot strand busy state',async()=>{
  const h=setup(source);h.c.noamDidacticGuide=()=>{throw new Error('preflight failed');};assert.doesNotThrow(()=>h.c.askNoam('hint','רמז'));assert.equal(h.c.busy,false);assert.equal(h.thread().messages.at(-1).text,'preflight failed');assert.equal(h.timers.size,0);
 });
 it(label+': expired same-exercise generation cannot post, append, unlock or clear newer photos',async()=>{
  const h=setup(source),old=deferred(),next=deferred();h.c.noamQuestionAnalysis=()=>old.promise;h.c.askNoam('hint','old');await h.advance(25000);
  const exercise=h.c.selectedExercise;h.c.selectedExercise={...exercise,id:'other'};h.c.selectedExercise=exercise;h.photos.push({name:'new.png'});h.c.noamQuestionAnalysis=()=>next.promise;h.c.askNoam('hint','new');
  const count=h.thread().messages.length;old.resolve({readable:true});await h.advance(0);assert.equal(h.requests.length,0);assert.equal(h.thread().messages.length,count);assert.equal(h.thread().history.length,0);assert.equal(h.c.busy,true);assert.equal(h.photos.length,1);
  next.resolve({readable:true});await h.advance(0);assert.equal(h.requests.length,1);assert.equal(h.c.busy,false);assert.equal(h.thread().hintIndex,1);assert.equal(h.photos.length,0);
 });
 it(label+': actual fetch boundary fences delayed CAPTCHA and internal retry after expiry even during a new request',async()=>{
  for(const phase of ['captcha','retry']){
   const h=setup(source),ready=deferred(),late=deferred();let network=0;
   h.c.fetch=async()=>{network++;throw new Error('network');};h.c.window.NoamBotClient={create:(options:any)=>({postJson:async()=>{if(phase==='captcha')await late.promise;try{return await options.fetch('/model',{method:'POST'});}catch(error){if(phase!=='retry')throw error;await late.promise;return options.fetch('/model',{method:'POST'});}}})};
   h.c.ensureNoamBotClient=async()=>({});h.load('noamOperationClient','postJson');h.c.noamQuestionAnalysis=()=>ready.promise;h.c.askNoam('hint','old');await h.advance(20000);ready.resolve({readable:true});await h.advance(0);assert.equal(network,phase==='retry'?1:0);
   await h.advance(5000);h.c.noamQuestionAnalysis=()=>new Promise(()=>{});h.c.askNoam('hint','new');late.resolve();await h.advance(0);assert.equal(network,phase==='retry'?1:0);assert.equal(h.c.busy,true);assert.equal(h.thread().hintIndex,0);
  }
 });
 it(label+': abort forwarding survives response headers while body is pending',async()=>{
  for(const abortKind of ['request','operation']){
   const h=setup(source),body=deferred(),request=new AbortController();let forwarded:AbortSignal|undefined;
   h.c.fetch=async(_:any,options:any)=>{forwarded=options.signal;return {text:()=>body.promise};};h.c.noamQuestionAnalysis=(_:any,__:any,op:any)=>op.fetch('/model',{signal:request.signal}).then((r:any)=>r.text());
   h.c.askNoam('hint','x');await h.advance(0);assert.equal(forwarded?.aborted,false);
   if(abortKind==='request')request.abort();else await h.advance(25000);assert.equal(forwarded?.aborted,true,abortKind);
   await h.advance(25000);assert.equal(h.c.busy,false);
  }
 });
 it(label+': pending native cache is evicted by identity and late rejection cannot delete its replacement',async()=>{
  const h=setup(source),json=deferred(),svg=deferred();Object.assign(h.c,{noamSourceVisualPackages:{},noamNativeDataUrl:()=>'/native/noam-ai.json',noamLoadSourcePanels:(_:any,s:any)=>s,fetch:(url:string)=>url.endsWith('.json')?json.promise:svg.promise});h.c.selectedExercise.nativeFigureUrl='/native/figures/q3.svg';h.load('noamLoadSourceVisual');h.c.noamQuestionAnalysis=(_:any,__:any,op:any)=>h.c.noamLoadSourceVisual(h.c.selectedExercise,op);h.c.askNoam('hint','x');await h.advance(0);
  const key=Object.keys(h.c.noamSourceVisualPackages)[0];assert.ok(key);await h.advance(25000);assert.equal(h.c.noamSourceVisualPackages[key],undefined);const replacement={data:{fresh:true}};h.c.noamSourceVisualPackages[key]=replacement;
  json.resolve({ok:false});svg.resolve({ok:false});await h.advance(0);assert.equal(h.c.noamSourceVisualPackages[key],replacement);assert.equal(h.requests.length,0);
 });
 it(label+': expired PDF document cannot replace a new load and a fresh request can recover',async()=>{
  const h=setup(source),old=deferred(),next=deferred();let loads=0;Object.assign(h.c,{pdfDocument:null,pdfCropLoadPromise:null,PDFJS_BASE:'/pdf/',pdfUrl:'/worksheet.pdf',pdfJsGetDocumentOptions:(x:any)=>x,fetch:async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(1)})});
  h.c.window.pdfjsLib={GlobalWorkerOptions:{},getDocument:()=>({promise:++loads===1?old.promise:next.promise})};h.load('ensurePdfDocumentForCrop');h.c.noamQuestionAnalysis=(_:any,__:any,op:any)=>h.c.ensurePdfDocumentForCrop(op).then(()=>({readable:true}));
  h.c.askNoam('hint','old');await h.advance(0);assert.equal(loads,1);await h.advance(25000);assert.equal(h.c.pdfCropLoadPromise,null);h.c.askNoam('hint','new');await h.advance(0);const replacement=h.c.pdfCropLoadPromise;assert.equal(loads,2);
  old.resolve({old:true});await h.advance(0);assert.equal(h.c.pdfDocument,null);assert.equal(h.c.pdfCropLoadPromise,replacement);assert.equal(h.c.busy,true);
  const doc={fresh:true};next.resolve(doc);await h.advance(0);assert.equal(h.c.pdfDocument,doc);assert.equal(h.c.busy,false);assert.equal(h.requests.length,1);
 });
 it(label+': late PDF render is cancelled and cannot repopulate the crop cache',async()=>{
  const h=setup(source),render=deferred();let cancelled=0;const create=h.c.document.createElement.bind(h.c.document);h.c.document.createElement=(name:string)=>name==='canvas'?{getContext:()=>({fillRect(){}})}:create(name);
  Object.assign(h.c,{cachedCropPage:()=>null,cropPageCache:[],mobileLayout:null,CROP_PAGE_CACHE_LIMIT:2,pdfDocument:{getPage:async()=>({getViewport:()=>({width:100,height:100}),render:()=>({promise:render.promise,cancel:()=>cancelled++})})}});h.load('renderCropPageCanvas');h.c.noamQuestionAnalysis=(_:any,__:any,op:any)=>h.c.renderCropPageCanvas(2,2,op);h.c.askNoam('hint','x');await h.advance(0);await h.advance(25000);assert.equal(cancelled,1);render.resolve();await h.advance(0);assert.equal(h.c.cropPageCache.length,0);assert.equal(h.requests.length,0);
 });
 it(label+': analyzer REQUEST_TIMEOUT is not retried and late analysis cannot populate either cache',async()=>{
  for(const mode of ['timeout','late']){
   const h=setup(source),reply=deferred();let calls=0;Object.assign(h.c,{noamManifestOcrUnreliable:()=>false,syntheticAnalysis:()=>({}),noamExerciseNeedsLiveVision:()=>true,ensurePdfDocumentForCrop:async()=>null,noamRebuildSelectedPartExpression:async()=>null,cropExerciseImage:async()=> 'data:image/png;base64,QUJD',noamScopedExerciseSemantic:()=>'',postJson:()=>{calls++;return mode==='late'?reply.promise:Promise.reject(Object.assign(new Error('request timeout'),{code:'REQUEST_TIMEOUT'}));}});h.load('getExerciseAnalysis');h.c.noamQuestionAnalysis=h.c.getExerciseAnalysis;h.c.askNoam('hint','x');await h.advance(0);
   if(mode==='late'){await h.advance(25000);reply.resolve({ok:true,analysis:{readable:true,transcription:'late'}});await h.advance(0);}assert.equal(calls,1);assert.equal(Object.keys(h.c.analysisCache).length,0);assert.equal(h.c.busy,false);
   assert.equal(h.thread().messages.at(-1).answerErrorCode,mode==='late'?'HINT_REQUEST_TIMEOUT':'REQUEST_TIMEOUT');
  }
 });
 it(label+': a15s first-load latency still completes normally and clears the deadline',async()=>{
  const h=setup(source),analysis=deferred();h.c.noamQuestionAnalysis=()=>analysis.promise;h.c.askNoam('hint','x');await h.advance(15000);analysis.resolve({readable:true});await h.advance(0);assert.equal(h.c.busy,false);assert.equal(h.thread().hintIndex,1);assert.equal(h.timers.size,0);await h.advance(25000);assert.equal(h.thread().messages.filter((m:any)=>m.answerError).length,0);
 });
}
