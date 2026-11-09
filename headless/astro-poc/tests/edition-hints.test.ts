import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';
import { parseHTML } from 'linkedom';
import { prepareMeasuredManifestDraft, validateMeasuredManifest } from '../scripts/lib/measured-worksheet.mjs';
const pub=new URL('../public/',import.meta.url);
const code=readFileSync(new URL('noam-curated-hints.js',pub),'utf8');
const viewer=readFileSync(new URL('worksheet-viewer-noam.html',pub),'utf8');
const fixture=new URL('./fixtures/measured-v1/a05-B/',import.meta.url);
const pdfBytes=readFileSync(new URL('sheet.pdf',fixture));
const draft=JSON.parse(readFileSync(new URL('draft.json',fixture),'utf8'));
const pdfId='a'.repeat(32),config={url:'https://synthetic123.supabase.co',key:'sb_publishable_synthetic_test'};
const texts=['רמז ראשון','רמז שני','רמז שלישי'];
function manifest(){
 const m=prepareMeasuredManifestDraft(draft,readFileSync(new URL('layout.json',fixture)),{pdfId,url:`https://static.wixstatic.com/ugd/d8e7ad_${pdfId}.pdf`,downloadedSha256:draft.binding.pdfSha256,syntheticTestFixture:true});
 // Simulates a published response ONLY in memory. This is neither a saved
 // publication entry nor source/hint approval. Original fixtures stay drafts.
 return {...m,publishable:true,reviewRequired:false,syntheticTestFixture:false};
}
function row(m:any,ex=m.exercises[0],extra:any={}){return {edition_id:m.editionId,exercise_id:ex.id,source_pdf_hash:m.pdfHash,source_pdf_sha256:m.sourceSha256,canonical_source_sha256:m.canonicalSourceSha256,canonical_question_sha256:ex.canonicalQuestionSha256,canonical_item_id:ex.canonicalItemId,source_exercise_sha256:ex.sourceExerciseSha256,hint_1:texts[0],hint_2:texts[1],hint_3:texts[2],status:'verified',...extra};}
function setup(extra:any={}){const c:any={Promise,AbortController,TextEncoder,Uint8Array,setTimeout,clearTimeout,crypto:webcrypto,NOAM_LEARNING_CONFIG:config,...extra};runInNewContext(code,c);return {c,bank:c.NoamCuratedHints};}
function fetchRows(rows:any,calls:any[]=[]){return async(url:string,init:any)=>{calls.push({url,init});return {ok:true,json:async()=>rows};};}
function context(m:any){return {gradeNumber:Number(m.prefix.slice(1,2)),editionId:m.editionId,pdfHash:m.pdfHash,prefix:m.prefix,levelCode:m.levelCode};}
function clone(v:any){return structuredClone(v);}

