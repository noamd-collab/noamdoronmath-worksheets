const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),catalog=JSON.parse(fs.readFileSync(path.join(root,'headless/catalog/catalog.v1.json'))),registry=JSON.parse(fs.readFileSync(path.join(root,'headless/catalog/worksheet-editions.v1.json')));
const {fixture,hash,bytes}=require('./fixtures/reviewed-ramzi-additional.cjs');
const {validateAdditionalEvidence}=require('../scripts/lib/reviewed-ramzi-activation-build.cjs');
const {mergeReviewedCatalog,validateAdditionalProjection}=require('../scripts/lib/reviewed-ramzi-activation.mjs');
const {buildLearningCatalog}=require('../scripts/build-learning-catalog.cjs');
const {exportCatalog,loadIndexCatalog}=require('../scripts/lib/headless-catalog.cjs');
const {loadRamziActivationEvidence}=require('../scripts/lib/worksheet-ramzi-activation.cjs');
const old=loadRamziActivationEvidence(path.join(root,'headless/catalog'),path.join(root,'headless/astro-poc/public'));
const raw=loadIndexCatalog(path.join(root,'index.html'));
const clone=structuredClone;
function build(b){return validateAdditionalEvidence(catalog,registry,b);}
function merged(b,p=build(b)){return mergeReviewedCatalog(catalog,registry,old.ready,old.hintCorrection,p,b.trust);}
function changeReceipt(b,key,mutate){const r=b.requests.batches[0],value=JSON.parse(b.receipts[r[key]]);mutate(value);const text=bytes(value);r[key]=hash(text);b.receipts[r[key]]=text;const t=b.trust.scopes.find(t=>t.scopeId===r.scopeId);t.activation={readbackReceiptSha256:r.dbReadbackReceiptSha256,evidenceSha256:hash(JSON.stringify(r))};}

