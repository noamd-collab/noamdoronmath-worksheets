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
import { beforeBatch08Catalog, beforeBatch08Copy, beforeBatch08Registry,
  reviewedBatch08 as reviewed, reviewedBatch08Ids as ids } from './fixtures/batch08-pdf';
import { createRequire } from 'node:module';
import { beforeBatch09Copy, beforeBatch09Registry, reviewedBatch09 } from './fixtures/batch09-pdf';

const require = createRequire(import.meta.url);
const { loadIndexCatalog } = require('../../../scripts/lib/headless-catalog.cjs');
const { buildLearningCatalog } = require('../../../scripts/build-learning-catalog.cjs');
const { loadRamziActivationEvidence } = require('../../../scripts/lib/worksheet-ramzi-activation.cjs');

const root = new URL('../../../', import.meta.url);
const read = (path: string) => JSON.parse(readFileSync(new URL(path, root), 'utf8'));
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value, null, 2) + '\n').digest('hex');
const raw = read('headless/astro-poc/src/data/catalog.v1.json');
const catalog = loadCatalog();
const previous = beforeBatch08Catalog(raw) as ReturnType<typeof loadCatalog>;
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
for (const addition of reviewedBatch09.additions) {
  const topic = previousSsr.grades.find((g: any) => g.grade === addition.grade)
    .topics.find((t: any) => t.id === addition.topicId);
  topic.editions = topic.editions?.filter((e: any) => e.editionId !== addition.editionId);
  if (!topic.editions?.length) {
    delete topic.editions;
    delete topic.defaultEditionId;
  }
}
const registry = read('headless/catalog/worksheet-editions.v1.json');
const batch08Registry = beforeBatch09Registry(registry);
const priorRegistry = beforeBatch08Registry(registry);
const receipt = read('docs/batch08-pdf-first-20261118.json');
const expectedIds = ['ms-20261118-sol-01-r1',  'ms-20261118-g8-dat-01-r1',  'ms-20261118-rat-01-r1',  'ms-20261118-rhm-01-r1',  'ms-20261118-sqm-01-r1'];
const mappings: Array<[number, number, string]> = [
  [7, 20, 'solids-box-cube-prism-grade-7'],
  [8, 67, 'statistics-data-frequency-grade-8'],
  [8, 4, 'ratio-proportion-grade-8'],
  [9, 13, 'rhombus-grade-9'],
  [9, 14, 'square-grade-9'],
];
const baselineCatalogSha256 = 'd76a6961eaca4fda1c942fe7029e96e03862423bf33396f5289e091b2f963764';
const baselineRegistrySha256 = 'a31ca0a9104de110a830cacd811dd23ca9f88957bf3a31671093cea0a0e14c91';
const PINS: Record<string, Array<[string, string]>> = {
  'ms-20261118-sol-01-r1': [
    ['f55d140f6b1a4dc2ad748cf517f330e4', 'b8cf86b5a1ae29ef9d6c9a09aeaf03ff9f94e4f2e0ac35e01ee5c28a3a913be9'],
    ['df43b2fd2f1a403a9aa23a03546f8056', 'b09f90d8409cb304259f0bffd4c30239fd84504713583b0a2cc0968f294a80be'],
    ['2ef19184204d42f1872b63251560d7fc', '286fa9eff549d678fbfece88ab139a96cdbded2f15579a75d07870139bf29ca5']],
  'ms-20261118-g8-dat-01-r1': [
    ['23c731fa942843519f2cfc1232e3d503', 'c44668dc4e00b7076b10c097a15ef75c23f9d98e41b15c1ebdc343dea67cb788'],
    ['b4226383875b4715b7a38203c2ab479a', '43debd9c31c47f20e8e218582e8969e645de6f785673267ebd60367bf2b2b35e'],
    ['e416913b10484b6289d5479818749755', 'd1d959c3d719c425b714b1d587ca7333f6dc47d6c0a7e731dcc7475d9376d46d']],
  'ms-20261118-rat-01-r1': [
    ['eb5c82cdae23439192002a2ae5a09987', 'c888827e47c5cc329a7bf7c0cb72067a7e4ca50b7bc7b2c49696961b9f8b2998'],
    ['51ca7fa23d764c71adbbcaa24586e3c7', '8e776b88352adb6a6df79080063b296d9664a29ea03776c5ce3bad8300b8870a'],
    ['0ea79c5b38184007a3d7862c1339164b', '94bfccbd90b7c79c697f0cb26cd6aeb5e922db8b7b60e43fe749783c8eb65ec3']],
  'ms-20261118-rhm-01-r1': [
    ['7a2d0143a74942f187edb0e517722367', '6071bcd72dc646f392c4f0f3e3a82e7e524f3470350f334f6181b8dfb60391f4'],
    ['0011a1c0893c4a0d84a92efb3d8f4dc8', 'ee457f36b8a2375399b4d69bd3342b342e4c667fa974b58ddee4fd24526512b7'],
    ['fc1da3d14c5549d28f1f49411ca13fea', '3407efffccd2fdae0a6b769e8c2d4277d3639e1aba190df53c9817979c109e32']],
  'ms-20261118-sqm-01-r1': [
    ['334c469b45ec4819a94e1f7ea2dfcb36', '6e617c57f71bf31eba278d47f25198b7382cf7858c41549e2be51fc4d1388f94'],
    ['ff70835c7aac44fc93237bcf0025886d', '11d9e3eeecf61ca480881e0e21b59fe321e17b7b4dca36b301704c8412d4a8cd'],
    ['37d77b5f26ee4055ad294e15dc1f4c0c', '00f0faedf4e2025b7bb2253fb6c8fb8503fb54ac0a61613e36fbb008bf2bc907']],
};
const RECEIPT_SHA256S: Record<string, string[]> = {
  'G7-SOL-01': ['5971266b88a1990604b828a9c1172884f199140dbbc8d00756c0317f08d079ab'],
  'G8-DAT-01': ['2ab4491836f9139425d29823872561943c1a4d397077b25e6afc87bb0e91c4c8'],
  'G8-RAT-01': ['d681126134fb74526514187e7cfa50c4c1c83ef6c3a6f1a6940ebd075313af22'],
  'G9-RHM-01': ['e45676b2916d532599efdde62c43c91d322a971709c4ca7d2ea66a23f78898d9'],
  'G9-SQM-01': ['7f7cbb11cfffe02aaefdb77c3b7dd1c9df159670aa51c513ea475956cc3a75d3'],
};

