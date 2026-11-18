const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),astro=path.join(root,'headless/astro-poc');
const {fixture}=require('./fixtures/reviewed-ramzi-additional.cjs');
const {validateAdditionalEvidence}=require('../scripts/lib/reviewed-ramzi-activation-build.cjs');
const {mergeReviewedCatalog}=require('../scripts/lib/reviewed-ramzi-activation.mjs');
const nav=require('../noam-ai/site-companion/retrieve.js');
const catalog=JSON.parse(fs.readFileSync(path.join(root,'headless/catalog/catalog.v1.json'))),registry=JSON.parse(fs.readFileSync(path.join(root,'headless/catalog/worksheet-editions.v1.json')));
const bundle=fixture(registry),projection=validateAdditionalEvidence(catalog,registry,bundle),active=mergeReviewedCatalog(catalog,registry,catalog.ramziActivation,catalog.ramziHintCorrection,projection,bundle.trust);
const ids=new Set(['ms-20261115-rat-01-r1','ms-20261115-frq-01-r1']);
const isNew=r=>[...ids].some(id=>r.id.endsWith('-e-'+id));
const previousSource=execFileSync('git',['show','HEAD:noam-ai/site-companion/retrieve.js'],{cwd:root,encoding:'utf8'});
const previous=import('data:text/javascript;base64,'+Buffer.from(previousSource).toString('base64'));
// Execute the real generator in an isolated child. Only its catalog read is
// substituted in memory; every attempted write is intercepted, never persisted.
function generate(input){
 const script=`import fs from 'node:fs';import path from 'node:path';import {syncBuiltinESMExports} from 'node:module';import {pathToFileURL} from 'node:url';
 const replacement=fs.readFileSync(0,'utf8'),target=path.resolve('src/data/catalog.v1.json'),output=path.resolve('src/data/site-guide.v1.json'),read=fs.readFileSync;let captured;
 fs.readFileSync=function(p,...args){if(path.resolve(String(p))===target)return args[0]==='utf8'?replacement:Buffer.from(replacement);return read.call(this,p,...args);};
 fs.writeFileSync=function(p,value){if(path.resolve(String(p))!==output)throw Error('Unexpected generator write');captured=String(value);};syncBuiltinESMExports();
 await import(pathToFileURL(path.resolve('scripts/build-site-guide.ts')).href);if(!captured)throw Error('No guide captured');process.stdout.write('\\n__REVIEW_GUIDE__'+captured);`;
 const stdout=execFileSync(process.execPath,['--import','tsx','--input-type=module','-e',script],{cwd:astro,input:JSON.stringify(input),encoding:'utf8',maxBuffer:8_000_000});return JSON.parse(stdout.split('__REVIEW_GUIDE__').at(-1));
}
let generated;
function guide(){return generated||(generated=generate(active));}

test('all previous catalog records and their relative order are exact; only six new records',async()=>{
 const old=(await previous).buildCatalogRecords(catalog),current=nav.buildCatalogRecords(active);assert.deepEqual(current.filter(r=>!isNew(r)),old);assert.equal(current.length,old.length+6);assert.equal(new Set(current.map(r=>r.id)).size,current.length);
});
test('each new record has the original PDF, nonlegacy edition, correct grade/topic and lower-case native URL level',()=>{
 const records=nav.buildCatalogRecords(active).filter(isNew);assert.equal(records.length,6);
 for(const r of records){const u=new URL(r.href,'https://example.test'),isRat=r.editionId.includes('rat'),g=isRat?9:7,t=isRat?47:26,prefix=isRat?'G9-T93':'G7-T88';
  assert.equal(r.id,`g${g}-t${t}-${r.levelKey}-e-${r.editionId}`);assert.equal(u.searchParams.get('edition'),r.editionId);assert.equal(u.searchParams.get('g'),String(g));assert.equal(u.searchParams.get('topic'),String(t));assert.equal(u.searchParams.get('x'),prefix);assert.equal(u.searchParams.get('lv'),r.levelKey);assert.equal(u.searchParams.get('pdf'),r.pdfId);assert.equal(u.searchParams.get('back'),'/worksheets?grade='+g);
  const scope=bundle.trust.scopes.find(s=>s.batch.editionId===r.editionId);assert.equal(scope.batch.units.find(x=>x.level===r.levelKey).pdfId,r.pdfId);
 }
 for(const r of records.filter(r=>r.levelKey==='c'))assert.equal(new URL(r.href,'https://example.test').searchParams.get('lv'),'c','E native level maps to URL c');
});
test('withdrawing all readiness restores every original catalog record',async()=>{
 const withdrawn=mergeReviewedCatalog(active,registry,catalog.ramziActivation,catalog.ramziHintCorrection,undefined,bundle.trust);assert.deepEqual(nav.buildCatalogRecords(withdrawn),(await previous).buildCatalogRecords(catalog));
});
for(const [name,change,remaining]of [
 ['absent projection',c=>delete c.reviewedRamziActivations,0],
 ['missing referenced scope',c=>c.reviewedRamziActivations.batches=c.reviewedRamziActivations.batches.filter(x=>x.scopeId.includes('frq')),3],
 ['dangling learning scope URL',c=>c.grades.find(g=>g.grade===9).topics.find(t=>t.id===47).reviewedBaseBinding.levels.forEach(l=>l.ramzi.learningScopeUrl='/noam-ai/learning-scopes/not-accepted.json'),3],
 ['disabled readiness tier',c=>c.grades.find(g=>g.grade===9).topics.find(t=>t.id===47).reviewedBaseBinding.levels[0].ramzi.status='review',3],
 ['disabled viewer',c=>c.grades.find(g=>g.grade===9).topics.find(t=>t.id===47).reviewedBaseBinding.routing.usesViewer=false,3],
 ['dangling binding',c=>delete c.grades.find(g=>g.grade===9).topics.find(t=>t.id===47).reviewedBaseBinding,3],
])test('does not create unresolved/disabled additions: '+name,()=>{const c=structuredClone(active);change(c);assert.equal(nav.buildCatalogRecords(c).filter(isNew).length,remaining);});
test('real guide generator preserves every old record and order and adds exactly six',()=>{
 const old=JSON.parse(fs.readFileSync(path.join(astro,'src/data/site-guide.v1.json'))),current=guide();assert.deepEqual(current.records.filter(r=>!isNew(r)),old.records);assert.equal(current.records.length,old.records.length+6);assert.equal(current.counts.worksheet,old.counts.worksheet+6);assert.equal(new Set(current.records.map(r=>r.id)).size,current.records.length);
 for(const r of current.records.filter(isNew)){const expected=nav.buildCatalogRecords(active).find(x=>x.id===r.id);assert.equal(r.href,expected.href);assert.equal(r.pdfId,expected.pdfId);}
});
test('real generator --check without activation does not alter its source snapshot',()=>{
 const f=path.join(astro,'src/data/site-guide.v1.json'),before=fs.readFileSync(f);execFileSync(process.execPath,['--import','tsx','scripts/build-site-guide.ts','--check'],{cwd:astro,stdio:'pipe'});assert.deepEqual(fs.readFileSync(f),before);
});
test('FRQ retrieval prioritizes the newly requested exact topic title',()=>{
 const query='טבלאות שכיחות ושכיחות יחסית כיתה ז';assert(nav.retrieveRecords(active,query,3).every(r=>r.editionId==='ms-20261115-frq-01-r1'));assert(nav.retrieveGuide(guide(),query,6).some(r=>r.id.includes('-e-ms-20261115-frq-01-r1')));
});
test('an explicit request for the new RAT sheet with Ramzi reaches the new edition first',()=>{
 const query='משוואות רציונליות רמזי חדש כיתה ט';const selected=nav.retrieveRecords(active,query,3);assert.equal(selected[0].editionId,'ms-20261115-rat-01-r1','RAT requested with Ramzi must not rank the old direct PDF ahead');
});
test('the first matching RAT worksheet in the guide supports the explicitly requested Ramzi',()=>{
 const hits=nav.retrieveGuide(guide(),'משוואות רציונליות רמזי חדש כיתה ט',8).filter(r=>r.type==='worksheet'&&r.id.startsWith('g9-t47-'));assert(hits.length);assert(hits[0].id.includes('-e-ms-20261115-rat-01-r1'),'Guide ranks a direct PDF without Ramzi first');
});

