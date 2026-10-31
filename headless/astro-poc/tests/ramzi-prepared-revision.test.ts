import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { it } from 'node:test';
import { parseHTML } from 'linkedom';

const id='G7-T01-B-Q20ב',pdf='a'.repeat(32),native='b'.repeat(64);
const oldHints=['כיוון ישן','דרך ישנה','צעד ישן'],newHints=['כיוון מעודכן','דרך מעודכנת','צעד מעודכן'];
function fn(source:string,name:string){const start=source.indexOf('function '+name+'(');assert.ok(start>=0,name);return source.slice(start,source.indexOf('\nfunction ',start+1));}
async function drain(){for(let i=0;i<50;i++)await Promise.resolve();}
function savedThread(){
 const messages:any[]=[],history:any[]=[];
 oldHints.forEach((text,index)=>{messages.push({role:'user',text:'אפשר רמז '+(index+1)+'?',kind:'רמז '+(index+1)},{role:'assistant',text,preparedHint:true,preparedHintIndex:index});history.push({role:'user',content:'רמז '+(index+1)},{role:'assistant',content:text});});
 messages.push({role:'user',text:'האם הצעד שלי מתאים?',kind:''},{role:'assistant',text:'השוו לנתון שבשאלה.',kind:''});
 history.push({role:'user',content:'האם הצעד שלי מתאים?'},{role:'assistant',content:'השוו לנתון שבשאלה.'});
 return {hintIndex:3,preparedHintRevision:JSON.stringify([pdf+':'+native,id,oldHints]),messages,history};
}
function setup(source:string,options:any={}){
 const exercise={id,q:20,part:'ב'},manifest={prefix:'G7-T01',levelCode:'B',pdfHash:pdf,nativeExportSha256:native,exercises:[exercise]};
 // A browser reload restores this JSON before the fresh catalog request.
 const thread=JSON.parse(JSON.stringify(options.thread||savedThread())),storage:any={},calls:string[]=[],button={disabled:true};let rendered=0;
 const c:any={Promise,AbortController,setTimeout,clearTimeout,Date,manifest:null,manifestReady:false,aiReady:true,busy:false,threads:{[id]:thread},selectedExercise:exercise,pendingExerciseId:null,
  analysisCache:{},THREAD_STORAGE_KEY:'threads',ANALYSIS_STORAGE_KEY:'analysis',MANIFEST_PATH:'/manifest',noamDrafts:{[id]:'טיוטה שנשמרת'},photos:[{name:'student-work.png'}],
  NOAM_LEARNING_CONFIG:{url:'https://example123.supabase.co',key:'sb_publishable_fixture'},
  sessionStorage:{setItem:(key:string,value:string)=>storage[key]=value},fab:{classList:{add(){},remove(){}}},renderManifestPins(){},
  document:{getElementById:(name:string)=>name==='noamHint'?button:null},panelBody:{querySelectorAll:()=>[]},console:{warn(){}},
  fetch:async(url:string)=>{calls.push(url);if(url==='/manifest')return {ok:true,json:async()=>manifest};assert.match(url,/\/rest\/v1\/noam_ramzi_hints\?/);if(options.offline)throw Error('offline');const hints=options.hints||newHints;return {ok:true,json:async()=>options.missing?[]:[{exercise_id:id,hint_1:hints[0],hint_2:hints[1],hint_3:hints[2],source_pdf_hash:options.staleSource?'c'.repeat(32):pdf,source_native_sha256:native}]};},
  renderNoamChat(){rendered++;c.setNoamBusy(false);}};
 c.window=c;runInNewContext(readFileSync(new URL('../public/noam-curated-hints.js',import.meta.url),'utf8'),c);
 runInNewContext(['exerciseThread','saveNoamState','noamReconcilePreparedHints','loadStaticManifest','setNoamBusy','noamPreparedHint'].map(name=>fn(source,name)).join('\n'),c);
 return {c,thread,manifest,exercise,storage,calls,button,rendered:()=>rendered};
}
for(const [label,relative] of [['public','../public/worksheet-viewer-noam.html'],['root','../../../worksheet-viewer-noam.html']]){
 const source=readFileSync(new URL(relative,import.meta.url),'utf8');
 it(label+': fresh source-bound catalog clears stale saved hints and reenables the exhausted button without losing additional conversation',async()=>{
  const f=setup(source),draft=f.c.noamDrafts[id],photo=f.c.photos[0];await f.c.loadStaticManifest();await drain();
  assert.equal(f.thread.hintIndex,0);assert.equal(f.button.disabled,false);assert.equal(f.thread.preparedHintRevision,undefined);
  assert.deepEqual(JSON.parse(JSON.stringify(f.thread.messages)),savedThread().messages.slice(-2));assert.deepEqual(JSON.parse(JSON.stringify(f.thread.history)),savedThread().history.slice(-2));
  assert.equal(f.c.noamDrafts[id],draft);assert.equal(f.c.photos[0],photo);assert.equal(f.rendered(),1);assert.equal(JSON.parse(f.storage.threads)[id].hintIndex,0);
  const reply=await f.c.noamPreparedHint(f.exercise,f.thread,0,{check(){}});assert.equal(reply.answer,newHints[0]);assert.equal(f.calls.length,2,'one manifest GET and one catalog GET; no provider or OCR');
 });
 it(label+': unchanged catalog revision preserves saved messages, progress and history byte-for-byte',async()=>{
  const f=setup(source,{hints:oldHints}),before=JSON.stringify(f.thread);await f.c.loadStaticManifest();await drain();assert.equal(JSON.stringify(f.thread),before);assert.equal(f.rendered(),0);assert.equal(f.thread.hintIndex,3);
 });
 it(label+': unavailable catalog cannot discard history, but a confirmed withdrawn or stale-source row cannot keep old hints active',async()=>{
  const offline=setup(source,{offline:true}),before=JSON.stringify(offline.thread);await offline.c.loadStaticManifest();await drain();assert.equal(JSON.stringify(offline.thread),before);
  for(const options of [{missing:true},{staleSource:true}]){const f=setup(source,options);await f.c.loadStaticManifest();await drain();assert.equal(f.thread.hintIndex,0);assert.equal(f.thread.messages.length,2);assert.equal(f.c.NoamCuratedHints.get(f.manifest,id),null);}
 });
 it(label+': active operations and stale manifest callbacks cannot modify a replacement thread',async()=>{
  const f=setup(source);f.c.busy=true;await f.c.loadStaticManifest();await drain();assert.equal(f.thread.hintIndex,3);assert.equal(f.rendered(),0);
  f.c.busy=false;assert.equal(f.c.noamReconcilePreparedHints({...f.manifest},f.exercise,f.thread),false);assert.equal(f.thread.hintIndex,3);
  assert.equal(f.c.noamReconcilePreparedHints(f.manifest,f.exercise,f.thread),true);assert.equal(f.thread.hintIndex,0);assert.equal(f.c.noamReconcilePreparedHints(f.manifest,f.exercise,f.thread),false);
  assert.match(fn(source,'renderNoamChat'),/noamReconcilePreparedHints\(manifest,selectedExercise,thread\)/,'render rechecks after busy ends and when another saved part opens');
 });
 it(label+': sliced legacy hint history is cleared while a freeform turn with similar text is preserved',async()=>{
  const thread=savedThread();thread.messages=thread.messages.slice(-2);thread.history=[{role:'assistant',content:oldHints[2]},{role:'user',content:'רמז 1'},{role:'assistant',content:'זו שאלה נוספת ולא רמז מוכן.'}];
  const f=setup(source,{thread});await f.c.loadStaticManifest();await drain();assert.equal(f.thread.history.length,2);assert.equal(f.thread.history[0].content,'רמז 1');assert.equal(f.thread.history[1].content,'זו שאלה נוספת ולא רמז מוכן.');
 });
 it(label+': the actual three button clicks render the reported number-line hint as text with no drawing or provider call',async()=>{
  const third='המספר האחר נמצא באותו מרחק מהאפס אך בצד השני; כיצד מסמנים אותו על הישר?';
  const f=setup(source,{thread:{hintIndex:0,messages:[],history:[]},hints:[newHints[0],newHints[1],third]});
  const {document,window}=parseHTML('<html><body></body></html>');
  Object.assign(f.c,{document,Event:window.Event,panelBody:document.body,panelBack:{hidden:false},mathKeyboardOpen:false,activeGlossaryEntryId:null,
   noamPageAllowsDrawingHint:()=>false,esc:(value:any)=>String(value||''),exerciseLabel:()=> 'שאלה 20 · סעיף ב',hideNoamGlossaryPopover(){},renderNoamAttachments(){},renderPanelMath(){},renderNoamFractionMarkers(){},enhanceNoamGlossary(){},renderExercisePreview(){},restoreNoamChatFocus(){},locateSelectedExercise(){},announceNoam(){},
   currentAttachments:()=>f.c.photos,MIN_WAIT:0,g:7,lv:'b',LEVEL:{b:'רמה ב'},ttl:'מספרים מכוונים',
   noamQuestionAnalysis:()=>{throw Error('No provider/OCR for prepared hints');},noamStripMarkdownEmphasis:(value:string)=>value,
   isBotProtectionError:()=>false,noamDiagramRuntime:()=>({messages:new Map()})});
  runInNewContext(['noamCanOfferDrawing','noamLatestDrawingAnswer','addTranscriptBubble','renderNoamChat','askNoam'].map(name=>fn(source,name)).join('\n'),f.c);
  await f.c.loadStaticManifest();await drain();f.c.renderNoamChat();
  for(let index=0;index<3;index++){
   const button=document.getElementById('noamHint') as any;assert.equal(button.disabled,false);button.click();await drain();assert.equal(f.c.busy,false);assert.equal(f.thread.hintIndex,index+1);assert.equal(f.thread.messages.at(-1).preparedHintIndex,index);
  }
  assert.match(document.getElementById('noamTranscript')!.textContent!,/המספר האחר נמצא באותו מרחק מהאפס אך בצד השני/);
  assert.equal((document.getElementById('noamHint') as any).disabled,true);assert.equal(document.getElementById('noamDraw')!.hidden,true);assert.equal(document.querySelectorAll('.noam-draw-action').length,0);assert.equal(f.calls.length,2);
 });
 it(label+': glossary flips above the word before covering hint controls, retains its explanation action and scrolls within short viewports',()=>{
  for(const [viewportWidth,viewportHeight,composeTop,wordTop,popoverHeight] of [[1280,800,412,340,166],[390,600,320,290,166],[390,330,180,140,240]]){
   const {document}=parseHTML('<html><body><section><span id="term">אפס</span><div class="noam-compose"><button id="noamHint">רמז שלישי</button></div></section><div id="popover"><button id="more">להסבר המלא</button></div></body></html>');
   const panelBody=document.querySelector('section')!,trigger=document.getElementById('term')!,popover=document.getElementById('popover')!,compose=document.querySelector('.noam-compose')!;
   Object.defineProperty(document.documentElement,'clientWidth',{value:viewportWidth});Object.defineProperty(popover,'offsetWidth',{value:280});Object.defineProperty(popover,'offsetHeight',{value:popoverHeight});
   trigger.getBoundingClientRect=()=>({top:wordTop,bottom:wordTop+16,left:200,width:30} as any);compose.getBoundingClientRect=()=>({top:composeTop,height:100} as any);popover.hidden=false;
   let clicked=0;document.getElementById('more')!.addEventListener('click',()=>clicked++);
   const c={document,panelBody,window:{innerHeight:viewportHeight},noamGlossaryPopover:popover};runInNewContext(fn(source,'positionNoamGlossaryPopover'),c);(c as any).positionNoamGlossaryPopover(trigger);
   const top=parseFloat(popover.style.top),height=Math.min(popoverHeight,parseFloat(popover.style.maxHeight));assert.ok(top+height<=composeTop-8);assert.ok(top>=10);assert.equal(popover.style.overflowY,'auto');assert.notEqual(popover.style.pointerEvents,'none');document.getElementById('more')!.click();assert.equal(clicked,1);
  }
 });
}
