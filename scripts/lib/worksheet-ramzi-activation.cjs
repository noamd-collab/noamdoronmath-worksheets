'use strict';
// Build-time evidence gate. It never reads a database or grants a publication.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const SHA = /^[0-9a-f]{64}$(?![\s\S])/;
const COMMIT = /^[0-9a-f]{40}$(?![\s\S])/;
const REVIEW = '3a2438b4076088398e0fb5b167051eb1d57b7a2c1911fcca427abcc35348bd50';
const SCOPE = Object.freeze({ 'ms-20261113-trn-r1': 'G7-T86', 'ms-20261113-cyl-r1': 'G8-T84',
  'ms-20261113-con-r1': 'G8-T87', 'ms-20261113-par-r1': 'G9-T85' });
const UNIT = ['editionId', 'prefix', 'level', 'worksheetId', 'revision', 'pdfId', 'pdfSha256',
  'sourceNativeExportSha256', 'nativeExportSha256', 'canonicalSourceSha256', 'manifestSha256', 'itemCount', 'hintCount'];
const COMMON = ['editionId', 'prefix', 'level', 'worksheetId', 'revision', 'pdfId', 'pdfSha256',
  'sourceNativeExportSha256', 'nativeExportSha256', 'canonicalSourceSha256', 'itemCount', 'hintCount'];
