import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, mkdtempSync, realpathSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { test } from 'node:test';
import { parseHTML } from 'linkedom';
import { buildTeacherCatalog, catalogSheets, sheetFromManifest } from '../scripts/build-teacher-catalog.mjs';
import { prepareMeasuredManifestDraft } from '../scripts/lib/measured-worksheet.mjs';
import { editionFixture } from './fixtures/worksheet-editions';
import { groupWholeQuestions, expandToWholeQuestionKeys } from '../public/teachers/teacher-question-pick.js';
import { wizardPrefillFromSearch, replaceWizardScopeUrl } from '../public/teachers/wizard-prefill.js';
import { createTeacherDocx } from '../public/teachers/teacher-word-export.js';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const committed = JSON.parse(read('../src/data/catalog.v1.json'));
// Fixture registries must not inherit live published editions from the snapshot.
const raw = { ...committed, grades: committed.grades.map((g: any) => ({
  ...g, topics: g.topics.map((t: any) => {
    const { editions, defaultEditionId, ...legacy } = t;
    return legacy;
  }),
})) };
const printer = read('../public/teachers/teacher-factoring-print.js');
const clone = (v: any) => structuredClone(v);
const sha = (v: Buffer|string) => createHash('sha256').update(v).digest('hex');
function definition(name: string) {
  const start = printer.search(new RegExp(`(?:^|\\n)(?:async )?function ${name}\\(`)); assert.notEqual(start, -1, name);
  const tail = printer.slice(start + (printer[start] === '\n' ? 1 : 0)); const end = tail.search(/\n(?:async )?function /);
  return (end < 0 ? tail : tail.slice(0, end)).split('\nstart().catch')[0];
}
const built = () => buildTeacherCatalog(raw, editionFixture());

test('the published teacher snapshot matches the real registry and can withdraw its overlays', () => {
  const registry = JSON.parse(read('../../catalog/worksheet-editions.v1.json'));
  const current = buildTeacherCatalog(committed);
  assert.deepEqual(current, buildTeacherCatalog(raw, registry));
  assert.deepEqual(buildTeacherCatalog(committed, { version: 1, editions: [] }), buildTeacherCatalog(raw));
  assert.equal(catalogSheets(current).filter((s: any) => s.editionId).length,
    registry.editions.filter((e: any) => e.status === 'published' && e.publicationMode !== 'pdf-only').length * 3);
});

test('teacher catalog appends only published editions and leaves every legacy field/order unchanged', () => {
  const old = buildTeacherCatalog(raw), next = built();
  assert.deepEqual(buildTeacherCatalog(raw, {version:1,editions:[]}), old);
  let legacy = 0, added = 0;
  next.grades.forEach((grade: any, gi: number) => grade.topics.forEach((topic: any, ti: number) => {
    const before = old.grades[gi].topics[ti];
    assert.deepEqual({...topic,sheets:topic.sheets.filter((s: any)=>!s.editionId)}, before);
    legacy += before.sheets.length; added += topic.sheets.filter((s: any)=>s.editionId).length;
  }));
  assert.equal(legacy, 967); assert.equal(added, 3); // legacy +3: grade 8 topic 67 (2026-11-09)
  const sheets = catalogSheets(next).filter((s: any)=>s.editionId);
  assert.deepEqual(sheets.map((s: any)=>s.level), ['a','b','c']);
  for (const s of sheets) { assert.equal(s.editionLabel,'דפים חדשים'); assert.equal(s.prefix,'G1-T05'); assert.match(s.learningId,/-e-test-renewal-r1$/); assert.ok(s.title.endsWith(' · דפים חדשים')); }
  assert.equal(catalogSheets(next).filter((s: any)=>s.grade===2 && s.editionId).length,0);
});

test('teacher ingestion uses registry identity rules and refuses reused legacy or duplicate media', () => {
  for (const mutation of [
    (r:any)=>{r.editions[0].levels[0].pdfId=raw.grades[0].topics[0].levels[0].pdfId;},
    (r:any)=>{r.editions[0].levels[1].pdfId=r.editions[0].levels[0].pdfId;},
    (r:any)=>{r.editions[0].editionId='legacy';},
    (r:any)=>{r.editions.push(clone(r.editions[0]));},
  ]) { const r=editionFixture(); mutation(r); assert.throws(()=>buildTeacherCatalog(raw,r)); }
});

