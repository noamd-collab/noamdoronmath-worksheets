import { beforeNovember21Copy } from './fixtures/middle-090-091-094';
import { expectedElementaryPrintTopics } from './fixtures/elementary-print-topics';
import { beforeExtra15Catalog, beforeExtra15Registry } from './fixtures/extra15-pdf';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { loadCatalog } from '../src/lib/catalog/loadCatalog';
import { buildWorksheetHref } from '../src/lib/worksheetLinks';
import { topicWorksheetEditionLinks } from '../src/lib/topicWorksheetEditions';
import { buildTeacherCatalog } from '../scripts/build-teacher-catalog.mjs';
import { buildTeacherLandingCatalog, getTeacherLandingScope } from '../src/lib/teacherLandingCatalog';
import { collectViewerPdfIds } from '../scripts/sync-github-static.mjs';
import { loadTopicPage, extractJsonLdFaq, synthesizeBodyFlow } from '../src/lib/topicPages';
import { beforeSaoWpcCatalog, beforeSaoWpcCopy, reviewedSaoWpc as reviewed, reviewedSaoWpcIds as ids } from './fixtures/sao-wpc-pdf';
import { beforeBatch05Copy, reviewedBatch05 } from './fixtures/batch05-pdf';
import { beforeReviewedRamziActivation } from './helpers/beforeReviewedRamziActivation';
import { catalogBeforeCorrections } from './fixtures/middle-090-091-094';

const require = createRequire(import.meta.url);
const { loadIndexCatalog } = require('../../../scripts/lib/headless-catalog.cjs');
const { buildLearningCatalog } = require('../../../scripts/build-learning-catalog.cjs');
const { loadRamziActivationEvidence } = require('../../../scripts/lib/worksheet-ramzi-activation.cjs');
const root = new URL('../../../', import.meta.url);
const read = (path: string) => JSON.parse(readFileSync(new URL(path, root), 'utf8'));
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value, null, 2) + '\n').digest('hex');
const registry = read('headless/catalog/worksheet-editions.v1.json');
const priorRegistry = beforeExtra15Registry(registry);
const catalog = beforeReviewedRamziActivation(loadCatalog());
const corrected = catalogBeforeCorrections(catalog);
const rawCatalog = beforeReviewedRamziActivation(read('headless/astro-poc/src/data/catalog.v1.json'));
const previous = beforeExtra15Catalog(rawCatalog);
const receipt = read('docs/sao-wpc-pdf-first-20261115.json');

