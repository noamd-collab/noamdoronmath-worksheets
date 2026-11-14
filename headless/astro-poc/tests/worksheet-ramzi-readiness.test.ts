import { collectViewerPdfIds } from '../scripts/sync-github-static.mjs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import { buildWorksheetHref } from '../src/lib/worksheetLinks';
import { worksheetEditionNote, worksheetTopicHintLabel } from '../src/lib/catalog/editions';
import { topicWorksheetEditionLinks } from '../src/lib/topicWorksheetEditions';
import { buildTeacherLandingCatalog } from '../src/lib/teacherLandingCatalog';
import { buildTeacherCatalog } from '../scripts/build-teacher-catalog.mjs';
import type { CatalogV1 } from '../src/lib/catalog/types';
const require=createRequire(import.meta.url);
const {build}=require('esbuild');
const Ajv=require('ajv/dist/2020');
const {fixture}=require('../../../tests/fixtures/ramzi-activation-evidence.cjs');
const {mergeWorksheetEditions}=require('../../../scripts/lib/worksheet-editions.cjs');
const {validateRamziActivation}=require('../../../scripts/lib/worksheet-ramzi-activation.cjs');
const registry=JSON.parse(readFileSync(new URL('../../catalog/worksheet-editions.v1.json',import.meta.url),'utf8'));
const base=mergeWorksheetEditions(JSON.parse(readFileSync(new URL('../src/data/catalog.v1.json',import.meta.url),'utf8')),registry) as CatalogV1;
function active(){const b=fixture();validateRamziActivation(registry,b);return mergeWorksheetEditions(base,registry,b.ready) as CatalogV1;}

test('readiness schema and runtime reject malformed records; complete fixture validates',()=>{
 const schema=JSON.parse(readFileSync(new URL('../../catalog/worksheet-ramzi-ready.schema.json',import.meta.url),'utf8'));
 const validate=new Ajv({strict:false}).compile(schema);assert.equal(validate(fixture().ready),true,JSON.stringify(validate.errors));
 for(const change of [(r:any)=>{r.aiReady=true;},(r:any)=>{r.finalManifestsPublished=true;},(r:any)=>{r.units.pop();},(r:any)=>{r.deployedCommit+='\n';},(r:any)=>{r.units[0].manifestSha256+='\n';}]){
  const r=fixture().ready;change(r);assert.equal(validate(r),false);assert.throws(()=>mergeWorksheetEditions(base,registry,r),/Ramzi readiness/);
 }
});
test('all twelve active links name their source edition and show ready hints without a Word claim',()=>{
 const catalog=active();let count=0;
 for(const g of catalog.grades)for(const t of g.topics)for(const e of t.editions||[]){
  if(!e.routing.usesViewer)continue;count+=e.levels.length;
  assert.equal(e.publicationMode,'pdf-only');assert.equal(t.defaultEditionId,'legacy');
  assert.equal(worksheetEditionNote(e),'קובצי PDF להדפסה · רמזים בשלוש דרגות');
  const group=topicWorksheetEditionLinks(catalog,g.grade,t.id,'/worksheets').find(x=>x.editionId===e.editionId)!;
  assert.equal(group.note,worksheetEditionNote(e));
  for(const level of e.levels){const href=buildWorksheetHref({catalog,grade:g.grade,topic:t,levelKey:level.key,editionId:e.editionId});const u=new URL(href,'https://www.noamdoronmath.co.il');
   assert.equal(u.pathname,'/worksheet-viewer-noam.html');assert.equal(u.searchParams.get('edition'),e.editionId);assert.equal(u.searchParams.get('pdf'),level.pdfId);assert.equal(u.searchParams.get('x'),e.routing.resolvedNoamPrefix);
   for(const sibling of e.levels)assert.equal(u.searchParams.get('p'+sibling.key),sibling.pdfId);
  }
 }
 assert.equal(count,12);
});
test('teacher exercise/Word and landing projections are unchanged after Ramzi activation',()=>{
 const catalog=active();assert.deepEqual(buildTeacherCatalog(catalog),buildTeacherCatalog(base));assert.deepEqual(buildTeacherLandingCatalog(catalog),buildTeacherLandingCatalog(base));
});
test('runtime loader preserves validated readiness using a browser-compatible pure overlay',async()=>{
 const catalog=active();const loader=fileURLToPath(new URL('../src/lib/catalog/loadCatalog.ts',import.meta.url));
 const rawPath=fileURLToPath(new URL('../src/data/catalog.v1.json',import.meta.url));
 const result=await build({entryPoints:[loader],bundle:true,platform:'browser',format:'cjs',write:false,logLevel:'silent',plugins:[{name:'verified-test-snapshot',setup(b:any){b.onLoad({filter:/catalog\.v1\.json$/},(a:any)=>a.path===rawPath?{contents:JSON.stringify(catalog),loader:'json'}:undefined);}}]});
 const code=result.outputFiles[0].text;assert.doesNotMatch(code,/require\(["'](?:node:)?(?:fs|crypto)["']\)/);
 const env:any={module:{exports:{}},exports:{},URL};env.exports=env.module.exports;runInNewContext(code,env);
 const loaded=env.module.exports.loadCatalog() as CatalogV1;
 assert.equal(loaded.grades.flatMap(g=>g.topics).flatMap(t=>t.editions||[]).filter(e=>e.routing.usesViewer).length,4);
 assert.deepEqual(JSON.parse(JSON.stringify(loaded.ramziActivation)),JSON.parse(JSON.stringify(catalog.ramziActivation)));
});
test('readiness withdrawal removes active overlay and never changes legacy source rows',()=>{
 const catalog=active();assert.deepEqual(mergeWorksheetEditions(catalog,registry),base);
});

test('static sync includes exactly the twelve ready PDFs and excludes six PDF-only follow-ups',()=>{
 const catalog=active(),before=new Set(collectViewerPdfIds(base)),after=new Set(collectViewerPdfIds(catalog));
 const expected=fixture().ready.units.map((u:any)=>u.pdfId).sort();
 assert.deepEqual([...after].filter(id=>!before.has(id)).sort(),expected);
 assert([...before].every(id=>after.has(id)));
 const followups=registry.editions.filter((e:any)=>['ms-20261113-par-02-r1','ms-20261113-par-03-r1'].includes(e.editionId)).flatMap((e:any)=>e.levels);
 assert.equal(followups.length,6);for(const level of followups)assert(!after.has(level.pdfId));
 const incomplete=structuredClone(catalog),first=incomplete.grades.flatMap(g=>g.topics).flatMap(t=>t.editions||[]).find(e=>e.routing.usesViewer)!;
 if(first.publicationMode!=='pdf-only')throw Error('Expected PDF-only readiness');delete first.levels[0].ramzi;
 const denied=new Set(collectViewerPdfIds(incomplete));for(const level of first.levels)assert(!denied.has(level.pdfId),'partial readiness cannot enter static sync');
});

test('AI badge distinguishes all-ready, partial and legacy-only edition availability',()=>{
 const catalog=active();
 const topic=(grade:number,id:number)=>catalog.grades.find(g=>g.grade===grade)!.topics.find(t=>t.id===id)!;
 assert.equal(worksheetTopicHintLabel(topic(7,17)),'✦ רמזי AI');
 assert.equal(worksheetTopicHintLabel(topic(9,7)),'✦ רמזי AI בחלק מהדפים');
 const legacyOnly=base.grades.find(g=>g.grade===7)!.topics.find(t=>t.id===17)!;
 assert.equal(worksheetTopicHintLabel(legacyOnly),'✦ רמזי AI בדפים קודמים');
});
