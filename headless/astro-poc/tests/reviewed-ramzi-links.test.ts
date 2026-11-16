import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { loadCatalog } from '../src/lib/catalog/loadCatalog';
import { buildWorksheetHref } from '../src/lib/worksheetLinks';
import { topicEditions, worksheetEditionNote, worksheetTopicHintLabel } from '../src/lib/catalog/editions';
import { topicWorksheetEditionLinks } from '../src/lib/topicWorksheetEditions';
import { buildTeacherLandingCatalog } from '../src/lib/teacherLandingCatalog';
import { buildTeacherCatalog } from '../scripts/build-teacher-catalog.mjs';
const require=createRequire(import.meta.url),root=fileURLToPath(new URL('../../../',import.meta.url));
const {fixture}=require('../../../tests/fixtures/reviewed-ramzi-additional.cjs');
const {validateAdditionalEvidence}=require('../../../scripts/lib/reviewed-ramzi-activation-build.cjs');
const {mergeReviewedCatalog}=require('../../../scripts/lib/reviewed-ramzi-activation.mjs');
const registry=JSON.parse(readFileSync(join(root,'headless/catalog/worksheet-editions.v1.json'),'utf8'));
const before=loadCatalog(),bundle=fixture(registry),projection=validateAdditionalEvidence(before,registry,bundle);
const active=mergeReviewedCatalog(before,registry,before.ramziActivation,before.ramziHintCorrection,projection,bundle.trust);

test('RAT base has one three-link group with its real nonlegacy native edition',()=>{
 const topic=active.grades.find((g:any)=>g.grade===9).topics.find((t:any)=>t.id===47);
 assert.equal(topicEditions(topic).length,1);assert(worksheetTopicHintLabel(topic));
 assert.equal(topicWorksheetEditionLinks(active,9,47,'/worksheets').length,1);
 assert.equal(worksheetEditionNote(topicEditions(topic)[0]),'קובצי PDF להדפסה · רמזים בשלוש דרגות');
 for(const level of topic.levels){const url=new URL(buildWorksheetHref({catalog:active,grade:9,topic,levelKey:level.key}),'https://example.test');
  assert.equal(url.searchParams.get('edition'),'ms-20261115-rat-01-r1');assert.equal(url.searchParams.get('x'),'G9-T93');assert.equal(url.searchParams.get('pdf'),level.pdfId);assert.equal(url.searchParams.get('topic'),'47');
 }
});
test('FRQ new links work without changing any legacy link or teacher source',()=>{
 const topic=active.grades.find((g:any)=>g.grade===7).topics.find((t:any)=>t.id===26),original=before.grades.find(g=>g.grade===7)!.topics.find(t=>t.id===26)!;
 for(const level of original.levels)assert.equal(buildWorksheetHref({catalog:active,grade:7,topic,levelKey:level.key}),buildWorksheetHref({catalog:before,grade:7,topic:original,levelKey:level.key}));
 for(const level of ['a','b','c']){const url=new URL(buildWorksheetHref({catalog:active,grade:7,topic,levelKey:level,editionId:'ms-20261115-frq-01-r1'}),'https://example.test');assert.equal(url.searchParams.get('x'),'G7-T88');assert.equal(url.searchParams.get('edition'),'ms-20261115-frq-01-r1');}
 assert.deepEqual(buildTeacherLandingCatalog(active),buildTeacherLandingCatalog(before));
 assert.deepEqual(buildTeacherCatalog(active),buildTeacherCatalog(before));
});
test('disabled snapshot retains all PDF-only and historical link behavior',()=>{
 const restored=mergeReviewedCatalog(active,registry,before.ramziActivation,before.ramziHintCorrection,undefined,bundle.trust);
 assert.deepEqual(restored,before);
 const grade=restored.grades.find(g=>g.grade===9);assert(grade);
 const topic=grade.topics.find(t=>t.id===47);assert(topic);
 assert.equal(worksheetTopicHintLabel(topic),null);assert(!buildWorksheetHref({catalog:restored,grade:9,topic,levelKey:'a'}).includes('edition='));
});

test('GRW uses the generic edition links while legacy and teacher choices stay exact', () => {
 const editionId = 'ms-20261115-grw-01-r1';
 const grwBundle = fixture(registry, [['G7-T61', 7, 6, 'edition', 'grw']]);
 const grwProjection = validateAdditionalEvidence(before, registry, grwBundle);
 const grwCatalog = mergeReviewedCatalog(before, registry, before.ramziActivation, before.ramziHintCorrection, grwProjection, grwBundle.trust);
 const topic = grwCatalog.grades.find((g:any) => g.grade === 7).topics.find((t:any) => t.id === 6);
 const original = before.grades.find(g => g.grade === 7)!.topics.find(t => t.id === 6)!;
 assert.equal(topicEditions(topic).length, topicEditions(original).length);
 for (const edition of topicEditions(original)) {
  for (const level of edition.levels) {
   const input = { grade: 7, levelKey: level.key, editionId: edition.editionId };
   const current = buildWorksheetHref({ ...input, catalog: grwCatalog, topic });
   if (edition.editionId !== editionId) {
    assert.equal(current, buildWorksheetHref({ ...input, catalog: before, topic: original }));
   } else {
    const url = new URL(current, 'https://example.test');
    assert.equal(url.searchParams.get('x'), 'G7-T61');
    assert.equal(url.searchParams.get('edition'), editionId);
    assert.equal(url.searchParams.get('pdf'), level.pdfId);
    assert.equal(url.searchParams.get('topic'), '6');
    assert.equal(url.searchParams.get('lv'), level.key);
   }
  }
 }
 const enabled = topicEditions(topic).find(e => e.editionId === editionId)!;
 assert.equal(worksheetEditionNote(enabled), 'קובצי PDF להדפסה · רמזים בשלוש דרגות');
 assert.deepEqual(buildTeacherLandingCatalog(grwCatalog), buildTeacherLandingCatalog(before));
 assert.deepEqual(buildTeacherCatalog(grwCatalog), buildTeacherCatalog(before));
 assert.deepEqual(mergeReviewedCatalog(grwCatalog, registry, before.ramziActivation, before.ramziHintCorrection, undefined, grwBundle.trust), before);
});
