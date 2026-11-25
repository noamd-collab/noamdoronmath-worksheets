import { renewalIds } from './fixtures/middle-090-091-094';
import { reviewedNext12Ids } from './fixtures/next12-pdf';
import { reviewedNext21Ids } from './fixtures/next21-pdf';
import { reviewedBatch01Ids } from './fixtures/batch01-pdf';
import { reviewedBatch02aIds } from './fixtures/batch02a-pdf';
import { reviewedBatch03Ids } from './fixtures/batch03-pdf';
import { probabilityNineIds, reviewedProbabilityNine } from './fixtures/probability-nine-pdf';
import { reviewedBatch04Ids } from './fixtures/batch04-pdf';
import { reviewedBatch05, reviewedBatch05Ids } from './fixtures/batch05-pdf';
import { reviewedBatch06Ids } from './fixtures/batch06-pdf';
import { reviewedSaoWpcIds } from './fixtures/sao-wpc-pdf';
import { reviewedExtSmlAfrIds } from './fixtures/ext-sml-afr-pdf';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import type { CatalogV1 } from '../src/lib/catalog/types';
import { mergeWorksheetEditions } from '../../../scripts/lib/worksheet-editions.cjs';
import { resolveEdition } from '../src/lib/catalog/editions';
import { buildWorksheetHref } from '../src/lib/worksheetLinks';
import { topicWorksheetEditionLinks } from '../src/lib/topicWorksheetEditions';
import { buildTeacherCatalog } from '../scripts/build-teacher-catalog.mjs';
import { buildTeacherLandingCatalog, getTeacherLandingScope } from '../src/lib/teacherLandingCatalog';
import { readFirst567Activation } from './helpers/first567Activation';
import { reviewedEqnSgnFacIds } from './fixtures/eqn-sgn-fac-pdf';
import { reviewedBatch07Ids } from './fixtures/batch07-pdf';
import { reviewedBatch08Ids } from './fixtures/batch08-pdf';
import { reviewedBatch09Ids } from './fixtures/batch09-pdf';
import { reviewedBatch10Ids } from './fixtures/batch10-pdf';
import { reviewedBatch11Ids } from './fixtures/batch11-pdf';
import { beforeReviewedRamziActivation } from './helpers/beforeReviewedRamziActivation';
import { reviewedBatch12Ids } from './fixtures/batch12-pdf';
import { reviewedBatch13Ids } from './fixtures/batch13-pdf';

const read = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const registry = read('../../catalog/worksheet-editions.v1.json');
const catalog = beforeReviewedRamziActivation(read('../src/data/catalog.v1.json')) as CatalogV1;
const evidence = read('../../../docs/middle-school-followup-pdf-20261113.json');
const ids = ['ms-20261113-par-02-r1', 'ms-20261113-par-03-r1'];
const additions = registry.editions.filter((row: any) => ids.includes(row.editionId));
const activation = readFirst567Activation();
assert.deepEqual(catalog.ramziActivation, activation.ready);
const previous = mergeWorksheetEditions(catalog, { version: 1,
  editions: registry.editions.filter((row: any) => !ids.includes(row.editionId)) }, activation.ready, activation.hintCorrection);
const topic = (value: CatalogV1) => value.grades.find(g => g.grade === 9)!.topics.find(t => t.id === 7)!;

test('six follow-up PDF files retain frozen provenance and are separate from PR456', () => {
  assert.equal(additions.length, 2);
  assert.deepEqual(additions.map((row: any) => row.nativePrefix), ['G9-T88', 'G9-T89']);
  assert.deepEqual(additions.map((row: any) => row.label), [
    'מקבילית — הוכחות וסימטריה · PDF', 'מקבילית — משפטים הפוכים וזיהוי · PDF']);
  assert.deepEqual(evidence.editions, additions);
  assert.equal(evidence.verified_count, 6);
  assert.equal(evidence.verified_download_count, 18);
  assert.equal(evidence.included_in_pr456, false);
  assert.equal(evidence.live_published, false);
  assert.equal(evidence.AI_activated, false);
  assert.equal(evidence.Word_available, false);
  for (const row of additions) {
    assert.equal(row.grade, 9); assert.equal(row.topicId, 7);
    assert.equal(row.isDefault, false); assert.equal(row.publicationMode, 'pdf-only');
    const proof = evidence.evidence.find((e: any) => e.editionId === row.editionId);
    for (const level of row.levels) {
      const verified = proof.levels.find((e: any) => e.level === level.key);
      for (const key of ['pdfId', 'pdfSha256', 'sourceSha256', 'nativeExportSha256']) assert.equal(level[key], verified[key]);
      assert.equal(verified.verified_urls.length, 3);
      assert.equal(verified.pages, row.nativePrefix === 'G9-T88' ? 14 : 9);
      assert.ok(verified.verified_urls.includes(`${catalog.config.pdfBase}${level.pdfId}.pdf`));
      for (const field of ['canonicalSourceSha256', 'manifestSha256', 'answerMapSha256', 'wordSourceSha256', 'hintsBundleSha256']) {
        assert.equal(Object.hasOwn(level, field), false, `${row.editionId}/${level.key}: no future artifact placeholder`);
      }
    }
  }
});

