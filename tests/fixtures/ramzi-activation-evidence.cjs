'use strict';
// Synthetic evidence only. Final manifest flags are changed in memory; no publication.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),pub=path.join(root,'headless/astro-poc/public');
const registry=JSON.parse(fs.readFileSync(path.join(root,'headless/catalog/worksheet-editions.v1.json')));
const scope=['G7-T86','G8-T84','G8-T87','G9-T85'];
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function fixture(){
 const ready={schema:'noam-first567-activation-ready/v1',status:'ready_for_activation',finalManifestsPublished:false,
 contentReviewedHead:'4f155ebb1f1c1bf85f91dba313df1be3d1cc7217',deployedCommit:'1'.repeat(40),releaseReceiptSha256:hash('synthetic release only'),
 itemCount:567,hintCount:1701,hintReviewSha256:'3a2438b4076088398e0fb5b167051eb1d57b7a2c1911fcca427abcc35348bd50',payloadSha256:hash('synthetic payload only'),units:[]};
 const b={ready,receipts:{},manifests:{},nativeExports:{}};
 for(const row of registry.editions.filter(e=>scope.includes(e.nativePrefix)))for(const lv of row.levels){
  const m=JSON.parse(fs.readFileSync(path.join(pub,'noam-ai/manifests',lv.pdfId+'.json')));
  // In-memory synthetic final flags, not publication evidence or output files.
  m.publishable=true;m.reviewRequired=false;m.nativeExportPublished=true;
  const raw=JSON.stringify(m);b.manifests[lv.pdfId]=raw;
  b.nativeExports[row.nativePrefix+'/'+lv.key]=fs.readFileSync(path.join(pub,m.nativeExportUrl));
  ready.units.push({editionId:row.editionId,prefix:row.nativePrefix,level:lv.key,worksheetId:lv.worksheetId,revision:lv.revision,pdfId:lv.pdfId,pdfSha256:lv.pdfSha256,
   sourceNativeExportSha256:lv.nativeExportSha256,nativeExportSha256:m.nativeExportSha256,canonicalSourceSha256:m.canonicalSourceSha256,manifestSha256:hash(raw),itemCount:m.exercises.length,hintCount:m.exercises.length*3});
 }
 const defs={publicationReceiptSha256:['publication','verified_source_assets'],finalManifestReviewReceiptSha256:['manifest-review','reviewed_not_deployed'],verifiedDbReadbackReceiptSha256:['db-readback','verified_exact_readback'],learningWorksheetsReceiptSha256:['learning-readback','verified_exact_readback']};
 for(const[field,[kind,status]]of Object.entries(defs)){
  const receipt={schema:'noam-first567-'+kind+'-evidence/v1',status,contentReviewedHead:ready.contentReviewedHead,deployedCommit:ready.deployedCommit,releaseReceiptSha256:ready.releaseReceiptSha256,sourceReceiptSha256:hash('synthetic '+kind),units:ready.units.map(u=>{const c={...u};if(kind!=='manifest-review')delete c.manifestSha256;return c;})};
  if(kind==='db-readback')Object.assign(receipt,{payloadSha256:ready.payloadSha256,hintReviewSha256:ready.hintReviewSha256,itemCount:567,hintCount:1701});
  if(kind==='learning-readback')receipt.learningIds=ready.units.map(u=>{const row=registry.editions.find(e=>e.editionId===u.editionId);return `g${row.grade}-t${row.topicId}-${u.level}-e-${u.editionId}`;});
  const raw=JSON.stringify(receipt),sha=hash(raw);ready[field]=sha;b.receipts[sha]=raw;
 }
 return b;
}

module.exports={fixture};