test('six exact additional PDFs preserve every preceding catalog and registry byte', () => {
  assert.equal(rawCatalog.config.pdfBase, 'https://www.noamdoronmath.co.il/_files/ugd/d8e7ad_');
  assert.equal(catalog.config.pdfBase, 'https://static.wixstatic.com/ugd/d8e7ad_');
  const expectedSsr = structuredClone(rawCatalog);
  expectedSsr.elementaryPrintTopics = expectedElementaryPrintTopics;
  expectedSsr.config.pdfBase = 'https://static.wixstatic.com/ugd/d8e7ad_';
  assert.deepEqual(catalog, expectedSsr, 'SSR adds the reviewed elementary print topics and normalizes the CDN base');
  assert.equal(digest(beforeExtra15Catalog(read('headless/astro-poc/src/data/catalog.v1.json'))), reviewed.baselineCatalogSha256);
  assert.equal(digest(priorRegistry), reviewed.baselineRegistrySha256);
  assert.deepEqual(registry.editions.filter((e: any) => ids.includes(e.editionId)), reviewed.additions.map(a => a.edition));
  assert.equal(new Set(reviewed.additions.flatMap(a => a.pdfIds)).size, 6);
  assert.deepEqual(reviewed.additions.map(a => [a.grade, a.topicId]), [[9, 38], [7, 41]]);
  assert.equal(receipt.review.sourceSubitemsReviewedByIndependentPeers, 144); assert.equal(receipt.review.sampledPages, 22);
  assert.equal(receipt.review.totalPages, 42); assert.match(receipt.review.nativeExportStatus, /N4\/K22 HOLD/);
  assert.equal(receipt.sitePublicationClaimed, false);
  for (const a of reviewed.additions) {
    const topic = catalog.grades.find(g => g.grade === a.grade)!.topics.find(t => t.id === a.topicId)!;
    const edition = topic.editions!.find(e => e.editionId === a.editionId)!;
    const proof = receipt.packages.find((p: any) => p.editionId === a.editionId);
    assert.equal(topic.defaultEditionId, 'legacy'); assert.equal(a.edition.isDefault, false);
    assert.equal(edition.publicationMode, 'pdf-only'); assert.equal(edition.routing.usesViewer, false);
    assert.equal(edition.routing.aiHintShown, false);
    const groups = topicWorksheetEditionLinks(catalog, a.grade, a.topicId, `/worksheets?grade=${a.grade}&topic=${a.topicId}`);
    const laterIds = reviewedBatch05.additions
      .filter(later => later.grade === a.grade && later.topicId === a.topicId).map(later => later.editionId);
    const previousGroups = topicWorksheetEditionLinks(previous, a.grade, a.topicId, `/worksheets?grade=${a.grade}&topic=${a.topicId}`).filter(g => g.editionId !== 'legacy');
    assert.deepEqual(groups.map(g => g.editionId), [...previousGroups.map(g => g.editionId), a.editionId, ...laterIds]);
    assert.deepEqual(groups.filter(g => g.editionId !== a.editionId).map(g => g.editionId),
      [...previousGroups.map(g => g.editionId), ...laterIds]);
    for (const [index, group] of previousGroups.entries()) assert.deepEqual(groups[index], group);
    assert.deepEqual(groups[previousGroups.length].levels.map(l => l.href), a.pdfIds.map(id => `${catalog.config.pdfBase}${id}.pdf`));
    for (const level of edition.levels) {
      assert.equal(buildWorksheetHref({ catalog, grade: a.grade, topic, editionId: a.editionId, levelKey: level.key }), `${catalog.config.pdfBase}${level.pdfId}.pdf`);
      assert.equal(Object.hasOwn(level, 'ramzi'), false);
      assert.equal(level.viewerLevel, ({ a: 'A', b: 'B', c: 'E' } as any)[level.key]);
      const evidence = proof.levels.find((l: any) => l.key === level.key);
      for (const field of ['pdfId', 'pdfSha256', 'sourceSha256', 'nativeExportSha256', 'worksheetId', 'revision']) assert.equal((level as any)[field], evidence[field]);
      assert.equal(evidence.downloadChecks.length, 2, 'two actual media routes were read back');
      assert.equal(evidence.downloadChecks[0].sha256, level.pdfSha256);
      assert.equal(evidence.downloadChecks[0].status, 200);
    }
  }
});

test('teacher sources, learning regeneration and viewer dependencies reject all six PDF-only additions', () => {
  assert.deepEqual(buildTeacherCatalog(corrected), buildTeacherCatalog(previous));
  const teacher = buildTeacherLandingCatalog(corrected);
  assert.deepEqual(teacher, buildTeacherLandingCatalog(previous));
  for (const a of reviewed.additions) {
    assert.equal(getTeacherLandingScope({ grade: a.grade, topic: a.topicId, edition: a.editionId }, teacher), null);
    assert.ok(getTeacherLandingScope({ grade: a.grade, topic: a.topicId }, teacher));
  }
  assert.deepEqual(collectViewerPdfIds(corrected), collectViewerPdfIds(previous));
  for (const pdfId of reviewed.additions.flatMap(a => a.pdfIds)) assert.ok(!collectViewerPdfIds(corrected).includes(pdfId));
  const raw = loadIndexCatalog();
  const activation = loadRamziActivationEvidence(new URL('headless/catalog/', root).pathname, new URL('headless/astro-poc/public/', root).pathname);
  assert.deepEqual(buildLearningCatalog(raw, registry, activation), buildLearningCatalog(raw, priorRegistry, activation));
});