function measured() {
  const base = './fixtures/measured-v1/a05-B/';
  const draft=JSON.parse(read(base+'draft.json')), pdfId='a'.repeat(32);
  const manifest=prepareMeasuredManifestDraft(draft,readFileSync(new URL(base+'layout.json',import.meta.url)),{
    pdfId,url:`https://static.wixstatic.com/ugd/d8e7ad_${pdfId}.pdf`,downloadedSha256:draft.binding.pdfSha256,syntheticTestFixture:true});
  const meta={pdfId,grade:manifest.grade,topicId:manifest.topicId,level:manifest.level,prefix:manifest.prefix,levelCode:manifest.levelCode,
    title:'בדיקת מהדורה',editionId:manifest.editionId,editionLabel:'מהדורת בדיקה',learningId:'test-only-learning-id',
    expectedSha256:manifest.sourceSha256,canonicalSourceSha256:manifest.canonicalSourceSha256};
  return {manifest,meta};
}
test('catalog metadata binds to measured edition/PDF/grade/topic/level/SHA while every fragment stays exact', () => {
  const {manifest,meta}=measured(), before=JSON.stringify(manifest);
  const sheet=sheetFromManifest(meta,manifest,undefined,{allowDraft:true});
  assert.equal(JSON.stringify(manifest),before); assert.equal(sheet.editionLabel,meta.editionLabel);
  assert.deepEqual(sheet.questions,manifest.measured.sheet.questions); assert.deepEqual(sheet.fragmentLedger,manifest.measured.fragments);
  assert.ok(sheet.case.endsWith('-e-'+meta.editionId));
  for (const key of ['pdfId','editionId','grade','topicId','level','levelCode','prefix','expectedSha256','canonicalSourceSha256']) {
    const bad:any={...meta,[key]:typeof (meta as any)[key]==='number'?99:'wrong'};
    assert.throws(()=>sheetFromManifest(bad,manifest,undefined,{allowDraft:true}),Error,key);
  }
});

