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
import { beforeBatch11Catalog, beforeBatch11Copy, beforeBatch11Registry,
  reviewedBatch11 as reviewed, reviewedBatch11Ids as ids } from './fixtures/batch11-pdf';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { loadIndexCatalog } = require('../../../scripts/lib/headless-catalog.cjs');
const { buildLearningCatalog } = require('../../../scripts/build-learning-catalog.cjs');
const { loadRamziActivationEvidence } = require('../../../scripts/lib/worksheet-ramzi-activation.cjs');

const root = new URL('../../../', import.meta.url);
const read = (path: string) => JSON.parse(readFileSync(new URL(path, root), 'utf8'));
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value, null, 2) + '\n').digest('hex');
const raw = read('headless/astro-poc/src/data/catalog.v1.json');
const catalog = loadCatalog();
const previous = beforeBatch11Catalog(raw) as ReturnType<typeof loadCatalog>;
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
const registry = read('headless/catalog/worksheet-editions.v1.json');
const priorRegistry = beforeBatch11Registry(registry);
const receipt = read('docs/batch11-pdf-first-20261118.json');
const expectedIds = ["ms-20261118-qfr-01-r1", "ms-20261118-dgm-01-r1", "ms-20261118-ang-01-r1", "ms-20261118-ang-04-r1"];
const mappings: Array<[number, number, string]> = [
  [9, 6, 'quadratic-equations-grade-9'],
  [7, 26, 'relative-frequency-grade-7'],
  [7, 11, 'angles-introduction-measurement-grade-7'],
  [7, 14, 'triangle-quadrilateral-angle-sum-grade-7'],
];
const baselineCatalogSha256 = '8e7d0ceb08142df3e6c4118a772abba38daa9b157b2459b79a6a237972d7aad8';
const baselineRegistrySha256 = '0d4d57534b70f6e30a9175d16b0c03d9a4c1a76f4fa88f043cf219d8f49e5452';
const PINS: Record<string, Array<[string, string]>> = {
  'ms-20261118-qfr-01-r1': [
    ['696c707d9e4f42049ead576bc0563f6e', '577f43706bedd87be1e07445538bc4dcd40401bb6a3d65a4ce0685661b897a5b'],
    ['bc52e89c74dc4cbfaddd2e90c293a8d7', 'f585c2084f2e155e83db67768909ceb42f6c97a61c41e7ba7e99def1376d36b2'],
    ['1f19c56dde9748f588a47aca92615f60', '4d8e0213d425c2f74b97b2a5ae09a8e871b0353effdaf4e3ba5917dc34033a37']],
  'ms-20261118-dgm-01-r1': [
    ['67785355a263444f831fbce6431ef939', '6514cd9fab787eedc665616e70b6cfd3df0703e3d21baadbe6252ec673722d88'],
    ['3751febc9e2e43dba6bbab3e65631fbe', 'f96d72f89c9a72886a76430fc75954993ec75f0208af7191c47456b1bfea4b1e'],
    ['78cb8aac50f0479db087f298f6ba59bf', '08a529b6ca6502881f0cacac16269f336b633f35ce931d1b9130edc407e7d32f']],
  'ms-20261118-ang-01-r1': [
    ['f5ebdde1cefc4b9483d48894ed9f419d', '88d03cda26c913407793645db26c2201372827d2d9f4175e9c8585aac5cf7eee'],
    ['be4d3aa8e1244697895cbf263b549827', '814096b23249275593e7b52273dfdd602d844c332510dfadfaa6839af1a68474'],
    ['c91d007982374cd19f47a714486c85bf', '2303ae152fa7b13b7c0d8b88830aa81ef24889ceac894bb28f2ccb5d26cb1a73']],
  'ms-20261118-ang-04-r1': [
    ['5f86e81c30d4433b880b6722a816911d', 'fef3d289243e7b21115228661268b8cb8b700b8cb074bfd8e1cd0145a6bdd094'],
    ['a02da047e95e47b5bf14dcc8f2fbe18a', '6af863c296cf24899318b5d3afa0ad7aabf3e788ec464d2262b32196480fff8b'],
    ['42860fc585fd431e86097ef79317e189', '1c750641921dea4c36af53cf0460f5c6aa170e6de473d32ff0a422fb357a03c2']],
};
const RECEIPT_SHA256S: Record<string, string[]> = {
  'G9-QFR-01': ['06601be51360fc385f3255dfcf169bb5085a4fb7fba130cd9de6fa93fcd53f44', '178f1fe7b89712d793e91ce886abfcede24b94dafd7ce6145021bfdc73dc375c', 'c8e51e7230668174070eb4817dda18b26e09ff7a45f3110d3d1b99767cf4844e', 'e9fdc52265ac12aed8733db203c7f930e9a9b827bc0d8a60dffd95001fdcc976'],
  'G7-DGM-01': ['5bd1437dccb811780c71e1c8df072f5d3ebbe8b5044a16f44225df1995a325db', '7767153c67607ffc88c6fa9da1c459296d5962437c1908a2d4fb690031cb3567', '5c21529fa2884ce9226166bffe82ababa49c9b3b3e53a4b9830e95c83c75322b'],
  'G7-ANG-01': ['aa99dd843a7e6815fa41b4388bc1bc53c822bf5f9d74ba91169fe8d42a2abfa4', '676d8f8d4a1ee4e52672c0dfbf4a5de4804d2cecf38c1c36a4fdae5816f251f4', '9c19a2949ff68a6ecbf50502b15c920b258730764afb75b1002d8d2c8a799d49'],
  'G7-ANG-04': ['186046d203ff47967da2f40799d3223a87cf2f7d8bb563506e041bde1e10f661', 'bdd42ffdbb72edd13e3f8f6142a684e36b42cda69a1d71daec8abc413c3c8f84', 'dd777c505ab3f7b560b9968ff1f0aab3b160f572b30459ea87bb4fa8f0ac3f75'],
};

