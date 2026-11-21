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
import { beforeBatch09Catalog, beforeBatch09Copy, beforeBatch09Registry,
  reviewedBatch09 as reviewed, reviewedBatch09Ids as ids } from './fixtures/batch09-pdf';
import { createRequire } from 'node:module';
import { beforeLandingCorrections } from './fixtures/landing-corrections-20261118';
import { beforeBatch10Registry } from './fixtures/batch10-pdf';
import { beforeReviewedRamziActivation } from './helpers/beforeReviewedRamziActivation';
import { beforeRamziActivationCopy } from './fixtures/ramzi-activation-copy-20261119';

const require = createRequire(import.meta.url);
const { loadIndexCatalog } = require('../../../scripts/lib/headless-catalog.cjs');
const { buildLearningCatalog } = require('../../../scripts/build-learning-catalog.cjs');
const { loadRamziActivationEvidence } = require('../../../scripts/lib/worksheet-ramzi-activation.cjs');

const root = new URL('../../../', import.meta.url);
const read = (path: string) => JSON.parse(readFileSync(new URL(path, root), 'utf8'));
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value, null, 2) + '\n').digest('hex');
const raw = beforeReviewedRamziActivation(read('headless/astro-poc/src/data/catalog.v1.json'));
const catalog = beforeReviewedRamziActivation(loadCatalog());
const previous = beforeBatch09Catalog(raw) as ReturnType<typeof loadCatalog>;
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
const priorRegistry = beforeBatch09Registry(registry);
const receipt = read('docs/batch09-pdf-first-20261118.json');
const expectedIds = ['ms-20261118-sgm-01-r1',  'ms-20261118-str-01-r1',  'ms-20261118-fnc-02-r1',  'ms-20261118-eqn-03-r1',  'ms-20261118-crt-01-r1',  'ms-20261118-pga-01-r1'];
const mappings: Array<[number, number, string]> = [
  [7, 2, 'signed-numbers-grade-7'],
  [9, 9, 'statistics-grade-9'],
  [8, 21, 'function-representations-grade-8'],
  [7, 37, 'equations-advanced-grade-7'],
  [7, 20, 'solids-box-cube-prism-grade-7'],
  [7, 42, 'pythagorean-theorem-grade-7'],
];
const baselineCatalogSha256 = 'ba67566b2a84e7575223de2d9591396636926bc91c789fa43d3ec724e05444f8';
const baselineRegistrySha256 = 'ea89ae175a04ae4c7c0a4495812e0e6118a111433cf08b9988ae053fbe8c1cf5';
const PINS: Record<string, Array<[string, string]>> = {
  'ms-20261118-sgm-01-r1': [
    ['87fdda260dd04ae5accbb003ad348dec', '9486827ae4373bfb77cf7dd696c1c618b42a00611c4192909cf3c463d5986f10'],
    ['df8ee1c286ab495b955332ca7cbe9a09', '9087643a13e62a72822f4b4711261689edba7c01cba7640949ff53990d91d57a'],
    ['38f236b06be548df9f0c47086874b5e8', 'd7a44e3c78a383f0eadca045b60c0e0a505b39fa414ffb77e7ba9e48dec58984']],
  'ms-20261118-str-01-r1': [
    ['9970baaec3ff46bfbbab9c838cb1db75', '5e46097394bb78aa8c1630ae8daacb94e71039915e91932bac9dfc1fb593c687'],
    ['35568da347874b54921bce0fb67dc8ae', 'fb173cfc5a073aa5a0724be36fea83a9b1d3d0121d2ee20396e07f470f6f5baf'],
    ['237d094786f04c9a893650132a131053', '65a5e064404e6ac9dbb22f14d9872516b1fa67d745a53682eec8f5f444530832']],
  'ms-20261118-fnc-02-r1': [
    ['c68a15204c974103add3c8b6b41bfa06', 'ff22104f75d7bbcaaa140703d1750235beb370d8d2444093c10a9fb6fc788751'],
    ['7617adc56ccd48efabbebad045016e0a', '1666ba5bd001d59b08cf09551c530432a752a9038e4b74daf87d6786248965a6'],
    ['669ac31129a74be39da12df5ebc0e083', 'dcd47ff0d102a9e9557a01f9f3530c1a3c4ae541d8667a4fbc1f6539a6b552bb']],
  'ms-20261118-eqn-03-r1': [
    ['d630be1df47b4d4b81497adbef4c6cda', 'bf981b1bfd51b55ad5f1f08fbb5534709276671c3fc0a4babd61b58d5d4a051a'],
    ['1bfef61820814ba7ac7e984d5510132f', '0fb30db4d0836c220291b03f1b5f156b5888656e8707d4c1f621ac5536c548db'],
    ['97f73bee4aae4d8d867bfe77d09fd568', 'e5255dd88122401f1878bf4398bf7970dda783d82e7d2d304790a44bc1291bbc']],
  'ms-20261118-crt-01-r1': [
    ['82bbbec709fe4f489c8ee20b005b7b70', '6a06e4f89b857c98e482788fce78e02446a11d08cb43789d017629126ae26b1d'],
    ['8b322fc66e4b476db1b742532a1b46b3', 'e62fd9d386b7bd2ad0dcbf9d4cd5b0c1fb1d5343d131f04bd34db693d0724bdd'],
    ['01a221982ed64475bc84d73048e08bde', '7d7017da20f932e229b9dc1e925f75971f3289fc34fb955000051d35f3840ec0']],
  'ms-20261118-pga-01-r1': [
    ['478bfe4418f842b5a78fc12886038b2b', '390bb0d0de9565db6836dacbf6d9b994f2d6bdef35963f4b418a6e1558ff97fc'],
    ['a12dafcf047a439a9d26d3cc6ed61c0e', '61b84afe8c84335ea660848fbe395699f856d400548f225e7c599caa8359c2ac'],
    ['2d74cb6dda6e4b5280f822ec332eac10', 'a3b8adda0fb407ad9f5cc913b127b2deeb1dc17c2ac14fb061cc5eff3c38b586']],
};
const RECEIPT_SHA256S: Record<string, string[]> = {
  'G7-SGM-01': ['7bc4819718957576312569d0f9219a02f90edd3dca51994644066230c329c82f'],
  'G9-STR-01': ['fd15be0f54bff1269dd034544bfdbc4c9b5e3d9ae6f1839664915911617911bc'],
  'G8-FNC-02': ['51bb5fa04db55784bce889d365f799b03fa0e7e31e5aa2144987ef54e972107a', 'ebfcad7140a57b756d6013e0ff3feb8aa6df5882e82f51e9df07ca2072c0ad14'],
  'G7-EQN-03': ['e5536cf3cf1195d77767319fa2d750b93be3b9d57ce25512f2c670bd0b52af4a', '6389f3d8d04aca7f468fa0d06784754499380d84b7bda83da4895d393488a3d9'],
  'G7-CRT-01': ['29f8fbad8ed7fdfbe83ec1aad715295625de2a50f1d938aac91976f756889aef', 'fe2e527485d21a755fb91500043f234b044f3f76ee5f01e7e29ebd24678ce403'],
  'G7-PGA-01': ['d9a0f087d6a1993da742becac1f9a251f8a26c4e97397dfa5cf4423b41c3ca02', '48f30c77eb2d07fa216115e85e1a5ad5c296de0b58f3b9c8553eca4b09cf84fe'],
};

