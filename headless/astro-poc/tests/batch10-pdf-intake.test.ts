import { expectedElementaryPrintTopics } from './fixtures/elementary-print-topics';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { loadCatalog } from '../src/lib/catalog/loadCatalog';
import { buildWorksheetHref } from '../src/lib/worksheetLinks';
import { topicWorksheetEditionLinks } from '../src/lib/topicWorksheetEditions';
import { buildTeacherCatalog } from '../scripts/build-teacher-catalog.mjs';
import { buildTeacherLandingCatalog, getTeacherLandingScope } from '../src/lib/teacherLandingCatalog';
import { collectViewerPdfIds } from '../scripts/sync-github-static.mjs';
import { loadTopicPage, extractJsonLdFaq, synthesizeBodyFlow } from '../src/lib/topicPages';
import { beforeBatch10Catalog, beforeBatch10Copy, beforeBatch10Registry,
  reviewedBatch10 as reviewed, reviewedBatch10Ids as ids } from './fixtures/batch10-pdf';
import { beforeBatch11Copy, beforeBatch11Registry } from './fixtures/batch11-pdf';
import { reviewedBatch12 } from './fixtures/batch12-pdf';
import { createRequire } from 'node:module';
import { beforeReviewedRamziActivation } from './helpers/beforeReviewedRamziActivation';
import { catalogBeforeCorrections } from './fixtures/middle-090-091-094';

const require = createRequire(import.meta.url);
const { loadIndexCatalog } = require('../../../scripts/lib/headless-catalog.cjs');
const { buildLearningCatalog } = require('../../../scripts/build-learning-catalog.cjs');
const { loadRamziActivationEvidence } = require('../../../scripts/lib/worksheet-ramzi-activation.cjs');

