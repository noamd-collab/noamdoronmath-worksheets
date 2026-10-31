import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { handleNoamSiteCompanion } from '../../../noam-ai/site-companion/endpoint.js';
import { logTeacherSelection, parseClassifier, selectTeacherPlans } from '../../../noam-ai/site-companion/teacher-pick.js';

const catalogIndex = JSON.parse(readFileSync(new URL('../src/data/teacher-pick-index.json', import.meta.url), 'utf8'));
const family = (level: string) => level === 'c2' ? 'c' : level;
type Candidate = { id: string; label: string; key: string; family: string; questionKey: string; text: string };

function candidatesFor(rows: any[]): Candidate[] {
  return rows.flatMap(row => {
    const seen = new Set<number>();
    return row.questions.filter((label: string) => {
      const number = parseInt(label, 10); if (seen.has(number)) return false;
      seen.add(number); return true;
    }).map((label: string) => ({ id: /^(?:[abc]|c2)$/.test(row.level) ? `${row.level}:${label}` : label,
      label, key:`ex:${row.pdfId}:${label}`, family:family(row.level), questionKey:`${row.pdfId}:${parseInt(label,10)}`, text:`שאלה ${label}` }));
  });
}

function chosen(candidates: Candidate[], count: number, offset = count): string[] {
  const representatives = ['a','b','c'].map(level => {
    const matching = candidates.filter(item=>item.family===level);
    return matching.find(item=>item.id.startsWith('c2:')) || matching[0];
  }).filter(Boolean);
  const rest = candidates.filter(item=>!representatives.includes(item));
  const rotated = rest.slice(offset).concat(rest.slice(0,offset));
  return representatives.concat(rotated).slice(0,Math.min(count,candidates.length)).map(item=>item.id);
}

function inputFor(rows: any[], count = 5, candidates = candidatesFor(rows)) {
  return { message:`בחר ${count} שאלות שלמות עם AI`, page:{kind:'teachers',path:'/teachers',title:'למורים'},
    teacher:{grade:String(rows[0].grade),topic:String(rows[0].topicId),level:'all',count,planCounts:[5,10,15],goal:'first',style:'scaffold',
      note:'PRIVATE_TEACHER_NOTE_SENTINEL',candidates},
    botVerification:{provider:'recaptcha-v3',token:'PRIVATE_SYNTHETIC_VERIFICATION_SENTINEL'} };
}

function validModel(candidates: Candidate[], count = 5) {
  return { exerciseLabels:chosen(candidates,count,0),
    exerciseLabelsByCount:Object.fromEntries([5,10,15].map(size=>[String(size),chosen(candidates,size,size)])) };
}

type RequestOptions = { rows?: any[]; input?: ReturnType<typeof inputFor>; model?: unknown; raw?: string;
  status?: number; finishReason?: string; completionTokens?: number; providerBodyFails?: boolean; networkFails?: boolean;
  verification?: Record<string,unknown>; rateAllowed?: boolean };