function picker() {
  const catalog=built(), sheets=new Map();
  for (const s of catalogSheets(catalog)) {
    const source={...s,questions:[{id:'1א',q:1,part:'א',page:1},{id:'1ב',q:1,part:'ב',page:1}]};
    source.questions.forEach((q:any)=>q.source=source); sheets.set(s.pdfId,source);
  }
  const {document}=parseHTML('<html><body></body></html>');
  const elements=new Map();
  const $=(id:string)=>{if(!elements.has(id)){const e=document.createElement(id==='edition'?'select':'div');e.id=id;if(id==='edition')Object.defineProperty(e,'value',{value:'all',writable:true});document.body.append(e);elements.set(id,e);}return elements.get(id);};
  const window={confirm:()=>true,location:{href:'https://example.invalid/teachers?tag=keep'},history:{state:{},replaceState(_s:any,_t:any,url:string){window.location.href=url;}}};
  const names=['bind','gradeRecord','currentTopic','topicLevelChoices','resolveTopicLevel','syncLevels','syncWizardUrl','topicSheets','currentExercises','exKey','visibleSelectionKeys','keepVisible','selectionKey','snapshot','carriedKeys','levelAllows'];
  const api=new Function('CATALOG','sheets','$','document','window','expandToWholeQuestionKeys','replaceWizardScopeUrl',`
    let state={grade:'1',topic:'5',level:'a',edition:'all',selected:[],blocks:[],pickMode:'manual'},history=[];
    const clearPreparedPrint=()=>{},confirmTeacherReplacement=()=>window.confirm(),render=()=>{syncLevels();syncWizardUrl();},announce=()=>{},escapeHTML=v=>String(v),topicSearch=null;
    ${names.map(definition).join('\n')}
    bind();render();
    return {state,topicSheets,currentExercises,levelAllows,render,history,window,
      changeEdition(value){$('edition').value=value;$('edition').dispatchEvent(new window.Event('change'));},
      undo(){ $('undo').dispatchEvent(new window.Event('click')); }};
  `)(catalog,sheets,$,document,Object.assign(window,{Event:document.defaultView!.Event}),expandToWholeQuestionKeys,replaceWizardScopeUrl);
  return {...api,elements};
}
test('edition filtering preserves level, unique source IDs, saved sections and confirmed selection; cancel and undo cannot expose another edition', () => {
  const app=picker(), old=app.topicSheets().find((s:any)=>!s.editionId), fresh=app.topicSheets().find((s:any)=>s.editionId);
  assert.equal(app.topicSheets().length,2); assert.equal(app.elements.get('edition-filter').hidden,false);
  const keys=(s:any)=>['א','ב'].map(part=>'ex:'+s.pdfId+':1'+part);
  assert.notDeepEqual(keys(old),keys(fresh));
  app.state.selected=[...keys(old),...keys(fresh)]; app.state.blocks=[{keys:['ex:saved:1']}];
  app.window.confirm=()=>false;app.changeEdition('test-renewal-r1');
  assert.equal(app.state.edition,'all'); assert.equal(app.state.selected.length,4);
  app.window.confirm=()=>true;app.changeEdition('test-renewal-r1');
  assert.deepEqual(app.state.selected,keys(fresh));assert.equal(app.state.level,'a');assert.deepEqual(app.state.blocks,[{keys:['ex:saved:1']}]);
  assert.equal(app.levelAllows(old),false);app.undo();assert.deepEqual(app.state.selected,keys(fresh));
  app.state.level='b';app.render();assert.equal(app.topicSheets().length,1);assert.equal(app.topicSheets()[0].editionId,'test-renewal-r1');
  app.changeEdition('legacy');assert.equal(app.state.level,'b');assert.ok(app.topicSheets().every((s:any)=>!s.editionId));
  const url=new URL(app.window.location.href);assert.equal(url.searchParams.get('edition'),'legacy');assert.equal(url.searchParams.get('tag'),'keep');
  app.state.topic='6';app.render();assert.equal(app.state.edition,'all');assert.equal(app.elements.get('edition-filter').hidden,true);
});
test('edition scope round trips, clears stale picks, and legacy links retain their exact shape', () => {
  const browser={location:{href:'https://example.invalid/teachers?grade=1&topic=5&level=a&pick=ex:'+ 'a'.repeat(32)+':1א&tag=keep'},history:{state:{},replaceState(_s:any,_t:any,url:string){browser.location.href=url;}}};
  assert.equal(replaceWizardScopeUrl(browser,{grade:1,topic:5,level:'b',edition:'test-renewal-r1'}),true);
  const url=new URL(browser.location.href);assert.equal(url.searchParams.has('pick'),false);assert.equal(wizardPrefillFromSearch(url.search)?.edition,'test-renewal-r1');
  assert.equal(wizardPrefillFromSearch('?grade=1&topic=5&edition=%3Cscript%3E'),null);
  replaceWizardScopeUrl(browser,{grade:1,topic:5,level:'b',edition:'all'});assert.equal(new URL(browser.location.href).searchParams.has('edition'),false);
  assert.equal(Object.hasOwn(wizardPrefillFromSearch('?grade=1&topic=5')!,'edition'),false);
});

test('measured print headings display public edition labels without modifying measurements', () => {
  const {manifest,meta}=measured(),source=sheetFromManifest(meta,manifest,undefined,{allowDraft:true});
  const describe=new Function(definition('levelPrintName')+'\n'+definition('measuredSourceDescription')+';return measuredSourceDescription;')();
  assert.ok(describe(source).endsWith(' · מהדורת בדיקה'));
  assert.ok(describe(source,{showLevel:false}).endsWith(' · מהדורת בדיקה'));
  assert.ok(!describe(source).includes(meta.editionId));
  const legacy={topic:'נושא',level:'a',levelLabel:'רמה א׳'}; assert.equal(describe(legacy),'נושא · רמה א׳');
});