test('six additive editions recover the pinned baseline after batch 8 (c45a033c) without changing existing defaults', () => {
  assert.equal(reviewed.baselineCommit, 'c45a033ccb7c011b51b54470debd176dc0b3e342');
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
  assert.deepEqual(receipt.scope, { packages: 6, pdfs: 18, pages: 219, landingRoutes: 6 });
  // Batch 10 appends later rows; compare this batch's registry state.
  const batch09Registry = beforeBatch10Registry(registry);
  assert.equal(batch09Registry.editions.length, priorRegistry.editions.length + 6);
  assert.deepEqual(batch09Registry.editions.slice(0, -6), priorRegistry.editions);
  assert.deepEqual(batch09Registry.editions.slice(-6), reviewed.additions.map(a => a.edition));
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

test('six landing routes add only reviewed PDF copy and preserve their complete batch 8 data', () => {
  assert.equal(reviewed.landingDeltas.length, 6);
  const slugs = [...new Set(reviewed.additions.map(a => a.slug))].sort();
  assert.deepEqual(reviewed.landingDeltas.map(d => d.slug).sort(), slugs);
  for (const delta of reviewed.landingDeltas) {
    assert.ok(delta.slug);
    const slug = delta.slug;
    const page = (beforeLandingCorrections(slug, read(`headless/astro-poc/src/data/topic-pages/${slug}.json`)) as any);
    const restored = beforeBatch09Copy(slug, page);
    assert.equal(digest(restored), delta.baselineSha256, `${delta.slug}: exact previous page`);
    assert.equal(page.h1, restored.h1);
    assert.equal(page.title, restored.title);
    assert.deepEqual(page.catalogCta, restored.catalogCta);
    assert.deepEqual(page.catalogCtas, restored.catalogCtas);
    assert.deepEqual(page.sections.at(-1), delta.appendedSection);
    const loaded = beforeLandingCorrections(slug, loadTopicPage(slug)!);
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
    // The 19.11 copy after the additional Ramzi activation is newer than batch 9: compare without it.
    const faq = extractJsonLdFaq((beforeRamziActivationCopy(slug, loaded) as any).jsonLd).map(item => ({
      question: item.question.replace(/[⁦-⁩]/g, ''), answer: item.answer.replace(/[⁦-⁩]/g, ''),
    }));
    const baselineFaq = extractJsonLdFaq((beforeBatch09Copy(slug, loaded) as any).jsonLd).map(item => ({
      question: item.question.replace(/[⁦-⁩]/g, ''), answer: item.answer.replace(/[⁦-⁩]/g, ''),
    }));
    assert.deepEqual(faq, baselineFaq, `${slug}: FAQ schema unchanged by batch 9`);
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
  const reduced = reviewed.additions.filter(a => a.sheetId === 'G9-STR-01');
  assert.equal(reduced.length, 1);
  assert.ok(reduced.every(a => a.track === 'ט_מצומצמת' && a.edition.label.includes('ט׳ מצומצמת')));
  assert.match(loadTopicPage('statistics-grade-9')!.sections.at(-1)!.heading ?? '', /ט׳ מצומצמת/);
  assert.ok(reviewed.additions.filter(a => a.sheetId !== 'G9-STR-01').every(a => !a.edition.label.includes('מצומצמת')));
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
  badCatalog.grades.find((g: any) => g.grade === 8).topics.find((t: any) => t.id === 21).levels[0].pdfId = 'changed-old-link';
  assert.throws(() => beforeBatch09Catalog(badCatalog));
  const substituted = structuredClone(raw);
  substituted.grades.find((g: any) => g.grade === 8).topics.find((t: any) => t.id === 21)
    .editions.at(-1).levels[0].sourceSha256 = '0'.repeat(64);
  assert.throws(() => beforeBatch09Catalog(substituted));
  const registryDuplicate = structuredClone(registry);
  registryDuplicate.editions.push(structuredClone(reviewed.additions[0].edition));
  assert.throws(() => beforeBatch09Registry(registryDuplicate));
  const registryAltered = structuredClone(registry);
  registryAltered.editions.find((e: any) => e.editionId === ids.at(-1)).levels[0].pdfId = 'changed-pdf-id';
  assert.throws(() => beforeBatch09Registry(registryAltered));
  for (const destinationId of [20, 22]) {
    const moved = structuredClone(raw);
    const grade = moved.grades.find((g: any) => g.grade === 8);
    const source = grade.topics.find((t: any) => t.id === 21);
    const destination = grade.topics.find((t: any) => t.id === destinationId);
    const misplaced = source.editions.pop();
    assert.equal(misplaced.editionId, 'ms-20261118-fnc-02-r1');
    if (!source.editions.length) {
      delete source.editions;
      delete source.defaultEditionId;
    }
    destination.editions = [...(destination.editions || []), misplaced];
    assert.throws(() => beforeBatch09Catalog(moved), `FNC-02 must not move from 8/21 to 8/${destinationId}`);
  }
  for (const destinationId of [48, 47]) {
    const moved = structuredClone(raw);
    const grade = moved.grades.find((g: any) => g.grade === 7);
    const source = grade.topics.find((t: any) => t.id === 20);
    const destination = grade.topics.find((t: any) => t.id === destinationId);
    const misplaced = source.editions.pop();
    assert.equal(misplaced.editionId, 'ms-20261118-crt-01-r1');
    if (!source.editions.length) {
      delete source.editions;
      delete source.defaultEditionId;
    }
    destination.editions = [...(destination.editions || []), misplaced];
    assert.throws(() => beforeBatch09Catalog(moved), assert.AssertionError, `CRT-01 must not move from 7/20 to 7/${destinationId} on the shared page`);
  }
  const page = read('headless/astro-poc/src/data/topic-pages/pythagorean-theorem-grade-7.json');
  page.sections.at(-1).blocks[0].text += ' כל PDF כולל רמזי ופתרון מלא';
  assert.throws(() => beforeBatch09Copy('pythagorean-theorem-grade-7', page));
  const proofText = JSON.stringify(receipt);
  for (const path of ['/Users/', '/private/', '/root/']) assert.ok(!proofText.includes(path), path);
});
