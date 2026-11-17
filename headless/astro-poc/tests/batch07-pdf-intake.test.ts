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
import { beforeBatch07Catalog, beforeBatch07Copy, beforeBatch07Registry,
  reviewedBatch07 as reviewed, reviewedBatch07Ids as ids } from './fixtures/batch07-pdf';
import { createRequire } from 'node:module';
import { beforeBatch08Registry } from './fixtures/batch08-pdf';

const require = createRequire(import.meta.url);
const { loadIndexCatalog } = require('../../../scripts/lib/headless-catalog.cjs');
const { buildLearningCatalog } = require('../../../scripts/build-learning-catalog.cjs');
const { loadRamziActivationEvidence } = require('../../../scripts/lib/worksheet-ramzi-activation.cjs');

const root = new URL('../../../', import.meta.url);
const read = (path: string) => JSON.parse(readFileSync(new URL(path, root), 'utf8'));
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value, null, 2) + '\n').digest('hex');
const raw = read('headless/astro-poc/src/data/catalog.v1.json');
const catalog = loadCatalog();
const previous = beforeBatch07Catalog(raw) as ReturnType<typeof loadCatalog>;
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
const batch07Registry = beforeBatch08Registry(registry);
const priorRegistry = beforeBatch07Registry(registry);
const receipt = read('docs/batch07-pdf-first-20261117.json');
const expectedIds = ['trp-02', 'lnm-01', 'alg-05'].map(key => `ms-20261117-${key}-r1`);
const mappings: Array<[number, number, string]> = [
  [9, 39, 'trapezoid-grade-9'], [9, 34, 'linear-function-grade-9'], [7, 22, 'algebraic-expressions-grade-7'],
];
const baselineCatalogSha256 = '3c5c0bbf3807be2a0d2866960743c2616a063b73634657f32a7f7158ecc2ebe3';
const baselineRegistrySha256 = 'a0daffccf392dd7150b5527046c00bd98a21ec68d8d759b82e47744843550f2a';
const PINS: Record<string, Array<[string, string]>> = {
  'ms-20261117-trp-02-r1': [
    ['7193f26728714f8d8636012ece48bfaa', '60b1edb772e4be68f52a2916b682952c1706f6ef7d2f77204b47512603de6f2a'],
    ['43c42469f72148039315d7957076bb5c', '058fb33976fc68af35e28f6a30844ffcddcb4f32ceecbd17467d1582ac7c6e18'],
    ['b5b5968044ec475ba118e62e1be3857f', '103289876709627a13476863c42928327aeed375a5f47ee99130dd5124c3f608']],
  'ms-20261117-lnm-01-r1': [
    ['ecaf240714494fa5bc15fa436626587c', 'a504630bd5a158269712c8a668a42cd82086f0088951553026d60ed02c393b1e'],
    ['4b80c8a6e1604a4693ec3f2ddea59a66', 'd5afdc979c62980e3862586a2792b7964d887f790a24918109b48c6665ecbe5b'],
    ['c65d1550945c49a4acde12b8bd8a977b', 'c29b179148cc21d32488ee549342aaa2d2eaf64d2a4f99b8f887a7542a320b7d']],
  'ms-20261117-alg-05-r1': [
    ['770cbafac9ae4a4f8238b779f8f6eb6f', '5c4c09520fe7711a12001297024912ff2388b3de2e0ba401767d56b7749c6708'],
    ['1cf0a9ab309d4e189a1029b1a5b6fbef', 'ee19ba9f0749105638a4eb30ab845434220066ed0becd8fb98a088b069a10a93'],
    ['2f3e68107653463b94fefeb5c99d86b0', '3f871b3e25d7ab0cf3d985b6bbd7a7512312adf103e546764140895dd0a381d8']],
};
const RECEIPT_SHA256S: Record<string, string[]> = {
  'G9-TRP-02': ['7f4809cb91bd5be31e543323cc3f84b01129f265c3cda43294287a86a6870d15', '355a7a0ec9c33cf32742ee0d6680bc138ecbb762e717766d9c2629042d079661', 'd9499efed4346c7a1c1ee62c01af5f4e5aa862e8ddf2fca25599e7ae9b1447b4'],
  'G9-LNM-01': ['fb892b6b8f67ed440812c9e1618887621b5096d1896f20f8b741d5879248af82', '51103199d9cbb0390d488eb4182f484425474bda0565fdf8257da784dd1f4d1e'],
  'G7-ALG-05': ['698152a5a3a0fbc6c5918dd8f86bf367a6cb5a36e86b4b617d5e265644d69f7c', '3eaf662c429dfe1d2b8a7243348704b9304e79114a525af14b0cc71b3ad64500'],
};

