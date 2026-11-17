import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash,webcrypto} from 'node:crypto';
import {runInNewContext,Script} from 'node:vm';
import {test} from 'node:test';
import {parseHTML} from 'linkedom';
// Synthetic in-memory source only. No publication claims and no live transport.
const native={package:'G8-T87',level:'c',questions:[{id:'q1',label:1,text:'התבוננו בשלושת הגופים.',example:{title:'תזכורת',lines:['היעזרו בנתונים המודפסים.']},table:{head:['גוף','גובה'],rows:[['ראשון','$___$'],['שני','$6$']]},items:[{id:'q1a',label:'א',text:'חשבו את נפח הגוף הראשון.'},{id:'q1b',label:'ב',text:'השוו בין הגופים.',table:{head:['גוף','נפח'],rows:[['ראשון','?']]}}],solution:'PRIVATE_QUESTION',given:[{answer:'PRIVATE_GIVEN'}],to_prove:'PRIVATE_TARGET'}],figures:[1,2,3].map(n=>({id:'q1_head'+(n===1?'':'_'+n),question:'q1',svg:'figures/q1_head'+(n===1?'':'_'+n)+'.svg'}))};
const body=JSON.stringify(native),hash=createHash('sha256').update(body).digest('hex');
const manifest={geometryContract:'measured-v1',prefix:'G8-T87',level:'c',nativeExportUrl:'/noam-ai/native/G8-T87/c/noam-ai.json',nativeExportSha256:hash};
const exercise={id:'ms-g8-con-01-c-r1.q01.a',q:1,part:'א',nativeLevel:'c',nativeQuestionId:'q1',nativeItemId:'q1a',nativeFigures:native.figures.map(f=>({id:f.id,url:'/noam-ai/native/G8-T87/c/'+f.svg}))};
const clone=(v:any)=>JSON.parse(JSON.stringify(v));
function fn(html:string,name:string){const at=html.indexOf('function '+name+'(');assert(at>=0,name);const tail=html.slice(at),end=tail.match(/\n(?:  )?function \w+\(/);return tail.slice(0,end?.index??tail.length);}
function setup(html:string,variant:string){
 const {document,window}=parseHTML('<html><body><main id="panel"><div class="noam-picked"><div id="noamNativeQuestion" hidden></div><div id="noamPickedText">READABLE_FALLBACK</div></div><div id="noamTranscript"></div></main></body></html>');
 Object.defineProperty(window,'crypto',{value:webcrypto});const thread:any={messages:[],hintIndex:0,history:[]};
 const c:any={document,window,Promise,Map,Set,Uint8Array,TextDecoder,console,manifestReady:true,manifest:clone(manifest),selectedExercise:clone(exercise),busy:false,pendingCheckFocus:false,panelBody:document.getElementById('panel'),noamVerifiedNativePackages:new Map(),noamNativeFocusUrl:()=>null,
 esc:(v:any)=>String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'),exerciseLabel:(e:any)=>'שאלה '+e.q+' סעיף '+e.part,exerciseThread:()=>thread,
 renderPanelMath(){},saveNoamState(){c.saved++},renderNoamChat(){c.renders++},announceNoam:(s:string)=>c.announcements.push(s),askNoam:(kind:string,message:string)=>c.requests.push({kind,message}),saved:0,renders:0,requests:[],announcements:[],
 fetch:async()=>({ok:true,arrayBuffer:async()=>new TextEncoder().encode(body).buffer}),cropExerciseCanvas:async(e:any,opts:any)=>{c.crops.push({e,opts});return {toDataURL:()=> 'data:image/png;base64,QUJD'};},crops:[]};
 if(variant==='public')runInNewContext(['equationCoreQualifies','trimEquationEdges','wrapEquations','noamFractionHtml','escAttr'].map(n=>fn(html,n)).join('\n'),c);
 const block=html.split('// BEGIN MEASURED QUESTION CARD')[1].split('// END MEASURED QUESTION CARD')[0].replace(/^[^\n]*/,'');
 runInNewContext(['noamEditionQuestionHtml','noamNativeDataUrl','noamPrintedText','noamDeepFreeze','noamVerifiedNativeData'].map(n=>fn(html,n)).join('\n')+'\n'+block,c);
 if(variant==='public'&&c.noamInstallMeasuredFeedbackBridge)c.noamInstallMeasuredFeedbackBridge();
 if(variant==='public')runInNewContext(['makeCheckGroup','placeUnderstandingChecks','submitUnderstanding'].map(n=>fn(html,n)).join('\n'),c);
 function pair(){
  const transcript=document.getElementById('noamTranscript')!;transcript.querySelectorAll('.noam-row').forEach((n:any)=>n.remove());
  for(const m of thread.messages){const row=document.createElement('div');row.className='noam-row '+m.role;const bubble=document.createElement('div');bubble.className='noam-bubble';bubble.textContent=m.text;row.appendChild(bubble);transcript.appendChild(row);}
  if(variant==='public')c.placeUnderstandingChecks(transcript);else c.noamAppendUnderstandingCheck(thread);
  return Array.from(document.querySelectorAll(variant==='public'?'.ramzi-check button':'.noam-understanding-check button')) as any[];
 }
 function choose(button:any,yes:boolean){if(variant==='public')c.submitUnderstanding(yes?'understood':'not-understood',button);else button.click();}
 return {c,thread,document,pair,choose};
}
for(const [variant,path] of [['public','../public/worksheet-viewer-noam.html'],['root','../../../worksheet-viewer-noam.html']]){
 const html=readFileSync(new URL(path,import.meta.url),'utf8');
 test(variant+': production-only wiring and all inline scripts parse',()=>{
  for(const [,script] of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))new Script(script);
  assert.doesNotMatch(html,/\/__harness\/|\/__fixtures\/|PRIVATE MEASURED QUESTION CARD/);
  assert.match(html,/if \(measuredNativeQuestion\)\{noamRenderMeasuredQuestion\(selectedExercise\);\}/);
  assert.match(html,/announceNoam\(exerciseLabel\(exercise\)\+"\. נבחר סעיף חדש\."\);/);
 });
 test(variant+': exact task first; complete tables/multiSVG/blanks; no answer AST',async()=>{
  const {c,document}=setup(html,variant);assert.equal(await c.noamRenderMeasuredQuestion(c.selectedExercise),true);
  const root=document.querySelector('.noam-native-source')!;assert(root.firstElementChild!.classList.contains('noam-native-selected-item'));
  assert.equal(root.querySelectorAll('.noam-native-selected-item').length,1);assert(!root.textContent.includes('השוו בין הגופים.'));
  assert.equal(root.querySelectorAll('img').length,3);assert.equal(root.querySelectorAll('table').length,1);assert.equal(root.querySelectorAll('tbody tr').length,2);assert.match(root.textContent,/underline/);assert.doesNotMatch(root.textContent,/PRIVATE_/);
  assert(!(root.querySelector('.noam-native-context') as HTMLDetailsElement).open);c.noamSetMeasuredContextExpanded(true);assert((root.querySelector('.noam-native-context') as HTMLDetailsElement).open);c.noamSetMeasuredContextExpanded(false);assert(!(root.querySelector('.noam-native-context') as HTMLDetailsElement).open);
  const second=c.noamBuildMeasuredQuestion(clone(native),{...c.selectedExercise,part:'ב',nativeItemId:'q1b'},c.manifest);assert.equal(second.querySelectorAll('table').length,2);assert.match(second.firstElementChild.textContent,/השוו/);assert(!second.textContent.includes('חשבו את נפח'));assert.equal(JSON.stringify(native),body);
 });
 test(variant+': wrong item/level/question/figure/table fails closed',()=>{
  const {c}=setup(html,variant);
  for(const edit of [(d:any,e:any)=>e.nativeItemId='q1z',(d:any,e:any)=>e.part='ג',(d:any)=>d.level='a',(d:any)=>d.package='G7-T86',(d:any)=>d.questions.push(clone(d.questions[0])),(d:any,e:any)=>e.nativeFigures[0].url='/noam-ai/native/G7-T86/a/figures/q1_head.svg',(d:any,e:any)=>e.nativeFigures.push(clone(e.nativeFigures[0])),(d:any)=>d.figures[0].question='q9',(d:any)=>d.questions[0].table.rows[0].pop()]){const d=clone(native),e=clone(exercise);edit(d,e);assert.equal(c.noamBuildMeasuredQuestion(d,e,c.manifest),null);}
 });
 test(variant+': actual SHA verifier rejects altered bytes and keeps fallback',async()=>{
  const {c,document}=setup(html,variant);c.fetch=async()=>({ok:true,arrayBuffer:async()=>new TextEncoder().encode(body+' ').buffer});assert.equal(await c.noamRenderMeasuredQuestion(c.selectedExercise),false);assert.equal(document.getElementById('noamPickedText')!.hidden,false);assert.equal(document.querySelectorAll('img').length,0);
 });
 test(variant+': late verified response cannot fill changed item, manifest or DOM',async()=>{
  for(const mode of ['selection','manifest','dom']){const {c,document}=setup(html,variant);let resolve:any;const wait=new Promise(r=>resolve=r);c.fetch=()=>wait;const pending=c.noamRenderMeasuredQuestion(c.selectedExercise);if(mode==='selection')c.selectedExercise={...c.selectedExercise,id:'different-item'};if(mode==='manifest')c.manifest={...c.manifest};if(mode==='dom')document.getElementById('noamNativeQuestion')!.remove();resolve({ok:true,arrayBuffer:async()=>new TextEncoder().encode(body).buffer});assert.equal(await pending,false);assert.equal(document.querySelectorAll('img').length,0);}
 });
 test(variant+': original PDF crop remains lazy and uses complete source crops',async()=>{
  const {c,document}=setup(html,variant);await c.noamRenderMeasuredQuestion(c.selectedExercise);assert.equal(c.crops.length,0);const detail:any=document.querySelector('.noam-native-original');detail.open=true;detail.dispatchEvent(new c.window.Event('toggle'));await Promise.resolve();assert.equal(c.crops.length,1);assert.equal(c.crops[0].opts.exactSourceCrops,true);assert.equal(detail.querySelectorAll('img').length,1);
 });
 test(variant+': exactly one pair after question and each hint, none on busy/error/closing',()=>{
  const {c,thread,document,pair}=setup(html,variant);assert.equal(pair().length,2);assert.equal(pair().length,2);for(let n=1;n<=3;n++){thread.hintIndex=n;thread.messages=[{role:'assistant',text:'synthetic hint '+n}];assert.equal(pair().length,2);assert.equal(pair().length,2);}c.busy=true;assert.equal(pair().length,0);c.busy=false;for(const flag of ['answerError','closed','understood']){thread.messages=[{role:'assistant',text:'response',[flag]:true}];assert.equal(pair().length,0);}assert.equal(document.querySelectorAll('.ramzi-check,.noam-understanding-check').length,0);
 });
 test(variant+': feedback never requests model/fourth hint; stale controls inert',()=>{
  const {c,thread,pair,choose}=setup(html,variant);thread.hintIndex=1;thread.messages=[{role:'assistant',text:'synthetic hint'}];choose(pair()[0],true);assert.equal(c.requests.length,0);assert.equal(thread.hintIndex,1);assert.equal(pair().length,0);thread.messages=[{role:'assistant',text:'synthetic hint'}];choose(pair()[1],false);assert.deepEqual(clone(c.requests),[{kind:'hint',message:''}]);assert.equal(thread.hintIndex,1);thread.hintIndex=3;thread.messages=[{role:'assistant',text:'third hint'}];choose(pair()[1],false);assert.equal(c.requests.length,1);assert.equal(pair().length,0);thread.messages=[];thread.hintIndex=0;const old=pair()[1];c.selectedExercise={...c.selectedExercise,id:'new-item'};choose(old,false);assert.equal(c.requests.length,1);
 });
}

