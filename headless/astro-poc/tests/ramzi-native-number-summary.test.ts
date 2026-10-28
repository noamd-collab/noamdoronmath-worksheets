import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import {fileURLToPath} from 'node:url';
import {it} from 'node:test';
const root=new URL('../../../',import.meta.url),require=createRequire(import.meta.url);
const {isGenericNumberSummary,summariesForQuestion,cleanManifest,scan}=require(new URL('scripts/strip-native-number-summaries.cjs',root).pathname);
const line='הנתונים: $6$, $9$, $4$';
function pair(){const question={id:'q4',text:['שלוש קופסאות:','$6, 9, 9$'],given:[{text:line}],items:[{id:'q4a',label:'א',text:'חלקו בשווה.'}]};return {native:{questions:[question]},manifest:{exercises:[{id:'G8-T32-B-Q04א',nativeQuestionId:'q4',nativeItemId:'q4a',part:'א',context:question.text.join('\n')+'\n'+line,prompt:'פתיח\n'+line+'\nהסעיף הנבחר: חלקו בשווה.',text:'חלקו בשווה.',crop:{page:2}}]}};}
it('only exact text-only numeric summaries qualify; relations, units and printed prose do not',()=>{
  for(const text of [line,'הנתונים: $6$, $9$, $9$','הנתונים: $−2.5$, $0$, $+4$'])assert.equal(isGenericNumberSummary({text}),true);
  for(const g of [{text:line,type:'given'},{text:line,unit:'סמ'},line,{text:'הנתונים: AB = AC'},{text:'הנתונים: $x$, $2$'},{text:'הנתונים: $6$ ס״מ, $9$ ס״מ'},{text:'הנתונים: $\\frac{1}{2}$, $3$'},{text:'לפי הנתונים: $6$, $9$, $4$'}])assert.equal(isGenericNumberSummary(g),false);
});
it('remove every exact generated standalone occurrence, retaining different and inline lists and all other fields',()=>{
  const {native,manifest}=pair();manifest.exercises[0].context+='\n'+line+'\nהנתונים: $6$, $9$, $9$\nטקסט '+line;
  const original=JSON.stringify({native,manifest}),result=cleanManifest(manifest,native);
  assert.equal(result.changes.reduce((n:number,c:any)=>n+c.removed.length,0),3);
  assert.equal(result.manifest.exercises[0].context,'שלוש קופסאות:\n$6, 9, 9$\nהנתונים: $6$, $9$, $9$\nטקסט '+line);
  assert.deepEqual(result.manifest.exercises[0].crop,{page:2});assert.equal(result.manifest.exercises[0].text,'חלקו בשווה.');
  assert.equal(JSON.stringify({native,manifest}),original);
});
it('identical genuinely printed question, selected-item or table lines are preserved',()=>{
  for(const place of ['question','part','table']){const {native,manifest}=pair(),q:any=native.questions[0];if(place==='question')q.text.push(line);else if(place==='part')q.items[0].text=line;else q.table={head:['נתון'],rows:[[line]]};assert.deepEqual(summariesForQuestion(q),[]);assert.deepEqual(cleanManifest(manifest,native).manifest,manifest);}
});
it('wrong item identity and meaningful structured givens cannot authorize removal',()=>{
  let f=pair();f.manifest.exercises[0].nativeItemId='q5a';assert.equal(cleanManifest(f.manifest,f.native).changes.length,0);
  f=pair();(f.native.questions[0].given[0] as any).type='relation';assert.equal(cleanManifest(f.manifest,f.native).changes.length,0);
});
const pdf='45ab1aedeacb4ed5b8b40b4fec71af5b',m=JSON.parse(readFileSync(new URL('noam-ai/manifests/'+pdf+'.json',root),'utf8')),d=JSON.parse(readFileSync(new URL(m.nativeExportUrl.slice(1),root),'utf8'));
const ex=(q:number,part:string)=>m.exercises.find((e:any)=>e.q===q&&e.part===part);
for(const name of ['worksheet-viewer-noam.html','headless/astro-poc/public/worksheet-viewer-noam.html']){
  const html=readFileSync(new URL(name,root),'utf8'),fn=(n:string)=>{const i=html.indexOf('function '+n+'(');assert.ok(i>=0);return html.slice(i,html.indexOf('\nfunction ',i+1));};
  it(name+': actual ordinary-hint and planner input functions use corrected authored prompts',async()=>{
    let calls=0;const c:any={Promise,JSON,Date,console,API:'offline',analysisCache:{},saveNoamState:()=>{},ensurePdfDocumentForCrop:()=>Promise.resolve(),noamRebuildSelectedPartExpression:()=>Promise.resolve(null),cropExerciseImage:()=>Promise.resolve('offline-image'),isBotProtectionError:()=>false,postJson:async()=>{calls++;return{ok:true,analysis:{readable:true,transcription:'Original crop',problem_statement:'Original crop'}};},manifest:m};c.window=c;
    runInNewContext(['syntheticAnalysis','noamManifestOcrUnreliable','noamExerciseSectionLabel','noamScopedExerciseSemantic','noamExerciseNeedsLiveVision','getExerciseAnalysis','noamDiagramSourceInput'].map(fn).join('\n'),c);
    c.noamNativeDiagramContext=()=>Promise.resolve(null);c.noamNativeDataUrl=()=>m.nativeExportUrl;c.noamTypedVisualContext=()=>({});c.NoamVisualPlan={};
    for(const q of [4,12,20]){const e=ex(q,'א'),a=await c.getExerciseAnalysis(e),v=await c.noamDiagramSourceInput(e);assert.equal(c.noamScopedExerciseSemantic(e),e.prompt);assert.ok(a.transcription.startsWith(e.prompt));assert.ok(a.problem_statement.startsWith(e.prompt));assert.doesNotMatch(a.transcription,/הנתונים:/);assert.ok(v.questionText.includes(e.prompt));assert.doesNotMatch(v.questionText,/הנתונים:/);}
    assert.equal(calls,3);assert.ok(ex(4,'א').prompt.includes('$6, 9, 9$'));assert.ok(ex(4,'ב').prompt.includes('ובה $4$ עפרונות'));
    assert.ok(ex(20,'א').prompt.includes('$12$ פינים'));assert.ok(ex(20,'ב').prompt.includes('$20$ שחקנים'));
  });
  it(name+': only the19 affected PDFs refresh analysis, while conversation history remains',()=>{
    const i=html.indexOf('var NOAM_NUMBER_SUMMARY_PDFS'),end=html.indexOf('var threads =',i),block=html.slice(i,end);
    const c:any={pdf,HEADLESS_MANIFEST_BASE:'/noam-ai/manifests/'};runInNewContext(block,c);assert.equal(c.NOAM_NUMBER_SUMMARY_PDFS.length,19);assert.ok(c.NOAM_NUMBER_SUMMARY_PDFS.includes(pdf));
    for(const id of [...c.NOAM_NUMBER_SUMMARY_PDFS,'ddfdb423c2dc4e9d925ee5be56971195']){const ctx:any={pdf:id,HEADLESS_MANIFEST_BASE:'/noam-ai/manifests/'};runInNewContext(block,ctx);assert.equal(ctx.ANALYSIS_STORAGE_KEY.endsWith(':number-summary-v1'),c.NOAM_NUMBER_SUMMARY_PDFS.includes(id));assert.equal(ctx.THREAD_STORAGE_KEY,'noam-static-threads-v1:'+id);assert.match(ctx.MANIFEST_PATH,/20261028-number-summary/);}
  });
}
it('all412 canonical manifests pass the source-bound regeneration guard and retain all762 native summaries',()=>{
  const r=scan(fileURLToPath(root));assert.equal(r.nativeManifests,412);assert.equal(r.mainQuestions,8178);assert.equal(r.strictSummaryEntries,762);assert.equal(r.affectedManifests,0);assert.equal(r.removedLineOccurrences,0);
});
it('typed native context still uses exact printed introduction/item/table and ignores generic given arrays',()=>{
  const c:any={};runInNewContext(readFileSync(new URL('noam-native-visual.js',root),'utf8'),c);
  for(const q of [4,12,20]){const e=ex(q,'א'),ctx=c.NoamNativeVisual.authoredContext(d,e,''),question=d.questions.find((x:any)=>x.id==='q'+q);assert.ok(question.given[0].text.startsWith('הנתונים:'));assert.equal(ctx.questionText,Array.isArray(question.text)?question.text.join('\n'):question.text);assert.equal(ctx.partText,question.items[0].text);assert.doesNotMatch(JSON.stringify(ctx),/הנתונים:/);if(q===12)assert.deepEqual(JSON.parse(JSON.stringify(ctx.questionTable)),question.table);}
});
