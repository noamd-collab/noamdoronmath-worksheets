import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { it } from 'node:test';
const pub=new URL('../public/',import.meta.url),read=(name:string)=>readFileSync(new URL(name,pub),'utf8');
const code=read('noam-curated-hints.js'),config={url:'https://example123.supabase.co',key:'sb_publishable_test'};
const pdf='a'.repeat(32),native='b'.repeat(64),id='G9-T39-E-Q03ב',hints=['רמז ראשון','רמז שני','רמז שלישי'];
function manifest(extra:any={}){return {prefix:'G9-T39',levelCode:'E',pdfHash:pdf,nativeExportSha256:native,exercises:[{id}],...extra};}
function row(extra:any={}){return {exercise_id:id,hint_1:hints[0],hint_2:hints[1],hint_3:hints[2],source_pdf_hash:pdf,source_native_sha256:native,...extra};}
function setup(extra:any={}){const c:any={Promise,AbortController,setTimeout,clearTimeout,NOAM_LEARNING_CONFIG:config,...extra};runInNewContext(code,c);return {c,bank:c.NoamCuratedHints};}
function fetchRows(rows:any,calls:any[]=[]){return async(url:string,init:any)=>{calls.push({url,init});return {ok:true,json:async()=>rows};};}
function deferred(){let resolve:any;const promise=new Promise<any>(r=>resolve=r);return {promise,resolve};}
async function drain(){for(let i=0;i<40;i++)await Promise.resolve();}
it('loads one source-bound three-hint set per exact manifest, without generic-guide registration or credentials',async()=>{
 const calls:any[]=[],sheet=manifest(),{bank}=setup({NoamDidacticGuides:{register(){throw new Error('must not register');}}});
 const opts={fetch:fetchRows([row(),row({exercise_id:'G9-T39-E-Q09ב'})],calls)};
 const first=bank.prefetch(sheet,opts),second=bank.prefetch(sheet,opts);assert.equal(first,second);assert.equal(await first,1);
 const set=bank.get(sheet,id);assert.deepEqual(Array.from(set.hints),hints);assert.ok(set.revision.includes(native));assert.equal(bank.get(sheet,'G9-T39-E-Q09ב'),null);
 set.hints[0]='tampered';assert.equal(bank.get(sheet,id).hints[0],hints[0]);assert.equal(calls.length,1);
 const url=new URL(calls[0].url);assert.equal(url.pathname,'/rest/v1/noam_ramzi_hints');assert.equal(url.searchParams.get('select'),'exercise_id,hint_1,hint_2,hint_3,source_pdf_hash,source_native_sha256');assert.equal(url.searchParams.get('exercise_id'),'like.G9-T39-E-Q*');assert.equal(calls[0].init.credentials,'omit');assert.equal(calls[0].init.headers.apikey,config.key);assert.equal(calls[0].init.headers.Authorization,undefined);
});
it('requires exact PDF and native SHA when present; a missing native binding is not accepted for native manifests',async()=>{
 for(const change of [{source_pdf_hash:'c'.repeat(32)},{source_pdf_hash:null},{source_native_sha256:'d'.repeat(64)},{source_native_sha256:null}]){
  const {bank}=setup(),sheet=manifest();assert.equal(await bank.prefetch(sheet,{fetch:fetchRows([row(change)])}),0);assert.equal(bank.get(sheet,id),null);
 }
 const {bank}=setup(),legacy=manifest({nativeExportSha256:undefined});assert.equal(await bank.prefetch(legacy,{fetch:fetchRows([row({source_native_sha256:null})])}),1);
});
it('rejects duplicate, incomplete, oversized and foreign exercise rows without reusing a matching-looking part',async()=>{
 for(const rows of [[row(),row()],[row({hint_2:''})],[row({hint_1:'x'.repeat(601)})],[row({exercise_id:'G9-T39-A-Q03ב'})],[row({exercise_id:'__proto__'})],{}]){
  const {bank}=setup(),sheet=manifest();assert.equal(await bank.prefetch(sheet,{fetch:fetchRows(rows)}),0);assert.equal(bank.get(sheet,id),null);
 }
});
it('a different PDF or native version cannot read a previously loaded hint',async()=>{
 const {bank}=setup(),sheet=manifest();await bank.prefetch(sheet,{fetch:fetchRows([row()])});assert.equal(bank.get(manifest({pdfHash:'c'.repeat(32)}),id),null);assert.equal(bank.get(manifest({nativeExportSha256:'c'.repeat(64)}),id),null);
});
it('single-level PDF aliases use only exact manifest exercise IDs and one worksheet identity',async()=>{
 const {bank}=setup(),calls:any[]=[],sheet=manifest({levelCode:'B',exercises:[{id:'G9-T39-A-Q03ב'}]});
 assert.equal(await bank.prefetch(sheet,{fetch:fetchRows([row({exercise_id:'G9-T39-A-Q03ב'})],calls)}),1);assert.equal(new URL(calls[0].url).searchParams.get('exercise_id'),'like.G9-T39-A-Q*');
 assert.equal(await bank.prefetch(manifest({exercises:[{id},{id:'G9-T39-A-Q03ב'}]}),{fetch:fetchRows([],calls)}),0);assert.equal(calls.length,1);
});
it('E2 PDF-only ladders load under E2 and never alias an E worksheet',async()=>{
 const e2='G8-T45-E2-Q01א',e='G8-T45-E-Q01א',sheet=manifest({prefix:'G8-T45',levelCode:'E2',nativeExportSha256:null,exercises:[{id:e2}]}),calls:any[]=[],{bank}=setup();
 assert.equal(await bank.prefetch(sheet,{fetch:fetchRows([row({exercise_id:e2,source_native_sha256:null}),row({exercise_id:e,source_native_sha256:null})],calls)}),1);
 assert.equal(new URL(calls[0].url).searchParams.get('exercise_id'),'like.G8-T45-E2-Q*');
 assert.deepEqual(Array.from(bank.get(sheet,e2).hints),hints);assert.equal(bank.get(sheet,e),null);
 for(const changed of [{...sheet,levelCode:'E'},{...sheet,exercises:[{id:e}]},{...sheet,exercises:[{id:e2},{id:e}]},{...sheet,levelCode:'E22'}]){
  assert.equal(await bank.prefetch(changed,{fetch:fetchRows([],calls)}),0);
 }
 assert.equal(calls.length,1);
 const {bank:other}=setup();assert.equal(await other.prefetch(sheet,{fetch:fetchRows([row({exercise_id:e2,source_native_sha256:null,source_pdf_hash:'c'.repeat(32)})])}),0);
});
it('canonical T40 manifest IDs cannot load old T32 hints, including matching hashes',async()=>{
 const sheet=JSON.parse(read('noam-ai/manifests/043606cd6c8e4c199b148424caf7ef36.json')),target=sheet.exercises[0].id,old=target.replace('G9-T40-','G9-T32-'),calls:any[]=[],{bank}=setup();
 assert.equal(target,'G9-T40-A-Q01א');
 const correct=row({exercise_id:target,source_pdf_hash:sheet.pdfHash,source_native_sha256:sheet.nativeExportSha256});
 assert.equal(await bank.prefetch(sheet,{fetch:fetchRows([{...correct,exercise_id:old},correct],calls)}),1);
 assert.equal(new URL(calls[0].url).searchParams.get('exercise_id'),'like.G9-T40-A-Q*');
 assert.equal(bank.get(sheet,old),null);assert.deepEqual(Array.from(bank.get(sheet,target).hints),hints);
 assert.equal(await bank.prefetch({...sheet,exercises:[{...sheet.exercises[0],id:old}]},{fetch:fetchRows([correct],calls)}),0);assert.equal(calls.length,1);
});
it('invalid manifest hashes, levels and configured hosts never send a request',async()=>{
 const calls:any[]=[];
 for(const extra of [{pdfHash:'x'},{nativeExportSha256:'x'},{levelCode:'AB'},{prefix:'G9-T39&x=1'},{exercises:[]}]){const {bank}=setup();assert.equal(await bank.prefetch(manifest(extra),{fetch:fetchRows([],calls)}),0);}
 const {bank}=setup({NOAM_LEARNING_CONFIG:{url:'https://attacker.example',key:'key'}});assert.equal(await bank.prefetch(manifest(),{fetch:fetchRows([],calls)}),0);assert.equal(calls.length,0);
});
it('network/body failure is retryable and does not register partial state',async()=>{
 const {bank}=setup(),sheet=manifest();assert.equal(await bank.prefetch(sheet,{fetch:async()=>{throw new Error('offline');}}),0);assert.equal(bank.get(sheet,id),null);assert.equal(await bank.prefetch(sheet,{fetch:fetchRows([row()])}),1);
 bank.invalidate(sheet);assert.equal(bank.get(sheet,id),null);assert.equal(await bank.prefetch(sheet,{fetch:fetchRows([row({hint_2:'updated'})])}),1);assert.equal(bank.get(sheet,id).hints[1],'updated');
});
it('the4s bound covers a hung response body even when fetch ignores abort; late body cannot populate cache',async()=>{
 const timers=new Map<number,()=>void>();let n=0,signal:any;const body=deferred(),{bank}=setup({setTimeout:(fn:any)=>{timers.set(++n,fn);return n;},clearTimeout:(i:number)=>timers.delete(i)});
 const sheet=manifest(),pending=bank.prefetch(sheet,{fetch:async(_:any,init:any)=>{signal=init.signal;return {ok:true,json:()=>body.promise};}});await drain();assert.equal(signal.aborted,false);[...timers.values()][0]();assert.equal(await pending,0);assert.equal(signal.aborted,true);body.resolve([row()]);await drain();assert.equal(bank.get(sheet,id),null);
});
it('an invalidated old request cannot overwrite or delete a replacement entry',async()=>{
 const {bank}=setup(),sheet=manifest(),old=deferred();const pending=bank.prefetch(sheet,{fetch:()=>old.promise});await drain();bank.invalidate(sheet);await bank.prefetch(sheet,{fetch:fetchRows([row({hint_1:'new'})])});old.resolve({ok:false});await pending;assert.equal(bank.get(sheet,id).hints[0],'new');
});
it('deferred public config is awaited and bounded without loading security or a model',async()=>{
 const listeners:any={},calls:any[]=[],{bank,c}=setup({NOAM_LEARNING_CONFIG:null,document:{readyState:'interactive',addEventListener:(n:string,f:any)=>listeners[n]=f,removeEventListener(){}}});
 const pending=bank.prefetch(manifest(),{fetch:fetchRows([row()],calls)});assert.equal(calls.length,0);c.NOAM_LEARNING_CONFIG=config;listeners.DOMContentLoaded();assert.equal(await pending,1);assert.equal(calls.length,1);
});
it('both viewer copies prefetch after manifest load and put prepared standard hints before any guide or AI action',()=>{
 for(const path of ['../public/worksheet-viewer-noam.html','../../../worksheet-viewer-noam.html']){
  const viewer=readFileSync(new URL(path,import.meta.url),'utf8'),ask=viewer.slice(viewer.indexOf('function askNoam('),viewer.indexOf('function noamRetryActionLabel('));
  assert.match(viewer,/noam-curated-hints\.js\?v=20261031-source-bound3/);assert.match(viewer,/manifest = data;[\s\S]{0,600}NoamCuratedHints\.prefetch\(data\)/);assert.doesNotMatch(ask,/noamDidacticResponse\(|noamDidacticGuide\(|noamDidacticPrompt\(/);assert.ok(ask.indexOf('noamPreparedHint(')<ask.indexOf('noamPrepareOperationClient('));assert.doesNotMatch(viewer,/function noamFirstSourceHint\(/);
 }
 assert.equal(readFileSync(new URL('../../../noam-curated-hints.js',import.meta.url),'utf8'),code);
});

it('config waiting and response body share one absolute4s budget; expiry never grants a fresh request budget',async()=>{
 for(const configAt of [2500,4000]){
  let now=0,next=0;const timers=new Map<number,{at:number,fn:()=>void}>(),listeners:any={},calls:any[]=[],body=deferred();
  const {bank,c}=setup({Date:class extends Date{static now(){return now;}},NOAM_LEARNING_CONFIG:null,
   setTimeout:(fn:any,ms:number)=>{timers.set(++next,{at:now+ms,fn});return next;},clearTimeout:(n:number)=>timers.delete(n),
   document:{readyState:'interactive',addEventListener:(n:string,f:any)=>listeners[n]=f,removeEventListener(){}}});
  const pending=bank.prefetch(manifest(),{fetch:async(url:any,init:any)=>{calls.push({url,init});return {ok:true,json:()=>body.promise};}});
  now=configAt;c.NOAM_LEARNING_CONFIG=config;listeners.DOMContentLoaded();await drain();
  if(configAt===2500){assert.equal(calls.length,1);assert.deepEqual([...timers.values()].map(x=>x.at),[4000]);now=4000;[...timers.values()][0].fn();}
  assert.equal(await pending,0);assert.equal(bank.status(manifest(),id),'unavailable');assert.equal(calls.length,configAt===2500?1:0);
  body.resolve([row()]);await drain();assert.equal(bank.get(manifest(),id),null);
 }
});
it('successful approved-catalog misses are distinct from transient network/body failures',async()=>{
 const {bank}=setup(),sheet=manifest();assert.equal(await bank.prefetch(sheet,{fetch:fetchRows([])}),0);assert.equal(bank.status(sheet,id),'missing');
 bank.invalidate(sheet);assert.equal(await bank.prefetch(sheet,{fetch:async()=>{throw new Error('offline');}}),0);assert.equal(bank.status(sheet,id),'unavailable');
 assert.equal(await bank.prefetch(sheet,{fetch:fetchRows([row()])}),1);assert.equal(bank.status(sheet,id),'available');
});
