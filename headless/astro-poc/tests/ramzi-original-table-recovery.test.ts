import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {it} from 'node:test';
import {parseHTML} from 'linkedom';
const pub=new URL('../public/',import.meta.url),clone=(x:any)=>JSON.parse(JSON.stringify(x));
const modules=['noam-native-visual','noam-source-panels','noam-authored-geometry','noam-authored-visual','noam-visual-data','noam-visual-plan','noam-source-data-visual'].map(n=>readFileSync(new URL(n+'.js',pub),'utf8')).join('\n');
function fn(v:string,n:string){const s=v.slice(v.indexOf('function '+n+'('));assert.ok(s.startsWith('function '+n+'('));return s.slice(0,s.indexOf('\nfunction ',1));}
async function settled(){for(let i=0;i<150;i++)await Promise.resolve();}
function fixture(v:string){
 const manifest=JSON.parse(readFileSync(new URL('noam-ai/manifests/084c58836048405aa2a2f97ba4396553.json',pub),'utf8'));
 const exercise=manifest.exercises.find((e:any)=>e.nativeItemId==='q16b'),{document,window}=parseHTML('<html><body><main></main></body></html>');
 const message:any={role:'assistant',text:'לא הצלחנו לקרוא את תמונת השאלה.',answerError:true,answerErrorCode:'QUESTION_IMAGE_UNREADABLE',sourceRecoveryAllowed:true,sourceRecoveryExerciseId:exercise.id};
 const thread:any={messages:[{role:'user',text:'אפשר רמז 1?',kind:'רמז 1'},message],hintIndex:0,history:[]},fetches:string[]=[],announcements:string[]=[];
 const c:any={document,window,manifest,selectedExercise:exercise,pdf:manifest.pdfHash,Map,WeakSet,Promise,
  noamNativeFocusUrl:()=>manifest.nativeExportUrl,exerciseThread:()=>thread,currentAttachments:()=>[],
  noamStripMarkdownEmphasis:(s:string)=>s,isBotProtectionError:(e:any)=>/BOT_|429|בדיקת האבטחה/.test(String(e.code)+' '+String(e.message)),
  noamCanOfferDrawing:()=>false,retryLastNoamHelp(){},saveNoamState(){},renderNoamChat(){},announceNoam:(s:string)=>announcements.push(s),
  noamAddDiagramExpansion:(container:any)=>{const b=document.createElement('button');b.textContent='הגדלת הטבלה';container.append(b);},
  postJson:()=>{throw Error('protected request forbidden');},requestNoamDiagram:()=>{throw Error('diagram request forbidden');},
  fetch:async(url:string)=>{assert.equal(url,manifest.nativeExportUrl);fetches.push(url);const body=readFileSync(new URL(url.slice(1),pub),'utf8');return {ok:true,json:async()=>JSON.parse(body)};}};
 const helpers='var noamSourceVisualPackages='+v.split('var noamSourceVisualPackages=')[1].split('function noamNativeFigure(')[0];
 runInNewContext(modules+'\n'+fn(v,'noamDiagramSourceIdentity')+'\n'+helpers+'\n'+['noamVisualCanExpand','noamRetryActionLabel','addTranscriptBubble'].map(n=>fn(v,n)).join('\n'),c);
 for(const k of Object.keys(c))if(k.startsWith('Noam'))window[k]=c[k];
 function bubble(){return c.addTranscriptBubble(document.querySelector('main'),'assistant',message.text,'',message.visual||null,message,thread);}
 return {c,manifest,exercise,message,thread,fetches,announcements,bubble};
}
for(const relative of ['../public/worksheet-viewer-noam.html','../../../worksheet-viewer-noam.html']){
 const v=readFileSync(new URL(relative,import.meta.url),'utf8'),name=relative.includes('public')?'public':'root';
 it(name+': W11-Q3 error offers exact original table through static source only and preserves error/retry/history',async()=>{
  const f=fixture(v),before=clone(f.thread);const row=f.bubble();await settled();
  const button=row.querySelector('.noam-source-table-recovery');assert.ok(button);assert.equal(button.textContent,'הצגת הטבלה המקורית');
  assert.equal(f.fetches.length,1);assert.equal(row.querySelector('.noam-retry-action').textContent,'נסו שוב לקרוא את השאלה');
  button.click();assert.equal(f.message.visual.type,'native-original-table');assert.equal(f.message.answerError,true);
  assert.equal(f.message.text,before.messages[1].text);assert.equal(f.thread.hintIndex,0);assert.deepEqual(f.thread.history,[]);
  assert.deepEqual(Object.keys(f.message.visual).sort(),['exerciseId','sourceIdentity','type']);
  const figure=f.c.noamRenderOriginalTable(f.message.visual);assert.ok(figure);assert.equal(figure.querySelectorAll('td').length,4);
  assert.equal((figure.textContent.match(/\?/g)||[]).length,3);assert.match(figure.textContent,/הטבלה המקורית כפי שהודפסה/);assert.doesNotMatch(figure.textContent,/n\s*\(|28|54/);
  const again=f.bubble();await settled();assert.equal(again.querySelectorAll('.noam-source-table-recovery').length,0);assert.ok(again.querySelector('figure'));assert.match(again.textContent,/הגדלת הטבלה/);
 });
 it(name+': unknown/security/rate errors, attachments and unbound error records never fetch or offer recovery',async()=>{
  for(const mode of ['unknown','empty-code','BOT_RISK_REJECTED','BOT_VERIFICATION_TIMEOUT','RATE_LIMITED','untrusted-flag','wrong-exercise','attachments','security-message','not-error','deleted','switched']){
   const f=fixture(v);
   if(['unknown','empty-code','BOT_RISK_REJECTED','BOT_VERIFICATION_TIMEOUT','RATE_LIMITED'].includes(mode))f.message.answerErrorCode=mode==='empty-code'?'':mode;
   if(mode==='untrusted-flag')delete f.message.sourceRecoveryAllowed;if(mode==='wrong-exercise')f.message.sourceRecoveryExerciseId='q16a';
   if(mode==='attachments')f.c.currentAttachments=()=>[{}];if(mode==='security-message')f.message.text='בדיקת האבטחה נכשלה';if(mode==='not-error')f.message.answerError=false;
   if(mode==='deleted')f.thread.messages=[];if(mode==='switched')f.c.selectedExercise={id:'other'};
   const row=f.bubble();await settled();assert.equal(f.fetches.length,0,mode);assert.equal(row.querySelector('.noam-source-table-recovery'),null,mode);
  }
 });
 it(name+': source failure, wrong item, malformed/unsupported selected table and source-panel scope cannot fall through to a model',async()=>{
  for(const mode of ['fetch-fail','missing','wrong-item','own-new-table','ragged','figure','grouped']){
   const f=fixture(v);if(mode==='fetch-fail')f.c.fetch=async()=>{throw Error('static failed');};if(mode==='missing')f.c.fetch=async()=>({ok:false});
   if(mode==='wrong-item')f.exercise.nativeItemId='q16a';
   if(['own-new-table','ragged','figure'].includes(mode)){
    const old=f.c.fetch;f.c.fetch=async(url:string)=>{const r=await old(url),d=await r.json(),q=d.questions.find((q:any)=>q.id==='q16'),p=q.items.find((p:any)=>p.id==='q16b');
     if(mode==='own-new-table')p.text='בנו טבלה משלכם.';if(mode==='ragged')p.table={head:['x','y'],rows:[['1']]};if(mode==='figure')p.figure_id='q1_head';return {ok:true,json:async()=>d};};
   }
   if(mode==='grouped')f.c.noamSourcePanelReviewed=()=>true;
   const row=f.bubble();await settled();assert.equal(row.querySelector('.noam-source-table-recovery'),null,mode);assert.equal(f.message.visual,undefined,mode);
  }
 });
 it(name+': pending selection/message/source changes do not attach the action or table',async()=>{
  for(const mode of ['switch','delete','source','detach']){
   const f=fixture(v);let finish:any;const original=f.c.fetch;f.c.fetch=(url:string)=>new Promise(resolve=>{finish=async()=>resolve(await original(url));});
   const row=f.bubble();if(mode==='switch')f.c.selectedExercise={id:'other'};if(mode==='delete')f.thread.messages=[];if(mode==='source')f.manifest.nativeExportSha256='0'.repeat(64);if(mode==='detach')row.remove();
   await finish();await settled();assert.equal(row.querySelector('.noam-source-table-recovery'),null,mode);assert.equal(f.message.visual,undefined,mode);
  }
 });
 it(name+': saved table intent revalidates exact source and rejects injected scene/options/identity',async()=>{
  const f=fixture(v);const row=f.bubble();await settled();row.querySelector('.noam-source-table-recovery').click();const saved=clone(f.message.visual);
  for(const change of [{sourceIdentity:'stale'},{exerciseId:'unknown'},{scene:{kind:'typed-table',rows:[['42']]}},{options:{answer:'42'}}])assert.equal(f.c.noamRenderOriginalTable({...saved,...change}),null);
  const g=fixture(v);assert.equal(g.c.noamRenderOriginalTable(saved),null);await settled();const figure=g.c.noamRenderOriginalTable(saved);assert.ok(figure);assert.equal((figure.textContent.match(/\?/g)||[]).length,3);
 });
 it(name+': actual failed hint records recovery authorization only for worksheet read errors without attachments',async()=>{
  for(const [code,attachments] of [['QUESTION_IMAGE_UNREADABLE',false],['QUESTION_IMAGE_UNREADABLE',true],['BOT_RISK_REJECTED',false],['UNKNOWN',false]] as const){
   const f=fixture(v);f.thread.messages=[];const error=Object.assign(new Error('read failed'),{code});f.c.currentAttachments=()=>attachments?[{}]:[];
   Object.assign(f.c,{busy:false,panelBody:f.c.document.body,noamDrafts:{},MIN_WAIT:0,API:'/model',g:7,lv:'a',LEVEL:{a:'רמה א׳'},ttl:'חוקיות',setNoamBusy:(b:boolean)=>{f.c.busy=b;},restoreNoamChatFocus(){},exerciseLabel:()=> '16ב',
    noamDidacticGuide:()=>null,noamDidacticPrompt:()=>'',noamDidacticResponse:()=>null,getExerciseAnalysis:()=>Promise.reject(error)});
   runInNewContext(fn(v,'askNoam'),f.c);f.c.askNoam('hint','רמז');await settled();assert.equal(f.thread.messages.length,2);
   assert.equal(f.thread.messages[1].sourceRecoveryAllowed,code==='QUESTION_IMAGE_UNREADABLE'&&!attachments);assert.equal(f.thread.messages[1].sourceRecoveryExerciseId,f.exercise.id);assert.equal(f.thread.hintIndex,0);
  }
 });
}