test('no added request preserves exact catalog, learning and original v1 proof',()=>{
 const trusted={version:1,scopes:[]};assert.equal(validateAdditionalEvidence(catalog,registry,undefined),undefined);
 assert.deepEqual(mergeReviewedCatalog(catalog,registry,old.ready,old.hintCorrection,undefined,trusted),catalog);
 assert.equal(exportCatalog({indexPath:path.join(root,'index.html'),dryRun:true}).text,fs.readFileSync(path.join(root,'headless/catalog/catalog.v1.json'),'utf8'));
 const learning=buildLearningCatalog(raw,registry,old);const vm=require('node:vm'),ctx={window:{}};vm.runInNewContext(fs.readFileSync(path.join(root,'noam-learning-catalog.js'),'utf8'),ctx);assert.equal(JSON.stringify(learning),JSON.stringify(ctx.window.NOAM_LEARNING_CATALOG));
});
test('actual six disabled source fixtures support synthetic 108-row binding without duplicate base PDFs',()=>{
 const b=fixture(registry),p=build(b),next=merged(b,p);assert.equal(p.batches.length,2);assert(!JSON.stringify(p).includes('canonicalItemId'));assert(!JSON.stringify(p).includes('units'));
 const rat=next.grades.find(g=>g.grade===9).topics.find(t=>t.id===47),ratOld=catalog.grades.find(g=>g.grade===9).topics.find(t=>t.id===47);
 assert.deepEqual(rat.levels,ratOld.levels);assert.deepEqual(rat.routing,ratOld.routing);assert.equal(rat.publicationMode,'pdf-only');assert.equal(rat.reviewedBaseBinding.editionId,'ms-20261115-rat-01-r1');assert.equal(rat.editions,undefined);
 const frq=next.grades.find(g=>g.grade===7).topics.find(t=>t.id===26),frqOld=catalog.grades.find(g=>g.grade===7).topics.find(t=>t.id===26);
 assert.deepEqual(frq.levels,frqOld.levels);assert.deepEqual(frq.routing,frqOld.routing);assert.equal(frq.defaultEditionId,frqOld.defaultEditionId);
 assert(frq.editions.find(e=>e.editionId==='ms-20261115-frq-01-r1').levels.every(l=>l.ramzi.status==='ready'));
 assert.deepEqual(next.ramziActivation,catalog.ramziActivation);assert.deepEqual(next.ramziHintCorrection,catalog.ramziHintCorrection);
 const learning=buildLearningCatalog(raw,registry,old,{trust:b.trust,bundle:b}),original=buildLearningCatalog(raw,registry,old);
 assert.equal(learning.length,original.length+6);assert.deepEqual(learning.slice(0,original.length),original);assert.equal(new Set(learning.map(l=>l.id)).size,original.length+6);
 assert.equal(learning.filter(l=>l.editionId==='ms-20261115-rat-01-r1').length,3);assert(!learning.some(l=>/^g9-t47-[abc]$/.test(l.id)));
});
test('withdrawing additions from a previously active snapshot removes both kinds without disturbing first567',()=>{
 const b=fixture(registry),next=merged(b);assert.deepEqual(mergeReviewedCatalog(next,registry,old.ready,old.hintCorrection,undefined,b.trust),catalog);
 const projection=build(b);projection.batches=projection.batches.filter(x=>x.scopeId.includes('frq'));
 const frqOnly=mergeReviewedCatalog(next,registry,old.ready,old.hintCorrection,projection,b.trust);
 assert.equal(frqOnly.grades.find(g=>g.grade===9).topics.find(t=>t.id===47).reviewedBaseBinding,undefined);
 assert(frqOnly.grades.find(g=>g.grade===7).topics.find(t=>t.id===26).editions.find(e=>e.editionId.includes('frq')).routing.usesViewer);
});
const bad=[
 ['unknown request field',b=>b.requests.batches[0].ready=true],
 ['untrusted scope',b=>b.trust.scopes.shift()],
 ['duplicate request',b=>b.requests.batches.push(clone(b.requests.batches[0]))],
 ['missing scope bytes',b=>delete b.scopes[b.requests.batches[0].scopeId]],
 ['changed accepted scope bytes',b=>b.scopes[b.requests.batches[0].scopeId]+=' '],
 ['capsule source substitution',b=>b.trust.scopes[0].batch.units[0].pdfSha256='a'.repeat(64)],
 ['capsule payload substitution',b=>b.trust.scopes[0].batch.payloadSha256='a'.repeat(64)],
 ['unknown capsule field',b=>b.trust.scopes[0].batch.approved=true],
 ['missing manifest',b=>delete b.assets.manifests[Object.keys(b.assets.manifests)[0]]],
 ['changed manifest bytes',b=>b.assets.manifests[Object.keys(b.assets.manifests)[0]]+=' '],
 ['changed native bytes',b=>b.assets.nativeExports[Object.keys(b.assets.nativeExports)[0]]=Buffer.from('{}')],
 ['missing learning scope',b=>delete b.assets.learningScopes[Object.keys(b.assets.learningScopes)[0]]],
 ['changed learning scope',b=>b.assets.learningScopes[Object.keys(b.assets.learningScopes)[0]]+=' '],
 ['missing actual DB receipt',b=>delete b.receipts[b.requests.batches[0].dbReadbackReceiptSha256]],
 ['missing enforcement proof',b=>delete b.receipts[b.requests.batches[0].scopeEnforcementReceiptSha256]],
 ['prepared not executed DB',b=>changeReceipt(b,'dbReadbackReceiptSha256',r=>r.status='PREPARED_NOT_EXECUTED')],
 ['unverified review rows',b=>changeReceipt(b,'dbReadbackReceiptSha256',r=>r.rows[0].status='review')],
 ['missing DB row',b=>changeReceipt(b,'dbReadbackReceiptSha256',r=>r.rows.pop())],
 ['duplicate DB row',b=>changeReceipt(b,'dbReadbackReceiptSha256',r=>r.rows[1]=clone(r.rows[0]))],
 ['unreviewed hint tier',b=>changeReceipt(b,'dbReadbackReceiptSha256',r=>r.rows[0].hintSha256[1]='a'.repeat(64))],
 ['source/PDF substitution',b=>changeReceipt(b,'dbReadbackReceiptSha256',r=>r.rows[0].pdfSha256='a'.repeat(64))],
 ['wrong canonical item',b=>changeReceipt(b,'dbReadbackReceiptSha256',r=>r.rows[0].canonicalItemId+='-other')],
 ['wrong question hash',b=>changeReceipt(b,'dbReadbackReceiptSha256',r=>r.rows[0].canonicalQuestionSha256='a'.repeat(64))],
 ['wrong verified payload',b=>changeReceipt(b,'dbReadbackReceiptSha256',r=>r.payloadSha256='a'.repeat(64))],
 ['self review',b=>changeReceipt(b,'dbReadbackReceiptSha256',r=>r.reviewerId=r.authorId)],
 ['future actual observation',b=>changeReceipt(b,'dbReadbackReceiptSha256',r=>r.observedAt=new Date(Date.now()+86400000).toISOString())],
 ['fake future deployment field',b=>changeReceipt(b,'assetReceiptSha256',r=>r.futureDeployedCommit='a'.repeat(40))],
 ['missing CDN PDF',b=>changeReceipt(b,'assetReceiptSha256',r=>r.pdfs.pop())],
 ['local manifest substitution',b=>changeReceipt(b,'assetReceiptSha256',r=>r.localManifestHashes[0]='a'.repeat(64))],
 ['unread learning IDs',b=>changeReceipt(b,'learningReceiptSha256',r=>r.status='planned')],
 ['legacy learning ID alias',b=>changeReceipt(b,'learningReceiptSha256',r=>r.worksheetIds[0]='g9-t47-a')],
 ['unproven dynamic scope',b=>changeReceipt(b,'scopeEnforcementReceiptSha256',r=>r.status='instructions_added_only')],
 ['wrong dynamic scope hash',b=>changeReceipt(b,'scopeEnforcementReceiptSha256',r=>r.learningScopeSha256='a'.repeat(64))],
];
for(const[name,mutate]of bad)test('full build rejects '+name,()=>{const b=fixture(registry);mutate(b);assert.throws(()=>build(b));});
for(const[name,mutate]of [
 ['readback substitution',p=>p.batches[0].readbackReceiptSha256='a'.repeat(64)],
 ['evidence substitution',p=>p.batches[0].evidenceSha256='a'.repeat(64)],
 ['unknown public field',p=>p.batches[0].nativeExportSha256='a'.repeat(64)],
 ['missing public scope',p=>delete p.batches[0].scopeSha256],
 ['substituted scope',p=>p.batches[0].scopeSha256='a'.repeat(64)],
 ['unknown scope',p=>p.batches[0].scopeId='not-reviewed'],
 ['duplicate public scope',p=>p.batches.push(clone(p.batches[0]))],
 ['custom public prototype',p=>Object.setPrototypeOf(p.batches[0],{fake:true})],
 ['private path',p=>p.batches[0].evidenceSha256='/Users/private/proof.json'],
])test('pure SSR rejects '+name,()=>{const b=fixture(registry),p=build(b);mutate(p);assert.throws(()=>validateAdditionalProjection(catalog,registry,p,b.trust));});
// Re-sign synthetic fixtures only: prove the semantic gates still reject a
// technically well-pinned but forbidden contract, beyond rejecting bad bytes.
function rebindSynthetic(b, mutate){
 const r=b.requests.batches[0],t=b.trust.scopes[0],s=JSON.parse(b.scopes[r.scopeId]);mutate(s,b);
 const raw=bytes(s);r.scopeSha256=hash(raw);b.scopes[r.scopeId]=raw;t.scopeSha256=r.scopeSha256;t.batch=clone(s.batch);
 for(const key of ['assetReceiptSha256','dbReadbackReceiptSha256','learningReceiptSha256','scopeEnforcementReceiptSha256'])changeReceipt(b,key,v=>{
  if(Object.hasOwn(v,'scopeSha256'))v.scopeSha256=r.scopeSha256;
  if(Object.hasOwn(v,'learningScopeSha256'))v.learningScopeSha256=s.batch.learningScopeSha256;
  if(key==='assetReceiptSha256')v.localManifestHashes=s.batch.units.map(u=>u.manifestSha256);
 });
}
test('algebra cannot permit diagrams even with a fully re-pinned synthetic scope',()=>{
 const b=fixture(registry);rebindSynthetic(b,(s,b)=>{const p=JSON.parse(b.assets.learningScopes[b.requests.batches[0].scopeId]);p.drawingsAllowed=true;const raw=bytes(p);b.assets.learningScopes[p.scopeId]=raw;s.batch.learningScopeSha256=hash(raw);});
 assert.throws(()=>build(b),/drawing policy/);
});
test('a disabled source manifest cannot activate merely by adding matching evidence',()=>{
 const b=fixture(registry);rebindSynthetic(b,(s,b)=>{const u=s.batch.units[0],m=JSON.parse(b.assets.manifests[u.pdfId]);m.publishable=false;m.reviewRequired=true;const raw=bytes(m);b.assets.manifests[u.pdfId]=raw;u.manifestSha256=hash(raw);});
 assert.throws(()=>build(b),/MEASURED_UNREVIEWED_DRAFT/);
});
for(const [name,mutate,error] of [
 ['PDF bytes differ from the accepted CDN and DB source',m=>JSON.parse(JSON.stringify(m).replaceAll(m.sourceSha256,'a'.repeat(64))),/manifest identity/],
 ['grade differs from the reviewed batch',m=>({...m,grade:m.grade===9?7:9}),/manifest curriculum\/level identity/],
 ['topic differs from the reviewed batch',m=>({...m,topicId:m.topicId+1}),/manifest curriculum\/level identity/],
])test('re-pinned manifest cannot substitute its source: '+name,()=>{
 const b=fixture(registry);rebindSynthetic(b,(s,b)=>{
  const u=s.batch.units[0],m=mutate(JSON.parse(b.assets.manifests[u.pdfId]));
  const raw=bytes(m);b.assets.manifests[u.pdfId]=raw;u.manifestSha256=hash(raw);
 });
 // Scope, trust and asset receipts match the altered manifest's new bytes.
 // Accepted PDF/DB identity remains unchanged, so byte hashing alone is insufficient.
 assert.throws(()=>build(b),error);
});
test('reviewed scope requires actual bounded tool lists',()=>{
 const b=fixture(registry);rebindSynthetic(b,(s,b)=>{const p=JSON.parse(b.assets.learningScopes[b.requests.batches[0].scopeId]);p.permittedTools=[];const raw=bytes(p);b.assets.learningScopes[p.scopeId]=raw;s.batch.learningScopeSha256=hash(raw);});assert.throws(()=>build(b),/bounded scope tools/);
});
test('candidate static assets are byte-identical disabled sources, never synthetic test receipts',()=>{
 const zlib=require('node:zlib'),dir=path.join(root,'tests/fixtures/reviewed-ramzi-additional'),pins=JSON.parse(fs.readFileSync(path.join(dir,'source-pins.json')));
 for(const p of pins.files){const raw=zlib.gunzipSync(fs.readFileSync(path.join(dir,p.file))),j=JSON.parse(raw);
  const target=p.file.includes('.manifest.')?'manifests/'+j.pdfHash+'.json':'native/'+j.package+'/'+j.level+'/noam-ai.json';
  assert.equal(hash(fs.readFileSync(path.join(root,'headless/astro-poc/public/noam-ai',target))),p.uncompressedSha256);
  if(p.file.includes('.manifest.')){assert.equal(j.publishable,false);assert.equal(j.reviewRequired,true);}
 }
 assert.equal(fs.existsSync(path.join(root,'headless/catalog/ramzi-additional-requests.v1.json')),false);
 assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root,'headless/catalog/ramzi-additional-trust.v1.json'))),{version:1,scopes:[]});
});
