import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { it } from 'node:test';
import { parseHTML } from 'linkedom';

const pub = new URL('../public/', import.meta.url);
const viewers = [new URL('../../../worksheet-viewer-noam.html',import.meta.url), new URL('worksheet-viewer-noam.html',pub)];
const sourceBytes=readFileSync(new URL('noam-ai/native/G8-T03/a/noam-ai.json',pub),'utf8');
const sourceData=JSON.parse(sourceBytes),sourceHash=createHash('sha256').update(sourceBytes).digest('hex');
const question=sourceData.questions.find((q:any)=>q.id==='q1');
const typedPlan={version:2,status:'ok',family:'table',tableSource:'question',evidence:[{source:'question',quote:question.text}]};
const legacyPlan={version:1,status:'ok',points:{A:[0,0],B:[4,0],C:[1,3]},segments:[['A','B'],['B','C'],['C','A']],highlights:[{from:'A',to:'B',color:'blue',label:'AB'}],angles:[],equalGroups:[],rightAngles:[],evidence:[]};
const modules=['noam-geometry.js','noam-diagram-plan.js','noam-native-visual.js','noam-authored-geometry.js','noam-authored-visual.js','noam-visual-data.js','noam-visual-plan.js'];
function fn(viewer:string,name:string) {const at=viewer.indexOf('function '+name+'(');assert.ok(at>=0,name);const t=viewer.slice(at);return t.slice(0,t.indexOf('\nfunction ',1));}
function deferred(){let resolve!:(value?:any)=>void;const promise=new Promise<any>(r=>{resolve=r;});return{promise,resolve};}
async function settle(){for(let i=0;i<30;i++)await Promise.resolve();}
function fixture(file=viewers[1],legacy=false) {
  const html=readFileSync(file,'utf8'),{document}=parseHTML('<html><body></body></html>');
  const exercise:any=legacy?{id:'G8-T09-A-Q02א',text:'נתון משולש ABC.'}:{id:'G8-T03-A-Q01א',part:'א',nativeQuestionId:'q1',nativeItemId:'q1a',text:'השלימו את הטבלה.'};
  const message:any={role:'assistant',text:legacy?'סמנו את הקטע AB.':'השתמשו בנתונים בטבלה.'},thread:any={hintIndex:1,history:[],messages:[{role:'user',text:'אפשר רמז 1?'},message]};
  const calls:any[]=[],fetches:string[]=[],renders:string[]=[],notices:string[]=[];
  const manifest:any={sourceSha256:'same-pdf',exercises:[exercise],...(legacy?{}:{nativeExportUrl:'/noam-ai/native/G8-T03/a/noam-ai.json',nativeExportSha256:sourceHash})};
  const c:any={document,manifest,pdf:'fixture-pdf',selectedExercise:exercise,threads:{[exercise.id]:thread},API:'https://api.test/_functions',g:8,lv:'a',LEVEL:{a:'רמה א׳'},ttl:'ביטויים',ownerKey:'unchanged-owner',Map,WeakSet,Promise,console:{warn(){}},
    noamNativeFocusUrl:()=>null,noamSourceCropRequested:()=>false,noamConstructedVisual:()=>null,noamParsedLocalVisual:()=>null,
    exerciseThread:(id:string)=>c.threads[id],saveNoamState(){},renderNoamChat(){renders.push(c.selectedExercise.id);},announceNoam:(s:string)=>notices.push(s),
    noamDiagramRefresh:(e:any,t:any)=>{if(c.selectedExercise.id===e.id&&c.threads[e.id]===t)renders.push(e.id);},
    getExerciseAnalysis:async()=>({readable:true,transcription:legacy?exercise.text:question.text,diagram_description:''}),
    cropExerciseImage:async()=> 'data:image/png;base64,fixture',isBotProtectionError:(e:any)=>e.code==='BOT_BLOCKED'};
  c.window=c;
  function clone(value:any){c.__clone=JSON.stringify(value);return runInNewContext('JSON.parse(__clone)',c);}
  c.fetch=async(url:string)=>{fetches.push(url);return{ok:true,json:async()=>clone(sourceData)};};
  c.postJson=async(url:string,payload:any)=>{calls.push({url,payload});return{ok:true,accepted:true,jobId:'job-'+calls.length};};
  c.pollNoamDiagramJob=async()=>clone({ok:true,plan:legacy?legacyPlan:typedPlan,sourceSha256:sourceHash,validationQuestionText:legacy?exercise.text:'model text is not authoritative for typed plans'});
  for(const name of modules)runInNewContext(readFileSync(new URL(name,pub),'utf8'),c,{filename:name});
  const sourceHelpers='var noamSourceVisualPackages='+html.split('var noamSourceVisualPackages=')[1].split('function noamNativeFigure(')[0];
  const names=['noamDiagramRuntime','noamDiagramSourceIdentity','noamDiagramAnalysis','noamDiagramQuestionText','noamTypedVisualContext','noamInspectVisualPlan','noamRenderVisualPlan','noamRenderAiDiagram','noamDiagramError','noamNativeDiagramContext','noamDiagramSourceInput','requestNoamDiagram'];
  // The released viewer retains earlier native-focus and printed-mark guards.
  // Include their real functions: these no-figure fixtures must pass through
  // them naturally, rather than mocking those production branches away.
  for(const name of ['noamPrepareNativeFocus','noamNativeLengthComparisonHint','noamLoadNativeFocus','noamNativeSegmentFocus','noamSourceGivens'])if(html.includes('function '+name+'('))names.push(name);
  runInNewContext(sourceHelpers+'\n'+names.map(n=>fn(html,n)).join('\n'),c);
  const options={studentMessage:'אפשר רמז 1?',answer:message.text,helpKind:'hint',hintIndex:1,drawCurrentStep:true};
  return{c,clone,exercise,message,thread,manifest,calls,fetches,renders,notices,options};
}

