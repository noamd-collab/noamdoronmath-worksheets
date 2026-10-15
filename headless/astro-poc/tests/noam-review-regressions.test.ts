import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {runInNewContext} from 'node:vm';
import {parseHTML} from 'linkedom';
import {handleCompanionTurn, callQwen, resolveQwenTarget, qwenChatUrlFrom, conversationRecords, qwenRequestBody} from '../../../noam-ai/site-companion/companion.js';
import {navigateSite, navigationHelp} from '../../../noam-ai/site-companion/navigation.js';
import {runCompanionTurn} from '../../../noam-ai/site-companion/endpoint.js';
const read=(name:string)=>JSON.parse(readFileSync(new URL('../src/data/'+name,import.meta.url),'utf8'));
const guide=read('site-guide.v1.json'), catalog=read('catalog.v1.json'), teacherIndex=read('teacher-pick-index.json');
const page={kind:'home',path:'/'};
const first='אני מחפש דפים לכיתה ט׳ על פירוק לגורמים';
const fail={guide,apiKey:'synthetic',log:()=>{},fetch:async()=>({ok:false,status:401,json:async()=>({error:{code:'InvalidApiKey'}})})};
const level=(link:any)=>new URL(link.href,'https://example.com').searchParams.get('lv');

test('Noam level order: default A, harder excellence, easier B; history keeps subject and grade',async()=>{
 for(const [start,follow,expected] of [[first,'קשה יותר','c'],[first,'משהו קל יותר','b'],[first+' ברמה ב׳','עכשיו רמה א׳','a'],['grade 9, factoring, level B','something harder','a'],[first+' מצוינות','קל יותר','a'],[first+' ברמה ב׳','קל יותר','b'],[first+' מצוינות','קשה יותר','c']] as const){
  const history=[{role:'user',content:start},{role:'assistant',content:'כיתה ג רמה ב בנושא אחר'}];
  for(const input of [{message:start,page},{message:follow,history,page}]){
   const server=await handleCompanionTurn(input,fail), local=navigateSite(input,guide);
   assert.equal(server.source,'fallback');assert.equal(server.code,'MODEL_AUTH_FAILED');
   assert.equal(level(server.primary),level(local.primary));
   assert.match(server.primary.id,/^g9-t2-/);
   if(input.message===follow) assert.equal(level(server.primary),expected);
  }
 }
 const r=navigateSite({message:first,page},guide);assert.equal(level(r.primary),'a');
});

test('unknown topics and a grade change never invent a matching subject',async()=>{
 const r=await handleCompanionTurn({message:'עכשיו לכיתה ח׳',history:[{role:'user',content:first}],page},fail);
 assert.equal(r.primary.href,'/worksheets?grade=8');
 const unknown=navigateSite({message:'דפים על טופולוגיה לכיתה ט',page},guide);
 assert.equal(unknown.primary.href,'/worksheets?grade=9');
});

test('valid regional/workspace endpoints work, invalid explicit settings never send the key',async()=>{
 assert.equal(resolveQwenTarget({baseUrl:'',model:''}).model,'qwen3.8-flash');
 for(const base of ['https://dashscope-intl.aliyuncs.com/compatible-mode/v1','https://workspace123.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1']){
  assert.equal(qwenChatUrlFrom(base),base+'/chat/completions');
 }
 for(const baseUrl of ['https://evil.example/compatible-mode/v1','https://foo.ap-southeast-1.maas.aliyuncs.com.evil.example/compatible-mode/v1','https://dashscope-intl.aliyuncs.com:444/compatible-mode/v1','http://dashscope-intl.aliyuncs.com/compatible-mode/v1']){
  await assert.rejects(callQwen({baseUrl,apiKey:'synthetic',log:()=>{},fetch:()=>{throw Error('MUST_NOT_FETCH');}},{}),{code:'QWEN_CONFIG_REJECTED'});
 }
 await assert.rejects(callQwen({model:'invalid model',apiKey:'synthetic',log:()=>{},fetch:()=>{throw Error('MUST_NOT_FETCH');}},{}),{code:'QWEN_CONFIG_REJECTED'});
});