test('edition source loading refuses stale binding before caching questions or showing a preview', async () => {
  const {manifest,meta}=measured();
  const original=sheetFromManifest(meta,manifest,undefined,{allowDraft:true});
  const load=async (source:any) => {
    const cache=new Map(),library=new Map();
    const method=new Function('byPdf','sheets','library','fetch',`
      const FACTORING_PDF='unused'; let SOURCE=null;
      ${definition('exKey')}
      ${definition('loadExerciseSheet').replaceAll('import.meta.url',"'https://example.invalid/teachers/app.js'")}
      return loadExerciseSheet;
    `)(new Map([[meta.pdfId,meta]]),cache,library,async()=>({ok:true,json:async()=>source}));
    return {promise:method(meta.pdfId),cache,library};
  };
  const ok=await load(clone(original)); await ok.promise; assert.equal(ok.cache.size,1); assert.equal(ok.library.size,original.questions.length);
  for(const key of ['pdfId','editionId','grade','topicId','level','sourceSha256','canonicalSourceSha256']) {
    const bad=clone(original);bad[key]=typeof bad[key]==='number'?99:'wrong';const result=await load(bad);
    await assert.rejects(result.promise,/SHEET_EDITION_BINDING/);assert.equal(result.cache.size,0);assert.equal(result.library.size,0);
  }
});

test('question cards distinguish the same question number in two editions using escaped public labels', () => {
  const render=new Function('const questionPreviewGroup=g=>g,previewManifests=new Map(),QUESTION_ROLES={},state={}; const escapeHTML=s=>String(s).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll(\'"\',"&quot;");\n'+definition('questionCard')+'\nreturn questionCard;')();
  const group={q:1,key:'test-key',parts:[{id:'1א',part:'א',page:1}],source:{pdfId:'a'.repeat(32),pdfUrl:'https://example.invalid/test.pdf',levelLabel:'רמה א׳',editionLabel:'דפים <חדשים>'}};
  const html=render(group,false),{document}=parseHTML(html);
  assert.match(document.querySelector('.q-page')!.textContent!,/דפים <חדשים>/);
  assert.match(document.querySelector('input')!.getAttribute('aria-label')!,/דפים <חדשים>/);
  assert.equal(document.querySelectorAll('חדשים').length,0);
  assert.ok(!html.includes('elementary-2026'));
});

function unzipStored(bytes: Uint8Array) {
  const b=Buffer.from(bytes),files:Record<string,string>={};let at=0;
  while(b.readUInt32LE(at)===0x04034b50){assert.equal(b.readUInt16LE(at+8),0);const size=b.readUInt32LE(at+18),n=b.readUInt16LE(at+26),extra=b.readUInt16LE(at+28),start=at+30+n+extra;files[b.subarray(at+30,at+30+n).toString()]=b.subarray(start,start+size).toString();at=start+size;} return files;
}
test('Word labels selected editions on both questions and answers, retaining identical legacy equations and RTL', async () => {
  const q={id:'a'.repeat(32)+':1',q:1,topic:'חילוק',levelLabel:'רמה א׳',text:'חשבו',items:[{label:'א',text:'$12 : 3$',answer:'$4$'}]};
  const old=unzipStored(await createTeacherDocx({questions:[q]}));
  const next=unzipStored(await createTeacherDocx({questions:[{...q,editionLabel:'דפים חדשים'}]}));
  assert.equal((next['word/document.xml'].match(/דפים חדשים/g)||[]).length,2);
  assert.equal(next['word/document.xml'].replaceAll(' · דפים חדשים',''),old['word/document.xml']);
  for(const name of Object.keys(old).filter(n=>n!=='word/document.xml')) assert.equal(next[name],old[name],name);
});

test('static viewer sync includes published edition manifests without changing legacy selection or leaking reviewed drafts', async () => {
  const {collectViewerPdfIds}=await import('../scripts/sync-github-static.mjs');
  const {mergeWorksheetEditions}=await import('../../../scripts/lib/worksheet-editions.cjs');
  const old=collectViewerPdfIds(raw),next=collectViewerPdfIds(mergeWorksheetEditions(raw,editionFixture()));
  const ids=editionFixture().editions[0].levels.map(s=>s.pdfId);
  assert.deepEqual(next.filter((id:string)=>!ids.includes(id)),old);
  for(const id of ids)assert.ok(next.includes(id));
  for(const s of editionFixture().editions[1].levels)assert.ok(!next.includes(s.pdfId));
});

