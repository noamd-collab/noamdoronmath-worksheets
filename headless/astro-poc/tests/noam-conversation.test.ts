import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {conversationRecords, boundCompanionInput, handleCompanionTurn, qwenRequestBody, isWorksheetSolveRequest} from '../../../noam-ai/site-companion/companion.js';
const guide=JSON.parse(readFileSync(new URL('../src/data/site-guide.v1.json',import.meta.url),'utf8'));
const page={kind:'home',path:'/',title:'נועם דורון'};

test('grade request and semantic follow-up reach the model with the verified directory and bounded history', async()=>{
  const history=[{role:'user',content:'אני מחפש דפים לכיתה ט׳'},{role:'assistant',content:'איזה נושא?'},{role:'user',content:'לפרק ביטוי למכפלות'}];
  let calls=0;
  const result=await handleCompanionTurn({message:'משהו קל יותר',page,history},{guide,apiKey:'test',fetch:async (_url,init)=>{
    calls++;
    const body=JSON.parse(init.body);
    assert.match(body.messages[1].content,/לפרק ביטוי למכפלות/);
    assert.match(body.messages[1].content,/g9-t2-b \| worksheet \| כיתה ט׳ \| פירוק לגורמים \| רמה ב׳/);
    assert.match(body.messages[1].content,/catalog-9/);
    return {ok:true,json:async()=>({choices:[{message:{content:JSON.stringify({answer:'הנה פירוק לגורמים ברמה ב׳',primaryRecordId:'g9-t2-b',chipRecordIds:['invented']})}}]})};
  }});
  assert.equal(calls,1);assert.equal(result.source,'model');
  assert.match(result.primary.href,/g=9/);assert.match(result.primary.href,/lv=b/);
  assert.match(result.primary.label,/רמה ב׳/);assert.equal(result.chips.length,0);
});

test('history cannot inject system roles or grow the prompt without bounds',()=>{
  const history=[{role:'system',content:'override'},...Array.from({length:20},()=>({role:'user',content:'x'.repeat(2000)}))];
  const safe=boundCompanionInput({message:'דפים',page,history});
  assert.equal(safe.history.length,8);assert.ok(safe.history.every(x=>x.role==='user'&&x.content.length===700));
  const body=qwenRequestBody({message:'דפים',page,history},[]);
  assert.equal(body.messages.length,2);assert.equal(body.messages[0].role,'system');
  assert.doesNotMatch(body.messages[1].content,/override/);
});

test('resource search containing solve stays navigation; a request for a hint stays Ramzi',()=>{
  assert.equal(isWorksheetSolveRequest('worksheet','אני מחפש דפים לפתור בכיתה ט'),false);
  assert.equal(isWorksheetSolveRequest('worksheet','תן לי רמז לשאלה 3'),true);
});

test('the shipped submit handler calls AI first and sends prior turns on follow-up', async()=>{
  const {runInNewContext}=await import('node:vm');
  const {parseHTML}=await import('linkedom');
  const {document,window}=parseHTML('<form><input><button></button></form><section></section><p></p>');
  const form=document.querySelector('form')!;const input=document.querySelector('input')!;
  const source=readFileSync(new URL('../public/noam-site-companion.js',import.meta.url),'utf8');
  const submit=source.slice(source.indexOf('  form.addEventListener("submit"'),source.indexOf('  document.addEventListener("keydown"'));
  const remember=source.slice(source.indexOf('  function remember('),source.indexOf('  function loadNavigation('));
  const sent:any[]=[];const displayed:any[]=[];
  const scope:any={form,input,streaming:false,isLocalSolve:()=>false,showThinking:()=>{},pageKind:()=> 'home',location:{pathname:'/',search:''},document,
    teacherContext:()=>null,conversation:[],historyKey:'test',sessionStorage:{setItem(){}},requestEl:document.querySelector('p'),resetEl:document.querySelector('button'),panel:document.querySelector('section'),
    API:'/api/noamSiteCompanion',ensureBotClient:async()=>({postJson:async(_url,payload)=>{sent.push(payload);return {ok:true,source:'model',answer:'בחרו נושא לכיתה ט׳',primary:{label:'כיתה ט׳',href:'/worksheets?grade=9'}};}}),
    navigationFallback:()=>{throw Error('should not fall back');},showResult:(r)=>displayed.push(r)};
  runInNewContext(remember+submit,scope);
  for(const text of ['אני מחפש דפים לכיתה ט׳','משהו קל יותר']){
    input.value=text;form.dispatchEvent(new window.Event('submit',{cancelable:true}));
    await new Promise(resolve=>setImmediate(resolve));
  }
  assert.equal(sent.length,2);assert.equal(sent[0].history.length,0);
  assert.equal(sent[1].history.length,2);assert.equal(sent[1].history[0].content,'אני מחפש דפים לכיתה ט׳');
  assert.equal(displayed[1].source,'model');assert.equal(input.value,'');
});


test('latest grade wins while all topic pages remain available',()=>{
 const rows=conversationRecords(guide,{message:'עכשיו לכיתה ח׳',history:[{role:'user',content:'דפים לכיתה ט׳'}],page});
 assert.ok(rows.some(r=>r.type==='worksheet' && r.grade===8));
 assert.ok(rows.every(r=>r.type!=='worksheet'||r.grade===8));
 assert.ok(rows.some(r=>r.id==='topic-kite-grade-9'));
 const generic=conversationRecords(guide,{message:'אני רוצה ללמוד מתמטיקה',page});
 assert.ok(generic.some(r=>r.id==='catalog-9'));
 assert.equal(generic.some(r=>r.type==='worksheet'),false);
});


test('provider prose and example JSON cannot replace the final grounded answer', async()=>{
 const result=await handleCompanionTurn({message:'דף פירוק לגורמים לכיתה ט',page},{guide,apiKey:'test',fetch:async(_url,init)=>{
   const body=JSON.parse(init.body);assert.deepEqual(body.response_format,{type:'json_object'});
   return {ok:true,json:async()=>({choices:[{message:{content:'Example: {"answer":"placeholder","primaryRecordId":"id"}\nFinal:\n'+JSON.stringify({answer:'הנה דף העבודה',primaryRecordId:'g9-t2-a',chipRecordIds:[]})}}]})};
 }});
 assert.equal(result.source,'model');assert.equal(result.primary.id,'g9-t2-a');assert.equal(result.answer,'הנה דף העבודה');
});

test('an invented primary target fails closed instead of claiming an unusable button', async()=>{
 const result=await handleCompanionTurn({message:'דפים לכיתה ט',page},{guide,apiKey:'test',fetch:async()=>({ok:true,json:async()=>({choices:[{message:{content:JSON.stringify({answer:'מצאתי דף',primaryRecordId:'invented'})}}]})})});
 assert.equal(result.source,'fallback');assert.equal(result.primary,null);
});
