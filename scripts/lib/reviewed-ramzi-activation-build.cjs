'use strict';
// Additional packages only. Historical first567 import/validation is never widened.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {validateAdditionalProjection}=require('./reviewed-ramzi-activation.mjs');
const {validateMeasuredManifest}=require('../../headless/astro-poc/scripts/lib/measured-worksheet.mjs');
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const SHA=/^[0-9a-f]{64}$(?![\s\S])/;
function must(ok,why){if(!ok)throw Error('Additional Ramzi build: '+why);}
function exact(v,keys,label){must(v&&typeof v==='object'&&!Array.isArray(v)&&[Object.prototype,null].includes(Object.getPrototypeOf(v))&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k)),label+' fields');}
function decode(raw,expected,label){must((typeof raw==='string'||Buffer.isBuffer(raw))&&SHA.test(expected)&&hash(raw)===expected,label+' bytes/hash');return JSON.parse(String(raw));}
const ITEM=['editionId','exerciseId','pdfId','pdfSha256','canonicalSourceSha256','canonicalQuestionSha256','canonicalItemId','sourceExerciseSha256','hintSha256'];
const PARTS=['manifests','nativeExports','learningScopes'];
function artifact(assets,kind,key,sha){must(PARTS.includes(kind)&&assets[kind]&&Object.hasOwn(assets[kind],key),'missing '+kind+' artifact');return decode(assets[kind][key],sha,kind);}
function publicOnly(value) {
 if (Array.isArray(value)) return value.forEach(publicOnly);
 if (value && typeof value==='object') for (const [k,v] of Object.entries(value)) {must(!/^(answer|answers|solution|solutions|expected_answer|final_answer|hint_[123]|private_solutions)$/i.test(k),'private answer/hint field');publicOnly(v);}
 else if (typeof value==='string') must(!/(?:\/Users\/|\/home\/|file:\/\/|service_role|sb_secret_)/i.test(value),'private path/secret');
}
function same(a,b,label){try{assert.deepStrictEqual(a,b);}catch{throw Error('Additional Ramzi build: '+label);}}
/** All receipts here are build-only. A syntactically plausible receipt never proves SQL ran. */
function validateAdditionalEvidence(catalog,registry,bundle){
 if(bundle===undefined)return undefined;
 exact(bundle,['trust','requests','scopes','receipts','assets'],'bundle');
 validateAdditionalProjection(catalog,registry,undefined,bundle.trust);
 exact(bundle.requests,['schema','batches'],'requests');must(bundle.requests.schema==='noam-reviewed-additional-requests/v1'&&Array.isArray(bundle.requests.batches),'request schema');
 if(!bundle.requests.batches.length){validateAdditionalProjection(catalog,registry,undefined,bundle.trust);return undefined;}
 const batches=[];const seen=new Set();
 for(const request of bundle.requests.batches){
  exact(request,['scopeId','scopeSha256','assetReceiptSha256','dbReadbackReceiptSha256','learningReceiptSha256','scopeEnforcementReceiptSha256'],'request');
  const trusted=bundle.trust.scopes.find(t=>t.scopeId===request.scopeId);must(trusted&&trusted.scopeSha256===request.scopeSha256&&!seen.has(request.scopeId),'trusted unique scope');seen.add(request.scopeId);
  const scope=decode(bundle.scopes[request.scopeId],trusted.scopeSha256,'accepted scope');
  exact(scope,['schema','batch','items','rootAcceptanceSha256','independentReviewSha256','authorId','reviewerId','hintsBundleSha256'],'accepted scope');
  must(scope.schema==='noam-reviewed-additional-scope/v1'&&scope.rootAcceptanceSha256===trusted.rootAcceptanceSha256&&scope.independentReviewSha256===trusted.independentReviewSha256,'review pins');
  must(typeof scope.authorId==='string'&&scope.authorId.length>0&&typeof scope.reviewerId==='string'&&scope.reviewerId.length>0&&scope.authorId.toLowerCase()!==scope.reviewerId.toLowerCase(),'independent review');
  must(SHA.test(scope.hintsBundleSha256),'hint bundle pin');
  same(trusted.batch,scope.batch,'compiled trust capsule differs from accepted scope');
  const ref={scopeId:request.scopeId,scopeSha256:request.scopeSha256,readbackReceiptSha256:request.dbReadbackReceiptSha256,evidenceSha256:hash(JSON.stringify(request))};
  const b={...scope.batch,...ref};
  // The compiled trust index pins the entire batch; receipts cannot widen it.
  validateAdditionalProjection(catalog,registry,{schema:'noam-reviewed-additional-ready/v1',batches:[ref]},bundle.trust);
  must(Array.isArray(scope.items)&&scope.items.length===b.units.reduce((n,u)=>n+u.itemCount,0),'scope item count');
  const byExercise=new Map(),canonicalIds=new Set();for(const item of scope.items){exact(item,ITEM,'scope item');must(item.editionId===b.editionId&&!byExercise.has(item.exerciseId),'scope item identity');must(typeof item.canonicalItemId==='string'&&!canonicalIds.has(item.canonicalItemId),'unique canonical item');canonicalIds.add(item.canonicalItemId);byExercise.set(item.exerciseId,item);must(Array.isArray(item.hintSha256)&&item.hintSha256.length===3&&item.hintSha256.every(x=>typeof x==='string'&&SHA.test(x)),'three reviewed tiers');}
  for(const u of b.units){
   const manifest=artifact(bundle.assets,'manifests',u.pdfId,u.manifestSha256);
   publicOnly(manifest);validateMeasuredManifest(manifest);
   const native=artifact(bundle.assets,'nativeExports',b.nativePrefix+'/'+u.level,u.nativeExportSha256);
   publicOnly(native);
   must(manifest.pdfHash===u.pdfId&&manifest.sourceSha256===u.pdfSha256&&manifest.editionId===b.editionId&&manifest.prefix===b.nativePrefix&&manifest.level===u.level&&manifest.canonicalSourceSha256===u.canonicalSourceSha256,'manifest identity');
   must(manifest.grade===b.grade&&manifest.topicId===b.topicId&&manifest.levelCode===({a:'A',b:'B',c:'E'}[u.level]),'manifest curriculum/level identity');
   must(manifest.nativeExportSha256===u.nativeExportSha256&&manifest.sourceNativeExportSha256===u.sourceNativeExportSha256&&native.package===b.nativePrefix&&native.level===u.level,'native identity');
   must(manifest.reviewRequired===false&&manifest.publishable===true,'final locally reviewed manifest required');
   must(Array.isArray(manifest.exercises)&&manifest.exercises.length===u.itemCount,'manifest item count');
   const ids=new Set();for(const ex of manifest.exercises){must(!ids.has(ex.id),'duplicate manifest exercise');ids.add(ex.id);const item=byExercise.get(ex.id);must(item,'unknown manifest exercise');for(const [a,z]of [['pdfId',u.pdfId],['pdfSha256',u.pdfSha256],['canonicalSourceSha256',u.canonicalSourceSha256],['canonicalItemId',ex.canonicalItemId],['canonicalQuestionSha256',ex.canonicalQuestionSha256],['sourceExerciseSha256',ex.sourceExerciseSha256]])must(item[a]===z,'exact item/source binding '+a);}
  }
  const profile=artifact(bundle.assets,'learningScopes',b.scopeId,b.learningScopeSha256);publicOnly(profile);exact(profile,['schema','scopeId','status','drawingsAllowed','permittedTools','deferredTools'],'learning scope');must(profile.schema==='noam-reviewed-learning-scope/v1'&&['permittedTools','deferredTools'].every(k=>Array.isArray(profile[k])&&profile[k].length<=30&&profile[k].every(x=>typeof x==='string'&&x.trim().length>0&&x.length<=400))&&profile.permittedTools.length>0,'bounded scope tools');must(profile.scopeId===b.scopeId&&typeof profile.drawingsAllowed==='boolean'&&(!profile.drawingsAllowed||catalog.grades.find(g=>g.grade===b.grade)?.topics.find(t=>t.id===b.topicId)?.group==='geo')&&profile.status==='reviewed','reviewed learning scope and topic drawing policy');
  const receipt=(field,label)=>decode(bundle.receipts[request[field]],request[field],label);
  const assets=receipt('assetReceiptSha256','asset receipt');exact(assets,['schema','status','scopeId','scopeSha256','pdfs','localManifestHashes','localNativeHashes','learningScopeSha256'],'asset receipt');
  must(assets.schema==='noam-reviewed-additional-assets/v1'&&['verified_published_source_assets','reviewed_local_final_assets_with_verified_cdn_pdfs'].includes(assets.status),'real asset evidence phase');
  must(assets.scopeId===b.scopeId&&assets.scopeSha256===b.scopeSha256&&assets.learningScopeSha256===b.learningScopeSha256,'asset scope');
  same(assets.pdfs,b.units.map(u=>({pdfId:u.pdfId,pdfSha256:u.pdfSha256})),'verified CDN PDF bindings');same(assets.localManifestHashes,b.units.map(u=>u.manifestSha256),'local final manifests');same(assets.localNativeHashes,b.units.map(u=>u.nativeExportSha256),'local native assets');
  const db=receipt('dbReadbackReceiptSha256','DB readback');exact(db,['schema','status','scopeId','scopeSha256','payloadSha256','sourceReceiptSha256','observedAt','authorId','reviewerId','rows'],'DB readback');
  must(db.schema==='noam-reviewed-additional-db-readback/v1'&&db.status==='verified_exact_readback'&&db.scopeId===b.scopeId&&db.scopeSha256===b.scopeSha256&&db.payloadSha256===b.payloadSha256,'committed readback scope');
  must(SHA.test(db.sourceReceiptSha256)&&typeof db.observedAt==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(db.observedAt)&&new Date(db.observedAt).toISOString()===db.observedAt&&Date.parse(db.observedAt)<=Date.now()+60000,'actual readback metadata');
  must(db.authorId===scope.authorId&&db.reviewerId===scope.reviewerId,'DB independent review');same(db.rows,scope.items.map(i=>({...i,status:'verified'})),'exact verified rows/tier hashes');
  const learning=receipt('learningReceiptSha256','learning readback');exact(learning,['schema','status','scopeId','worksheetIds','sourceReceiptSha256'],'learning readback');must(learning.schema==='noam-reviewed-additional-learning-readback/v1'&&learning.status==='verified_exact_readback'&&learning.scopeId===b.scopeId&&SHA.test(learning.sourceReceiptSha256),'learning readback phase');same(learning.worksheetIds,b.units.map(u=>`g${b.grade}-t${b.topicId}-${u.level}-e-${b.editionId}`),'exact learning IDs');
  const enforcement=receipt('scopeEnforcementReceiptSha256','scope enforcement');exact(enforcement,['schema','status','scopeId','learningScopeSha256','sourceReceiptSha256'],'scope enforcement');must(enforcement.schema==='noam-reviewed-additional-scope-enforcement/v1'&&enforcement.status==='verified_server_scope_and_drawing_policy'&&enforcement.scopeId===b.scopeId&&enforcement.learningScopeSha256===b.learningScopeSha256&&SHA.test(enforcement.sourceReceiptSha256),'trusted server scope required');
  batches.push(ref);
 }
 const projection={schema:'noam-reviewed-additional-ready/v1',batches};validateAdditionalProjection(catalog,registry,projection,bundle.trust);return projection;
}
function loadAdditionalEvidence(catalogDir,publicDir){
 const trustPath=path.join(catalogDir,'ramzi-additional-trust.v1.json');const trust=fs.existsSync(trustPath)?JSON.parse(fs.readFileSync(trustPath,'utf8')):{version:1,scopes:[]};
 const requestPath=path.join(catalogDir,'ramzi-additional-requests.v1.json');if(!fs.existsSync(requestPath))return {trust,bundle:undefined};
 const requests=JSON.parse(fs.readFileSync(requestPath,'utf8'));exact(requests,['schema','batches'],'request file');must(Array.isArray(requests.batches),'request batches');const scopes={},receipts={},assets={manifests:{},nativeExports:{},learningScopes:{}};
 for(const r of requests.batches){must(typeof r.scopeId==='string'&&/^[a-z0-9][a-z0-9-]{0,63}$(?![\s\S])/.test(r.scopeId),'scope path');must(SHA.test(r.scopeSha256),'scope hash path');const raw=fs.readFileSync(path.join(catalogDir,'ramzi-additional-evidence',r.scopeSha256+'.json'));scopes[r.scopeId]=raw;const scope=decode(raw,r.scopeSha256,'scope bytes');
  for(const field of ['assetReceiptSha256','dbReadbackReceiptSha256','learningReceiptSha256','scopeEnforcementReceiptSha256']){must(SHA.test(r[field]),'receipt hash path');receipts[r[field]]=fs.readFileSync(path.join(catalogDir,'ramzi-additional-evidence',r[field]+'.json'));}
  const b=scope.batch;must(/^G[789]-T\d{2,3}$/.test(b.nativePrefix)&&Array.isArray(b.units),'native path');for(const u of b.units){must(/^[0-9a-f]{32}$/.test(u.pdfId)&&['a','b','c'].includes(u.level),'asset path');assets.manifests[u.pdfId]=fs.readFileSync(path.join(publicDir,'noam-ai/manifests',u.pdfId+'.json'));assets.nativeExports[b.nativePrefix+'/'+u.level]=fs.readFileSync(path.join(publicDir,'noam-ai/native',b.nativePrefix,u.level,'noam-ai.json'));}assets.learningScopes[r.scopeId]=fs.readFileSync(path.join(publicDir,'noam-ai/learning-scopes',r.scopeId+'.json'));
 }
 return {trust,bundle:{trust,requests,scopes,receipts,assets}};
}
module.exports={validateAdditionalEvidence,loadAdditionalEvidence};
