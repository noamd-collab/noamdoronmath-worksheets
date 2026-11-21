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
import { beforeNext12Catalog, beforeNext12Registry, beforeNext12Copy,
  reviewedNext12 as reviewed, reviewedNext12Ids as ids } from './fixtures/next12-pdf';
import { beforeNext21Registry } from './fixtures/next21-pdf';
import { reviewedBatch03 } from './fixtures/batch03-pdf';
import { reviewedBatch07 } from './fixtures/batch07-pdf';
import { beforeLandingCorrections } from './fixtures/landing-corrections-20261118';
import { beforeReviewedRamziActivation } from './helpers/beforeReviewedRamziActivation';

const require = createRequire(import.meta.url);
const { loadIndexCatalog } = require('../../../scripts/lib/headless-catalog.cjs');
const { buildLearningCatalog } = require('../../../scripts/build-learning-catalog.cjs');
const { loadRamziActivationEvidence } = require('../../../scripts/lib/worksheet-ramzi-activation.cjs');
const root = new URL('../../../', import.meta.url);
const read = (p: string) => JSON.parse(readFileSync(new URL(p, root), 'utf8'));
const digest = (v: unknown) => createHash('sha256').update(JSON.stringify(v, null, 2) + '\n').digest('hex');
const raw = beforeReviewedRamziActivation(read('headless/astro-poc/src/data/catalog.v1.json'));
const catalog = beforeReviewedRamziActivation(loadCatalog());
const previous = beforeNext12Catalog(raw) as ReturnType<typeof loadCatalog>;
const registry = read('headless/catalog/worksheet-editions.v1.json');
const priorRegistry = beforeNext12Registry(registry);
const receipt = read('docs/next12-pdf-first-20261115.json');
const plain = (s: string) => s.replace(/[\u2066-\u2069]/g, '');

test('four exact editions add twelve verified PDFs and preserve the complete preceding catalog and registry', () => {
  assert.equal(digest(beforeNext12Catalog(raw)), reviewed.baselineCatalogSha256);
  assert.equal(digest(priorRegistry), reviewed.baselineRegistrySha256);
  assert.deepEqual(registry.editions.filter((e: any) => ids.includes(e.editionId)), reviewed.additions.map(a => a.edition));
  assert.deepEqual(reviewed.additions.map(a => [a.grade, a.topicId]), [[9, 39], [9, 19], [7, 18], [7, 44]]);
  assert.equal(new Set(reviewed.additions.flatMap(a => a.pdfIds)).size, 12);
  assert.equal(receipt.scope.pages, 96); assert.equal(receipt.scope.subitems, 288);
  assert.equal(receipt.sitePublicationClaimed, false); assert.equal(receipt.review.preserveDensityReview, true);
  for (const a of reviewed.additions) {
    const topic = catalog.grades.find(g => g.grade === a.grade)!.topics.find(t => t.id === a.topicId)!;
    const edition = topic.editions!.find(e => e.editionId === a.editionId)!;
    const groups = topicWorksheetEditionLinks(catalog, a.grade, a.topicId, '/');
    // Batch 03 appends its own series after this one on 9/39 (ITP-01) and 7/6 (POW-01).
    const later = [...reviewedBatch03.additions, ...reviewedBatch07.additions].filter(x => x.grade === a.grade && x.topicId === a.topicId).map(x => x.editionId);
    assert.deepEqual(groups.map(g => g.editionId), ['legacy', a.editionId, ...later]);
    assert.deepEqual(groups[0], topicWorksheetEditionLinks(previous, a.grade, a.topicId, '/')[0]);
    assert.equal(topic.defaultEditionId, 'legacy'); assert.equal(edition.routing.usesViewer, false);
    assert.equal(edition.routing.aiHintShown, false);
    const proof = receipt.packages.find((p: any) => p.editionId === a.editionId);
    for (const l of edition.levels) {
      assert.equal(buildWorksheetHref({ catalog, grade: a.grade, topic, editionId: a.editionId, levelKey: l.key }), `${catalog.config.pdfBase}${l.pdfId}.pdf`);
      assert.equal(Object.hasOwn(l, 'ramzi'), false);
      const p = proof.levels.find((p: any) => p.key === l.key);
      for (const k of ['pdfId', 'pdfSha256', 'sourceSha256', 'nativeExportSha256', 'worksheetId', 'revision']) assert.equal(p[k], (l as any)[k]);
      assert.equal(p.downloadChecks.length, 2);
      assert.ok(p.downloadChecks.every((d: any) => d.status === 200 && d.sha256 === (l as any).pdfSha256));
    }
  }
  assert.deepEqual(catalog.grades.find(g => g.grade === 9)!.topics.find(t => t.id === 45), previous.grades.find(g => g.grade === 9)!.topics.find(t => t.id === 45));
});