test('parallelogram landing exposes all focused sets without changing legacy defaults or links', () => {
  const page = read('../src/data/topic-pages/parallelogram-grade-9.json');
  assert.equal(page.grade, 9); assert.equal(page.catalogCta.catalogTopicId, 7);
  const currentTopic = topic(catalog);
  assert.equal(resolveEdition(currentTopic).editionId, 'legacy');
  const { editions, defaultEditionId, ...legacy } = currentTopic;
  const { editions: oldEditions, defaultEditionId: oldDefault, ...oldLegacy } = topic(previous);
  assert.deepEqual(legacy, oldLegacy);
  assert.deepEqual(editions!.filter(e => !ids.includes(e.editionId)), oldEditions);
  assert.equal(defaultEditionId, oldDefault);
  for (const grade of catalog.grades) for (const t of grade.topics) {
    if (grade.grade !== 9 || t.id !== 7) assert.deepEqual(t,
      previous.grades.find(g => g.grade === grade.grade)!.topics.find(before => before.id === t.id));
  }
  const groups = topicWorksheetEditionLinks(catalog, 9, 7, '/worksheets?grade=9&topic=7');
  const laterTopicIds = reviewedBatch05.additions.filter(a => a.grade === 9 && a.topicId === 7).map(a => a.editionId);
  assert.deepEqual(groups.map(g => g.editionId), ['ms-20261113-par-r1', ...ids, 'ms-20261113-par-04-r1', ...laterTopicIds]);
  assert.equal(groups.some(group => group.editionId === 'legacy'), false);
  for (const row of additions) {
    const selected = resolveEdition(currentTopic, row.editionId);
    assert.equal(selected.routing.usesViewer, false);
    assert.equal(selected.routing.aiHintShown, false);
    assert.equal(selected.routing.resolvedNoamPrefix, row.nativePrefix);
    const group = groups.find(g => g.editionId === row.editionId)!;
    assert.equal(group.pdfOnly, true); assert.equal(group.levels.length, 3);
    for (const level of row.levels) {
      const url = `${catalog.config.pdfBase}${level.pdfId}.pdf`;
      assert.equal(group.levels.find(l => l.key === level.key)!.href, url);
      assert.equal(buildWorksheetHref({ catalog, grade: 9, topic: currentTopic,
        editionId: row.editionId, levelKey: level.key }), url);
      assert.ok(!url.includes('worksheet-viewer') && !url.includes('.docx'));
    }
  }
});

test('the six new PDF-only levels never enter teacher selection or change prior teacher scopes', () => {
  const before = JSON.stringify(catalog);
  assert.deepEqual(buildTeacherCatalog(catalog), buildTeacherCatalog(previous));
  const landing = buildTeacherLandingCatalog(catalog);
  assert.deepEqual(landing, buildTeacherLandingCatalog(previous));
  for (const edition of ids) assert.equal(getTeacherLandingScope({ grade: 9, topic: 7, edition }, landing), null);
  assert.equal(JSON.stringify(catalog), before);
});