const root = new URL('../../../', import.meta.url);
const read = (path: string) => JSON.parse(readFileSync(new URL(path, root), 'utf8'));
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value, null, 2) + '\n').digest('hex');
const raw = beforeReviewedRamziActivation(read('headless/astro-poc/src/data/catalog.v1.json'));
const catalog = beforeReviewedRamziActivation(loadCatalog());
const corrected = catalogBeforeCorrections(catalog);
const previous = beforeBatch10Catalog(raw) as ReturnType<typeof loadCatalog>;
const previousSsr: any = structuredClone(catalog);
for (const addition of reviewed.additions) {
  const topic = previousSsr.grades.find((g: any) => g.grade === addition.grade)
    .topics.find((t: any) => t.id === addition.topicId);
  topic.editions = topic.editions?.filter((e: any) => !ids.includes(e.editionId));
  if (!topic.editions?.length) {
    delete topic.editions;
    delete topic.defaultEditionId;
  }
}
// Batch 12 (19.11) adds a later edition on 7/12 (G7-ANG-02, after G7-ANG-03).
for (const addition of reviewedBatch12.additions) {
  const topic = previousSsr.grades.find((g: any) => g.grade === addition.grade)
    .topics.find((t: any) => t.id === addition.topicId);
  topic.editions = topic.editions?.filter((e: any) => e.editionId !== addition.editionId);
  if (!topic.editions?.length) {
    delete topic.editions;
    delete topic.defaultEditionId;
  }
}
const registry = read('headless/catalog/worksheet-editions.v1.json');
// Batch 11 (18.11) is newer: its rows come after batch 10's.
const batch10Registry = beforeBatch11Registry(registry);
const priorRegistry = beforeBatch10Registry(registry);
const receipt = read('docs/batch10-pdf-first-20261118.json');
const expectedIds = ['ms-20261118-dat-03-r1', 'ms-20261118-crc-01-r1', 'ms-20261118-cng-01-r1', 'ms-20261118-dir-01-r1', 'ms-20261118-ang-03-r1', 'ms-20261118-qsh-01-r1'];
const mappings: Array<[number, number, string]> = [
  [8, 18, 'pie-charts-grade-8'],
  [8, 63, 'circle-area-circumference-grade-8'],
  [8, 36, 'triangle-congruence-grade-8'],
  [7, 1, 'number-line-absolute-value-grade-7'],
  [7, 12, 'adjacent-vertical-angles-grade-7'],
  [9, 5, 'quadratic-function-grade-9'],
];
const baselineCatalogSha256 = '0b561bfc62736f74457dbe0ac3471215d0ad5ca9f07ae7ea11376395ce3a44a2';
const baselineRegistrySha256 = '13d2e0547b0b8cbe5e1efc5c890badfd241f882fd2cbca07dc5d9a6d2b15b3fe';
const PINS: Record<string, Array<[string, string]>> = {
  'ms-20261118-dat-03-r1': [
    ['b9b1db69377a4d88a09b5e007e437313', 'b635f115b0189e87daac2c0a65de609502761484631c2e7ed0c404fdec008edf'],
    ['b13b23c998974e40b7d96b3234f71483', '87a44db33f9ad824b5133605479857cb4306b0c1e310e93a7e7e8f7bd86e07aa'],
    ['ef663c26e72041ee97d905cc8d57d83d', '684a8aaad470489019bd01eb2bc30aee724804b922cfc6a0a8e0c002d317e4fd']],
  'ms-20261118-crc-01-r1': [
    ['8f870a62f51046d586e986d13cc9eca4', 'ab1622d884c51b50a1c84629d42e7eead38e189f12bbd1f5cfe5dcaad6d9473d'],
    ['99fbab053f68433ab53fc1337b376902', '57e27aa344bfbc54fd0a4dc0a74b251bf4d369727af4cd1e8fe90a4d615e2371'],
    ['72b43b4531bd4f6caf72cc4901772981', 'bca7536adc6e6ee7628ebce90ca4866b87388136ffd80701f74436af826f45e4']],
  'ms-20261118-cng-01-r1': [
    ['b64687ca7ad14929b483ddd01dd067a9', 'bcf7fa074916816dffd4fed23255f62422d219f9d7d045ba08efa85d88a6910e'],
    ['76f5f8e1378b46ce94a456abb93e361f', '3d0e932695a8c06a3139494ec8b3ce0ce8ac9830bd5ec61f9db2101f1ee7618f'],
    ['3c2f6aee91c64ee0a2d645100481948a', 'b2ea610b6c719bec4bebdf1c293f43828017ede162f4c3bf95403ab2ea982f69']],
  'ms-20261118-dir-01-r1': [
    ['9bbe74b00dd84b70957934d25886c099', '680b84e0f33d05b17e92df02c048733cf3a6feee07fadb05f7ef26652a4f09f9'],
    ['aef807ca2bdf40b89a2b79ab40d37a60', 'dba54ff14f7468fa2aad5b31b39d09411a67bde484163a8e976566ad9e662bdf'],
    ['79552e1ba9aa4920af9e00a2b9c5c1f8', '990f0628e92f3fc787149cf2387652a1329e2af48ddd8038e1f73d968605374b']],
  'ms-20261118-ang-03-r1': [
    ['c3967f7b32b146b8baf018c231f875ba', '273347ca2c0e1828cb39ab0b37fc99bf893dbd9f016656f95a9d4d366ac5180b'],
    ['e12f3c2810064d26a1bb3c6eb141e90c', 'c31b83a5bc4fbabe64185c28e102cf60d1a77c464d69a18a8c6b3ec63dbcffe2'],
    ['38e0d3aaac1c465da4da7f882bb6b6c4', '7fd6335345d5f095dd637c8f64d9b35088d7ae20669547ef234fd99b09373dba']],
  'ms-20261118-qsh-01-r1': [
    ['55df00341e49450a92b59df82afb7f92', 'a7bb5376c080a8e552b7173c8ec91d25c152bb5d47ef71e9ff5942992b7e666a'],
    ['8ef4c5a8c6504029986cd3f09e0dd359', 'ca8aa7aac44ebbdd55f78e9ad4112e4b044bd367a16bcddfe9dbf0825935e7dc'],
    ['a8d7f83cbbe0409c91c9f049183d07b4', '735a863c806f9365c5594541c488dcd5f30b8c95e8b50e4adb9cd26653088785']],
};
const RECEIPT_SHA256S: Record<string, string[]> = {
  'G8-DAT-03': ['667c157cd7c7aefb9e898ae50047126722659c1e0d695f051e1ec9b0ae61e107', 'fa9aacfee3660699c399ce95726e81779963721d3b870bba3e9ef196f25cf6e9'],
  'G8-CRC-01': ['f3ba575501650691579f3c00e8ac194131bb7749c2169ee27fad2e3bdd989d96', '48eb2a7c8a95c38d06a02452fd3f894a8cd86378922ef180c7d9e005728f2eca', '4be41ebe8b7f672431b76bb4dcdbd22580797144e0b80eca5b44307e091d2575'],
  'G8-CNG-01': ['25a4ffaf986ce85335bfb27548a8a4ee9680676d17718ea1dcd176eb1a892dae', '07723eccc86c4cde66f611df196af76db45bc25dde308084a3df282bd56dde45'],
  'G7-DIR-01': ['4a202773582a9199be9ba978a15505a8c273230a0d1c241c5f55869823d3bd0e', '31dbe2b86f39472f163c01e899eb5548081acc92e5616e3027fbab2c81c77e10'],
  'G7-ANG-03': ['313d939ca62f11fe63163e52af52720a669c9a1871c3a1438499999940d3e37d', 'b122adc394f27252ce75f6711b981f199a205d5ddce3b1c1a51dad27ae8413b7'],
  'G9-QSH-01': ['29dcdbd46807b3f0126d99ad55e6a0eba75786536c83f2b062ebe14e3ba4a158', '441e2a40f5750a3d874f51e285d2ddb9a0ed8664a9d23444220ac47ff083c19a'],
};