test('five additive editions recover the pinned baseline after batch 7 (6e94a979) without changing existing defaults', () => {
  assert.equal(reviewed.baselineCommit, '6e94a9799e3b9102e89effca9308f210b671709b');
  assert.equal(reviewed.baselineCatalogSha256, baselineCatalogSha256);
  assert.equal(reviewed.baselineRegistrySha256, baselineRegistrySha256);
  assert.equal(digest(previous), baselineCatalogSha256);
  assert.equal(digest(priorRegistry), baselineRegistrySha256);
  assert.deepEqual(ids, expectedIds);
  assert.deepEqual(reviewed.additions.map(a => [a.grade, a.topicId, a.slug]), mappings);
  assert.deepEqual(Object.keys(PINS), ids);
  assert.equal(new Set(reviewed.additions.flatMap(a => a.pdfIds)).size, 15);
  assert.equal(new Set(reviewed.additions.flatMap(a => a.edition.levels.map(l => l.pdfSha256))).size, 15);
  const expectedSsr = structuredClone(raw);
  expectedSsr.config.pdfBase = 'https://static.wixstatic.com/ugd/d8e7ad_';
  assert.deepEqual(catalog, expectedSsr);
  assert.equal(receipt.status, 'REVIEWED_MEDIA_SITE_CANDIDATE_NOT_PUBLISHED');
  assert.equal(receipt.sitePublicationClaimed, false);
  assert.deepEqual(receipt.scope, { packages: 5, pdfs: 15, pages: 139, landingRoutes: 5 });
  assert.equal(batch08Registry.editions.length, priorRegistry.editions.length + 5);
  assert.deepEqual(batch08Registry.editions.slice(0, -5), priorRegistry.editions);
  assert.deepEqual(batch08Registry.editions.slice(-5), reviewed.additions.map(a => a.edition));
  assert.equal(raw.grades.flatMap((g: any) => g.topics.flatMap((t: any) => t.levels)).length, 991); // NEW4 (18.11): four later base topics, +12 levels; batch 10 topic 9/53, +3
  assert.equal(previous.grades.flatMap((g: any) => g.topics.flatMap((t: any) => t.levels)).length, 976);

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
    
    assert.ok(proof.reviewReceipts.every((r: any) => /^reports\/(KIMI|CLAUDE)-INDEPENDENT-[A-Z0-9-]+-2026111[678]\/review\.json$/.test(r.path) && /^[0-9a-f]{64}$/.test(r.sha256)));
    assert.match(proof.reviewReceipts[0].role, /independent review/);
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
        ...reviewedBatch09.additions.filter(a => a.grade === addition.grade && a.topicId === addition.topicId).map(a => a.editionId)]);
    const oldGroupCount = oldIds.length + 1;
    assert.deepEqual(groups.slice(0, oldGroupCount), topicWorksheetEditionLinks(previousSsr, addition.grade, addition.topicId, back));
    assert.deepEqual(groups.find(g => g.editionId === addition.editionId)!.levels.map(l => l.key), ['a', 'b', 'c']);
  }
});