async function request(options: RequestOptions = {}) {
  const rows = options.rows || catalogIndex.filter((row: any)=>row.grade===1 && row.topicId==='21');
  const input = options.input || inputFor(rows);
  const model = options.model === undefined ? validModel(input.teacher.candidates,input.teacher.count) : options.model;
  const raw = options.raw === undefined ? JSON.stringify(model) : options.raw;
  const calls: string[] = [], modelRequests: any[] = [], logs: any[] = [];
  const result = await handleNoamSiteCompanion({method:'POST',url:'https://www.noamdoronmath.co.il/api/noamSiteCompanion'}, {
    payload:input,origin:'https://www.noamdoronmath.co.il',clientIp:'203.0.113.61',store:new Map(),now:5000,
    teacherIndex:rows,catalog:{grades:[]},qwenKey:'PRIVATE_SYNTHETIC_MODEL_KEY_SENTINEL',
    qwenModel:'qwen3.8-flash',qwenBaseUrl:'https://token-plan.maas.qwencloudapi.com/compatible-mode/v1',
    recaptchaSecret:'PRIVATE_SYNTHETIC_RECAPTCHA_SECRET_SENTINEL',log:(entry: unknown)=>logs.push(entry),
    rateBackend:{async take(){calls.push('rate');return options.rateAllowed!==false;}},
    fetch:async (url: string, init: {body: string})=>{
      if(url==='https://www.google.com/recaptcha/api/siteverify'){
        calls.push('verify');return {ok:true,json:async()=>({success:true,score:0.9,hostname:'www.noamdoronmath.co.il',action:'noam_site_companion',...options.verification})};
      }
      assert.match(url,/\/chat\/completions$/);calls.push('model');modelRequests.push(JSON.parse(init.body));
      if(options.networkFails)throw new Error('PRIVATE_PROVIDER_NETWORK_SENTINEL');
      return {ok:(options.status||200)===200,status:options.status||200,json:async()=>{
        if(options.providerBodyFails)throw new SyntaxError('PRIVATE_PROVIDER_BODY_SENTINEL');
        return (options.status||200)!==200 ? {error:{code:'SyntheticProviderError',message:'PRIVATE_PROVIDER_RESPONSE_SENTINEL'}}
          : {choices:[{finish_reason:options.finishReason||'stop',message:{content:raw}}],usage:{completion_tokens:options.completionTokens}};
      }};
    },
  });
  return {result,body:result.body as any,calls,modelRequests,logs,raw,input,rows};
}

function assertSingleCall(run: Awaited<ReturnType<typeof request>>) {
  assert.deepEqual(run.calls,['rate','verify','model']);assert.equal(run.modelRequests.length,1);
}
function assertExactModelChoice(body: any, labels: string[], candidates: Candidate[]) {
  const expected = labels.map(label=>{
    const matches=candidates.filter(item=>item.id===label);assert.equal(matches.length,1);return matches[0];
  });
  assert.equal(body.source,'classifier');assert.equal(typeof body.model,'string');assert.ok(body.model);
  assert.deepEqual(body.modelExerciseIds,expected.map(item=>item.key));
  assert.deepEqual(new Set(body.exerciseIds),new Set(expected.map(item=>item.key)));
  assert.equal(new Set(body.exerciseIds).size,labels.length);
  assert.equal(new Set(expected.map(item=>item.questionKey)).size,labels.length);
  const required=new Set(candidates.map(item=>item.family).filter(value=>['a','b','c'].includes(value)));
  for(const level of required)assert.ok(expected.some(item=>item.family===level),`Missing ${level}`);
  assert.equal(body.selectionError,undefined);
  assert.doesNotMatch(body.answer||'',/הושלמה מקומית|הנה בחירה בסיסית|לא התקבלה/);
}
function assertRejected(run: Awaited<ReturnType<typeof request>>) {
  assert.equal(run.result.status,200);assertSingleCall(run);
  assert.equal(run.body.source,'fallback');assert.equal(run.body.model,null);
  assert.deepEqual(run.body.exerciseIds,[]);assert.deepEqual(run.body.modelExerciseIds,[]);
  assert.equal(run.body.teacherPlans,undefined);
  assert.doesNotMatch(run.body.answer||'',/הושלמה מקומית|הנה בחירה בסיסית/);
}

for(const [grade,topic] of [[1,'21'],[8,'43']] as const) {
  for(const count of [5,10,15]) {
    test(`G${grade}T${topic}: invalid primary recovers the exact ${count}-plan after one guarded model response`,async()=>{
      const rows=catalogIndex.filter((row: any)=>row.grade===grade&&row.topicId===topic);
      const input=inputFor(rows,count),model=validModel(input.teacher.candidates,count);
      model.exerciseLabels=input.teacher.candidates.filter(item=>item.family==='a').slice(0,count).map(item=>item.id);
      const run=await request({rows,input,model});assert.equal(run.result.status,200);assertSingleCall(run);
      assertExactModelChoice(run.body,model.exerciseLabelsByCount[String(count)],input.teacher.candidates);
      for(const size of [5,10,15]) assertExactModelChoice(run.body.teacherPlans[String(size)],model.exerciseLabelsByCount[String(size)],input.teacher.candidates);
      if(grade===8)assert.ok(model.exerciseLabelsByCount[String(count)].some(id=>id.startsWith('c2:')));
    });
  }
}