test('six additive editions recover the pinned baseline after the landing corrections without changing existing defaults', () => {
  assert.equal(reviewed.baselineCommit, 'fa78cc7340ff9c48c51d0cda0c5cc4dab4e257d0');
  assert.equal(reviewed.baselineCatalogSha256, baselineCatalogSha256);
  assert.equal(reviewed.baselineRegistrySha256, baselineRegistrySha256);
  assert.equal(digest(previous), baselineCatalogSha256);
  assert.equal(digest(priorRegistry), baselineRegistrySha256);
  assert.deepEqual(ids, expectedIds);
  assert.deepEqual(reviewed.additions.map(a => [a.grade, a.topicId, a.slug]), mappings);
  assert.deepEqual(Object.keys(PINS), ids);
  assert.equal(new Set(reviewed.additions.flatMap(a => a.pdfIds)).size, 18);
  assert.equal(new Set(reviewed.additions.flatMap(a => a.edition.levels.map(l => l.pdfSha256))).size, 18);
  const expectedSsr = structuredClone(raw);
  expectedSsr.config.pdfBase = 'https://static.wixstatic.com/ugd/d8e7ad_';
  expectedSsr.elementaryPrintTopics = expectedElementaryPrintTopics;
  assert.deepEqual(catalog, expectedSsr);
  assert.equal(receipt.status, 'REVIEWED_MEDIA_SITE_CANDIDATE_NOT_PUBLISHED');
  assert.equal(receipt.sitePublicationClaimed, false);
  assert.deepEqual(receipt.scope, { packages: 6, pdfs: 18, pages: 183, landingRoutes: 6 });
  assert.equal(batch10Registry.editions.length, priorRegistry.editions.length + 6);
  assert.deepEqual(batch10Registry.editions.slice(0, -6), priorRegistry.editions);
  assert.deepEqual(batch10Registry.editions.slice(-6), reviewed.additions.map(a => a.edition));
  assert.equal(raw.grades.flatMap((g: any) => g.topics.flatMap((t: any) => t.levels)).length, 991); // batch 10 adds base topic 9/53 (+3 levels)
  assert.equal(previous.grades.flatMap((g: any) => g.topics.flatMap((t: any) => t.levels)).length, 988);

  for (const [index, addition] of reviewed.additions.entries()) {
    const topic = catalog.grades.find(g => g.grade === addition.grade)!.topics.find(t => t.id === addition.topicId)!;
    const oldTopic = previous.grades.find(g => g.grade === addition.grade)!.topics.find(t => t.id === addition.topicId)!;
    const edition = topic.editions!.find(e => e.editionId === addition.editionId)!;
    assert.equal(topic.defaultEditionId ?? 'legacy', oldTopic.defaultEditionId ?? 'legacy',
      `${addition.editionId}: prior default remains`);
    assert.deepEqual(topic.levels, oldTopic.levels, `${addition.editionId}: original levels remain`);
    assert.equal(edition.publicationMode, 'pdf-only');
    assert.equal(edition.status, 'published');
    assert.equal(edition.routing.resolvedNoamPrefix, addition.nativePrefix);
    assert.equal(addition.edition.isDefault, false);
    assert.deepEqual(addition.edition.levels.map(l => [l.pdfId, l.pdfSha256]), PINS[addition.editionId]);
    assert.deepEqual(edition.levels.map(l => [l.key, l.viewerLevel]), [['a', 'A'], ['b', 'B'], ['c', 'E']]);
    assert.deepEqual(edition.levels.map(l => l.worksheetId),
      ['a', 'b', 'c'].map(key => `ms-${addition.sheetId.toLowerCase()}-${key}-r1`));
    assert.equal(new Set(edition.levels.map(l => l.pdfId)).size, 3);
    assert.ok(edition.levels.every(l => !Object.hasOwn(l, 'ramzi')));
    const proof = receipt.packages[index];
    assert.equal(proof.sheetId, addition.sheetId);
    assert.equal(proof.editionId, addition.editionId);
    assert.equal(proof.isDefault, false);
    assert.equal(proof.reviewVerdict, 'PASS_STUDENT_PDF_ESSENTIALS');
    assert.ok(proof.author);
    
    assert.ok(proof.reviewReceipts.every((r: any) => /^reports\/(KIMI|ANTIGRAVITY)-INDEPENDENT-[A-Za-z0-9-]+-2026111[678]\/(review|numbers-blind)\.json$/.test(r.path) && /^[0-9a-f]{64}$/.test(r.sha256)));
    assert.match(proof.reviewReceipts[0].role, /^independent (full |numbers )?review/);
    assert.match(proof.reviewReceipts.at(-1).role, /verdict (PASS_STUDENT_PDF_ESSENTIALS|PASS_DELTA)\)$/);
    assert.deepEqual(proof.reviewReceipts.map((r: any) => r.sha256), RECEIPT_SHA256S[proof.sheetId]);
    assert.deepEqual(proof.levels.map((l: any) => [l.key, l.pdfId, l.pdfSha256]),
      addition.edition.levels.map(l => [l.key, l.pdfId, l.pdfSha256]));
    for (const level of edition.levels) {
      const downloads = proof.levels.find((p: any) => p.key === level.key).downloadChecks;
      assert.equal(downloads.length, 2);
      assert.ok(downloads.every((d: any) => d.status === 200 && d.matchesFrozenPdf && d.sha256 === level.pdfSha256));
      assert.equal(buildWorksheetHref({ catalog, grade: addition.grade, topic, editionId: addition.editionId, levelKey: level.key }),
        `${catalog.config.pdfBase}${level.pdfId}.pdf`);
    }
    const back = `/worksheets?grade=${addition.grade}&topic=${addition.topicId}`;
    const groups = topicWorksheetEditionLinks(catalog, addition.grade, addition.topicId, back);
    const oldIds = addition.baselineEditionIds;
    const selectedId = oldTopic.defaultEditionId ?? 'legacy';
    const topicAdditions = reviewed.additions.filter(a => a.grade === addition.grade && a.topicId === addition.topicId);
    assert.deepEqual(groups.map(g => g.editionId),
      [selectedId, ...oldIds.filter(id => id !== selectedId), ...topicAdditions.map(a => a.editionId),
        ...reviewedBatch12.additions.filter(a => a.grade === addition.grade && a.topicId === addition.topicId).map(a => a.editionId)]);
    const oldGroupCount = oldIds.length + 1;
    assert.deepEqual(groups.slice(0, oldGroupCount), topicWorksheetEditionLinks(previousSsr, addition.grade, addition.topicId, back));
    assert.deepEqual(groups.find(g => g.editionId === addition.editionId)!.levels.map(l => l.key), ['a', 'b', 'c']);
  }
});

