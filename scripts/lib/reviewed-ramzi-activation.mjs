// Pure runtime projection for additional reviewed packages. Full proofs stay build-only.
// Historical first567 and its optional correction keep their original validator.
import { mergeWorksheetEditions, worksheetLearningId } from './worksheet-editions.mjs';
const HASH=/^[0-9a-f]{64}$(?![\s\S])/;
const ID=/^[a-z0-9][a-z0-9-]{0,63}$(?![\s\S])/;
const UNIT=['level','worksheetId','revision','pdfId','pdfSha256','sourceNativeExportSha256','nativeExportSha256','canonicalSourceSha256','manifestSha256','itemCount','hintCount'];
const BATCH=['scopeId','scopeSha256','targetKind','grade','topicId','editionId','nativePrefix','label','learningScopeSha256','learningScopeUrl','payloadSha256','readbackReceiptSha256','evidenceSha256','units'];
const FIRST567=new Set(['ms-20261113-trn-r1','ms-20261113-cyl-r1','ms-20261113-con-r1','ms-20261113-par-r1']);
function must(ok,why){if(!ok)throw Error('Additional Ramzi: '+why);}
function exact(v,keys,label){must(v&&typeof v==='object'&&!Array.isArray(v)&&[Object.prototype,null].includes(Object.getPrototypeOf(v))&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k)),label+' fields');}
function hash(v,label){must(typeof v==='string'&&HASH.test(v),label+' hash');}
function strip(catalog){
 const {reviewedRamziActivations,...base}=catalog;
 if(!catalog.grades.some(g=>g.topics.some(t=>Object.hasOwn(t,'reviewedBaseBinding'))))return Object.hasOwn(catalog,'reviewedRamziActivations')?base:catalog;
 return {...base,grades:catalog.grades.map(g=>({...g,topics:g.topics.map(t=>{const {reviewedBaseBinding,...original}=t;return original;})}))};
}
export function validateAdditionalProjection(catalog,registry,projection,trust){
 exact(trust,['version','scopes'],'trust index');must(trust.version===1&&Array.isArray(trust.scopes),'trust version');
 const trusted=new Map();for(const s of trust.scopes){exact(s,['scopeId','scopeSha256','rootAcceptanceSha256','independentReviewSha256','batch','activation'],'trusted scope');must(ID.test(s.scopeId)&&!trusted.has(s.scopeId),'trusted identity');for(const f of ['scopeSha256','rootAcceptanceSha256','independentReviewSha256'])hash(s[f],f);exact(s.activation,['readbackReceiptSha256','evidenceSha256'],'trusted activation');for(const value of Object.values(s.activation))hash(value,'trusted activation');trusted.set(s.scopeId,s);}
 if(projection===undefined)return [];
 exact(projection,['schema','batches'],'projection');must(projection.schema==='noam-reviewed-additional-ready/v1'&&Array.isArray(projection.batches)&&projection.batches.length>0,'projection phase');
 const resolved=[];const seen=new Set(),targets=new Set(),prefixes=new Set(),worksheets=new Set(),pdfs=new Set();
 for(const ref of projection.batches){
  exact(ref,['scopeId','scopeSha256','readbackReceiptSha256','evidenceSha256'],'activation reference');
  const capsule=trusted.get(ref.scopeId);must(capsule&&capsule.scopeSha256===ref.scopeSha256,'untrusted scope reference');
  for(const field of ['readbackReceiptSha256','evidenceSha256'])must(ref[field]===capsule.activation[field],'untrusted activation evidence');
  const b={...capsule.batch,...ref};resolved.push(b);
  exact(b,BATCH,'batch');must(ID.test(b.scopeId)&&trusted.get(b.scopeId)?.scopeSha256===b.scopeSha256&&!seen.has(b.scopeId),'untrusted/duplicate scope');seen.add(b.scopeId);
  must(Number.isInteger(b.grade)&&b.grade>=7&&b.grade<=9&&Number.isInteger(b.topicId)&&b.topicId>0,'topic');
  must(['edition','base-topic'].includes(b.targetKind)&&ID.test(b.editionId)&&b.editionId!=='legacy'&&!FIRST567.has(b.editionId),'target/edition');
  must(new RegExp(`^G${b.grade}-T[0-9]{2,3}$(?![\\s\\S])`).test(b.nativePrefix)&&!prefixes.has(b.nativePrefix),'prefix');prefixes.add(b.nativePrefix);
  must(typeof b.label==='string'&&b.label.trim()===b.label&&b.label.length>0&&b.label.length<=80&&!/[<>\u0000-\u001f]/.test(b.label),'label');
  const tk=`${b.grade}:${b.topicId}:${b.targetKind}`+(b.targetKind==='edition'?':'+b.editionId:'');must(!targets.has(tk),'duplicate target');targets.add(tk);
  for(const f of ['scopeSha256','learningScopeSha256','payloadSha256','readbackReceiptSha256','evidenceSha256'])hash(b[f],f);
  must(b.learningScopeUrl===`/noam-ai/learning-scopes/${b.scopeId}.json`,'scope URL');
  const topic=catalog.grades.find(g=>g.grade===b.grade)?.topics.find(t=>t.id===b.topicId);must(topic,'missing topic');
  const row=registry.editions.find(r=>r.editionId===b.editionId);
  must(!registry.editions.some(r=>r.nativePrefix===b.nativePrefix&&r.editionId!==b.editionId),'prefix collision with existing edition');
  if(b.targetKind==='edition')must(row&&row.grade===b.grade&&row.topicId===b.topicId&&row.status==='published'&&row.publicationMode==='pdf-only'&&row.isDefault===false&&row.nativePrefix===b.nativePrefix,'edition registry');
  else must(!row&&topic.publicationMode==='pdf-only'&&!topic.routing.usesViewer&&!topic.routing.resolvedNoamPrefix&&!topic.noamTopicId,'base source must remain PDF-only');
  must(Array.isArray(b.units)&&b.units.length===3,'three units');const levels=new Set();
  for(const u of b.units){exact(u,UNIT,'unit');must(['a','b','c'].includes(u.level)&&!levels.has(u.level),'level');levels.add(u.level);
   must(typeof u.worksheetId==='string'&&/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(u.worksheetId)&&Number.isInteger(u.revision)&&u.revision>0&&!worksheets.has(u.worksheetId),'worksheet identity');worksheets.add(u.worksheetId);
   must(typeof u.pdfId==='string'&&/^[0-9a-f]{32}$(?![\s\S])/.test(u.pdfId)&&!pdfs.has(u.pdfId),'PDF identity');pdfs.add(u.pdfId);
   for(const f of ['pdfSha256','sourceNativeExportSha256','nativeExportSha256','canonicalSourceSha256','manifestSha256'])hash(u[f],f);
   must(Number.isInteger(u.itemCount)&&u.itemCount>0&&u.hintCount===u.itemCount*3,'hint counts');
   const lv=(row?.levels||topic.levels).find(l=>l.key===u.level);must(lv&&lv.pdfId===u.pdfId,'exact source PDF');
   if(row){for(const f of ['worksheetId','revision','pdfSha256'])must(lv[f]===u[f],'edition '+f);must(lv.nativeExportSha256===u.sourceNativeExportSha256,'edition native source');}
   else must(!registry.editions.some(r=>r.levels.some(l=>l.worksheetId===u.worksheetId||l.pdfId===u.pdfId)),'base binding collision');
  }
 }
 return resolved;
}
/** Rebuild old overlays first, so removing an additional request cannot leave stale links. */
export function mergeReviewedCatalog(catalog,registry,ready,hintCorrection,projection,trust){
 const base=mergeWorksheetEditions(strip(catalog),registry,ready,hintCorrection);
 const batches=validateAdditionalProjection(base,registry,projection,trust);if(!batches.length)return base;
 const byTopic=new Map();for(const b of batches){const k=`${b.grade}:${b.topicId}`;const list=byTopic.get(k)||[];list.push(b);byTopic.set(k,list);}
 function binding(topic,b){
  const original=b.targetKind==='edition'?topic.editions.find(e=>e.editionId===b.editionId):topic;
  const levels=original.levels.map(l=>{const u=b.units.find(u=>u.level===l.key);must(u,'exact complete level set');return {...l,worksheetId:u.worksheetId,revision:u.revision,pdfSha256:u.pdfSha256,sourceSha256:u.canonicalSourceSha256,nativeExportSha256:u.sourceNativeExportSha256,viewerLevel:{a:'A',b:'B',c:'E'}[u.level],learningId:worksheetLearningId(b.grade,b.topicId,u.level,b.editionId),ramzi:{status:'ready',manifestSha256:u.manifestSha256,nativeExportSha256:u.nativeExportSha256,sourceNativeExportSha256:u.sourceNativeExportSha256,canonicalSourceSha256:u.canonicalSourceSha256,itemCount:u.itemCount,hintCount:u.hintCount,payloadSha256:b.payloadSha256,verifiedDbReadbackReceiptSha256:b.readbackReceiptSha256,learningScopeSha256:b.learningScopeSha256,learningScopeUrl:b.learningScopeUrl}};});
  return {editionId:b.editionId,label:b.label,status:'published',publicationMode:'pdf-only',levels,routing:{resolvedNoamPrefix:b.nativePrefix,aiHintShown:true,usesViewer:true,viewerPath:catalog.config.viewer.path,siblingPdfQuery:Object.fromEntries(levels.map(l=>['p'+l.key,l.pdfId]))}};
 }
 return {...base,reviewedRamziActivations:projection,grades:base.grades.map(g=>({...g,topics:g.topics.map(t=>{const bs=byTopic.get(`${g.grade}:${t.id}`);if(!bs)return t;let out=t;for(const b of bs){const result=binding(t,b);out=b.targetKind==='base-topic'?{...out,reviewedBaseBinding:result}:{...out,editions:out.editions.map(e=>e.editionId===b.editionId?result:e)};}return out;})}))};
}