test('a valid primary remains authoritative even when its independent same-count plan differs',async()=>{
  const run=await request();assertSingleCall(run);
  const model=validModel(run.input.teacher.candidates);
  assert.notDeepEqual(model.exerciseLabels,model.exerciseLabelsByCount['5']);
  assertExactModelChoice(run.body,model.exerciseLabels,run.input.teacher.candidates);
  assertExactModelChoice(run.body.teacherPlans['5'],model.exerciseLabelsByCount['5'],run.input.teacher.candidates);
});

for(const invalid of ['missing','partial','duplicate','unknown','ambiguous','nested array','extra invalid','object'] as const) {
  test(`raw ${invalid} primary recovers only its independently validated same-count plan`,async()=>{
    const rows=catalogIndex.filter((row: any)=>row.grade===1&&row.topicId==='21');
    const input=inputFor(rows),model: any=validModel(input.teacher.candidates);
    if(invalid==='missing')delete model.exerciseLabels;
    if(invalid==='partial')model.exerciseLabels.pop();
    if(invalid==='duplicate')model.exerciseLabels[4]=model.exerciseLabels[3];
    if(invalid==='unknown')model.exerciseLabels[4]='c:999';
    if(invalid==='ambiguous')model.exerciseLabels=model.exerciseLabels.map((id: string)=>id.split(':')[1]);
    if(invalid==='nested array')model.exerciseLabels[0]=[model.exerciseLabels[0]];
    if(invalid==='extra invalid')model.exerciseLabels.push('PRIVATE_INVALID_PRIMARY_SENTINEL');
    if(invalid==='object')model.exerciseLabels={ids:model.exerciseLabels};
    const run=await request({rows,input,model});assertSingleCall(run);
    assertExactModelChoice(run.body,model.exerciseLabelsByCount['5'],input.teacher.candidates);
  });
}

test('another valid count never rescues a missing requested plan by slicing or padding',async()=>{
  for(const count of [5,10,15]) {
    const rows=catalogIndex.filter((row: any)=>row.grade===1&&row.topicId==='21');
    const input=inputFor(rows,count),model: any=validModel(input.teacher.candidates,count);
    delete model.exerciseLabels;delete model.exerciseLabelsByCount[String(count)];
    const run=await request({rows,input,model});assertRejected(run);
    assert.equal(run.body.selectionError,'MODEL_SELECTION_INVALID');
  }
});

for(const level of ['a','one','c2']) {
  for(const primary of ['missing','partial']) {
    test(`${level}: a ${primary} primary uses the validated exact plan rather than local completion`,async()=>{
      const rows=[{grade:9,topicId:'1',level,pdfId:'a'.repeat(32),questions:Array.from({length:20},(_,i)=>String(i+1))}];
      const input=inputFor(rows),model: any=validModel(input.teacher.candidates);
      if(primary==='missing')delete model.exerciseLabels;else model.exerciseLabels=model.exerciseLabels.slice(0,2);
      const run=await request({rows,input,model});assertSingleCall(run);
      assertExactModelChoice(run.body,model.exerciseLabelsByCount['5'],input.teacher.candidates);
      assert.ok(run.logs.some(entry=>entry.code==='MODEL_SELECTION_RECOVERED'&&entry.reason==='requested-plan'));
    });
  }
}