test('six landing routes add only reviewed PDF copy and preserve their complete earlier data', () => {
  assert.equal(reviewed.landingDeltas.length, 6);
  const slugs = [...new Set(reviewed.additions.map(a => a.slug))].sort();
  assert.deepEqual(reviewed.landingDeltas.map(d => d.slug).sort(), slugs);
  for (const delta of reviewed.landingDeltas) {
    assert.ok(delta.slug);
    const slug = delta.slug;
    const page = read(`headless/astro-poc/src/data/topic-pages/${slug}.json`);
    const restored = beforeBatch10Copy(slug, page);
    assert.equal(digest(restored), delta.baselineSha256, `${delta.slug}: exact previous page`);
    assert.equal(page.h1, restored.h1);
    assert.equal(page.title, restored.title);
    assert.deepEqual(page.catalogCta, restored.catalogCta);
    assert.deepEqual(page.catalogCtas, restored.catalogCtas);
    // Batch 12 appends a second PDF section to adjacent-vertical-angles-grade-7 after this one.
    assert.deepEqual((beforeBatch11Copy(slug, page) as any).sections.at(-1), delta.appendedSection);
    const loaded = loadTopicPage(slug)!;
    const sections = loaded.sections.filter(section => section.heading === delta.appendedSection.heading);
    assert.equal(sections.length, 1);
    assert.ok(sections[0].blocks.some(block => /רמה א׳/.test(block.text ?? '')));
    assert.ok(sections[0].blocks.some(block => /רמה ב׳/.test(block.text ?? '')));
    assert.ok(sections[0].blocks.some(block => /מצוינות/.test(block.text ?? '')));
    const hintScope = 'בדפים הקודמים שנפתחים עם רמזי אפשר לקבל רמזים';
    assert.ok(sections[0].blocks.every(block => !/רמה ג׳|פתרונות מפורטים|רמז/.test((block.text ?? '').replace(hintScope, ''))));
    assert.ok(!/בדקו|בדיקה/.test(delta.appendedSection.heading) && !/\?$/.test(delta.appendedSection.heading)
      && !/^(חשבו|פתרו|מהו|באיזה|מצאו)/.test(delta.appendedSection.heading), `${slug}: heading stays visible`);
    const flow = synthesizeBodyFlow(loaded);
    assert.equal(flow.filter(block => block.type === 'heading' && block.text?.replace(/[⁦-⁩]/g, '') === delta.appendedSection.heading).length, 1);
    for (const block of delta.appendedSection.blocks) {
      assert.equal(flow.filter(item => item.type === 'paragraph' && item.text?.replace(/[⁦-⁩]/g, '') === block.text).length, 1);
    }
    const faq = extractJsonLdFaq(loaded.jsonLd).map(item => ({
      question: item.question.replace(/[⁦-⁩]/g, ''), answer: item.answer.replace(/[⁦-⁩]/g, ''),
    }));
    const baselineFaq = extractJsonLdFaq((beforeBatch10Copy(slug, loaded) as any).jsonLd).map(item => ({
      question: item.question.replace(/[⁦-⁩]/g, ''), answer: item.answer.replace(/[⁦-⁩]/g, ''),
    }));
    assert.deepEqual(faq, baselineFaq, `${slug}: FAQ schema unchanged by batch 10`);
    if (!page.faqGroups) assert.deepEqual(faq, page.faq, `${slug}: FAQ schema matches visible FAQ`);
    for (const text of [page.description, page.intro, delta.appendedSection.heading,
      ...delta.appendedSection.blocks.map(block => block.text), ...page.faq.slice(-2).flatMap((f: any) => [f.question, f.answer])]) {
      assert.ok(!text.includes('/'), `${slug}: no slash fraction`);
      assert.ok(!text.includes('רמה ג׳'), `${slug}: no level ג׳`);
    }
    for (const text of [delta.appendedSection.heading, ...delta.appendedSection.blocks.map(block => block.text)]) {
      for (const banned of ['פתרון מלא', 'פתרונות מלאים', 'דוגמה פתורה', 'דוגמאות פתורות', 'רמז מנועם', 'נועם AI']) {
        assert.ok(!text.includes(banned), `${slug}: ${banned}`);
      }
    }
  }
  // No edition of this batch is for the reduced track.
  assert.ok(reviewed.additions.every(a => a.track !== 'ט_מצומצמת' && !a.edition.label.includes('מצומצמת')));
});