for(const file of viewers)it('actual '+(file===viewers[0]?'root':'public')+' viewer runs one protected v2 request and renders exact source table',async()=>{
  const f=fixture(file);const first=f.c.requestNoamDiagram(f.exercise,f.thread,f.message,f.options);
  assert.equal(f.c.requestNoamDiagram(f.exercise,f.thread,f.message,f.options),first);
  const visual=await first;assert.equal(visual.type,'ai-diagram');assert.equal(visual.plan.version,2);assert.equal(f.calls.length,1);
  assert.equal(f.calls[0].payload.ownerKey,'unchanged-owner');assert.match(f.calls[0].payload.questionText,/^NOAM_VISUAL_SOURCE_V2:/);
  assert.match(f.calls[0].payload.studentMessage,/הצג המחשה/);assert.equal(f.c.noamDiagramRuntime().messages.size,0);
  const figure=f.c.noamRenderAiDiagram(visual);assert.ok(figure.querySelector('table'));
  assert.equal([...figure.querySelectorAll('tbody td')].filter((td:any)=>td.textContent==='?').length,6);
  assert.equal(figure.querySelectorAll('img,script,iframe,foreignObject').length,0);
  await f.c.requestNoamDiagram(f.exercise,f.thread,f.message,f.options);assert.equal(f.calls.length,1,'identical repeat reuses validated current result');
});

it('saved v2 plans load fresh selected source once and revalidate instead of trusting stored result cells',async()=>{
  const a=fixture(),visual=await a.c.requestNoamDiagram(a.exercise,a.thread,a.message,a.options),b=fixture();
  const stored=b.clone(visual);stored.scene={table:{head:['fake'],rows:[['computed answer']]}};
  assert.equal(b.c.noamRenderAiDiagram(stored),null);assert.equal(b.c.noamRenderAiDiagram(stored),null);await settle();
  assert.equal(b.fetches.length,1);assert.equal(b.calls.length,0);
  const figure=b.c.noamRenderAiDiagram(stored);assert.ok(figure.querySelector('table'));assert.doesNotMatch(figure.textContent,/computed answer|fake/);
  assert.equal([...figure.querySelectorAll('tbody td')].filter((td:any)=>td.textContent==='?').length,6);
});

it('a changed PDF, native version, question or selected part cannot rehydrate an old typed result',async()=>{
  const f=fixture(),visual=await f.c.requestNoamDiagram(f.exercise,f.thread,f.message,f.options);
  for(const mutate of [(v:any)=>v.sourceIdentity='wrong',(v:any)=>v.nativeSourceIdentity='wrong',(v:any)=>v.exerciseId='G8-T03-A-Q01ב',(v:any)=>v.plan.evidence[0].quote='not authored']){
    const candidate=f.clone(visual);mutate(candidate);assert.equal(f.c.noamRenderAiDiagram(candidate),null);
  }
  f.exercise.nativeItemId='q1b';assert.equal(f.c.noamRenderAiDiagram(visual),null);
});

it('native version changes invalidate the request cache even when the PDF identity stays the same',async()=>{
  const f=fixture(),old=await f.c.requestNoamDiagram(f.exercise,f.thread,f.message,f.options);
  f.manifest.nativeExportSha256='b'.repeat(64);f.c.pollNoamDiagramJob=async()=>f.clone({ok:true,plan:typedPlan,sourceSha256:f.manifest.nativeExportSha256});
  assert.equal(f.c.noamRenderAiDiagram(old),null);
  const fresh=await f.c.requestNoamDiagram(f.exercise,f.thread,f.message,f.options);
  assert.equal(f.calls.length,2);assert.notEqual(fresh.nativeSourceIdentity,old.nativeSourceIdentity);assert.ok(f.c.noamRenderAiDiagram(fresh));
});