test('four additive editions recover the pinned baseline after batch 10 (143d3d57) without changing existing defaults', () => {
  assert.equal(reviewed.baselineCommit, '143d3d57af7281ace0c9056dad87d4955f4bc438');
  assert.equal(reviewed.baselineCatalogSha256, baselineCatalogSha256);
  assert.equal(reviewed.baselineRegistrySha256, baselineRegistrySha256);
  assert.equal(digest(previous), baselineCatalogSha256);
  assert.equal(digest(priorRegistry), baselineRegistrySha256);
  assert.deepEqual(ids, expectedIds);
  assert.deepEqual(reviewed.additions.map(a => [a.grade, a.topicId, a.slug]), mappings);
  assert.deepEqual(Object.keys(PINS), ids);
  assert.equal(new Set(reviewed.additions.flatMap(a => a.pdfIds)).size, 12);
  assert.equal(new Set(reviewed.additions.flatMap(a => a.edition.levels.map(l => l.pdfSha256))).size, 12);
  const expectedSsr = structuredClone(raw);
  expectedSsr.config.pdfBase = 'https://static.wixstatic.com/ugd/d8e7ad_';
  assert.deepEqual(catalog, expectedSsr);
  assert.equal(receipt.status, 'REVIEWED_MEDIA_SITE_CANDIDATE_NOT_PUBLISHED');
  assert.equal(receipt.sitePublicationClaimed, false);
  assert.deepEqual(receipt.scope, { packages: 4, pdfs: 12, pages: 143, landingRoutes: 4 });
  assert.equal(registry.editions.length, priorRegistry.editions.length + 4);
  assert.deepEqual(registry.editions.slice(0, -4), priorRegistry.editions);
  assert.deepEqual(registry.editions.slice(-4), reviewed.additions.map(a => a.edition));
  assert.equal(raw.grades.flatMap((g: any) => g.topics.flatMap((t: any) => t.levels)).length, 991); // batch 11 adds no base topic
  assert.equal(previous.grades.flatMap((g: any) => g.topics.flatMap((t: any) => t.levels)).length, 991);

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
      [selectedId, ...oldIds.filter(id => id !== selectedId), ...topicAdditions.map(a => a.editionId)]);
    const oldGroupCount = oldIds.length + 1;
    assert.deepEqual(groups.slice(0, oldGroupCount), topicWorksheetEditionLinks(previousSsr, addition.grade, addition.topicId, back));
    assert.deepEqual(groups.find(g => g.editionId === addition.editionId)!.levels.map(l => l.key), ['a', 'b', 'c']);
  }
});

