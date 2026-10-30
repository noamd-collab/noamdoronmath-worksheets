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
 load('noamSourceText','noamPrintedText','noamDeepFreeze','noamVerifiedNativeData','noamFirstSourceHint','askNoam');
 return {c,exercise,manifest,nativeBody,calls,photos,thread,counts,load,success};
}
for(const relative of ['../public/worksheet-viewer-noam.html','../../../worksheet-viewer-noam.html']){
 const source=readFileSync(new URL(relative,import.meta.url),'utf8'),label=relative.includes('public')?'public':'root';
 it(label+': real SHA-bound first congruence hint needs one source read and one protected probe, no OCR/PDF/SVG or repairs',async()=>{
  const f=setup(source);f.c.askNoam('hint',standard);await finish(f.c);
  assert.equal(f.counts.analysis,0);assert.equal(f.counts.enrich,0);assert.equal(f.counts.repairs,0);assert.equal(f.counts.visuals,0);assert.equal(f.calls.length,2);
  assert.equal(f.calls[0].url,f.manifest.nativeExportUrl);const request=f.calls[1].payload;assert.equal(request.sourceHintOnly,true);assert.equal(request.imageAnalysis,undefined);assert.equal(request.studentMessage,standard);assert.deepEqual(request.conversationHistory,[]);assert.equal(request.hasStudentAttachments,false);assert.equal(request.sourceIdentity.nativeSha256,f.manifest.nativeExportSha256);
  assert.equal(f.thread.hintIndex,1);assert.equal(f.thread.messages.at(-1).visual,null);assert.match(f.thread.messages.at(-1).text,/איזו צלע/);
 });
 it(label+': attachments, attempts, prior conversation, later hints and nongemetry never probe',async()=>{
  for(const mode of ['photo','attempt','history','later','topic','nongemetrytask','disjoint','repeat','noncorresponding']){
   const f=setup(source);let message=standard,kind='hint';if(mode==='photo')f.photos.push({name:'work.png'});if(mode==='attempt'){kind='free_question';message='קיבלתי 16. זה נכון?';}if(mode==='history')f.thread.history.push({role:'user',content:'attempt'});if(mode==='later')f.thread.hintIndex=1;if(mode==='topic')f.c.noamPageAllowsDrawingHint=()=>false;if(mode==='nongemetrytask')f.exercise.text='חשבו את הסכום.';if(mode==='disjoint')f.exercise.text='הוכיחו ש־$△AFC≅△BED$.';if(mode==='repeat')f.exercise.text='הוכיחו ש־$△ABA≅△BAD$.';if(mode==='noncorresponding')f.exercise.text='הוכיחו ש־$△ABC≅△ADB$.';
   f.c.askNoam(kind,message);await finish(f.c);assert.equal(f.calls.some(x=>x.payload?.sourceHintOnly),false,mode);assert.equal(f.calls.some(x=>x.method==='GET'),false,mode);assert.equal(f.counts.analysis,1,mode);
  }
 });
 it(label+': source unavailable/tampered, duplicate item and unsupported cue fall back explicitly to ordinary analysis',async()=>{
  for(const mode of ['unavailable','sha','duplicate','miss']){
   const f=setup(source);if(mode==='unavailable')f.c.fetch=async()=>({ok:false});if(mode==='sha')f.manifest.nativeExportSha256='0'.repeat(64);
   if(mode==='duplicate'){const data=JSON.parse(f.nativeBody);const q=data.questions.find((x:any)=>x.id==='q3');q.items.push({...q.items[1]});f.c.noamVerifiedNativeData=async()=>data;}
   if(mode==='miss')f.c.postJson=async(url:string,payload:any)=>{f.calls.push({url,payload});return payload.sourceHintOnly?{ok:true,sourceHintAvailable:false}:{ok:true,answer:'רגיל'};};
   f.c.askNoam('hint',standard);await finish(f.c);assert.equal(f.counts.analysis,1,mode);assert.equal(f.thread.messages.at(-1).answerError,undefined,mode);
  }
 });
 it(label+': a rejected protected probe and invalid provenance cannot trigger a paid fallback',async()=>{
  for(const mode of ['security','sha','visual','exerciseId','selectedPart','questionId','itemId']){
   const f=setup(source);f.c.postJson=async()=>{if(mode==='security')throw Object.assign(new Error('verify failed'),{code:'BOT_RISK_REJECTED'});const result=f.success();if(mode==='sha')result.sourceVerification.sha256='0'.repeat(64);else if(mode==='visual')result.sourceVerification.visualStatus='verified';else (result.sourceVerification as any)[mode]='other';return result;};
   f.c.askNoam('hint',standard);await finish(f.c);assert.equal(f.counts.analysis,0);assert.equal(f.thread.hintIndex,0);assert.equal(f.thread.messages.at(-1).answerError,true);
  }
 });
 it(label+': public-config preparation overlaps source work and the actual protected client still obtains a fresh token for the probe',async()=>{
  const f=setup(source),sourceReady=deferred(),http:any[]=[],tokens:string[]=[];const body=f.nativeBody;
  runInNewContext(read('noam-bot-client.js'),f.c);const original=f.c.window.NoamBotClient.create;
  f.c.window.NoamBotClient={create:(options:any)=>{f.counts.clients++;const client=original({...options,window:f.c.window,AbortController,loadRecaptcha:async()=>({ready:(cb:any)=>cb(),execute:async(_:any,opts:any)=>{tokens.push(opts.action);return 'fresh-token';}})});const prepare=client.prepare;client.prepare=()=>{f.counts.prepare++;return prepare();};return client;}};
  f.c.ensureNoamBotClient=async()=>({});f.load('noamOperationClient','noamPrepareOperationClient','postJson');
  f.c.fetch=async(url:string,options:any)=>{http.push({url,options});if(url===f.manifest.nativeExportUrl){await sourceReady.promise;return {ok:true,arrayBuffer:async()=>new TextEncoder().encode(body).buffer};}if(url.endsWith('/noamBotConfig'))return {ok:true,json:async()=>({ok:true,provider:'recaptcha-v3',siteKey:'test_site_key_long_enough',mode:'enforce'})};return {ok:true,status:200,json:async()=>f.success()};};
  assert.equal(http.length,0);f.c.askNoam('hint',standard);await drain();assert.equal(f.counts.prepare,1);assert.equal(http.filter(x=>x.url.endsWith('/noamBotConfig')).length,1);assert.equal(http.filter(x=>x.options?.method==='POST').length,0);assert.equal(tokens.length,0);
  sourceReady.resolve();await finish(f.c);const posts=http.filter(x=>x.options?.method==='POST');assert.equal(posts.length,1);assert.equal(f.counts.clients,1);assert.deepEqual(tokens,['noam_image_solve']);assert.equal(JSON.parse(posts[0].options.body).botVerification.token,'fresh-token');assert.equal(f.counts.analysis,0);
 });
 it(label+': an expired source cue cannot append to or unlock the next request',async()=>{
  const f=setup(source),old=deferred(),next=deferred();let expire:any,probeStarted=false;
  f.c.setTimeout=(cb:any,ms:number)=>{if(ms>1000&&ms<=25000){expire=cb;return 0;}return setTimeout(cb,ms);};
  f.c.postJson=async(_:string,payload:any)=>{if(payload.sourceHintOnly){probeStarted=true;return old.promise;}return next.promise;};
  f.c.askNoam('hint',standard);for(let i=0;i<100&&!probeStarted;i++)await new Promise(r=>setTimeout(r,5));assert.equal(probeStarted,true);
  expire();assert.equal(f.c.busy,false);assert.equal(f.thread.messages.at(-1).answerErrorCode,'HINT_REQUEST_TIMEOUT');
  f.c.askNoam('free_question','אפשר להסביר את הנתון?');await drain();const count=f.thread.messages.length;
  old.resolve(f.success());await drain();assert.equal(f.thread.messages.length,count);assert.equal(f.thread.hintIndex,0);assert.equal(f.c.busy,true);
  next.resolve({ok:true,answer:'הסבר'});await finish(f.c);assert.equal(f.thread.messages.at(-1).text,'הסבר');
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
 it(label+': visual loading reuses the same verified JSON bytes after the source-only probe',async()=>{
  const f=setup(source);await f.c.noamVerifiedNativeData(f.exercise);f.c.noamSourceVisualPackages={};f.c.noamLoadSourcePanels=(_:any,s:any)=>s;f.exercise.nativeFigureUrl='';f.load('noamLoadSourceVisual');await f.c.noamLoadSourceVisual(f.exercise);assert.equal(f.calls.length,1);
 });
 it(label+': exhausted transport retry is not retried again by the viewer analyzer',async()=>{
  const f=setup(source);let calls=0;Object.assign(f.c,{syntheticAnalysis:()=>({}),noamExerciseNeedsLiveVision:()=>true,ensurePdfDocumentForCrop:async()=>null,noamRebuildSelectedPartExpression:async()=>null,cropExerciseImage:async()=> 'data:image/png;base64,QUJD',postJson:async()=>{calls++;throw Object.assign(new Error('network exhausted'),{code:'NETWORK_UNAVAILABLE'});}});f.load('getExerciseAnalysis');await assert.rejects(f.c.getExerciseAnalysis(f.exercise,[]),{code:'NETWORK_UNAVAILABLE'});assert.equal(calls,1);
 });
}