test('SAO/WPC copy preserves old CTAs, visible flow, FAQ and scoped PDF availability', () => {
  for (const a of reviewed.additions) {
    const current = read(`headless/astro-poc/src/data/topic-pages/${a.slug}.json`);
    const restored = beforeSaoWpcCopy(a.slug, beforeBatch05Copy(a.slug, current));
    const raw = beforeNovember21Copy(a.slug, current);
    const page = beforeNovember21Copy(a.slug, loadTopicPage(a.slug));
    assert.equal(raw.updatedLine, a.slug === 'equations-both-sides-word-problems-grade-7'
      ? 'נועם דורון מתמטיקה · עודכן 17.11.2026' : 'נועם דורון מתמטיקה · עודכן 15.11.2026');
    assert.deepEqual(raw.catalogCta, restored.catalogCta); assert.deepEqual(raw.catalogCtas, restored.catalogCtas);
    assert.equal(raw.h1, restored.h1); assert.equal(raw.title, restored.title);
    const oldDelta = reviewed.landingDeltas.find(d => d.slug === a.slug)!;
    const laterDelta = reviewedBatch05.landingDeltas.find(d => d.slug === a.slug);
    const laterSection = laterDelta?.appendedSection;
    const added = raw.sections.find((section: any) =>
      JSON.stringify(section) === JSON.stringify(oldDelta.appendedSection));
    const flow = synthesizeBodyFlow(page);
    const plain = (text: string | undefined) => text?.replace(/[\u2066-\u2069]/g, '');
    assert.equal(flow.filter(b => b.type === 'heading' && plain(b.text) === added.heading).length, 1);
    assert.equal(flow.filter(b => b.type === 'paragraph' && plain(b.text) === added.blocks[0].text).length, 1);
    const expectedOldFlow = structuredClone(restored.bodyFlow);
    for (const field of reviewed.landingDeltas.find(d => d.slug === a.slug)!.fields) {
      if (field.path[0] === 'bodyFlow') expectedOldFlow[Number(field.path[1])][String(field.path[2])] = field.after;
    }
    const currentFlow = reviewedBatch05.landingDeltas.find(d => d.slug === a.slug)?.fields
      .find(field => field.path[0] === 'bodyFlow');
    const laterFlow = currentFlow
      ? currentFlow.after.slice(currentFlow.before.length) : [];
    assert.deepEqual(raw.bodyFlow, [...expectedOldFlow, ...oldDelta.appendedFlow, ...laterFlow]);
    if (laterSection) {
      assert.equal(raw.sections.filter((section: any) => JSON.stringify(section) === JSON.stringify(laterSection)).length, 1);
    }
    assert.deepEqual(extractJsonLdFaq(raw.jsonLd), extractJsonLdFaq(restored.jsonLd));
    assert.match(added.blocks[0].text, /PDF עם תשובות בסוף/);
  }
  const wpc = loadTopicPage('equations-both-sides-word-problems-grade-7');
  assert.deepEqual(wpc.catalogCtas.map(c => c.catalogTopicId), [41, 40, 39]);
  const wpcDelta = reviewed.landingDeltas.find(d => d.slug === 'equations-both-sides-word-problems-grade-7')!;
  const wpcSection = wpc.sections.find(section => section.heading === wpcDelta.appendedSection.heading)!;
  assert.match(wpcSection.blocks[0].text!, /פתרון ובדיקת התאמת התוצאה להקשר/);
  const sao = loadTopicPage('triangle-sides-angles-grade-9');
  assert.match(sao.sections.at(-1)!.blocks[0].text!, /התרגול ממוקד ביחסי הסדר/);
  assert.match(sao.sections[2].blocks[1].text!, /בדפים שנפתחים עם רמזי אפשר לקבל רמזים/);
  const graph = sao.jsonLd['@graph'] as Array<{ description: string }>;
  assert.equal(graph[0].description, sao.description); assert.equal(graph[1].description, sao.description);
});
test('review reversal rejects legacy drift, unbound PDF and false hint claims', () => {
  assert.doesNotThrow(() => beforeExtra15Catalog(rawCatalog));
  const bad = structuredClone(rawCatalog);
  bad.grades.find((g: any) => g.grade === 9).topics.find((t: any) => t.id === 38).levels[0].pdfId = 'unreviewed-old-link';
  assert.throws(() => beforeExtra15Catalog(bad), assert.AssertionError);
  const moved = structuredClone(rawCatalog);
  moved.grades.find((g: any) => g.grade === 7).topics.find((t: any) => t.id === 41).editions[0].levels[0].pdfId = 'wrong-new-pdf';
  assert.throws(() => beforeExtra15Catalog(moved), assert.AssertionError);
  const page = read('headless/astro-poc/src/data/topic-pages/triangle-sides-angles-grade-9.json');
  page.description += ' כל PDF כולל רמזי';
  assert.throws(() => beforeSaoWpcCopy('triangle-sides-angles-grade-9', page));
});
