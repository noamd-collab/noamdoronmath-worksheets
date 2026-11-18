// Actual disabled source assets; all acceptance/DB/service receipts below are
// synthetic in-memory fixtures only. They are never written to a production path.
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),crypto=require('node:crypto');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');const bytes=x=>JSON.stringify(x,null,2)+'\n';
const dir=path.join(__dirname,'reviewed-ramzi-additional');const pins=JSON.parse(fs.readFileSync(path.join(dir,'source-pins.json')));
function source(prefix,level,kind){const name=`${prefix}-${level}.${kind}.json.gz`,compressed=fs.readFileSync(path.join(dir,name)),p=pins.files.find(p=>p.file===name);if(hash(compressed)!==p.gzipSha256)throw Error('Fixture compressed source changed');const raw=zlib.gunzipSync(compressed);if(hash(raw)!==p.uncompressedSha256)throw Error('Fixture source changed');return JSON.parse(raw);}
const defaultPackages = [['G9-T93',9,47,'base-topic','rat'],['G7-T88',7,26,'edition','frq']];
function fixture(registry, packages = defaultPackages){
 const bundle={trust:{version:1,scopes:[]},requests:{schema:'noam-reviewed-additional-requests/v1',batches:[]},scopes:{},receipts:{},assets:{pdfs:{},manifests:{},nativeExports:{},learningScopes:{}}};
 for(const [prefix,grade,topicId,kind,code]of packages){
  const editionId=`ms-20261115-${code}-01-r1`,scopeId=editionId,items=[],units=[];
  for(const level of ['a','b','c']){
   const m=source(prefix,level,'manifest'),n=source(prefix,level,'native');m.publishable=true;m.reviewRequired=false;
   const manifestRaw=bytes(m),nativeRaw=bytes(n);bundle.assets.manifests[m.pdfHash]=manifestRaw;bundle.assets.nativeExports[prefix+'/'+level]=nativeRaw;
   // Native fixture bytes are preserved exactly, including original pretty format.
   bundle.assets.nativeExports[prefix+'/'+level]=zlib.gunzipSync(fs.readFileSync(path.join(dir,`${prefix}-${level}.native.json.gz`)));
   units.push({level,worksheetId:m.exercises[0].canonicalItemId.split('.question.')[0],revision:1,pdfId:m.pdfHash,pdfSha256:m.sourceSha256,sourceNativeExportSha256:m.sourceNativeExportSha256,nativeExportSha256:m.nativeExportSha256,canonicalSourceSha256:m.canonicalSourceSha256,manifestSha256:hash(manifestRaw),itemCount:m.exercises.length,hintCount:m.exercises.length*3});
   for(const e of m.exercises)items.push({editionId,exerciseId:e.id,pdfId:m.pdfHash,pdfSha256:m.sourceSha256,canonicalSourceSha256:m.canonicalSourceSha256,canonicalQuestionSha256:e.canonicalQuestionSha256,canonicalItemId:e.canonicalItemId,sourceExerciseSha256:e.sourceExerciseSha256,hintSha256:[1,2,3].map(i=>hash('synthetic reviewed tier '+e.id+' '+i))});
  }
  const profile={schema:'noam-reviewed-learning-scope/v1',scopeId,status:'reviewed',drawingsAllowed:false,permittedTools:['synthetic bounded topic context'],deferredTools:['synthetic outside scope']};bundle.assets.learningScopes[scopeId]=bytes(profile);
  const batch={targetKind:kind,grade,topicId,editionId,nativePrefix:prefix,label:registry.editions.find(e=>e.editionId===editionId)?.label||'משוואות רציונליות',learningScopeSha256:hash(bytes(profile)),learningScopeUrl:`/noam-ai/learning-scopes/${scopeId}.json`,payloadSha256:hash('synthetic verified payload '+scopeId),units};
  const scope={schema:'noam-reviewed-additional-scope/v1',batch,items,rootAcceptanceSha256:hash('synthetic root acceptance '+scopeId),independentReviewSha256:hash('synthetic independent review '+scopeId),authorId:'synthetic-author',reviewerId:'synthetic-independent-reviewer',hintsBundleSha256:hash('synthetic hint bundle '+scopeId)};
  const scopeRaw=bytes(scope),scopeSha256=hash(scopeRaw);bundle.scopes[scopeId]=scopeRaw;bundle.trust.scopes.push({scopeId,scopeSha256,rootAcceptanceSha256:scope.rootAcceptanceSha256,independentReviewSha256:scope.independentReviewSha256,batch:structuredClone(batch)});
  const asset={schema:'noam-reviewed-additional-assets/v1',status:'reviewed_local_final_assets_with_verified_cdn_pdfs',scopeId,scopeSha256,pdfs:units.map(u=>({pdfId:u.pdfId,pdfSha256:u.pdfSha256})),localManifestHashes:units.map(u=>u.manifestSha256),localNativeHashes:units.map(u=>u.nativeExportSha256),learningScopeSha256:batch.learningScopeSha256};
  const db={schema:'noam-reviewed-additional-db-readback/v1',status:'verified_exact_readback',scopeId,scopeSha256,payloadSha256:batch.payloadSha256,sourceReceiptSha256:hash('synthetic postcommit evidence '+scopeId),observedAt:'2026-11-15T12:10:00.000Z',authorId:scope.authorId,reviewerId:scope.reviewerId,rows:items.map(i=>({...i,status:'verified'}))};
  const learning={schema:'noam-reviewed-additional-learning-readback/v1',status:'verified_exact_readback',scopeId,worksheetIds:units.map(u=>`g${grade}-t${topicId}-${u.level}-e-${editionId}`),sourceReceiptSha256:hash('synthetic learning readback '+scopeId)};
  const enforcement={schema:'noam-reviewed-additional-scope-enforcement/v1',status:'verified_server_scope_and_drawing_policy',scopeId,learningScopeSha256:batch.learningScopeSha256,sourceReceiptSha256:hash('synthetic server policy evidence '+scopeId)};
  const request={scopeId,scopeSha256};for(const[f,r]of Object.entries({assetReceiptSha256:asset,dbReadbackReceiptSha256:db,learningReceiptSha256:learning,scopeEnforcementReceiptSha256:enforcement})){const raw=bytes(r);request[f]=hash(raw);bundle.receipts[request[f]]=raw;}bundle.requests.batches.push(request);bundle.trust.scopes.at(-1).activation={readbackReceiptSha256:request.dbReadbackReceiptSha256,evidenceSha256:hash(JSON.stringify(request))};
 }
 return bundle;
}
module.exports={fixture,hash,bytes};
