"use strict";
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {runAudit,learningOutputs}=require('../tools/catalog-audit.cjs');
const {loadIndexCatalog}=require('../scripts/lib/headless-catalog.cjs');
const {buildLearningCatalog}=require('../scripts/build-learning-catalog.cjs');
const {fixture}=require('./fixtures/ramzi-activation-evidence.cjs');
const root=path.resolve(__dirname,'..'),registry=JSON.parse(fs.readFileSync(path.join(root,'headless/catalog/worksheet-editions.v1.json')));

test('real activation audit reconstructs the generated snapshot and all979 learning rows',async()=>{
 const result=await runAudit({root,pdf:'off'});
 assert.deepEqual(result.findings.filter(f=>f.severity==='error'),[]);
 assert.equal(result.coverage.learningItems,979);
 assert(result.inputs.some(input=>input.path==='headless/catalog/worksheet-ramzi-ready.v1.json'&&/^[0-9a-f]{64}$/.test(input.sha256)));
});
test('independent learning reconstruction uses the same validated evidence as the writer',()=>{
 const raw=loadIndexCatalog(),bundle=fixture();
 assert.deepEqual(learningOutputs(raw,registry,bundle).items,buildLearningCatalog(raw,registry,bundle));
 bundle.ready.units[0].revision++;
 assert.throws(()=>learningOutputs(raw,registry,bundle),/Ramzi activation/);
});
test('audit reports altered manifest evidence as an activation error before stale-copy checks',async(t)=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'activation-audit-'));t.after(()=>fs.rmSync(temp,{recursive:true,force:true}));
 const put=(rel,data)=>{const p=path.join(temp,rel);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,data);};
 const bundle=fixture();
 put('index.html',fs.readFileSync(path.join(root,'index.html')));put('headless/catalog/worksheet-editions.v1.json',JSON.stringify(registry));put('headless/catalog/worksheet-ramzi-ready.v1.json',JSON.stringify(bundle.ready));
 for(const [hash,bytes]of Object.entries(bundle.receipts))put('headless/catalog/ramzi-evidence/'+hash+'.json',bytes);
 for(const [id,bytes]of Object.entries(bundle.manifests))put('headless/astro-poc/public/noam-ai/manifests/'+id+'.json',bytes);
 for(const [key,bytes]of Object.entries(bundle.nativeExports))put('headless/astro-poc/public/noam-ai/native/'+key+'/noam-ai.json',bytes);
 fs.appendFileSync(path.join(temp,'headless/astro-poc/public/noam-ai/manifests/'+bundle.ready.units[0].pdfId+'.json'),' ');
 const result=await runAudit({root:temp,pdf:'off'}),errors=result.findings.filter(f=>f.severity==='error');
 assert(errors.some(f=>f.code==='RAMZI_ACTIVATION_INVALID'&&/manifest hash mismatch/.test(JSON.stringify(f))));
 assert(!errors.some(f=>f.code==='EXPORT_STALE'||f.code==='LEARNING_CATALOG_STALE'));
});