test('edition query uses only the separate table, public columns and all source filters',async()=>{
 const m=manifest(),{bank}=setup(),calls:any[]=[];
 assert.equal(await bank.prefetch(m,{fetch:fetchRows([row(m)],calls)}),1);
 assert.deepEqual(Array.from(bank.get(m,m.exercises[0].id).hints),texts);
 const url=new URL(calls[0].url);assert.equal(url.pathname,'/rest/v1/noam_worksheet_edition_hints');
 assert.equal(url.searchParams.get('edition_id'),'eq.'+m.editionId);assert.equal(url.searchParams.get('source_pdf_hash'),'eq.'+m.pdfHash);
 assert.equal(url.searchParams.get('source_pdf_sha256'),'eq.'+m.sourceSha256);assert.equal(url.searchParams.get('canonical_source_sha256'),'eq.'+m.canonicalSourceSha256);assert.equal(url.searchParams.get('status'),'eq.verified');
 assert.doesNotMatch(url.searchParams.get('select')!,/\*|review_reference|updated_at/);assert.equal(calls[0].init.credentials,'omit');assert.equal(calls[0].init.headers.Authorization,undefined);
});
test('each edition/source/question/item/exercise/PDF binding is mandatory, including status',async()=>{
 const m=manifest();
 for(const field of ['edition_id','source_pdf_hash','source_pdf_sha256','canonical_source_sha256','canonical_question_sha256','canonical_item_id','source_exercise_sha256','exercise_id','status']){
  for(const val of ['wrong',null,undefined]){const {bank}=setup();assert.equal(await bank.prefetch(m,{fetch:fetchRows([row(m,undefined,{[field]:val})])}),0,field);assert.equal(bank.get(m,m.exercises[0].id),null);}
 }
});
test('same-looking legacy or different-edition hints never fill an edition miss or failure',async()=>{
 const m=manifest(),{bank}=setup(),calls:any[]=[];
 assert.equal(await bank.prefetch(m,{fetch:fetchRows([{exercise_id:m.exercises[0].id,source_pdf_hash:m.pdfHash,hint_1:'legacy',hint_2:'legacy',hint_3:'legacy'},row(m,undefined,{edition_id:'other'})],calls)}),0);
 assert.equal(calls.length,1);assert.equal(bank.status(m,m.exercises[0].id),'missing');
 bank.invalidate(m);assert.equal(await bank.prefetch(m,{fetch:async(url:string)=>{calls.push({url});throw new Error('offline');}}),0);
 assert.ok(calls.every(x=>x.url.includes('/noam_worksheet_edition_hints?')));
});
test('duplicate rows/IDs and incomplete hints cannot create a partial matching set',async()=>{
 const m=manifest();
 for(const rows of [[row(m),row(m)],[row(m,undefined,{hint_1:''})],[row(m,undefined,{hint_2:'x'.repeat(601)})]]){const {bank}=setup();assert.equal(await bank.prefetch(m,{fetch:fetchRows(rows)}),0);}
 for(const mutate of [(m:any)=>m.exercises.push(clone(m.exercises[0])),(m:any)=>m.exercises[1].canonicalItemId=m.exercises[0].canonicalItemId]){const x=manifest();mutate(x);const {bank}=setup(),calls:any[]=[];assert.equal(await bank.prefetch(x,{fetch:fetchRows([],calls)}),0);assert.equal(calls.length,0);}
});
test('malformed canonical manifests never fall back to legacy and draft/test fixtures remain disabled',async()=>{
 for(const edit of [{editionId:undefined},{editionId:''},{editionId:'legacy'},{editionId:'abc\n'},{editionId:'A'},{editionId:'a'.repeat(65)},{publishable:false},{reviewRequired:true},{syntheticTestFixture:true},{sourceSha256:''},{canonicalSourceSha256:null}]){
  const m={...manifest(),...edit},{bank}=setup(),calls:any[]=[];assert.equal(await bank.prefetch(m,{fetch:fetchRows([],calls)}),0);assert.equal(calls.length,0);
 }
});
test('text is normalized and hashed before any query; all binding fields separate cached entries',async()=>{
 const m=manifest(),{bank}=setup(),calls:any[]=[];await bank.prefetch(m,{fetch:fetchRows([row(m)],calls)});
 for(const change of [(x:any)=>x.editionId='another',(x:any)=>x.sourceSha256='1'.repeat(64),(x:any)=>x.canonicalSourceSha256='2'.repeat(64),(x:any)=>x.exercises[0].canonicalQuestionSha256='3'.repeat(64),(x:any)=>x.exercises[0].canonicalItemId='other-id',(x:any)=>x.exercises[0].sourceExerciseSha256='4'.repeat(64),(x:any)=>x.exercises[0].text+=' changed']){
  const x=clone(m);change(x);assert.equal(bank.get(x,m.exercises[0].id),null);
 }
 const x=clone(m);x.exercises[0].text+=' changed';const other=setup().bank;assert.equal(await other.prefetch(x,{fetch:fetchRows([row(x)],calls)}),0);assert.equal(calls.length,1);
});
test('viewer requires exact URL edition, prefix, level, PDF ID and actual PDF SHA',async()=>{
 const m=manifest(),{bank}=setup();assert.equal(await bank.validateViewerBinding(m,context(m),pdfBytes),true);
 for(const change of [{gradeNumber:9},{gradeNumber:'1'},{gradeNumber:undefined},{editionId:''},{editionId:'other'},{prefix:'G2-T05'},{levelCode:'A'},{pdfHash:'1'.repeat(32)}])assert.equal(await bank.validateViewerBinding(m,{...context(m),...change},pdfBytes),false);
 assert.equal(await bank.validateViewerBinding(m,context(m),Buffer.from('%PDF-wrong')),false);
 assert.equal(await bank.validateViewerBinding(m,context(m),undefined),false);
 assert.equal(await setup({crypto:null}).bank.validateViewerBinding(m,context(m),pdfBytes),false);
 assert.equal(await bank.validateViewerBinding({prefix:m.prefix,pdfHash:m.pdfHash,exercises:m.exercises},context(m),pdfBytes),false);
 assert.equal(await bank.validateViewerBinding({...m,grade:9},context(m),pdfBytes),false);
 assert.equal(await bank.validateViewerBinding({...m,grade:'1'},context(m),pdfBytes),false);
 const stale=clone(m);stale.exercises[0].text+=' unbound';assert.equal(await bank.validateViewerBinding(stale,context(m),pdfBytes),false);
});
test('measured ingestion enforces canonical task hashes and identity before downstream consumers',()=>{
 const m=manifest();validateMeasuredManifest(m,{allowDraft:true});
 for(const change of [(x:any)=>x.editionId='legacy',(x:any)=>x.exercises[0].text+=' changed',(x:any)=>delete x.exercises[0].canonicalQuestionSha256,(x:any)=>x.exercises[0].id='G1-T05-A-Q01א']){const x=clone(m);change(x);assert.throws(()=>validateMeasuredManifest(x,{allowDraft:true}));}
});

