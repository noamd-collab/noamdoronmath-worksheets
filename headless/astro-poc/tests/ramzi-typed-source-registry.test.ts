import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {it} from 'node:test';
const root=new URL('../../../',import.meta.url),app=new URL('../',import.meta.url);
const json=(base:URL,path:string)=>JSON.parse(readFileSync(new URL(path,base),'utf8'));
const rows=['pilot','next-ten','second-ten','third-ten','fourth-ten','remaining-101'].flatMap(n=>json(app,`src/data/worksheet-${n}.v1.json`).sheets);
it('every canonical native manifest has exact root/public source bytes and a complete typed reference for every selected part',()=>{
 let sections=0;
 for(const row of rows){
  const relative=`noam-ai/manifests/${row.pdfId}.json`;
  const manifest=json(app,'public/'+relative),legacy=json(root,relative);
  assert.deepEqual(manifest,legacy,row.key+' manifest twins');
  assert.equal(manifest.nativeExportUrl,row.nativeExport,row.key+' native path');
  const bytes=readFileSync(new URL('public'+row.nativeExport,app)),rootBytes=readFileSync(new URL(row.nativeExport.slice(1),root));
  assert.deepEqual(bytes,rootBytes,row.key+' native source twins');
  assert.equal(manifest.nativeExportSha256,createHash('sha256').update(bytes).digest('hex'),row.key+' exact source digest');
  // Independent wire-contract checks: no absent digest, unrecognized path,
  // question/item syntax or section label can silently keep a canonical page
  // outside the worker v2 reference protocol. The deployed parser is also run
  // over this whole registry by the offline release audit.
  assert.match(manifest.nativeExportUrl,/^\/noam-ai\/native\/(?:G[789]-T[0-9]+|G7-ASSESS1|G8-(?:ASSESS1|CIRCLE|INTERP|TWOSRC)|G9-(?:3060|KITE|SIDEANG|TRAP))\/[abc]\/noam-ai\.json$/);
  const native=JSON.parse(bytes.toString('utf8'));
  for(const ex of manifest.exercises){
   sections++;
   assert.match(ex.nativeQuestionId,/^q\d+$/);assert.match(ex.nativeItemId,/^q\d+[a-z0-9]*$/);assert.match(ex.part,/^[א-ת]$/);
   const question=native.questions.find((q:any)=>q.id===ex.nativeQuestionId),part=question?.items.find((p:any)=>p.id===ex.nativeItemId&&p.label===ex.part);
   assert.ok(part,ex.id+' exact selected source identity');
   const reference={path:manifest.nativeExportUrl,sha256:manifest.nativeExportSha256,questionId:ex.nativeQuestionId,itemId:ex.nativeItemId,part:ex.part};
   assert.ok(JSON.stringify(reference).length<=1500,ex.id+' bounded reference');
  }
 }
 assert.equal(rows.length,412);assert.equal(sections,30972);
});
it('the viewer refreshes manifests when typed source digests are introduced without resetting conversations',()=>{
 for(const base of [root,new URL('public/',app)]){
  const viewer=readFileSync(new URL('worksheet-viewer-noam.html',base),'utf8');
  assert.match(viewer,/MANIFEST_PATH = [^\n]+\.json\?v=20261028-panel-source/);
  assert.match(viewer,/THREAD_STORAGE_KEY = "noam-static-threads-v1:"/);
 }
});
