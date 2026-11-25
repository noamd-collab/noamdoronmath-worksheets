import { expectedElementaryPrintTopics } from './fixtures/elementary-print-topics';
import { beforeExtra15Registry } from './fixtures/extra15-pdf';
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
import { beforeEqnSgnFacCatalog, beforeEqnSgnFacCopy, reviewedEqnSgnFac as reviewed, reviewedEqnSgnFacIds as ids } from './fixtures/eqn-sgn-fac-pdf';
import { beforeBatch09Copy, reviewedBatch09 } from './fixtures/batch09-pdf';
import { beforeReviewedRamziActivation } from './helpers/beforeReviewedRamziActivation';
import { beforeRamziActivationCopy } from './fixtures/ramzi-activation-copy-20261119';
import { catalogBeforeCorrections } from './fixtures/middle-090-091-094';

const require = createRequire(import.meta.url);
const { loadIndexCatalog } = require('../../../scripts/lib/headless-catalog.cjs');
const { buildLearningCatalog } = require('../../../scripts/build-learning-catalog.cjs');
const { loadRamziActivationEvidence } = require('../../../scripts/lib/worksheet-ramzi-activation.cjs');
const root = new URL('../../../', import.meta.url);
const read = (path: string) => JSON.parse(readFileSync(new URL(path, root), 'utf8'));
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value, null, 2) + '\n').digest('hex');
const registry = read('headless/catalog/worksheet-editions.v1.json');
const priorRegistry = { ...registry, editions: beforeExtra15Registry(registry).editions.filter((e: any) => !ids.includes(e.editionId)) };
const catalog = beforeReviewedRamziActivation(loadCatalog());
const corrected = catalogBeforeCorrections(catalog);
const rawCatalog = beforeReviewedRamziActivation(read('headless/astro-poc/src/data/catalog.v1.json'));
const previous = beforeEqnSgnFacCatalog(rawCatalog);
const receipt = read('docs/eqn-sgn-fac-pdf-first-20261115.json');

test('nine exact additional PDFs preserve every preceding catalog and registry byte', () => {
  assert.equal(rawCatalog.config.pdfBase, 'https://www.noamdoronmath.co.il/_files/ugd/d8e7ad_');
  assert.equal(catalog.config.pdfBase, 'https://static.wixstatic.com/ugd/d8e7ad_');
  const expectedSsr = structuredClone(rawCatalog);
  expectedSsr.config.pdfBase = 'https://static.wixstatic.com/ugd/d8e7ad_';
  expectedSsr.elementaryPrintTopics = expectedElementaryPrintTopics;
  assert.deepEqual(catalog, expectedSsr, 'SSR preserves the raw catalog and supplies the reviewed elementary links and normalized CDN base');
  assert.equal(digest(beforeEqnSgnFacCatalog(read('headless/astro-poc/src/data/catalog.v1.json'))), reviewed.baselineCatalogSha256);
  assert.equal(digest(priorRegistry), reviewed.baselineRegistrySha256);
  assert.deepEqual(registry.editions.filter((e: any) => ids.includes(e.editionId)), reviewed.additions.map(a => a.edition));
  assert.equal(new Set(reviewed.additions.flatMap(a => a.pdfIds)).size, 9);
  assert.deepEqual(reviewed.additions.map(a => [a.grade, a.topicId]), [[7, 32], [7, 2], [9, 2]]);
  assert.equal(receipt.review.sourceSubitemsReviewed, 234); assert.equal(receipt.review.sampledPages, 27);
  assert.equal(receipt.review.totalPages, 56); assert.equal(receipt.review.wholePackagePass, false);
  assert.equal(receipt.sitePublicationClaimed, false);
  for (const a of reviewed.additions) {
    const topic = catalog.grades.find(g => g.grade === a.grade)!.topics.find(t => t.id === a.topicId)!;
    const edition = topic.editions!.find(e => e.editionId === a.editionId)!;
    const proof = receipt.packages.find((p: any) => p.editionId === a.editionId);
    assert.equal(topic.defaultEditionId, 'legacy'); assert.equal(a.edition.isDefault, false);
    assert.equal(edition.publicationMode, 'pdf-only'); assert.equal(edition.routing.usesViewer, false);
    assert.equal(edition.routing.aiHintShown, false);
    const groups = topicWorksheetEditionLinks(catalog, a.grade, a.topicId, `/worksheets?grade=${a.grade}&topic=${a.topicId}`);
    assert.deepEqual(groups.map(g => g.editionId), ['legacy', a.editionId,
      ...reviewedBatch09.additions.filter(x => x.grade === a.grade && x.topicId === a.topicId).map(x => x.editionId)]);
    assert.deepEqual(groups[0], topicWorksheetEditionLinks(previous, a.grade, a.topicId, `/worksheets?grade=${a.grade}&topic=${a.topicId}`)[0]);
    assert.deepEqual(groups[1].levels.map(l => l.href), a.pdfIds.map(id => `${catalog.config.pdfBase}${id}.pdf`));
    for (const level of edition.levels) {
      assert.equal(buildWorksheetHref({ catalog, grade: a.grade, topic, editionId: a.editionId, levelKey: level.key }), `${catalog.config.pdfBase}${level.pdfId}.pdf`);
      assert.equal(Object.hasOwn(level, 'ramzi'), false);
      assert.equal(level.viewerLevel, ({ a: 'A', b: 'B', c: 'E' } as any)[level.key]);
      const evidence = proof.levels.find((l: any) => l.key === level.key);
      for (const field of ['pdfId', 'pdfSha256', 'sourceSha256', 'nativeExportSha256', 'worksheetId', 'revision']) assert.equal((level as any)[field], evidence[field]);
      assert.equal(evidence.downloadChecks.length, 1, 'one actual CDN route was read back; do not invent three');
      assert.equal(evidence.downloadChecks[0].sha256, level.pdfSha256);
      assert.equal(evidence.downloadChecks[0].status, 200);
    }
  }
});