test('without activation every ordinary/new/Ramzi query keeps original catalog and guide results',async()=>{
 const old=await previous,unchangedGuide=JSON.parse(fs.readFileSync(path.join(astro,'src/data/site-guide.v1.json')));
 for(const query of ['משוואות רציונליות כיתה ט','דף עבודה משוואות רציונליות כיתה ט','דפי עבודה חדשים משוואות רציונליות כיתה ט','משוואות רציונליות מהדורה חדשה כיתה ט','משוואות רציונליות עם רמזים כיתה ט','טבלאות שכיחות ושכיחות יחסית כיתה ז','פירוק לגורמים כיתה ט']){
  assert.deepEqual(nav.retrieveRecords(catalog,query,6),old.retrieveRecords(catalog,query,6));
  assert.deepEqual(nav.retrieveGuide(unchangedGuide,query,6),old.retrieveGuide(unchangedGuide,query,6));
 }
});
test('ordinary exact topic queries preserve legacy tie order and unrelated topic results',async()=>{
 const old=await previous;
 for(const query of ['משוואות רציונליות כיתה ט','פירוק לגורמים כיתה ט'])assert.deepEqual(nav.retrieveRecords(active,query,3),old.retrieveRecords(catalog,query,3));
});
test('verified new RAT becomes discoverable for explicit singular new/hint variants',()=>{
 for(const query of ['משוואות רציונליות מהדורה חדשה כיתה ט','משוואות רציונליות עם רמזים כיתה ט']){
  assert.equal(nav.retrieveRecords(active,query,3)[0].editionId,'ms-20261115-rat-01-r1');
  const hits=nav.retrieveGuide(guide(),query,8).filter(r=>r.type==='worksheet'&&r.id.startsWith('g9-t47-'));assert(hits[0].id.endsWith('-e-ms-20261115-rat-01-r1'));
 }
});
test('plural Hebrew request for new worksheets reaches the same verified RAT edition',()=>{
 const query='דפי עבודה חדשים משוואות רציונליות כיתה ט';
 assert.equal(nav.retrieveRecords(active,query,3)[0].editionId,'ms-20261115-rat-01-r1','Plural חדשים should identify the same requested new edition');
 const hits=nav.retrieveGuide(guide(),query,8).filter(r=>r.type==='worksheet'&&r.id.startsWith('g9-t47-'));assert(hits[0].id.endsWith('-e-ms-20261115-rat-01-r1'));
});

test('ordinary worksheet wording may retain a legacy guide link, but it must reference the same correct RAT PDF',()=>{
 const query='דף עבודה משוואות רציונליות כיתה ט';
 const record=nav.retrieveGuide(guide(),query,8).find(r=>r.type==='worksheet'&&r.id.startsWith('g9-t47-'));
 assert(record);const source=catalog.grades.find(g=>g.grade===9).topics.find(t=>t.id===47).levels.find(l=>l.key===record.levelKey);assert.equal(record.pdfId,source.pdfId);
 const u=new URL(record.href,'https://example.test');assert(u.searchParams.get('pdf')===source.pdfId||u.pathname.endsWith(source.pdfId+'.pdf'));
});
