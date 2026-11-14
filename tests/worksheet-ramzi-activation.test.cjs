'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),pub=path.join(root,'headless/astro-poc/public');
const {validateRamziActivation,loadRamziActivationEvidence}=require('../scripts/lib/worksheet-ramzi-activation.cjs');
const {mergeWorksheetEditions}=require('../scripts/lib/worksheet-editions.cjs');
const {buildLearningCatalog}=require('../scripts/build-learning-catalog.cjs');
const {loadIndexCatalog}=require('../scripts/lib/headless-catalog.cjs');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const registry=JSON.parse(fs.readFileSync(path.join(root,'headless/catalog/worksheet-editions.v1.json')));
const committed=JSON.parse(fs.readFileSync(path.join(root,'headless/catalog/catalog.v1.json')));
const base=mergeWorksheetEditions(committed,registry);
const scope=['G7-T86','G8-T84','G8-T87','G9-T85'];
const {fixture}=require('./fixtures/ramzi-activation-evidence.cjs');
function alterReceipt(b,field,fn){const old=b.ready[field],doc=JSON.parse(b.receipts[old]);fn(doc);const raw=JSON.stringify(doc),h=hash(raw);delete b.receipts[old];b.receipts[h]=raw;b.ready[field]=h;}

test('no ready file/argument preserves all PDF-only editions and legacy defaults',()=>{
 const temp=fs.mkdtempSync(path.join(require('node:os').tmpdir(),'noam-readiness-absent-'));
 try { assert.equal(loadRamziActivationEvidence(temp,pub),undefined); } finally { fs.rmSync(temp,{recursive:true}); }
 assert.deepEqual(mergeWorksheetEditions(base,registry),base);
 assert.equal(validateRamziActivation(registry,undefined).size,0);
 assert.throws(()=>validateRamziActivation(registry,null),/evidence bundle/);
});
test('actual twelve source pairs accept only complete independently scoped evidence',()=>{
 const b=fixture(),result=validateRamziActivation(registry,b);assert.equal(result.size,12);
 assert.equal([...result.values()].reduce((n,u)=>n+u.itemCount,0),567);
 const next=mergeWorksheetEditions(base,registry,b.ready);
 for(const g of base.grades)for(const t of g.topics){const n=next.grades.find(x=>x.grade===g.grade).topics.find(x=>x.id===t.id);assert.deepEqual(n.levels,t.levels);assert.deepEqual(n.routing,t.routing);assert.equal(n.defaultEditionId,t.defaultEditionId);
  for(const e of n.editions||[]){const old=(t.editions||[]).find(x=>x.editionId===e.editionId);if(b.ready.units.some(u=>u.editionId===e.editionId)){assert.equal(e.publicationMode,'pdf-only');assert(e.routing.usesViewer&&e.routing.aiHintShown);assert(e.levels.every(l=>l.ramzi.status==='ready'));assert(e.levels.every(l=>!Object.hasOwn(l,'wordSourceSha256')));}else assert.deepEqual(e,old);}
 }
});
for(const [name,mutate]of [
 ['arbitrary ready boolean',b=>{b.ready.aiReady=true;}],['partial units',b=>b.ready.units.pop()],['duplicate level',b=>b.ready.units[1]={...b.ready.units[0]}],
 ['wrong package',b=>b.ready.units[0].prefix='G9-T88'],['wrong revision',b=>b.ready.units[0].revision++],['wrong frozen native',b=>b.ready.units[0].sourceNativeExportSha256='0'.repeat(64)],
 ['swapped public/source native',b=>b.ready.units[0].nativeExportSha256=b.ready.units[0].sourceNativeExportSha256],['wrong PDF',b=>b.ready.units[0].pdfId='0'.repeat(32)],
 ['wrong hint count',b=>b.ready.units[0].hintCount--],['wrong review',b=>b.ready.hintReviewSha256='0'.repeat(64)],['already published assertion',b=>b.ready.finalManifestsPublished=true],
 ['unproven DB readback',b=>alterReceipt(b,'verifiedDbReadbackReceiptSha256',r=>r.status='draft')],
 ['different payload in readback',b=>alterReceipt(b,'verifiedDbReadbackReceiptSha256',r=>r.payloadSha256='0'.repeat(64))],
 ['different deployment receipt',b=>alterReceipt(b,'publicationReceiptSha256',r=>r.deployedCommit='2'.repeat(40))],
 ['missing learning ID',b=>alterReceipt(b,'learningWorksheetsReceiptSha256',r=>r.learningIds.pop())],
 ['legacy learning ID substitution',b=>alterReceipt(b,'learningWorksheetsReceiptSha256',r=>r.learningIds[0]='g7-t17-a')],
 ['private local path',b=>alterReceipt(b,'publicationReceiptSha256',r=>r.sourceReceiptSha256='/Users/person/private.json')],
 ['receipt wrong raw bytes',b=>b.receipts[b.ready.publicationReceiptSha256]+=' '],
 ['manifest wrong raw bytes',b=>b.manifests[b.ready.units[0].pdfId]+=' '],
 ['native wrong raw bytes',b=>b.nativeExports[b.ready.units[0].prefix+'/'+b.ready.units[0].level]+=' '],
])test('rejects '+name,()=>{const b=fixture();mutate(b);assert.throws(()=>validateRamziActivation(registry,b),/Ramzi activation/);});
test('all 967 learning rows remain exact, only twelve reviewed edition identities are added',()=>{
 const raw=loadIndexCatalog(path.join(root,'index.html')),old=buildLearningCatalog(raw,registry),next=buildLearningCatalog(raw,registry,fixture());
 assert.equal(old.length,967);assert.equal(next.length,979);assert.deepEqual(next.slice(0,old.length),old);
 assert.equal(new Set(next.map(r=>r.id)).size,979);assert(next.slice(old.length).every(r=>scope.includes(r.x)&&r.editionId&&r.id.endsWith('-e-'+r.editionId)));
});
test('native mismatch is rejected even when caller updates local manifest hash',()=>{
 const b=fixture(),u=b.ready.units[0],m=JSON.parse(b.manifests[u.pdfId]);m.exercises[0].nativeItemId='q99z';const raw=JSON.stringify(m);b.manifests[u.pdfId]=raw;u.manifestSha256=hash(raw);
 alterReceipt(b,'finalManifestReviewReceiptSha256',r=>r.units[0].manifestSha256=u.manifestSha256);
 assert.throws(()=>validateRamziActivation(registry,b),/native\/exercise mapping/);
});

test('CJS require and Node/Vite ESM imports expose the same single pure implementation',async()=>{
 const esm=await import('../scripts/lib/worksheet-editions.mjs');
 const named=await import('../scripts/lib/worksheet-editions.cjs');
 const common=require('../scripts/lib/worksheet-editions.cjs');
 for(const key of ['mergeWorksheetEditions','worksheetLearningId','validateRamziReadiness']){
  assert.equal(common[key],esm[key]);assert.equal(named[key],esm[key]);
 }
});