const responseFailures: [string,RequestOptions,string,string?][] = [
  ['missing content',{raw:''},'MODEL_RESPONSE_FAILED','missing-content'],
  ['invalid JSON',{raw:'{"PRIVATE_MODEL_RAW_SENTINEL":'},'MODEL_RESPONSE_FAILED','invalid-json'],
  ['truncated JSON',{raw:'{"exerciseLabelsByCount":{"5":["a:1"],"10":[',finishReason:'length',completionTokens:1200},'MODEL_RESPONSE_FAILED','length-limit'],
  ['provider 401',{status:401},'MODEL_AUTH_FAILED'],
  ['provider 403',{status:403},'MODEL_AUTH_FAILED'],
  ['provider 500',{status:500},'MODEL_HTTP'],
  ['provider network failure',{networkFails:true},'MODEL_HTTP'],
  ['provider unreadable JSON body',{providerBodyFails:true},'MODEL_RESPONSE_FAILED','invalid-json'],
];
for(const [name,options,code,reason] of responseFailures) {
  test(`${name} retains its real error category and never becomes a level-coverage failure`,async()=>{
    const run=await request(options);assertRejected(run);
    assert.equal(run.body.code,code);assert.equal(run.body.selectionError,undefined);
    assert.doesNotMatch(run.body.answer,/משלבת את כל הרמות/);
    if(reason) {
      const entry=run.logs.find(entry=>entry.event==='noam-teacher-selection');assert.ok(entry);
      assert.equal(entry.reason,reason);
      assert.equal(entry.code,reason==='length-limit'?'MODEL_RESPONSE_TRUNCATED':'MODEL_RESPONSE_INVALID');
      if(reason==='length-limit')assert.equal(entry.completionTokens,1200);
    }
    assert.doesNotMatch(JSON.stringify(run.logs),/PRIVATE_/);
  });
}

test('a complete independently validated result may still be used when a length finish is reported',async()=>{
  const run=await request({finishReason:'length',completionTokens:1200});assertSingleCall(run);
  assertExactModelChoice(run.body,validModel(run.input.teacher.candidates).exerciseLabels,run.input.teacher.candidates);
  assert.ok(run.logs.some(entry=>entry.code==='MODEL_RESPONSE_TRUNCATED'&&entry.reason==='length-limit'));
});

test('failure and recovery diagnostics contain only fixed categories and bounded counts, never private data',async()=>{
  const rows=catalogIndex.filter((row: any)=>row.grade===1&&row.topicId==='21');
  const input=inputFor(rows),model: any=validModel(input.teacher.candidates);delete model.exerciseLabels;
  const recovered=await request({rows,input,model});
  const rejected=await request({rows,input,model:{exerciseLabels:[],exerciseLabelsByCount:{}}});
  const malformed=await request({raw:'PRIVATE_MODEL_RAW_SENTINEL',finishReason:'PRIVATE_PROVIDER_FINISH_SENTINEL',completionTokens:1e9});
  assert.ok(recovered.logs.some(entry=>entry.code==='MODEL_SELECTION_RECOVERED'));
  assert.ok(rejected.logs.some(entry=>entry.code==='MODEL_SELECTION_REJECTED'));
  const events=[...recovered.logs,...rejected.logs,...malformed.logs].filter(entry=>entry.event==='noam-teacher-selection');
  const allowed=new Set(['event','code','reason','requestedCount','primaryCount','planCount','completionTokens','finishReason']);
  for(const entry of events) {
    assert.ok(Object.keys(entry).every(key=>allowed.has(key)));
    assert.ok(['MODEL_RESPONSE_INVALID','MODEL_RESPONSE_TRUNCATED','MODEL_SELECTION_REJECTED','MODEL_SELECTION_RECOVERED'].includes(entry.code));
    assert.ok(['missing-content','invalid-json','length-limit','primary-invalid','level-coverage','requested-plan'].includes(entry.reason));
    for(const [key,max] of [['requestedCount',60],['primaryCount',60],['planCount',3],['completionTokens',100000]] as const) {
      if(key in entry)assert.ok(Number.isInteger(entry[key])&&entry[key]>=0&&entry[key]<=max);
    }
    if('finishReason' in entry)assert.ok(['stop','length','content_filter','other','missing'].includes(entry.finishReason));
  }
  assert.equal(events.find(entry=>entry.finishReason==='other')?.completionTokens,100000);
  assert.doesNotMatch(JSON.stringify(events),/PRIVATE_|exerciseLabels|exerciseIds|Bearer|apiKey|botVerification/);
  const dropped: unknown[]=[];
  logTeacherSelection({log:(entry: unknown)=>dropped.push(entry)},{code:'PRIVATE_INVALID_CODE',reason:'requested-plan'});
  logTeacherSelection({log:(entry: unknown)=>dropped.push(entry)},{code:'MODEL_SELECTION_RECOVERED',reason:'PRIVATE_INVALID_REASON'});
  assert.deepEqual(dropped,[]);
});