test('manifest sync omits unactivated PDFs while retaining legacy and verified edition dependencies', async () => {
  const { collectViewerPdfIds } = await import('../scripts/sync-github-static.mjs');
  const fixture = { grades: [{ topics: [{
    routing: { usesViewer: true, siblingPdfQuery: { pa: 'legacy-a', pb: 'legacy-b' } },
    levels: [{ pdfId: 'legacy-a', aiReady: false }],
    editions: [
      { status: 'published', publicationMode: 'pdf-only', levels: [{ pdfId: 'pdf-only', aiReady: true }] },
      { status: 'published', levels: [{ pdfId: 'old-unmarked' }, { pdfId: 'explicit-ready', aiReady: true }, { pdfId: 'disabled', aiReady: false }] },
      { status: 'draft', levels: [{ pdfId: 'not-published' }] },
    ],
  }] }] };
  assert.deepEqual(collectViewerPdfIds(fixture), ['explicit-ready', 'legacy-a', 'legacy-b', 'old-unmarked']);
  assert.deepEqual(collectViewerPdfIds(catalog), collectViewerPdfIds(previous));
  const selected = new Set(collectViewerPdfIds(catalog));
  const allPdfOnly = registry.editions.filter((e: any) => e.publicationMode === 'pdf-only');
  // Preserve the original eighteen-level boundary and separately fence the
  // later algebra and frequency PDFs, which must not gain viewer/hint activation.
  const algebraId = 'ms-20261115-alg-01-r1';
  const frequencyId = 'ms-20261115-frq-01-r1';
  assert.equal(allPdfOnly.filter((e: any) => ![algebraId, frequencyId, 'ms-20261115-prb-01-r1', 'ms-20261115-rec-01-r1', 'ms-20261113-par-04-r1', ...reviewedEqnSgnFacIds, ...reviewedExtSmlAfrIds, ...reviewedSaoWpcIds, ...reviewedNext12Ids, ...reviewedNext21Ids, ...reviewedBatch01Ids, ...reviewedBatch02aIds, ...reviewedBatch03Ids, ...probabilityNineIds, ...reviewedBatch04Ids, ...reviewedBatch05Ids, ...reviewedBatch06Ids, ...reviewedBatch07Ids, ...reviewedBatch08Ids, ...reviewedBatch09Ids, ...reviewedBatch10Ids, ...reviewedBatch11Ids, ...reviewedBatch12Ids, ...reviewedBatch13Ids, ...renewalIds].includes(e.editionId)).flatMap((e: any) => e.levels).length, 18);
  // The three grade-9 probability series (G9-PRC-01, G9-PRT-01, G9-PRW-01) are exactly the reviewed rows: nine PDF-only levels.
  const probabilityNine = allPdfOnly.filter((e: any) => probabilityNineIds.includes(e.editionId));
  assert.deepEqual(probabilityNine, reviewedProbabilityNine.additions.map(a => a.edition));
  assert.equal(probabilityNine.flatMap((e: any) => e.levels).length, 9);
  for (const pdfId of probabilityNine.flatMap((e: any) => e.levels.map((l: any) => l.pdfId))) assert.equal(selected.has(pdfId), false, 'probability PDF stays out of viewer sync');
  const algebra = allPdfOnly.filter((e: any) => e.editionId === algebraId);
  assert.equal(algebra.length, 1);
  assert.equal(algebra[0].grade, 7); assert.equal(algebra[0].topicId, 22);
  assert.equal(algebra[0].nativePrefix, 'G7-T87');
  const algebraPdfIds = ['b376976911234b758027329c9ea05cbf',
    'b6a76fb3eccd477b9788958efefbded2', '0fe476657595498194b93cdc46e39e5f'];
  assert.deepEqual(algebra[0].levels.map((level: any) => level.pdfId), algebraPdfIds);
  for (const pdfId of algebraPdfIds) {
    assert.equal(activation.units.has(pdfId), false, 'new algebra PDF has no activation');
    assert.equal(selected.has(pdfId), false, 'new algebra PDF stays out of viewer sync');
  }
  const frequency = allPdfOnly.filter((e: any) => e.editionId === frequencyId);
  assert.equal(frequency.length, 1);
  assert.equal(frequency[0].grade, 7); assert.equal(frequency[0].topicId, 26);
  assert.equal(frequency[0].nativePrefix, 'G7-T88');
  const frequencyPdfIds = ['941793a9b6614849bd5b7465c894ba87',
    '6cdddaac6d8c472580f2be5b4bdd0323', '659db2eb8dab43aaae976e9a669d503b'];
  assert.deepEqual(frequency[0].levels.map((level: any) => level.pdfId), frequencyPdfIds);
  for (const pdfId of frequencyPdfIds) {
    assert.equal(activation.units.has(pdfId), false, 'new frequency PDF has no activation');
    assert.equal(selected.has(pdfId), false, 'new frequency PDF stays out of viewer sync');
  }
  for (const e of allPdfOnly) for (const level of e.levels) {
    assert.equal(selected.has(level.pdfId), activation.units.has(level.pdfId), `${e.editionId}/${level.key}`);
  }
  for (const e of additions) for (const level of e.levels) assert.equal(selected.has(level.pdfId), false);
});