test('three additive editions recover the pinned batch 6 head (b87d7652) without changing existing defaults', () => {
  assert.equal(reviewed.baselineCommit, 'b87d76521a13f38f8f4ce23d80b4472ce4278eb5');
  assert.equal(reviewed.baselineCatalogSha256, baselineCatalogSha256);
  assert.equal(reviewed.baselineRegistrySha256, baselineRegistrySha256);
  assert.equal(digest(previous), baselineCatalogSha256);
  assert.equal(digest(priorRegistry), baselineRegistrySha256);
  assert.deepEqual(ids, expectedIds);
  assert.deepEqual(reviewed.additions.map(a => [a.grade, a.topicId, a.slug]), mappings);
  assert.deepEqual(Object.keys(PINS), ids);
  assert.equal(new Set(reviewed.additions.flatMap(a => a.pdfIds)).size, 9);
  assert.equal(new Set(reviewed.additions.flatMap(a => a.edition.levels.map(l => l.pdfSha256))).size, 9);
  const expectedSsr = structuredClone(raw);
  expectedSsr.config.pdfBase = 'https://static.wixstatic.com/ugd/d8e7ad_';
  assert.deepEqual(catalog, expectedSsr);
  assert.equal(receipt.status, 'REVIEWED_MEDIA_SITE_CANDIDATE_NOT_PUBLISHED');
  assert.equal(receipt.sitePublicationClaimed, false);
  assert.deepEqual(receipt.scope, { packages: 3, pdfs: 9, pages: 73, landingRoutes: 3 });
  assert.equal(batch07Registry.editions.length, priorRegistry.editions.length + 3);
  assert.deepEqual(batch07Registry.editions.slice(0, -3), priorRegistry.editions);
  assert.deepEqual(batch07Registry.editions.slice(-3), reviewed.additions.map(a => a.edition));
  assert.equal(raw.grades.flatMap((g: any) => g.topics.flatMap((t: any) => t.levels)).length, 976);
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
    
    assert.ok(proof.reviewReceipts.every((r: any) => r.path === undefined
      ? /external Codex workspace file, cited by hash/.test(r.role) && /^[0-9a-f]{64}$/.test(r.sha256)
      : new RegExp(`^reports/ANTIGRAVITY-(INDEPENDENT|DELTA)-${proof.sheetId}(-r0[0-9])?-2026111[67]/(review|numbers-blind)\\.json$`).test(r.path)));
    assert.match(proof.reviewReceipts[0].role, /^original (independent )?review/);
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

test('three landing routes add only reviewed PDF copy and preserve their complete batch 6 data', () => {
  assert.equal(reviewed.landingDeltas.length, 3);
  const slugs = [...new Set(reviewed.additions.map(a => a.slug))].sort();
  assert.deepEqual(reviewed.landingDeltas.map(d => d.slug).sort(), slugs);
  for (const delta of reviewed.landingDeltas) {
    assert.ok(delta.slug);
    const slug = delta.slug;
    const page = read(`headless/astro-poc/src/data/topic-pages/${slug}.json`);
    const restored = beforeBatch07Copy(slug, page);
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
  const reduced = reviewed.additions.filter(a => a.sheetId === 'G9-LNM-01');
  assert.equal(reduced.length, 1);
  assert.ok(reduced.every(a => a.track === 'ט_מצומצמת' && a.edition.label.includes('ט׳ מצומצמת')));
  const lnm = loadTopicPage('linear-function-grade-9')!;
  assert.match(lnm.sections.at(-1)!.heading ?? '', /ט׳ מצומצמת/);
  assert.ok(reviewed.additions.filter(a => a.sheetId !== 'G9-LNM-01').every(a => !a.edition.label.includes('מצומצמת')));
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
  badCatalog.grades.find((g: any) => g.grade === 9).topics.find((t: any) => t.id === 34).levels[0].pdfId = 'changed-old-link';
  assert.throws(() => beforeBatch07Catalog(badCatalog));
  const substituted = structuredClone(raw);
  substituted.grades.find((g: any) => g.grade === 9).topics.find((t: any) => t.id === 34)
    .editions.at(-1).levels[0].sourceSha256 = '0'.repeat(64);
  assert.throws(() => beforeBatch07Catalog(substituted));
  const registryDuplicate = structuredClone(registry);
  registryDuplicate.editions.push(structuredClone(reviewed.additions[0].edition));
  assert.throws(() => beforeBatch07Registry(registryDuplicate));
  const registryAltered = structuredClone(registry);
  registryAltered.editions.find((e: any) => e.editionId === ids.at(-1)).levels[0].pdfId = 'changed-pdf-id';
  assert.throws(() => beforeBatch07Registry(registryAltered));
  for (const destinationId of [33, 35]) {
    const moved = structuredClone(raw);
    const grade = moved.grades.find((g: any) => g.grade === 9);
    const source = grade.topics.find((t: any) => t.id === 34);
    const destination = grade.topics.find((t: any) => t.id === destinationId);
    const misplaced = source.editions.pop();
    assert.equal(misplaced.editionId, 'ms-20261117-lnm-01-r1');
    if (!source.editions.length) {
      delete source.editions;
      delete source.defaultEditionId;
    }
    destination.editions = [...(destination.editions || []), misplaced];
    assert.throws(() => beforeBatch07Catalog(moved), `LNM-01 must not move from 9/34 to 9/${destinationId}`);
  }
  for (const destinationId of [30, 23]) {
    const moved = structuredClone(raw);
    const grade = moved.grades.find((g: any) => g.grade === 7);
    const source = grade.topics.find((t: any) => t.id === 22);
    const destination = grade.topics.find((t: any) => t.id === destinationId);
    const misplaced = source.editions.pop();
    assert.equal(misplaced.editionId, 'ms-20261117-alg-05-r1');
    if (!source.editions.length) {
      delete source.editions;
      delete source.defaultEditionId;
    }
    destination.editions = [...(destination.editions || []), misplaced];
    assert.throws(() => beforeBatch07Catalog(moved), assert.AssertionError, `ALG-05 must not move from 7/22 to 7/${destinationId} on the shared page`);
  }
  const page = read('headless/astro-poc/src/data/topic-pages/linear-function-grade-9.json');
  page.sections.at(-1).blocks[0].text += ' כל PDF כולל רמזי ופתרון מלא';
  assert.throws(() => beforeBatch07Copy('linear-function-grade-9', page));
  const proofText = JSON.stringify(receipt);
  for (const path of ['/Users/', '/private/', '/root/']) assert.ok(!proofText.includes(path), path);
});