test('model candidate identity distinguishes new/previous PDFs of the same level and refuses omitted, wrong, or cross-topic source IDs', async () => {
 const {parseClassifier,selectTeacherPicks,hasInvalidTeacherCandidates}=await import('../../../noam-ai/site-companion/teacher-pick.js');
 const old={pdfId:'1'.repeat(32),grade:3,topicId:'10',level:'a',levelLabel:'רמה א׳',questions:['1א','1ב','2א'],mode:'exercise'},fresh={...old,pdfId:'2'.repeat(32),editionId:'test-renewal-r1'};
 const index=[old,fresh,{...fresh,pdfId:'3'.repeat(32),topicId:'11'}];
 const id='a:'+fresh.pdfId+':1א', input={message:'בחר שאלה',page:{kind:'teachers'},teacher:{grade:'3',topic:'10',level:'a',count:1,candidates:[{id}]}};
 assert.equal(hasInvalidTeacherCandidates(index,input),false);
 const good=selectTeacherPicks(index,input,parseClassifier(JSON.stringify({exerciseLabels:[id]})));
 assert.equal(good.selectionSource,'classifier');assert.deepEqual(good.exerciseIds,['ex:'+fresh.pdfId+':1א']);
 for(const bad of ['a:1א','a:'+old.pdfId+':1א','a:'+'3'.repeat(32)+':1א','a:'+fresh.pdfId+':99א']){
   const rejected=selectTeacherPicks(index,input,parseClassifier(JSON.stringify({exerciseLabels:[bad]})));
   assert.notEqual(rejected.selectionSource,'classifier');
   assert.ok((rejected.exerciseIds || []).every((key: string)=>key.startsWith('ex:'+fresh.pdfId+':')));
 }
 for(const id of ['a:'+'3'.repeat(32)+':1א','a:'+fresh.pdfId+':99א'])assert.equal(hasInvalidTeacherCandidates(index,{...input,teacher:{...input.teacher,candidates:[{id}]}}),true);
 const mixed={...input,teacher:{...input.teacher,count:2,candidates:[{id:'a:1א'},{id}]}};
 const result=selectTeacherPicks(index,mixed,parseClassifier(JSON.stringify({exerciseLabels:['a:1א',id]})));
 assert.equal(result.selectionSource,'classifier');assert.deepEqual(result.exerciseIds,['ex:'+old.pdfId+':1א','ex:'+fresh.pdfId+':1א']);
});


test('the real static-sync CLI preserves historical public manifests absent from active selection', () => {
 const dir=realpathSync(mkdtempSync(join(tmpdir(),'noam-edition-static-')));
 try {
  const put=(p:string,text:string)=>{const dest=join(dir,p);mkdirSync(dirname(dest),{recursive:true});writeFileSync(dest,text);};
  put('scripts/lib/worksheet-editions.cjs',read('../../../scripts/lib/worksheet-editions.cjs'));
  put('scripts/lib/worksheet-editions.mjs',read('../../../scripts/lib/worksheet-editions.mjs'));
  put('headless/astro-poc/scripts/sync-github-static.mjs',read('../scripts/sync-github-static.mjs'));
  const active='a'.repeat(32),historical='b'.repeat(32);
  put('headless/astro-poc/src/data/catalog.v1.json',JSON.stringify({config:{elementaryGrades:[1]},grades:[{grade:1,topics:[{id:1,levels:[{pdfId:active}],routing:{usesViewer:true}}]}]}));
  put('headless/catalog/worksheet-editions.v1.json',JSON.stringify({version:1,editions:[]}));
  put('noam-ai/manifests/'+active+'.json','{"active":true}');
  put('headless/astro-poc/public/noam-ai/manifests/'+historical+'.json','{"historical":"byte-exact"}');
  put('index.html','<html>legacy</html>');
  execFileSync(process.execPath,[join(dir,'headless/astro-poc/scripts/sync-github-static.mjs')],{stdio:'pipe'});
  assert.equal(readFileSync(join(dir,'headless/astro-poc/public/noam-ai/manifests/'+historical+'.json'),'utf8'),'{"historical":"byte-exact"}');
  const provenance=JSON.parse(readFileSync(join(dir,'headless/astro-poc/public/noam-ai/sync-provenance.json'),'utf8'));
  assert.equal(provenance.retainedLegacy[historical],sha('{"historical":"byte-exact"}'));
  execFileSync(process.execPath,[join(dir,'headless/astro-poc/scripts/sync-github-static.mjs'),'check'],{stdio:'pipe'});
 } finally {rmSync(dir,{recursive:true,force:true});}
});
