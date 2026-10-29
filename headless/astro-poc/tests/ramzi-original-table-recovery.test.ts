import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {it} from 'node:test';
import {parseHTML} from 'linkedom';
const pub=new URL('../public/',import.meta.url),clone=(x:any)=>JSON.parse(JSON.stringify(x));
const modules=['noam-visual-policy','noam-native-visual','noam-source-panels','noam-authored-geometry','noam-authored-visual','noam-visual-data','noam-visual-plan','noam-source-data-visual'].map(n=>readFileSync(new URL(n+'.js',pub),'utf8')).join('\n');
function fn(v:string,n:string){const s=v.slice(v.indexOf('function '+n+'('));assert.ok(s.startsWith('function '+n+'('));return s.slice(0,s.indexOf('\nfunction ',1));}
async function settled(){for(let i=0;i<150;i++)await Promise.resolve();}
function fixture(v:string){
 const manifest=JSON.parse(readFileSync(new URL('noam-ai/manifests/084c58836048405aa2a2f97ba4396553.json',pub),'utf8'));
 const exercise=manifest.exercises.find((e:any)=>e.nativeItemId==='q16b'),{document,window}=parseHTML('<html><body><main></main></body></html>');
 const message:any={role:'assistant',text:'לא הצלחנו לקרוא את תמונת השאלה.',answerError:true,answerErrorCode:'QUESTION_IMAGE_UNREADABLE',sourceRecoveryAllowed:true,sourceRecoveryExerciseId:exercise.id};
 const thread:any={messages:[{role:'user',text:'אפשר רמז 1?',kind:'רמז 1'},message],hintIndex:0,history:[]},fetches:string[]=[],announcements:string[]=[];
 const c:any={document,window,manifest,selectedExercise:exercise,pdf:manifest.pdfHash,Map,WeakSet,Promise,
  noamNativeFocusUrl:()=>manifest.nativeExportUrl,exerciseThread:()=>thread,currentAttachments:()=>[],
  noamStripMarkdownEmphasis:(s:string)=>s,
  noamCanOfferDrawing:()=>false,retryLastNoamHelp(){},saveNoamState(){},renderNoamChat(){},announceNoam:(s:string)=>announcements.push(s),
  noamAddDiagramExpansion:(container:any)=>{const b=document.createElement('button');b.textContent='הגדלת הטבלה';container.append(b);},
  postJson:()=>{throw Error('protected request forbidden');},requestNoamDiagram:()=>{throw Error('diagram request forbidden');},
  fetch:async(url:string)=>{assert.equal(url,manifest.nativeExportUrl);fetches.push(url);const body=readFileSync(new URL(url.slice(1),pub),'utf8');return {ok:true,json:async()=>JSON.parse(body)};}};
 const helpers='var noamSourceVisualPackages='+v.split('var noamSourceVisualPackages=')[1].split('function noamNativeFigure(')[0];
 runInNewContext(modules+'\n'+readFileSync(new URL('noam-bot-client.js',pub),'utf8')+'\n'+fn(v,'noamVisualsAllowed')+'\n'+fn(v,'isBotProtectionError')+'\n'+fn(v,'noamDiagramSourceIdentity')+'\n'+helpers+'\n'+['noamVisualCanExpand','noamRetryActionLabel','addTranscriptBubble'].map(n=>fn(v,n)).join('\n'),c);
 for(const k of Object.keys(c))if(k.startsWith('Noam'))window[k]=c[k];
 function bubble(){return c.addTranscriptBubble(document.querySelector('main'),'assistant',message.text,'',message.visual||null,message,thread);}
 return {c,manifest,exercise,message,thread,fetches,announcements,bubble};
}
for(const relative of ['../public/worksheet-viewer-noam.html','../../../worksheet-viewer-noam.html']){
 const v=readFileSync(new URL(relative,import.meta.url),'utf8'),name=relative.includes('public')?'public':'root';
 it(name+': arithmetic read errors retain their retry but never offer a Ramzi table or fetch a visual source',async()=>{
  const f=fixture(v),before=clone(f.thread),row=f.bubble();await settled();
  assert.equal(f.c.noamVisualsAllowed(f.exercise),false);
  assert.equal(row.querySelector('.noam-source-table-recovery'),null);
  assert.equal(row.querySelector('figure'),null);assert.equal(f.fetches.length,0);
  assert.equal(row.querySelector('.noam-retry-action').textContent,'נסו שוב לקרוא את השאלה');
  assert.deepEqual(f.thread,before,'the original error and saved history remain unchanged');
 });
 it(name+': original table recovery remains unavailable for all error/attachment states on excluded worksheets',async()=>{
  for(const code of ['QUESTION_IMAGE_UNREADABLE','BOT_RISK_REJECTED','BOT_VERIFICATION_TIMEOUT','RATE_LIMITED','UNKNOWN','']){
   const f=fixture(v);f.message.answerErrorCode=code;
   assert.equal(f.c.noamTableRecoveryAllowed(f.exercise,f.thread,f.message),false);
   const row=f.bubble();await settled();assert.equal(f.fetches.length,0);assert.equal(row.querySelector('.noam-source-table-recovery'),null);
  }
 });
 it(name+': previously saved exact original table stays stored but cannot render or trigger cold-source loading',async()=>{
  const f=fixture(v);
  f.message.visual={type:'native-original-table',exerciseId:f.exercise.id,sourceIdentity:f.c.noamSourceVisualIdentity(f.exercise)};
  const before=clone(f.thread);
  assert.equal(f.c.noamRenderOriginalTable(f.message.visual),null);
  const row=f.bubble();await settled();assert.equal(row.querySelector('figure'),null);
  assert.equal(row.querySelector('.noam-source-table-recovery'),null);assert.equal(f.fetches.length,0);
  assert.deepEqual(f.thread,before,'policy suppression must not delete persisted visuals');
 });
 it(name+': an already cached source cannot bypass the current worksheet policy',async()=>{
  const f=fixture(v);await f.c.noamLoadSourceVisual(f.exercise);assert.equal(f.fetches.length,1);
  const visual={type:'native-original-table',exerciseId:f.exercise.id,sourceIdentity:f.c.noamSourceVisualIdentity(f.exercise)};
  assert.equal(f.c.noamRenderOriginalTable(visual),null);assert.equal(f.fetches.length,1);
 });
}