test('teacher classifier failure retains fallback provenance, requested grade and level',async()=>{
 const r=await runCompanionTurn({message:first+' ברמה ב׳',page:{kind:'teachers',path:'/teachers'}},{...fail,qwenKey:'synthetic',catalog,teacherIndex});
 assert.equal(r.source,'fallback');assert.equal(r.model,null);assert.equal(r.code,'MODEL_AUTH_FAILED');
 assert.match(r.primary.label,/כיתה ט.*פירוק לגורמים.*רמה ב/);
});

test('shipped submit flow preserves relative level intent after the real client rejects a provider failure',async()=>{
 const {document,window}=parseHTML('<form><input><button></button></form><section></section><p></p>');
 const form=document.querySelector('form')!, input=document.querySelector('input')!;
 const source=readFileSync(new URL('../public/noam-site-companion.js',import.meta.url),'utf8');
 const submit=source.slice(source.indexOf('  form.addEventListener("submit"'),source.indexOf('  document.addEventListener("keydown"'));
 const remember=source.slice(source.indexOf('  function remember('),source.indexOf('  function loadNavigation('));
 const fallback=source.slice(source.indexOf('  function navigationFallback('),source.indexOf('  var script ='));
 const marking=source.slice(source.indexOf('  function answerKind('),source.indexOf('  function showResult('));
 const results:any[]=[];const panel=document.querySelector('section')!;
 const scope:any={form,input,panel,streaming:false,isLocalSolve:()=>false,showThinking:()=>{},pageKind:()=> 'home',location:{pathname:'/',search:''},document,
 teacherContext:()=>null,conversation:[],historyKey:'test',sessionStorage:{setItem(){}},requestEl:document.querySelector('p'),resetEl:document.querySelector('button'),
 API:'/api/noamSiteCompanion',ensureBotClient:async()=>({postJson:async()=>{throw Object.assign(Error('provider failure'),{code:'MODEL_AUTH_FAILED'});}}),
 loadNavigation:async()=>[{navigateSite,navigationHelp},guide],showResult:(r:any)=>{scope.markAnswer(r);results.push(r);}};
 runInNewContext(remember+fallback+marking+submit,scope);
 for(const text of [first,'קשה יותר','משהו קל יותר','משהו קל יותר']){
  input.value=text;form.dispatchEvent(new window.Event('submit',{cancelable:true}));
  await new Promise(resolve=>setImmediate(resolve));
 }
 assert.deepEqual(results.map(r=>level(r.primary)),['a','c','a','b']);
 assert.ok(results.every(r=>r.primary.id.startsWith('g9-t2-')));
 assert.equal(panel.getAttribute('data-answer-kind'),'fallback');
 assert.equal(panel.getAttribute('data-response-error'),'MODEL_AUTH_FAILED');
});

 test('model candidates and prompt enforce one difficulty step without losing topic discovery',()=>{
 const input={message:'קל יותר',history:[{role:'user',content:first},{role:'user',content:'קשה יותר'}],page};
 const rows=conversationRecords(guide,input);
 assert.ok(rows.some((r:any)=>r.id==='g9-t2-a'));
 assert.ok(rows.every((r:any)=>r.type!=='worksheet'||level(r)==='a'));
 assert.ok(rows.some((r:any)=>r.type==='topic'));
 assert.match(qwenRequestBody(input,rows).messages[0].content,/הרמה המחושבת לבקשה הנוכחית היא רמה א׳/);
 assert.match(qwenRequestBody(input,rows).messages[1].content,/הבקשה האחרונה לביצוע: פירוק לגורמים כיתה 9 רמה א/);
 assert.match(qwenRequestBody(input,rows).messages[1].content,/דף עבודה מאומת התואם לשינוי הרמה באותו נושא: g9-t2-a/);
 });