test('teacher sources, learning regeneration and viewer dependencies reject all nine PDF-only additions', () => {
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

test('landing additions describe actual scope, retain all old CTAs and keep FAQ schema synchronized', () => {
  for (const a of reviewed.additions) {
    const raw = read(`headless/astro-poc/src/data/topic-pages/${a.slug}.json`);
    const page = loadTopicPage(a.slug);
    const restored = beforeEqnSgnFacCopy(a.slug, beforeBatch09Copy(a.slug, raw));
    assert.equal(raw.updatedLine, 'נועם דורון מתמטיקה · עודכן 15.11.2026');
    assert.deepEqual(raw.catalogCta, restored.catalogCta); assert.deepEqual(raw.catalogCtas, restored.catalogCtas);
    assert.equal(raw.h1, restored.h1); assert.equal(raw.title, restored.title);
    const added = (beforeBatch09Copy(a.slug, raw) as any).sections.at(-1);
    const flow = synthesizeBodyFlow(page);
    const plain = (text: string | undefined) => text?.replace(/[\u2066-\u2069]/g, '');
    assert.equal(flow.filter(b => b.type === 'heading' && plain(b.text) === added.heading).length, 1);
    assert.equal(flow.filter(b => b.type === 'paragraph' && plain(b.text) === added.blocks[0].text).length, 1);
    assert.match(added.blocks[0].text, /PDF עם תשובות בסוף/);
    const schemaFaq = extractJsonLdFaq(page.jsonLd);
    assert.deepEqual(schemaFaq.map(f => plain(f.question)), extractJsonLdFaq(restored.jsonLd).map(f => f.question));
    for (const faq of schemaFaq) assert.deepEqual({ question: plain(faq.question), answer: plain(faq.answer) },
      raw.faq.find((f: { question: string }) => f.question === plain(faq.question)));
    for (const faq of schemaFaq) assert.ok(page.faqGroups.flatMap(g => g.items)
      .some(visible => visible.question === faq.question && visible.answer === faq.answer));
  }
  const equations = loadTopicPage('equations-basics-grade-7');
  assert.equal(equations.catalogCta.catalogTopicId, 23);
  assert.deepEqual(equations.catalogCtas.map(c => c.catalogTopicId), [23, 34, 32]);
  assert.match(equations.sections.at(-1)!.blocks[0].text!, /משמעות הפתרון/);
  const factoring = loadTopicPage('factoring-grade-9');
  // The 19.11 copy after the additional Ramzi activation names the series that now opens with Ramzi.
  const factoringBefore = beforeRamziActivationCopy('factoring-grade-9', factoring) as typeof factoring;
  assert.match(factoringBefore.intro, /בדפים שנפתחים עם רמזי אפשר לקבל רמזים/);
  assert.match(factoringBefore.intro.replace(/[\u2066-\u2069]/g, ''), /קובצי ה־PDF הנוספים מיועדים להורדה ולהדפסה/);
  assert.match(factoring.intro.replace(/[\u2066-\u2069]/g, ''), /מהדורת ה־PDF הנוספת נפתחים באתר עם רמזי/);
  const graph = factoring.jsonLd['@graph'] as Array<{ description: string }>;
  assert.equal(graph[0].description, factoring.description);
  assert.equal(graph[1].description, factoring.description);
});

test('reviewed deltas do not hide changed legacy links, wrong topic bindings or invented hint promises', () => {
  const bad = structuredClone(rawCatalog);
  bad.grades.find((g: any) => g.grade === 7).topics.find((t: any) => t.id === 32).levels[0].pdfId = 'unreviewed-old-link';
  assert.throws(() => beforeEqnSgnFacCatalog(bad));
  const moved = structuredClone(rawCatalog);
  moved.grades.find((g: any) => g.grade === 7).topics.find((t: any) => t.id === 32).editions[0].levels[0].pdfId = 'wrong-new-pdf';
  assert.throws(() => beforeEqnSgnFacCatalog(moved));
  const page = read('headless/astro-poc/src/data/topic-pages/factoring-grade-9.json');
  page.intro += ' כל PDF כולל רמזי';
  assert.throws(() => beforeEqnSgnFacCopy('factoring-grade-9', page));
});