const RECEIPTS = {
  publicationReceiptSha256: ['publication', 'verified_source_assets'],
  finalManifestReviewReceiptSha256: ['manifest-review', 'reviewed_not_deployed'],
  verifiedDbReadbackReceiptSha256: ['db-readback', 'verified_exact_readback'],
  learningWorksheetsReceiptSha256: ['learning-readback', 'verified_exact_readback'],
};
function must(ok, why) { if (!ok) throw Error('Ramzi activation: ' + why); }
function object(v, allowed, label, required = allowed) {
  must(v && typeof v === 'object' && !Array.isArray(v), label + ' must be an object');
  must(Object.keys(v).every(k => allowed.includes(k)) && required.every(k => Object.hasOwn(v,k)), label + ' fields');
}
function hash(bytes) { return crypto.createHash('sha256').update(bytes).digest('hex'); }
function parsed(bytes, expected, label) {
  must(typeof bytes === 'string' || Buffer.isBuffer(bytes), label + ' bytes absent');
  must(hash(bytes) === expected, label + ' hash mismatch'); return JSON.parse(String(bytes));
}
function key(unit) { return unit.editionId + ':' + unit.level; }
function learningId(row, level) { return `g${row.grade}-t${row.topicId}-${level}-e-${row.editionId}`; }
function noPrivateValues(value) {
  if (typeof value === 'string') must(!/(?:\/Users\/|\/home\/|file:\/\/|service_role|supabase_secret|sb_secret_)/i.test(value), 'private value in ready record');
  else if (Array.isArray(value)) value.forEach(noPrivateValues);
  else if (value && typeof value === 'object') Object.values(value).forEach(noPrivateValues);
}
function sameFields(a,b,fields,label) { for (const f of fields) must(a[f] === b[f], label + ' ' + f + ' mismatch'); }
function validateRamziActivation(registry, bundle) {
  if (bundle === undefined) return new Map();
  object(bundle, ['ready','receipts','manifests','nativeExports'], 'evidence bundle');
  const r = bundle.ready;
  object(r, ['schema','status','finalManifestsPublished','contentReviewedHead','deployedCommit','releaseReceiptSha256',
    'itemCount','hintCount','hintReviewSha256','payloadSha256',...Object.keys(RECEIPTS),'units'], 'ready');
  noPrivateValues(r);
  must(r.schema === 'noam-first567-activation-ready/v1' && r.status === 'ready_for_activation' && r.finalManifestsPublished === false, 'ready phase');
  must(r.contentReviewedHead === '4f155ebb1f1c1bf85f91dba313df1be3d1cc7217' && COMMIT.test(r.deployedCommit), 'release provenance');
  for (const f of ['releaseReceiptSha256','payloadSha256',...Object.keys(RECEIPTS)]) must(SHA.test(r[f]), 'invalid ' + f);
  must(r.hintReviewSha256 === REVIEW && r.itemCount === 567 && r.hintCount === 1701, 'review scope');
  must(Array.isArray(r.units) && r.units.length === 12, 'exact twelve units required');
  const rows = new Map(registry.editions.map(e => [e.editionId,e]));
  const units = new Map(); let itemCount = 0;
  for (const u of r.units) {
    object(u, UNIT, 'unit');
    must(Object.hasOwn(SCOPE,u.editionId) && SCOPE[u.editionId] === u.prefix && ['a','b','c'].includes(u.level), 'unit outside approved scope');
    must(!units.has(key(u)), 'duplicate unit'); units.set(key(u),u);
    const row = rows.get(u.editionId), level = row?.levels?.find(l => l.key === u.level);
    must(row && row.status === 'published' && row.publicationMode === 'pdf-only' && row.isDefault === false && row.nativePrefix === u.prefix && level, 'edition declaration mismatch');
    sameFields(u,level,['worksheetId','revision','pdfId','pdfSha256'],'registry level');
    must(u.sourceNativeExportSha256 === level.nativeExportSha256, 'frozen native source mismatch');
    for (const f of ['pdfSha256','sourceNativeExportSha256','nativeExportSha256','canonicalSourceSha256','manifestSha256']) must(SHA.test(u[f]), 'invalid unit '+f);
    must(Number.isInteger(u.itemCount) && u.itemCount > 0 && u.hintCount === u.itemCount * 3, 'item/hint count'); itemCount += u.itemCount;
    const m = parsed(bundle.manifests[u.pdfId],u.manifestSha256,'manifest');
    must(m.editionId === u.editionId && m.prefix === u.prefix && m.nativeLevel === u.level && m.level === u.level && m.pdfHash === u.pdfId && m.sourceSha256 === u.pdfSha256, 'manifest identity');
    must(m.geometryContract === 'measured-v1' && m.publishable === true && m.nativeExportPublished === true && m.reviewRequired === false, 'final manifest not enabled');
    sameFields(m,u,['sourceNativeExportSha256','nativeExportSha256','canonicalSourceSha256'],'manifest source');
    must(m.nativeExportUrl === `/noam-ai/native/${u.prefix}/${u.level}/noam-ai.json`, 'native URL mismatch');
    must(Array.isArray(m.exercises) && m.exercises.length === u.itemCount && m.exerciseCount === u.itemCount, 'manifest item count');
    must(new Set(m.exercises.map(e=>e.id)).size === u.itemCount && new Set(m.exercises.map(e=>e.canonicalItemId)).size === u.itemCount, 'duplicate exercise identity');
    const native = parsed(bundle.nativeExports[u.prefix+'/'+u.level],u.nativeExportSha256,'native');
    must(native.package === u.prefix && native.level === u.level && Array.isArray(native.questions), 'native identity');
    const nativeRows = native.questions.flatMap(q => (q.items || []).map(i => q.id + ':' + i.id));
    const nativeItems = new Set(nativeRows);
    must(nativeRows.length === u.itemCount && nativeItems.size === u.itemCount, 'native item count');
    for (const e of m.exercises) {
      must(e.nativeLevel === u.level && typeof e.canonicalItemId === 'string' && e.canonicalItemId.startsWith(u.worksheetId+'.question.') && SHA.test(e.canonicalQuestionSha256) && SHA.test(e.sourceExerciseSha256), 'canonical exercise identity');
      must(nativeItems.delete(e.nativeQuestionId+':'+e.nativeItemId), 'native/exercise mapping mismatch');
    }
    must(nativeItems.size === 0, 'native items omitted');
  }
  must(itemCount === r.itemCount, 'unit total');
  for (const edition of Object.keys(SCOPE)) for (const level of ['a','b','c']) must(units.has(edition+':'+level),'missing approved level');
  for (const [field,[kind,status]] of Object.entries(RECEIPTS)) {
    const receipt = parsed(bundle.receipts[r[field]],r[field],kind+' receipt');
    const allowed=['schema','status','contentReviewedHead','deployedCommit','releaseReceiptSha256','sourceReceiptSha256','units',
      ...(kind==='db-readback'?['payloadSha256','hintReviewSha256','itemCount','hintCount']:[]),...(kind==='learning-readback'?['learningIds']:[])];
    object(receipt,allowed,kind+' receipt'); noPrivateValues(receipt);
    must(receipt.schema === 'noam-first567-'+kind+'-evidence/v1' && receipt.status === status && SHA.test(receipt.sourceReceiptSha256), kind+' receipt status');
    sameFields(receipt,r,['contentReviewedHead','deployedCommit','releaseReceiptSha256'],kind+' release');
    must(Array.isArray(receipt.units) && receipt.units.length === 12 && new Set(receipt.units.map(key)).size === 12,kind+' units');
    for (const evidence of receipt.units) {
      const u=units.get(key(evidence)); must(u,kind+' unexpected unit');
      // Each receipt binds the whole worksheet identity. A publication receipt
      // describes existing native/PDF assets; it makes no active-manifest claim.
      const fields=kind==='manifest-review'?UNIT:COMMON;
      object(evidence,fields,kind+' unit'); sameFields(evidence,u,fields,kind+' unit');
    }
    if(kind==='db-readback') sameFields(receipt,r,['payloadSha256','hintReviewSha256','itemCount','hintCount'],'DB readback');
    if(kind==='learning-readback') {
      const ids=r.units.map(u=>learningId(rows.get(u.editionId),u.level)).sort();
      must(Array.isArray(receipt.learningIds) && JSON.stringify([...receipt.learningIds].sort())===JSON.stringify(ids),'learning ID readback');
    }
  }
  return new Map(r.units.map(u=>[key(u),{status:'ready',manifestSha256:u.manifestSha256,nativeExportSha256:u.nativeExportSha256,
    sourceNativeExportSha256:u.sourceNativeExportSha256,canonicalSourceSha256:u.canonicalSourceSha256,itemCount:u.itemCount,hintCount:u.hintCount,
    payloadSha256:r.payloadSha256,verifiedDbReadbackReceiptSha256:r.verifiedDbReadbackReceiptSha256}]));
}
function loadRamziActivationEvidence(catalogDir, publicDir) {
  const readyPath=path.join(catalogDir,'worksheet-ramzi-ready.v1.json');
  if(!fs.existsSync(readyPath)) return undefined;
  const ready=JSON.parse(fs.readFileSync(readyPath,'utf8'));
  // Check path-bearing fields before reading anything outside fixed directories.
  must(Array.isArray(ready.units) && ready.units.length === 12,'ready units');
  const receipts={},manifests={},nativeExports={};
  for(const field of Object.keys(RECEIPTS)){
    must(typeof ready[field]==='string' && SHA.test(ready[field]),'receipt hash path');
    receipts[ready[field]]=fs.readFileSync(path.join(catalogDir,'ramzi-evidence',ready[field]+'.json'));
  }
  for(const u of ready.units){
    must(Object.hasOwn(SCOPE,u.editionId) && SCOPE[u.editionId]===u.prefix && ['a','b','c'].includes(u.level) && /^[0-9a-f]{32}$/.test(u.pdfId),'unit file path');
    manifests[u.pdfId]=fs.readFileSync(path.join(publicDir,'noam-ai/manifests',u.pdfId+'.json'));
    nativeExports[u.prefix+'/'+u.level]=fs.readFileSync(path.join(publicDir,'noam-ai/native',u.prefix,u.level,'noam-ai.json'));
  }
  return {ready,receipts,manifests,nativeExports};
}
module.exports={validateRamziActivation,loadRamziActivationEvidence};