// Execute the TWO complete production script bodies, preserving their actual
// IIFE boundaries. Only browser startup is short-circuited and transport/render
// side effects are substituted. No owner functions are extracted into the
// adapter's scope; this catches accidental access to private owner state.
function isolatedScripts(html:string){
 const scripts=Array.from(html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g));
 const owner=scripts.find((m)=>m[2].includes('function noamVerifiedNativeData('))![2];
 const adapter=scripts.find((m)=>m[1].includes('id="exact-viewer-adapter"'))![2];
 const {document,window}=parseHTML('<html><body><main id="panelBody"><div class="noam-picked">Selected task</div><div id="noamTranscript"></div></main></body></html>');
 const thread:any={messages:[],history:[],hintIndex:0};
 const probe:any={requests:[],renders:0,announcements:[]};
 const seed={manifest:clone(manifest),exercise:clone(exercise),thread};
 Object.assign(window,{__testSeed:seed,__probe:probe});
 const c:any={window,document,console,Map,Set,Promise};
 function startup(script:string,code:string){const match=script.match(/(["'])use strict\1;/);assert(match);const at=match.index!+match[0].length;return script.slice(0,at)+'\n'+code+'\nreturn;\n'+script.slice(at);}
 const ownerStartup=`
 var manifest=window.__testSeed.manifest,manifestReady=true,selectedExercise=window.__testSeed.exercise,busy=false;
 var threads={};threads[selectedExercise.id]=window.__testSeed.thread;
 askNoam=function(kind,message){window.__probe.requests.push({kind:kind,message:message});};
 saveNoamState=function(){};renderNoamChat=function(){window.__probe.renders++;};
 announceNoam=function(text){window.__probe.announcements.push(text);};
 window.__probe.select=function(id){selectedExercise=Object.assign({},selectedExercise,{id:id});};
 window.__probe.setBusy=function(value){busy=value;};
 if(typeof noamInstallMeasuredFeedbackBridge==='function'){noamInstallMeasuredFeedbackBridge();}`;
 const adapterStartup=`
 var panelBody=document.getElementById('panelBody'),pendingCheckFocus=false;
 window.__probe.place=function(){return placeUnderstandingChecks(document.getElementById('noamTranscript'));};
 window.__probe.respond=function(intent,button){return submitUnderstanding(intent,button);};`;
 runInNewContext(startup(owner,ownerStartup),c);
 runInNewContext(startup(adapter,adapterStartup),c);
 assert.equal(c.noamHasMeasuredNativeQuestion,undefined,'owner function must remain private');
 assert.equal(c.selectedExercise,undefined,'selection must remain private');
 assert.equal((window as any).manifest,undefined,'manifest must remain private');
 return {c,window,document,thread,probe,seed};
}
test('public: complete owner and adapter scripts communicate only through an immutable bound bridge',()=>{
 const html=readFileSync(new URL('../public/worksheet-viewer-noam.html',import.meta.url),'utf8');
 const {window,document,thread,probe,seed}=isolatedScripts(html);
 probe.place(); // Regression: the pre-bridge adapter throws a private-scope ReferenceError here.
 const bridge=(window as any).NoamMeasuredFeedback;assert(Object.isFrozen(bridge));
 assert.deepEqual(Object.keys(bridge).sort(),['respond','snapshot']);
 const state=bridge.snapshot();assert(Object.isFrozen(state));assert.deepEqual(Object.keys(state).sort(),['binding','target']);assert.equal(state.target,'question');
 const buttons=()=>Array.from(document.querySelectorAll('.ramzi-check button')) as any[];
 probe.place();assert.equal(buttons().length,2);probe.place();assert.equal(buttons().length,2);
 const stale=buttons()[1];probe.select('another-item');probe.respond('not-understood',stale);assert.equal(probe.requests.length,0);probe.select(seed.exercise.id);
 probe.respond('not-understood',buttons()[1]);assert.deepEqual(clone(probe.requests),[{kind:'hint',message:''}]);
 const transcript=document.getElementById('noamTranscript')!;
 for(let n=1;n<=3;n++){
   thread.hintIndex=n;thread.messages=[{role:'assistant',text:'hint '+n}];transcript.innerHTML='<div class="noam-row assistant"><div class="noam-bubble">hint</div></div>';
   probe.place();assert.equal(buttons().length,2);probe.place();assert.equal(buttons().length,2);
 }
 const count=probe.requests.length;probe.respond('not-understood',buttons()[1]);assert.equal(probe.requests.length,count);assert(thread.messages.at(-1).closed);probe.place();assert.equal(buttons().length,0);
 thread.messages=[{role:'assistant',text:'error',answerError:true}];probe.place();assert.equal(buttons().length,0);
 thread.messages=[];probe.setBusy(true);probe.place();assert.equal(buttons().length,0);probe.setBusy(false);
 assert.equal(bridge.respond('wrong-binding','not-understood'),false);assert.equal(probe.requests.length,count);
});