test('new PDFs cannot enter teacher, learning, viewer or Ramzi banks', () => {
  assert.deepEqual(buildTeacherCatalog(corrected), buildTeacherCatalog(previous));
  const teacher = buildTeacherLandingCatalog(corrected);
  assert.deepEqual(teacher, buildTeacherLandingCatalog(previous));
  for (const addition of reviewed.additions) {
    assert.equal(getTeacherLandingScope({ grade: addition.grade, topic: addition.topicId, edition: addition.editionId }, teacher), null);
    assert.ok(getTeacherLandingScope({ grade: addition.grade, topic: addition.topicId }, teacher));
  }
  assert.deepEqual(collectViewerPdfIds(corrected), collectViewerPdfIds(previous));
  for (const id of reviewed.additions.flatMap(a => a.pdfIds)) assert.ok(!collectViewerPdfIds(corrected).includes(id));
  const activation = loadRamziActivationEvidence(new URL('headless/catalog/', root).pathname, new URL('headless/astro-poc/public/', root).pathname);
  assert.deepEqual(buildLearningCatalog(loadIndexCatalog(), registry, activation),
    buildLearningCatalog(loadIndexCatalog(), priorRegistry, activation));
  assert.deepEqual(raw.ramziActivation, (previous as any).ramziActivation);
});

