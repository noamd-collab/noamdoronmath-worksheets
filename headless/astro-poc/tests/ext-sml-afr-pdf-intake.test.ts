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
import { beforeExtSmlAfrCatalog, beforeExtSmlAfrRegistry, beforeExtSmlAfrCopy,
  reviewedExtSmlAfr as reviewed, reviewedExtSmlAfrIds as ids } from './fixtures/ext-sml-afr-pdf';
import { beforeBatch05Catalog, beforeBatch05Copy, reviewedBatch05 } from './fixtures/batch05-pdf';

const require = createRequire(import.meta.url);
const { loadIndexCatalog } = require('../../../scripts/lib/headless-catalog.cjs');
const { buildLearningCatalog } = require('../../../scripts/build-learning-catalog.cjs');
const { loadRamziActivationEvidence } = require('../../../scripts/lib/worksheet-ramzi-activation.cjs');
const root = new URL('../../../', import.meta.url);
const read = (p: string) => JSON.parse(readFileSync(new URL(p, root), 'utf8'));
const digest = (v: unknown) => createHash('sha256').update(JSON.stringify(v, null, 2) + '\n').digest('hex');
const raw = read('headless/astro-poc/src/data/catalog.v1.json');
const catalog = loadCatalog();
const previous = beforeExtra15Catalog(raw) as ReturnType<typeof loadCatalog>;
const registry = read('headless/catalog/worksheet-editions.v1.json');
const priorRegistry = beforeExtra15Registry(registry);
const receipt = read('docs/ext-sml-afr-pdf-first-20261115.json');
const plain = (s: string) => s.replace(/[\u2066-\u2069]/g, '');

test('three exact editions add nine verified PDFs and preserve the complete preceding catalog and registry', () => {
  assert.equal(digest(beforeExtra15Catalog(raw)), reviewed.baselineCatalogSha256);
  assert.equal(digest(priorRegistry), reviewed.baselineRegistrySha256);
  assert.deepEqual(registry.editions.filter((e: any) => ids.includes(e.editionId)), reviewed.additions.map(a => a.edition));
  assert.deepEqual(reviewed.additions.map(a => [a.grade, a.topicId]), [[9, 1], [9, 44], [9, 3]]);
  assert.equal(new Set(reviewed.additions.flatMap(a => a.pdfIds)).size, 9);
  assert.equal(receipt.scope.pages, 55); assert.equal(receipt.scope.subitems, 216);
  assert.equal(receipt.sitePublicationClaimed, false); assert.equal(receipt.review.preserveDensityReviewCount, 6);
  for (const a of reviewed.additions) {
    const topic = catalog.grades.find(g => g.grade === a.grade)!.topics.find(t => t.id === a.topicId)!;
    const edition = topic.editions!.find(e => e.editionId === a.editionId)!;
    const groups = topicWorksheetEditionLinks(catalog, a.grade, a.topicId, '/');
    const laterIds = reviewedBatch05.additions
      .filter(later => later.grade === a.grade && later.topicId === a.topicId).map(later => later.editionId);
    const previousIds = topicWorksheetEditionLinks(previous, a.grade, a.topicId, '/').map(g => g.editionId);
    assert.deepEqual(groups.map(g => g.editionId), [...previousIds, a.editionId, ...laterIds]);
    assert.deepEqual(groups.filter(g => g.editionId !== a.editionId).map(g => g.editionId), [...previousIds, ...laterIds]);
    for (const [index, group] of topicWorksheetEditionLinks(previous, a.grade, a.topicId, '/').entries()) {
      assert.deepEqual(groups[index], group);
    }
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

test('four exact landing deltas preserve old H1/title/primary CTAs and synchronize visible scope/FAQ', () => {
  for (const delta of reviewed.landingDeltas) {
    const rawPage = read(`headless/astro-poc/src/data/topic-pages/${delta.slug}.json`);
    const restored = beforeExtSmlAfrCopy(delta.slug, beforeBatch05Copy(delta.slug, rawPage)) as any;
    assert.equal(digest(restored), delta.baselineSha256);
    assert.equal(rawPage.h1, restored.h1); assert.equal(rawPage.title, restored.title);
    assert.deepEqual(rawPage.catalogCta, restored.catalogCta);
    assert.deepEqual(rawPage.catalogCtas.slice(0, restored.catalogCtas.length), restored.catalogCtas);
    const page = loadTopicPage(delta.slug);
    const sectionsChange = delta.fields.find(field => field.path[0] === 'sections');
    assert.ok(sectionsChange && Array.isArray(sectionsChange.before) && Array.isArray(sectionsChange.after));
    const beforeSections = sectionsChange.before as any[];
    const afterSections = sectionsChange.after as any[];
    const added: any = afterSections.find((section: any) =>
      !beforeSections.some((prior: any) => JSON.stringify(prior) === JSON.stringify(section)));
    assert.ok(added, `${delta.slug}: reviewed section must be present in its delta`);
    const flow = synthesizeBodyFlow(page);
    assert.equal(flow.filter(b => b.type === 'heading' && plain(b.text) === added.heading).length, 1);
    assert.equal(flow.filter(b => b.type === 'paragraph' && plain(b.text) === added.blocks[0].text).length, 1);
    assert.match(plain(page.intro), /בדפים שנפתחים עם רמזי אפשר לקבל רמזים/);
    for (const q of extractJsonLdFaq(page.jsonLd)) {
      assert.deepEqual({ question: plain(q.question), answer: plain(q.answer) }, rawPage.faq.find((f: any) => f.question === plain(q.question)));
    }
    assert.equal((page.jsonLd['@graph'] as any[])[0].description, page.description);
  }
  const secondary = loadTopicPage('difference-of-squares-grade-9');
  assert.equal(secondary.catalogCta.catalogTopicId, 45);
  assert.deepEqual(secondary.catalogCtas.map(c => c.catalogTopicId), [45, 44]);
  assert.equal(registry.editions.filter((e: any) => e.editionId === 'ms-20261115-sml-01-r1').length, 1);
});

test('exact reversals reject altered old materials, new media/source substitutions and unsupported copy', () => {
  assert.doesNotThrow(() => beforeExtra15Catalog(raw));
  const altered = structuredClone(raw);
  altered.grades.find((g: any) => g.grade === 9).topics.find((t: any) => t.id === 44).levels[0].pdfId = 'changed-old-link';
  assert.throws(() => beforeExtra15Catalog(beforeBatch05Catalog(altered)));
  const substituted = structuredClone(raw);
  substituted.grades.find((g: any) => g.grade === 9).topics.find((t: any) => t.id === 1).editions[0].levels[0].sourceSha256 = '0'.repeat(64);
  assert.throws(() => beforeExtra15Catalog(beforeBatch05Catalog(substituted)));
  const badRegistry = structuredClone(registry); badRegistry.editions.find((e: any) => e.editionId === ids[0]).isDefault = true;
  assert.throws(() => beforeExtSmlAfrRegistry(badRegistry));
  const page = read('headless/astro-poc/src/data/topic-pages/binomial-square-grade-9.json');
  page.intro += ' כל PDF כולל רמזי והדגמה גאומטרית';
  assert.throws(() => beforeExtSmlAfrCopy('binomial-square-grade-9', page));
});