test('five landing routes add only reviewed PDF copy and preserve their complete batch 7 data', () => {
  assert.equal(reviewed.landingDeltas.length, 5);
  const slugs = [...new Set(reviewed.additions.map(a => a.slug))].sort();
  assert.deepEqual(reviewed.landingDeltas.map(d => d.slug).sort(), slugs);
  for (const delta of reviewed.landingDeltas) {
    assert.ok(delta.slug);
    const slug = delta.slug;
    const page = read(`headless/astro-poc/src/data/topic-pages/${slug}.json`);
    const restored = beforeBatch08Copy(slug, page);
    assert.equal(digest(restored), delta.baselineSha256, `${delta.slug}: exact previous page`);
    assert.equal(page.h1, restored.h1);
    assert.equal(page.title, restored.title);
    assert.deepEqual(page.catalogCta, restored.catalogCta);
    assert.deepEqual(page.catalogCtas, restored.catalogCtas);
    assert.deepEqual((beforeBatch09Copy(slug, page) as any).sections.at(-1), delta.appendedSection);
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
    assert.deepEqual(faq, page.faq);
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
  const reduced = reviewed.additions.filter(a => ['G9-RHM-01', 'G9-SQM-01'].includes(a.sheetId));
  assert.equal(reduced.length, 2);
  assert.ok(reduced.every(a => a.track === 'ט_מצומצמת' && a.edition.label.includes('ט׳ מצומצמת')));
  for (const slug of ['rhombus-grade-9', 'square-grade-9']) {
    assert.match(loadTopicPage(slug)!.sections.at(-1)!.heading ?? '', /ט׳ מצומצמת/);
  }
  assert.ok(reviewed.additions.filter(a => !['G9-RHM-01', 'G9-SQM-01'].includes(a.sheetId)).every(a => !a.edition.label.includes('מצומצמת')));
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
  badCatalog.grades.find((g: any) => g.grade === 8).topics.find((t: any) => t.id === 4).levels[0].pdfId = 'changed-old-link';
  assert.throws(() => beforeBatch08Catalog(badCatalog));
  const substituted = structuredClone(raw);
  substituted.grades.find((g: any) => g.grade === 8).topics.find((t: any) => t.id === 4)
    .editions.at(-1).levels[0].sourceSha256 = '0'.repeat(64);
  assert.throws(() => beforeBatch08Catalog(substituted));
  const registryDuplicate = structuredClone(registry);
  registryDuplicate.editions.push(structuredClone(reviewed.additions[0].edition));
  assert.throws(() => beforeBatch08Registry(registryDuplicate));
  const registryAltered = structuredClone(registry);
  registryAltered.editions.find((e: any) => e.editionId === ids.at(-1)).levels[0].pdfId = 'changed-pdf-id';
  assert.throws(() => beforeBatch08Registry(registryAltered));
  for (const destinationId of [5, 45]) {
    const moved = structuredClone(raw);
    const grade = moved.grades.find((g: any) => g.grade === 8);
    const source = grade.topics.find((t: any) => t.id === 4);
    const destination = grade.topics.find((t: any) => t.id === destinationId);
    const misplaced = source.editions.pop();
    assert.equal(misplaced.editionId, 'ms-20261118-rat-01-r1');
    if (!source.editions.length) {
      delete source.editions;
      delete source.defaultEditionId;
    }
    destination.editions = [...(destination.editions || []), misplaced];
    assert.throws(() => beforeBatch08Catalog(moved), `RAT-01 must not move from 8/4 to 8/${destinationId}`);
  }
  for (const destinationId of [48, 47]) {
    const moved = structuredClone(raw);
    const grade = moved.grades.find((g: any) => g.grade === 7);
    const source = grade.topics.find((t: any) => t.id === 20);
    const destination = grade.topics.find((t: any) => t.id === destinationId);
    const misplaced = source.editions.splice(source.editions.findIndex((e: any) => e.editionId === 'ms-20261118-sol-01-r1'), 1)[0];
    assert.equal(misplaced.editionId, 'ms-20261118-sol-01-r1');
    if (!source.editions.length) {
      delete source.editions;
      delete source.defaultEditionId;
    }
    destination.editions = [...(destination.editions || []), misplaced];
    assert.throws(() => beforeBatch08Catalog(moved), assert.AssertionError, `SOL-01 must not move from 7/20 to 7/${destinationId} on the shared page`);
  }
  const page = read('headless/astro-poc/src/data/topic-pages/ratio-proportion-grade-8.json');
  page.sections.at(-1).blocks[0].text += ' כל PDF כולל רמזי ופתרון מלא';
  assert.throws(() => beforeBatch08Copy('ratio-proportion-grade-8', page));
  const proofText = JSON.stringify(receipt);
  for (const path of ['/Users/', '/private/', '/root/']) assert.ok(!proofText.includes(path), path);
});