function viewerFunction(name:string,endMarker:string){const start=viewer.indexOf('function '+name+'('),end=viewer.indexOf(endMarker,start);assert.ok(start>=0&&end>start);return viewer.slice(start,end);}
function deferred(){let resolve:any;const promise=new Promise<any>(r=>resolve=r);return {promise,resolve};}
function viewerSetup(fetch:any){
 const m=manifest(),base=setup(),counts={prefetch:0,pdfLoads:0,pdfData:0,pins:0},storageKeys:string[]=[];
 const bank={...base.bank,prefetch:async()=>{counts.prefetch++;return 0;}};
 const c:any={Promise,console:{warn(){}},location:{search:'?edition='+m.editionId},g:1,editionRequested:true,editionId:m.editionId,pdf:m.pdfHash,x:m.prefix,lv:'b',LEVEL:{b:'B'},aiReady:true,MANIFEST_PATH:'synthetic-manifest.json',fetch,
  window:{NoamCuratedHints:bank},fab:{classList:{add(){},remove(){}}},manifest:null,manifestReady:false,selectedExercise:null,threads:{},analysisCache:{},renderManifestPins(){counts.pins++;},saveNoamState(){},
  sessionStorage:{getItem(key:string){storageKeys.push(key);return null;}},THREAD_STORAGE_KEY:'legacy-key',ANALYSIS_STORAGE_KEY:'legacy-analysis',
  noamPdfEngineReady:Promise.resolve(),ensurePdfDocumentForCrop:async()=>{counts.pdfLoads++;return {getData:async()=>{counts.pdfData++;return pdfBytes;}};}};
 runInNewContext('var noamManifestLoadVersion=0;\n'+viewerFunction('hydrateEditionState','\nfunction saveNoamState')+'\n'+viewerFunction('loadStaticManifest','\n/* Resolve pins'),c);
 return {c,m,counts,storageKeys};
}
test('viewer delays hints/state until PDF validation and reuses existing document bytes',async()=>{
 const first=deferred(),{c,m,counts,storageKeys}=viewerSetup(()=>first.promise);const pending=c.loadStaticManifest();assert.equal(counts.prefetch,0);assert.equal(storageKeys.length,0);
 first.resolve({ok:true,json:async()=>m});await pending;assert.equal(c.manifestReady,true);assert.equal(counts.prefetch,1);assert.equal(counts.pdfLoads,1);assert.equal(counts.pdfData,1);
 assert.ok(storageKeys.every(k=>k.startsWith('noam-edition-')&&k.includes(m.editionId)&&k.includes(m.canonicalSourceSha256)&&k.includes(m.sourceSha256)));
 assert.ok(viewer.includes('if (editionRequested){pdfCropLoadPromise = loadTask.promise;}'));
});
test('late or mismatched manifests cannot replace a newer binding or restore stale threads',async()=>{
 const old=deferred(),fresh=deferred();let requests=0;const {c,m,counts,storageKeys}=viewerSetup(()=>++requests===1?old.promise:fresh.promise);
 const oldRun=c.loadStaticManifest(),freshRun=c.loadStaticManifest();fresh.resolve({ok:true,json:async()=>m});await freshRun;old.resolve({ok:true,json:async()=>({...m,editionId:'stale'})});await oldRun;
 assert.equal(c.manifest.editionId,m.editionId);assert.equal(counts.prefetch,1);assert.equal(storageKeys.length,2);
 const wrong=viewerSetup(async()=>({ok:true,json:async()=>({...m,pdfHash:'b'.repeat(32)})}));await wrong.c.loadStaticManifest();assert.equal(wrong.c.manifestReady,false);assert.equal(wrong.counts.prefetch,0);assert.equal(wrong.storageKeys.length,0);
 const race=deferred(),changed=viewerSetup(()=>race.promise),p=changed.c.loadStaticManifest();changed.c.location.search+='&lv=a';race.resolve({ok:true,json:async()=>m});await p;assert.equal(changed.c.manifestReady,false);assert.equal(changed.counts.prefetch,0);
});
test('both viewer and client copies contain the edition gates and preserve level URL context',()=>{
 assert.equal(readFileSync(new URL('../../../noam-curated-hints.js',import.meta.url),'utf8'),code);
 for(const text of [viewer,readFileSync(new URL('../../../worksheet-viewer-noam.html',import.meta.url),'utf8')]){
  assert.match(text,/var editionRequested = q\.has\("edition"\)/);assert.match(text,/bank\.validateViewerBinding\(data/);assert.match(text,/new URL\(\s*window\.location\.href/);
  assert.match(text,/if \(!editionRequested\)\{[\s\S]{0,200}sessionStorage\.getItem\(THREAD_STORAGE_KEY\)/);
 }
});

test('elementary editions block freeform, overview, mistakes and every old network gateway before side effects',async()=>{
 for(const source of [viewer,readFileSync(new URL('../../../worksheet-viewer-noam.html',import.meta.url),'utf8')]){
  const c:any={elementaryPreparedHintsOnly:true,Promise,Error};
  const extract=(name:string)=>{const start=source.indexOf('function '+name+'('),end=source.indexOf('\nfunction ',start+1);return source.slice(start,end);};
  for(const name of ['askNoam','postJson','ensureNoamBotClient','postNoamDiagramStatus','noamPageAllowsDrawingHint'])runInNewContext(extract(name),c);
  // No selected exercise, thread, token, fetch, diagram runtime or DOM was
  // provided: the closed path must stop before reading or mutating any of them.
  for(const kind of ['free_question','overview','common_mistake','unknown'])assert.equal(c.askNoam(kind,'test'),undefined);
  for(const call of [()=>c.postJson('/noamImageSolve',{}),()=>c.ensureNoamBotClient(),()=>c.postNoamDiagramStatus('test')])await assert.rejects(call,(e:any)=>e.code==='PREPARED_HINTS_ONLY');
  assert.equal(c.noamPageAllowsDrawingHint(),false);
 }
});
test('prepared-only state gets its own namespace and UI omits legacy model/attachment controls',()=>{
 const {c,m,storageKeys}=viewerSetup(async()=>({ok:true,json:async()=>manifest()}));c.elementaryPreparedHintsOnly=true;c.hydrateEditionState(m);
 assert.ok(storageKeys.every(k=>k.includes('prepared-only-v1')));
 const body=viewerFunction('renderPreparedEditionChat','\nfunction renderNoamChat');
 assert.doesNotMatch(body,/id="(?:noamQuestion|noamSend|noamDraw|noamOverview|noamAttachInput)"/);
 assert.match(body,/id="noamHint"/);assert.match(body,/askNoam\("hint"/);
});

// Scope the canonical underscore convention to edition question presentation.
// Legacy equation and fraction renderers are not rewritten.
test('canonical answer blanks render as lines without altering ordinary subscripts or input bytes',()=>{
 const c:any={esc:(s:string)=>s.replace(/</g,'&lt;'),noamFractionHtml:(s:string)=>s.replace(/</g,'&lt;')};
 runInNewContext(viewerFunction('noamEditionQuestionHtml','\n// Prepared hints'),c);
 const text='השלימו:\n$1 + 2 = ___$ וגם $x_1 + 4$ <script>';
 const before=text,result=c.noamEditionQuestionHtml(text);
 assert.equal(text,before);assert.ok(result.includes('\\underline{\\qquad}'));assert.ok(result.includes('$x_1 + 4$'));
 assert.ok(result.includes('<br>'));assert.ok(result.includes('&lt;script>'));
});

test('edition missing/offline errors return to the worksheet, never offer or focus an absent composer',()=>{
 for(const source of [viewer,readFileSync(new URL('../../../worksheet-viewer-noam.html',import.meta.url),'utf8')])for(const code of ['PREPARED_HINT_MISSING','PREPARED_HINT_UNAVAILABLE']){
  const {document}=parseHTML('<html><body><div id="test"></div></body></html>');let located=0;
  const c:any={document,elementaryPreparedHintsOnly:true,selectedExercise:{id:'test'},noamStripMarkdownEmphasis:(x:string)=>x,noamCanOfferDrawing:()=>false,locateSelectedExercise:()=>located++,window:{},retryLastNoamHelp:()=>{throw Error('legacy retry forbidden');}};
  for(const name of ['noamRetryActionLabel','addTranscriptBubble']){const a=source.indexOf('function '+name+'('),b=source.indexOf('\nfunction ',a+1);runInNewContext(source.slice(a,b),c);}
  c.addTranscriptBubble(document.getElementById('test'),'assistant','אין רמז זמין','',null,{answerError:true,answerErrorCode:code},{});
  const button=document.querySelector('button')!;assert.equal(button.textContent,'חזרה לדף');button.click();assert.equal(located,1);
  assert.doesNotMatch(document.body.textContent,/כתבו שאלה נוספת/);
 }
});

test('full viewer URL gate already rejects cross-grade prefixes before manifest loading',async()=>{
 for(const source of [viewer,readFileSync(new URL('../../../worksheet-viewer-noam.html',import.meta.url),'utf8')]){
  const start=source.indexOf('var editionRequested ='),end=source.indexOf('/* INVALID PDF */',start);
  const c:any={q:new URLSearchParams('edition=fixture-v1'),g:9,x:'G1-T05',lv:'b',okPdf:true,LEVEL:{b:'B'}};
  runInNewContext(source.slice(start,end),c);assert.equal(c.okX,false);assert.equal(c.aiReady,false);
  let fetched=0;const f=viewerSetup(async()=>{fetched++;throw Error('must not fetch');});f.c.aiReady=c.aiReady;f.c.g=9;
  await f.c.loadStaticManifest();assert.equal(fetched,0);assert.equal(f.counts.prefetch,0);assert.equal(f.storageKeys.length,0);
 }
});
