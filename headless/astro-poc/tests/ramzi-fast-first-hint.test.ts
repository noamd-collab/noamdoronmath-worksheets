import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import { runInNewContext } from 'node:vm';
import { it } from 'node:test';
import { parseHTML } from 'linkedom';
const pub=new URL('../public/',import.meta.url),read=(p:string)=>readFileSync(new URL(p,pub),'utf8');
const standard='תן לי רמז אחד בלבד. אל תגלה את התשובה הסופית, ואל תבצע את הצעד במקומי.';
function fn(s:string,n:string){const a=s.indexOf('function '+n+'(');assert.ok(a>=0,n);const b=s.indexOf('\nfunction ',a+1);return s.slice(a,b<0?undefined:b);}
function deferred(){let resolve:any;const promise=new Promise<any>(r=>resolve=r);return {promise,resolve};}
async function drain(){for(let i=0;i<50;i++)await Promise.resolve();}
async function finish(c:any){const until=Date.now()+3000;while(c.busy&&Date.now()<until)await new Promise(r=>setTimeout(r,5));assert.equal(c.busy,false);}
function setup(source:string){
 const manifest=JSON.parse(read('noam-ai/manifests/e020549ff713406fb0c0f07443b09b18.json'));
 const exercise=manifest.exercises.find((e:any)=>e.nativeItemId==='q3b'),nativeBody=read(manifest.nativeExportUrl.slice(1));
 const {document,window}=parseHTML('<html><body></body></html>');Object.defineProperty(window,'crypto',{value:webcrypto,configurable:true});
 const calls:any[]=[],photos:any[]=[],thread={messages:[] as any[],history:[] as any[],hintIndex:0},counts={analysis:0,enrich:0,prepare:0,clients:0,repairs:0,visuals:0};
 const c:any={document,window,AbortController,Promise,Map,WeakMap,WeakSet,TextDecoder,Uint8Array,Date,setTimeout,clearTimeout,
  manifest,pdf:manifest.pdf||'e020549ff713406fb0c0f07443b09b18',selectedExercise:exercise,panelBody:document.body,busy:false,noamDrafts:{},MIN_WAIT:0,API:'/api',TIMEOUT:20000,BOT_GUARD_ENABLED:true,g:9,lv:'c',LEVEL:{c:'מצוינות'},ttl:'טרפז',
  exerciseThread:()=>thread,saveNoamState(){},renderNoamChat(){},announceNoam(){},restoreNoamChatFocus(){},exerciseLabel:()=> '3ב',setNoamBusy:(v:boolean)=>c.busy=v,currentAttachments:()=>photos.slice(),clearNoamAttachments:()=>photos.splice(0),
  noamDidacticGuide:()=>null,noamDidacticPrompt:()=>'',noamDidacticResponse:()=>null,noamNativeDataUrl:()=>manifest.nativeExportUrl,
  noamQuestionAnalysis:async()=>{counts.analysis++;return {readable:true,transcription:'OCR'};},noamEnrichSourceAnalysis:(_:any,a:any)=>{counts.enrich++;return a;},noamSolverMessage:(s:string)=>s,
  noamGuardGeometryResult:(r:any)=>{counts.repairs++;return r;},noamGuardSignedAddResult:(r:any)=>r,noamClarifySignedAddLanguage:(s:string)=>s,noamResponseVisual:()=>{counts.visuals++;return null;},noamVisualAnswer:(_:any,s:string)=>s,noamAttachSourceHint(){counts.visuals++;},
  noamPageAllowsDrawingHint:()=>true,noamManifestOcrUnreliable:()=>false,isBotProtectionError:(e:any)=>/^BOT_/.test(e?.code||''),noamVerifiedNativePackages:new Map(),analysisCache:{},console:{warn(){}}};
 function success(){return {ok:true,sourceHintAvailable:true,answer:'איזו צלע מופיעה בשני המשולשים?',sourceVerification:{status:'verified',sha256:manifest.nativeExportSha256,visualStatus:'unverified',verificationScope:'printed_text',exerciseId:exercise.id,selectedPart:exercise.part,questionId:exercise.nativeQuestionId,itemId:exercise.nativeItemId}};}
 c.postJson=async(url:string,payload:any)=>{calls.push({url,payload:JSON.parse(JSON.stringify(payload))});return payload.sourceHintOnly?success():{ok:true,answer:'רמז רגיל'};};
 c.fetch=async(url:string)=>{calls.push({url,method:'GET'});assert.equal(url,manifest.nativeExportUrl);return {ok:true,arrayBuffer:async()=>new TextEncoder().encode(nativeBody).buffer};};
 const load=(...names:string[])=>runInNewContext(names.map(n=>fn(source,n)).join('\n'),c);
 load('noamSourceText','noamPrintedText','noamDeepFreeze','noamVerifiedNativeData','noamPreparedHint','askNoam');
 return {c,exercise,manifest,nativeBody,calls,photos,thread,counts,load,success};
}
for(const relative of ['../public/worksheet-viewer-noam.html','../../../worksheet-viewer-noam.html']){
 const source=readFileSync(new URL(relative,import.meta.url),'utf8'),label=relative.includes('public')?'public':'root';
 it(label+': all three standard hints use one source-bound catalog set, no OCR, model, repair, drawing or artificial wait',async()=>{
  const f=setup(source),ladder=['מאגר ראשון','מאגר שני','מאגר שלישי'];let reads=0,prepares=0;
  f.c.window.NoamCuratedHints={prefetch:async()=>{reads++;return 1;},get:()=>({hints:ladder,revision:'same-revision'})};
  f.c.noamPrepareOperationClient=()=>{prepares++;return Promise.resolve();};f.c.ensureNoamBotClient=async()=>({});f.c.MIN_WAIT=999999;
  f.c.noamDidacticResponse=()=>{throw new Error('standard hints must bypass authored guides');};
  f.photos.push({name:'student-work.png'});f.thread.history.push({role:'user',content:'prior attempt'});
  for(let i=0;i<3;i++){f.c.askNoam('hint',standard);await drain();assert.equal(f.c.busy,false);assert.equal(f.thread.hintIndex,i+1);assert.equal(f.thread.messages.at(-1).text,ladder[i]);assert.equal(f.thread.messages.at(-1).preparedHintIndex,i);}
  assert.equal(reads,3,'each request awaits the loader; loader itself deduplicates');assert.equal(prepares,0);assert.equal(f.calls.length,0);assert.equal(f.counts.analysis,0);assert.equal(f.counts.enrich,0);assert.equal(f.counts.repairs,0);assert.equal(f.counts.visuals,0);assert.equal(f.photos.length,1);assert.equal(f.thread.history[0].content,'prior attempt');
 });
 it(label+': missing, incomplete, changed or rejected prepared hints never fall back to Flash and retain exact progress',async()=>{
  for(const mode of ['missing','incomplete','rejected','changed']){
   const f=setup(source);f.thread.hintIndex=1;f.thread.preparedHintRevision='old';
   f.c.window.NoamCuratedHints={prefetch:async()=>{if(mode==='rejected')throw new Error('offline');return 0;},get:()=>mode==='missing'?null:{hints:mode==='incomplete'?['one']:['one','two','three'],revision:'new'}};
   f.c.askNoam('hint',standard);await drain();assert.equal(f.c.busy,false,mode);assert.equal(f.thread.hintIndex,1,mode);assert.equal(f.thread.messages.at(-1).answerError,true,mode);assert.equal(f.calls.length,0,mode);assert.equal(f.counts.analysis,0,mode);
  }
 });
 it(label+': failed second and third hint retries keep the exact failed index and preserve student photos',async()=>{
  for(const index of [1,2]){
   const f=setup(source);let ready=false,invalidations=0;const ladder=['one','two','three'];
   f.thread.hintIndex=index;f.thread.preparedHintRevision='same';f.photos.push({name:'work.png'});
   f.c.window.NoamCuratedHints={prefetch:async()=>1,get:()=>ready?{hints:ladder,revision:'same'}:null,invalidate:()=>{invalidations++;ready=true;}};
   f.c.clearExerciseVisionCache=()=>{throw new Error('prepared retry must not touch OCR');};f.load('retryLastNoamHelp');
   f.c.askNoam('hint',standard);await drain();assert.equal(f.thread.hintIndex,index);f.c.retryLastNoamHelp();await drain();
   assert.equal(f.thread.hintIndex,index+1);assert.equal(f.thread.messages.at(-1).text,ladder[index]);assert.equal(f.thread.messages.length,2);assert.equal(invalidations,1);assert.equal(f.photos.length,1);assert.equal(f.calls.length,0);
  }
 });
 it(label+': expired prepared read cannot append to or unlock a newer freeform operation',async()=>{
  const f=setup(source),pending=deferred(),next=deferred();let expire:any;
  f.c.setTimeout=(cb:any,ms:number)=>{if(ms>=55000){expire=cb;return 0;}return setTimeout(cb,ms);};
  f.c.window.NoamCuratedHints={prefetch:()=>pending.promise,get:()=>({hints:['one','two','three'],revision:'same'})};
  f.c.askNoam('hint',standard);await drain();expire();assert.equal(f.c.busy,false);assert.equal(f.thread.messages.at(-1).answerErrorCode,'HINT_REQUEST_TIMEOUT');
  f.c.noamQuestionAnalysis=()=>next.promise;f.c.askNoam('free_question','אפשר להסביר את הנתון?');await drain();const count=f.thread.messages.length;
  pending.resolve(1);await drain();assert.equal(f.thread.messages.length,count);assert.equal(f.thread.hintIndex,0);assert.equal(f.c.busy,true);
  next.resolve({readable:true});await finish(f.c);assert.equal(f.thread.messages.at(-1).text,'רמז רגיל');assert.equal(f.thread.hintIndex,0);
 });
 it(label+': manifest changes while catalog loads are rejected and cannot advance the hint',async()=>{
  const f=setup(source),pending=deferred();f.c.window.NoamCuratedHints={prefetch:()=>pending.promise,get:()=>({hints:['one','two','three'],revision:'same'})};
  f.c.askNoam('hint',standard);f.c.manifest={...f.manifest,nativeExportSha256:'0'.repeat(64)};pending.resolve(1);await drain();assert.equal(f.thread.hintIndex,0);assert.equal(f.thread.messages.at(-1).answerError,true);assert.equal(f.calls.length,0);
 });
 it(label+': additional student questions retain source preparation and the protected Flash request',async()=>{
  const f=setup(source);f.c.window.NoamCuratedHints={prefetch:()=>{throw new Error('freeform never requests a standard hint');}};f.photos.push({name:'work.png'});
  f.c.askNoam('free_question','האם הצעד שלי נכון?');await finish(f.c);assert.equal(f.counts.analysis,1);assert.equal(f.calls.length,1);assert.equal(f.calls[0].payload.helpKind,'free_question');assert.equal(f.calls[0].payload.hasStudentAttachments,true);assert.equal(f.calls[0].payload.sourceHintOnly,undefined);assert.equal(f.photos.length,0);assert.equal(f.thread.hintIndex,0);
 });
 it(label+': a successful catalog miss offers an additional question without retrying or sending any request',async()=>{
  const f=setup(source);let invalidated=0,focused=0;
  f.c.window.NoamCuratedHints={prefetch:async()=>0,get:()=>null,status:()=> 'missing',invalidate:()=>invalidated++};
  f.c.askNoam('hint',standard);await drain();const error=f.thread.messages.at(-1);assert.equal(error.answerErrorCode,'PREPARED_HINT_MISSING');assert.match(error.text,/שאלה נוספת/);assert.doesNotMatch(error.text,/לנסות שוב/);
  const input=f.c.document.createElement('textarea');input.id='noamQuestion';input.focus=()=>focused++;f.c.document.body.appendChild(input);
  f.c.noamStripMarkdownEmphasis=(x:string)=>x;f.c.noamCanOfferDrawing=()=>false;f.load('addTranscriptBubble','noamRetryActionLabel');
  const row=f.c.addTranscriptBubble(f.c.document.body,'assistant',error.text,'',null,error,f.thread),button=row.querySelector('button');assert.equal(button.textContent,'כתבו שאלה נוספת');button.click();
  assert.equal(focused,1);assert.equal(invalidated,0);assert.equal(f.calls.length,0);assert.equal(f.counts.analysis,0);assert.equal(f.thread.hintIndex,0);
 });
 it(label+': extra questions never use unbound authored-guide answers, goals or repair prompts',async()=>{
  for(const id of ['G9-T39-E-Q03ב','G9-T20-E-Q06א','G9-T15-E-Q04א','G9-T15-E-Q04ב']){
   const f=setup(source);f.exercise.id=id;let oldGuideReads=0;
   const stale={goal:'MN parallel AC',nextStep:'old false goal',modelPrompt:'old false source'};
   f.c.noamDidacticGuide=()=>{oldGuideReads++;return stale;};f.c.noamDidacticPrompt=()=>{oldGuideReads++;return stale.modelPrompt;};f.c.noamDidacticResponse=()=>{oldGuideReads++;return {text:stale.nextStep};};
   f.c.noamSolverMessage=(message:string,_thread:any,_topic:any,prompt:string)=>{assert.equal(prompt,'');return message;};
   f.c.noamGuardGeometryResult=(result:any,_payload:any,_analysis:any,_message:any,guide:any,prompt:string)=>{assert.equal(guide,null);assert.equal(prompt,'');return result;};
   f.c.askNoam('free_question','לא הבנתי את הנתון שבסעיף הנוכחי');await finish(f.c);
   assert.equal(oldGuideReads,0,id);assert.equal(f.counts.analysis,1,id);assert.equal(f.calls.length,1,id);assert.equal(f.calls[0].payload.helpKind,'free_question');assert.equal(f.thread.messages.at(-1).text,'רמז רגיל');assert.doesNotMatch(JSON.stringify(f.calls),/old false|MN parallel/);
  }
 });
 it(label+': a warm image or manifest cache cannot replace canonical source priority',async()=>{
  const f=setup(source);f.load('noamQuestionAnalysis');let sourceReads=0,imageReads=0;
  const cached={readable:true,transcription:'conflicting old OCR'},canonical={readable:true,transcription:'verified printed source'};
  f.c.analysisCache[f.exercise.id]=cached;
  f.c.noamCanonicalSourceAnalysis=async()=>{sourceReads++;return canonical;};
  f.c.getExerciseAnalysis=async()=>{imageReads++;return cached;};
  assert.equal(await f.c.noamQuestionAnalysis(f.exercise,[]),canonical);assert.equal(sourceReads,1);assert.equal(imageReads,0);
  f.c.noamCanonicalSourceAnalysis=async()=>{sourceReads++;return null;};
  assert.equal(await f.c.noamQuestionAnalysis(f.exercise,[]),cached);assert.equal(sourceReads,2);assert.equal(imageReads,1);
 });
 it(label+': visual loading reuses already verified native JSON bytes',async()=>{
  const f=setup(source);await f.c.noamVerifiedNativeData(f.exercise);f.c.noamSourceVisualPackages={};f.c.noamLoadSourcePanels=(_:any,s:any)=>s;f.exercise.nativeFigureUrl='';f.load('noamLoadSourceVisual');await f.c.noamLoadSourceVisual(f.exercise);assert.equal(f.calls.length,1);
 });
 it(label+': exhausted transport retry is not retried again by the viewer analyzer',async()=>{
  const f=setup(source);let calls=0;Object.assign(f.c,{syntheticAnalysis:()=>({}),noamExerciseNeedsLiveVision:()=>true,ensurePdfDocumentForCrop:async()=>null,noamRebuildSelectedPartExpression:async()=>null,cropExerciseImage:async()=> 'data:image/png;base64,QUJD',postJson:async()=>{calls++;throw Object.assign(new Error('network exhausted'),{code:'NETWORK_UNAVAILABLE'});}});f.load('getExerciseAnalysis');await assert.rejects(f.c.getExerciseAnalysis(f.exercise,[]),{code:'NETWORK_UNAVAILABLE'});assert.equal(calls,1);
 });
}