it('worker results with a different source hash or invented evidence never enter the success cache',async()=>{
  for(const kind of ['hash','evidence']){
    const f=fixture();const result:any={ok:true,plan:JSON.parse(JSON.stringify(typedPlan)),sourceSha256:sourceHash};
    if(kind==='hash')result.sourceSha256='0'.repeat(64);else result.plan.evidence[0].quote='the answer is42';
    f.c.pollNoamDiagramJob=async()=>f.clone(result);
    assert.equal(await f.c.requestNoamDiagram(f.exercise,f.thread,f.message,f.options),null);assert.equal(f.message.visual,undefined);assert.equal(f.c.noamDiagramRuntime().cache.size,0);
    assert.equal(f.message.diagramErrorCode,'DIAGRAM_UNSUPPORTED');
  }
});

it('opt-in marker requires loaded exact native identity, including valid nonfigure sources',async()=>{
  const good=fixture(),source=await good.c.noamDiagramSourceInput(good.exercise);
  const marker=JSON.parse(source.questionText.split('\n')[0].split('NOAM_VISUAL_SOURCE_V2:')[1]);
  assert.deepEqual(marker,{path:good.manifest.nativeExportUrl,sha256:sourceHash,questionId:'q1',itemId:'q1a',part:'א'});
  for(const broken of ['fetch','item','sha']){
    const f=fixture();if(broken==='fetch')f.c.fetch=async()=>({ok:false});if(broken==='item')f.exercise.nativeItemId='q1b';if(broken==='sha')f.manifest.nativeExportSha256='missing';
    assert.doesNotMatch((await f.c.noamDiagramSourceInput(f.exercise)).questionText,/NOAM_VISUAL_SOURCE_V2:/,broken);
  }
});

it('source-loading failure during rehydration is retryable and never calls protected generation',async()=>{
  const f=fixture(),saved=await f.c.requestNoamDiagram(f.exercise,f.thread,f.message,f.options),g=fixture();let failed=false;
  const fetch=g.c.fetch;g.c.fetch=async(url:string)=>{if(!failed){failed=true;return{ok:false};}return fetch(url);};
  const visual=g.clone(saved);assert.equal(g.c.noamRenderAiDiagram(visual),null);await settle();assert.equal(g.c.noamRenderAiDiagram(visual),null);await settle();
  assert.ok(g.c.noamRenderAiDiagram(visual));assert.equal(g.calls.length,0);
});

it('section switching and deleted messages cannot populate the wrong conversation after a v2 job',async()=>{
  for(const mode of ['switch','delete']){
    const f=fixture(),gate=deferred();f.c.pollNoamDiagramJob=async()=>{await gate.promise;return f.clone({ok:true,plan:typedPlan,sourceSha256:sourceHash});};
    const pending=f.c.requestNoamDiagram(f.exercise,f.thread,f.message,f.options);await settle();const before=f.renders.length;
    if(mode==='switch'){f.c.selectedExercise={id:'other'};f.c.threads.other={messages:[]};}else f.thread.messages=[];
    gate.resolve();await pending;
    if(mode==='switch'){assert.deepEqual(f.c.threads.other.messages,[]);assert.equal(f.renders.length,before);}else assert.equal(f.message.visual,undefined);
  }
});

it('legacy version1 clients and saved diagrams still use the unchanged geometric compiler',async()=>{
  const f=fixture(viewers[1],true);delete f.c.NoamVisualPlan;
  const visual=await f.c.requestNoamDiagram(f.exercise,f.thread,f.message,f.options);assert.equal(visual.plan.version,1);
  assert.equal(f.calls.length,1);assert.doesNotMatch(f.calls[0].payload.questionText,/NOAM_VISUAL_SOURCE_V2:/);assert.equal(f.fetches.length,0);
  assert.ok(f.c.noamRenderAiDiagram(visual).querySelector('svg'));assert.equal(visual.nativeSourceIdentity,undefined);
});

it('security/network failures do not become source evidence or a successful typed diagram',async()=>{
  const f=fixture();f.c.postJson=async()=>{const e:any=new Error('security refused');e.code='BOT_BLOCKED';throw e;};
  assert.equal(await f.c.requestNoamDiagram(f.exercise,f.thread,f.message,f.options),null);assert.equal(f.message.visual,undefined);assert.equal(f.message.diagramErrorCode,'DIAGRAM_UNAVAILABLE');assert.equal(f.c.noamDiagramRuntime().cache.size,0);
});