test('preservation fences reject catalog, registry and landing substitutions and misplaced shared-topic editions', () => {
  const badCatalog = structuredClone(raw);
  badCatalog.grades.find((g: any) => g.grade === 8).topics.find((t: any) => t.id === 18).levels[0].pdfId = 'changed-old-link';
  assert.throws(() => beforeBatch10Catalog(badCatalog));
  const substituted = structuredClone(raw);
  substituted.grades.find((g: any) => g.grade === 8).topics.find((t: any) => t.id === 18)
    .editions.at(-1).levels[0].sourceSha256 = '0'.repeat(64);
  assert.throws(() => beforeBatch10Catalog(substituted));
  const registryDuplicate = structuredClone(registry);
  registryDuplicate.editions.push(structuredClone(reviewed.additions[0].edition));
  assert.throws(() => beforeBatch10Registry(registryDuplicate));
  const registryAltered = structuredClone(registry);
  registryAltered.editions.find((e: any) => e.editionId === ids.at(-1)).levels[0].pdfId = 'changed-pdf-id';
  assert.throws(() => beforeBatch10Registry(registryAltered));
  for (const [grade, sourceId, destinations, editionId] of [[8, 18, [17, 22], 'ms-20261118-dat-03-r1'], [7, 12, [11, 13], 'ms-20261118-ang-03-r1']] as const) {
    for (const destinationId of destinations) {
      const moved = structuredClone(raw);
      const g = moved.grades.find((x: any) => x.grade === grade);
      const source = g.topics.find((t: any) => t.id === sourceId);
      const destination = g.topics.find((t: any) => t.id === destinationId);
      // Pick the batch-10 edition by id: a later batch may have appended another edition to the topic.
      const [misplaced] = source.editions.splice(source.editions.findIndex((e: any) => e.editionId === editionId), 1);
      assert.equal(misplaced.editionId, editionId);
      if (!source.editions.length) {
        delete source.editions;
        delete source.defaultEditionId;
      }
      destination.editions = [...(destination.editions || []), misplaced];
      assert.throws(() => beforeBatch10Catalog(moved), assert.AssertionError, `${editionId} must not move from ${grade}/${sourceId} to ${grade}/${destinationId}`);
    }
  }
  const page = read('headless/astro-poc/src/data/topic-pages/triangle-congruence-grade-8.json');
  page.sections.at(-1).blocks[0].text += ' כל PDF כולל רמזי ופתרון מלא';
  assert.throws(() => beforeBatch10Copy('triangle-congruence-grade-8', page));
  const proofText = JSON.stringify(receipt);
  for (const path of ['/Users/', '/private/', '/root/']) assert.ok(!proofText.includes(path), path);
});