test('all old teacher/learning/viewer sources stay identical and no additional PDF enters those banks', () => {
  assert.deepEqual(buildTeacherCatalog(catalog), buildTeacherCatalog(previous));
  const teacher = buildTeacherLandingCatalog(catalog);
  assert.deepEqual(teacher, buildTeacherLandingCatalog(previous));
  for (const a of reviewed.additions) {
    assert.equal(getTeacherLandingScope({ grade: a.grade, topic: a.topicId, edition: a.editionId }, teacher), null);
    assert.ok(getTeacherLandingScope({ grade: a.grade, topic: a.topicId }, teacher));
  }
  assert.deepEqual(collectViewerPdfIds(catalog), collectViewerPdfIds(previous));
  const activation = loadRamziActivationEvidence(new URL('headless/catalog/', root).pathname, new URL('headless/astro-poc/public/', root).pathname);
  assert.deepEqual(buildLearningCatalog(loadIndexCatalog(), registry, activation), buildLearningCatalog(loadIndexCatalog(), priorRegistry, activation));
});

test('three exact landing deltas preserve old H1/title/primary CTAs and synchronize visible scope/FAQ', () => {
  for (const delta of reviewed.landingDeltas) {
    const rawPage = (beforeLandingCorrections(delta.slug, read(`headless/astro-poc/src/data/topic-pages/${delta.slug}.json`)) as any);
    const restored = beforeNext12Copy(delta.slug, rawPage) as any;
    assert.equal(digest(restored), delta.baselineSha256);
    assert.equal(rawPage.h1, restored.h1); assert.equal(rawPage.title, restored.title);
    assert.deepEqual(rawPage.catalogCta, restored.catalogCta);
    assert.deepEqual(rawPage.catalogCtas.slice(0, restored.catalogCtas.length), restored.catalogCtas);
    const page = beforeLandingCorrections(delta.slug, loadTopicPage(delta.slug));
    const added = rawPage.sections.at(-1);
    const flow = synthesizeBodyFlow(page);
    assert.equal(flow.filter(b => b.type === 'heading' && plain(b.text) === added.heading).length, 1);
    assert.equal(flow.filter(b => b.type === 'paragraph' && plain(b.text) === added.blocks[0].text).length, 1);
    assert.match(plain(page.intro), /בדפים שנפתחים עם רמזי אפשר לקבל רמזים/);
    for (const q of extractJsonLdFaq(page.jsonLd)) {
      assert.deepEqual({ question: plain(q.question), answer: plain(q.answer) }, rawPage.faq.find((f: any) => f.question === plain(q.question)));
    }
    assert.equal((page.jsonLd['@graph'] as any[])[0].description, page.description);
  }
  const shared = loadTopicPage('area-rectangle-perimeter-grade-7');
  assert.equal(shared.catalogCta.catalogTopicId, 44);
  assert.deepEqual(shared.catalogCtas.map(c => c.catalogTopicId), [44, 18]);
  const next12Registry = beforeNext21Registry(registry);
  assert.equal(next12Registry.editions.length, 28);
  assert.equal(next12Registry.editions.flatMap((e: any) => e.levels).length, 84);
});

test('exact reversals reject altered old materials, new media/source substitutions and unsupported copy', () => {
  const altered = structuredClone(raw);
  altered.grades.find((g: any) => g.grade === 9).topics.find((t: any) => t.id === 39).levels[0].pdfId = 'changed-old-link';
  assert.throws(() => beforeNext12Catalog(altered));
  const substituted = structuredClone(raw);
  substituted.grades.find((g: any) => g.grade === 9).topics.find((t: any) => t.id === 39).editions[0].levels[0].sourceSha256 = '0'.repeat(64);
  assert.throws(() => beforeNext12Catalog(substituted));
  const badRegistry = structuredClone(registry); badRegistry.editions.find((e: any) => e.editionId === ids[0]).isDefault = true;
  assert.throws(() => beforeNext12Registry(badRegistry));
  const page = read('headless/astro-poc/src/data/topic-pages/trapezoid-grade-9.json');
  page.intro += ' כל PDF כולל רמזי והדגמה גאומטרית';
  assert.throws(() => beforeNext12Copy('trapezoid-grade-9', page));
});