for(const invalid of ['missing family','partial','extra','duplicate','unknown','nonstring'] as const) {
  test(`an invalid same-count plan (${invalid}) cannot rescue or locally complete primary output`,async()=>{
    const rows=catalogIndex.filter((row: any)=>row.grade===1&&row.topicId==='21');
    const input=inputFor(rows),model: any=validModel(input.teacher.candidates);delete model.exerciseLabels;
    const bad=model.exerciseLabelsByCount['5'];
    if(invalid==='missing family')model.exerciseLabelsByCount['5']=input.teacher.candidates.filter(item=>item.family==='a').slice(0,5).map(item=>item.id);
    if(invalid==='partial')bad.pop();
    if(invalid==='extra')bad.push('a:999');
    if(invalid==='duplicate')bad[4]=bad[3];
    if(invalid==='unknown')bad[4]='c:999';
    if(invalid==='nonstring')bad[4]=[bad[4]];
    const run=await request({rows,input,model});assertRejected(run);
    assert.equal(run.body.selectionError,'MODEL_SELECTION_INVALID');
  });
}

test('two parts of one source question cannot stand for two whole questions in a recovered plan',async()=>{
  const rows=['a','b','c'].map((level,i)=>({grade:3,topicId:'11',level,pdfId:String(i+1).repeat(32),questions:['1א','1ב','2א','3א']}));
  const input=inputFor(rows),extra={...input.teacher.candidates[0],id:'a:1ב',label:'1ב',key:`ex:${rows[0].pdfId}:1ב`};
  input.teacher.candidates.push(extra);
  const model={exerciseLabelsByCount:{'5':['a:1א','b:1א','c:1א','a:1ב','a:2א']}};
  assertRejected(await request({rows,input,model}));
});

test('excluded candidates stay excluded and exhausted families are not reintroduced during recovery',async()=>{
  const rows=catalogIndex.filter((row: any)=>row.grade===8&&row.topicId==='43');
  const original=candidatesFor(rows),candidates=original.filter(item=>item.family!=='c');
  const input=inputFor(rows,5,candidates),model: any=validModel(candidates);delete model.exerciseLabels;
  const run=await request({rows,input,model});assertSingleCall(run);
  assertExactModelChoice(run.body,model.exerciseLabelsByCount['5'],candidates);
  assert.ok(run.body.exerciseIds.every((id: string)=>candidates.some(item=>item.key===id)));
  model.exerciseLabelsByCount['5'][4]=original.find(item=>item.family==='c')!.id;
  assertRejected(await request({rows,input,model}));
});

for(const count of [8,12]) {
  test(`shortage request count ${count} does not infer whether an independent 10- or 15-plan was requested`,async()=>{
    const rows=catalogIndex.filter((row: any)=>row.grade===1&&row.topicId==='21');
    const all=candidatesFor(rows),allowed=new Set(chosen(all,count));
    const input=inputFor(rows,count,all.filter(item=>allowed.has(item.id))),model: any=validModel(input.teacher.candidates,count);
    delete model.exerciseLabels;
    const independentlyValid=selectTeacherPlans(rows,input,parseClassifier(JSON.stringify(model)),'offline-model');
    assert.ok(independentlyValid['10']);assert.ok(independentlyValid['15']);
    const run=await request({rows,input,model});assertRejected(run);
    assert.equal(run.body.selectionError,'MODEL_SELECTION_INVALID');
  });
}

test('verification and rate failures still prevent all model work and recovery',async()=>{
  const refused=await request({verification:{score:0.1}});
  assert.equal(refused.result.status,403);assert.equal(refused.body.code,'BOT_VERIFICATION_FAILED');
  assert.deepEqual(refused.calls,['rate','verify']);assert.equal(refused.body.teacherPlans,undefined);
  const limited=await request({rateAllowed:false});assert.equal(limited.result.status,429);
  assert.deepEqual(limited.calls,['rate']);assert.equal(limited.body.teacherPlans,undefined);
});