test('four landing routes add only reviewed PDF copy and preserve their complete earlier data', () => {
  assert.equal(reviewed.landingDeltas.length, 4);
  const slugs = [...new Set(reviewed.additions.map(a => a.slug))].sort();
  assert.deepEqual(reviewed.landingDeltas.map(d => d.slug).sort(), slugs);
  for (const delta of reviewed.landingDeltas) {
    assert.ok(delta.slug);
    const slug = delta.slug;
    const page = read(`headless/astro-poc/src/data/topic-pages/${slug}.json`);
    const restored = beforeBatch11Copy(slug, page);
    assert.equal(digest(restored), delta.baselineSha256, `${delta.slug}: exact previous page`);
    assert.equal(page.h1, restored.h1);
    assert.equal(page.title, restored.title);
    assert.deepEqual(page.catalogCta, restored.catalogCta);
    assert.deepEqual(page.catalogCtas, restored.catalogCtas);
    assert.deepEqual(page.sections.at(-1), delta.appendedSection);
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
    const baselineFaq = extractJsonLdFaq((beforeBatch11Copy(slug, loaded) as any).jsonLd).map(item => ({
      question: item.question.replace(/[⁦-⁩]/g, ''), answer: item.answer.replace(/[⁦-⁩]/g, ''),
    }));
    assert.deepEqual(faq, baselineFaq, `${slug}: FAQ schema unchanged by batch 11`);
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
  assert.deepEqual(buildTeacherCatalog(catalog), buildTeacherCatalog(previous));
  const teacher = buildTeacherLandingCatalog(catalog);
  assert.deepEqual(teacher, buildTeacherLandingCatalog(previous));
  for (const addition of reviewed.additions) {
    assert.equal(getTeacherLandingScope({ grade: addition.grade, topic: addition.topicId, edition: addition.editionId }, teacher), null);
    assert.ok(getTeacherLandingScope({ grade: addition.grade, topic: addition.topicId }, teacher));
  }
  assert.deepEqual(collectViewerPdfIds(catalog), collectViewerPdfIds(previous));
  for (const id of reviewed.additions.flatMap(a => a.pdfIds)) assert.ok(!collectViewerPdfIds(catalog).includes(id));
  const activation = loadRamziActivationEvidence(new URL('headless/catalog/', root).pathname, new URL('headless/astro-poc/public/', root).pathname);
  assert.deepEqual(buildLearningCatalog(loadIndexCatalog(), registry, activation),
    buildLearningCatalog(loadIndexCatalog(), priorRegistry, activation));
  assert.deepEqual(raw.ramziActivation, (previous as any).ramziActivation);
});

test('preservation fences reject catalog, registry and landing substitutions and misplaced shared-topic editions', () => {
  const badCatalog = structuredClone(raw);
  badCatalog.grades.find((g: any) => g.grade === 9).topics.find((t: any) => t.id === 6).levels[0].pdfId = 'changed-old-link';
  assert.throws(() => beforeBatch11Catalog(badCatalog));
  const substituted = structuredClone(raw);
  substituted.grades.find((g: any) => g.grade === 9).topics.find((t: any) => t.id === 6)
    .editions.at(-1).levels[0].sourceSha256 = '0'.repeat(64);
  assert.throws(() => beforeBatch11Catalog(substituted));
  const registryDuplicate = structuredClone(registry);
  registryDuplicate.editions.push(structuredClone(reviewed.additions[0].edition));
  assert.throws(() => beforeBatch11Registry(registryDuplicate));
  const registryAltered = structuredClone(registry);
  registryAltered.editions.find((e: any) => e.editionId === ids.at(-1)).levels[0].pdfId = 'changed-pdf-id';
  assert.throws(() => beforeBatch11Registry(registryAltered));
  for (const [grade, sourceId, destinations, editionId] of [[9, 6, [5, 8], 'ms-20261118-qfr-01-r1'], [7, 26, [25, 27], 'ms-20261118-dgm-01-r1'], [7, 11, [10, 12], 'ms-20261118-ang-01-r1'], [7, 14, [13, 15], 'ms-20261118-ang-04-r1']] as const) {
    for (const destinationId of destinations) {
      const moved = structuredClone(raw);
      const g = moved.grades.find((x: any) => x.grade === grade);
      const source = g.topics.find((t: any) => t.id === sourceId);
      const destination = g.topics.find((t: any) => t.id === destinationId);
      const misplaced = source.editions.pop();
      assert.equal(misplaced.editionId, editionId);
      if (!source.editions.length) {
        delete source.editions;
        delete source.defaultEditionId;
      }
      destination.editions = [...(destination.editions || []), misplaced];
      assert.throws(() => beforeBatch11Catalog(moved), assert.AssertionError, `${editionId} must not move from ${grade}/${sourceId} to ${grade}/${destinationId}`);
    }
  }
  const page = read('headless/astro-poc/src/data/topic-pages/relative-frequency-grade-7.json');
  page.sections.at(-1).blocks[0].text += ' כל PDF כולל רמזי ופתרון מלא';
  assert.throws(() => beforeBatch11Copy('relative-frequency-grade-7', page));
  const proofText = JSON.stringify(receipt);
  for (const path of ['/Users/', '/private/', '/root/']) assert.ok(!proofText.includes(path), path);
});
