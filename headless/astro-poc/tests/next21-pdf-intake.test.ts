import { beforeNovember21Catalog } from './fixtures/middle-090-091-094';
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
import { beforeNext21Catalog, beforeNext21Registry, beforeNext21Copy,
  reviewedNext21 as reviewed, reviewedNext21Ids as ids } from './fixtures/next21-pdf';
import { beforeBatch01Registry } from './fixtures/batch01-pdf';
import { reviewedBatch03 } from './fixtures/batch03-pdf';
import { reviewedBatch09 } from './fixtures/batch09-pdf';
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
const previous = beforeNext21Catalog(raw) as ReturnType<typeof loadCatalog>;
const registry = read('headless/catalog/worksheet-editions.v1.json');
const priorRegistry = beforeNext21Registry(registry);
const receipt = read('docs/next21-pdf-first-20261115.json');
const plain = (s: string) => s.replace(/[\u2066-\u2069]/g, '');

test('seven fixed mappings add twenty-one frozen PDFs and recover the independently pinned canonical451e baseline', () => {
  // Read independently from exact canonical git blobs before implementation.
  const baselineCatalog = '3f344c73b5f0f678d9258c243049534b47b2949dcde8d7a2be915c927479a010';
  const baselineRegistry = '207736707d3e8de70ac01407ba4b38bad0f5a1e43d166ffc0c05392ed6489b9d';
  assert.equal(reviewed.baselineCommit, '45146993b11782a0554cc29061d6d9adc96c6a1f');
  assert.equal(reviewed.baselineCatalogSha256, baselineCatalog);
  assert.equal(reviewed.baselineRegistrySha256, baselineRegistry);
  assert.equal(digest(previous), baselineCatalog);
  assert.equal(digest(priorRegistry), baselineRegistry);
  assert.deepEqual(reviewed.additions.map(a => [a.grade, a.topicId]), [[7, 19], [7, 45], [7, 42], [7, 43], [7, 6], [9, 33], [7, 31]]);
  assert.deepEqual(ids, ['atq', 'apt', 'pyt', 'pya', 'grw', 'ctm', 'q1g'].map(key => `ms-20261115-${key}-01-r1`));
  assert.equal(new Set(reviewed.additions.flatMap(a => a.pdfIds)).size, 21);
  assert.equal(new Set(reviewed.additions.flatMap(a => a.edition.levels.map(l => l.pdfSha256))).size, 21);
  const afterNext21Registry = beforeBatch01Registry(registry);
  assert.equal(afterNext21Registry.editions.length, 35);
  assert.equal(afterNext21Registry.editions.flatMap((e: any) => e.levels).length, 105);
  assert.equal(priorRegistry.editions.length, 28);
  assert.equal(priorRegistry.editions.flatMap((e: any) => e.levels).length, 84);
  // Editions never add base levels; EQM49 (17.11, +3 levels) and NEW4 (18.11, +12 levels) are the later base topics.
  assert.equal(raw.grades.flatMap((g: any) => g.topics.flatMap((t: any) => t.levels)).length, 991); // NEW4 (18.11): four later base topics, +12 levels; batch 10 topic 9/53, +3
  assert.equal(previous.grades.flatMap((g: any) => g.topics.flatMap((t: any) => t.levels)).length, 973);
  assert.equal(receipt.scope.pages, 137);
  assert.equal(receipt.scope.subitems, 405);
  assert.equal(receipt.sitePublicationClaimed, false);
  assert.deepEqual(registry.editions.filter((e: any) => ids.includes(e.editionId)), reviewed.additions.map(a => a.edition));
});

test('all twenty-one additions have direct PDF routing and exact media/source bindings while every previous choice remains', () => {
  for (const addition of reviewed.additions) {
    const topic = catalog.grades.find(g => g.grade === addition.grade)!.topics.find(t => t.id === addition.topicId)!;
    const edition = topic.editions!.find(e => e.editionId === addition.editionId)!;
    assert.equal(topic.defaultEditionId, 'legacy');
    assert.equal(edition.routing.usesViewer, false);
    assert.equal(edition.routing.aiHintShown, false);
    assert.equal(edition.publicationMode, 'pdf-only');
    const groups = topicWorksheetEditionLinks(catalog, addition.grade, addition.topicId, '/');
    // Batch 03 appends its own series after this one on 9/39 (ITP-01) and 7/6 (POW-01).
    const later = [...reviewedBatch03.additions, ...reviewedBatch09.additions].filter(x => x.grade === addition.grade && x.topicId === addition.topicId).map(x => x.editionId);
    assert.deepEqual(groups.map(g => g.editionId), [addition.editionId, ...later]);
    const earlier = topicWorksheetEditionLinks(previous, addition.grade, addition.topicId, '/').filter(g => g.editionId !== 'legacy');
    assert.deepEqual(groups.slice(0, earlier.length), earlier);
    const proof = receipt.packages.find((p: any) => p.editionId === addition.editionId);
    assert.ok(proof, `${addition.editionId}: public frozen evidence`);
    for (const level of edition.levels) {
      assert.equal(buildWorksheetHref({ catalog, grade: addition.grade, topic, editionId: addition.editionId, levelKey: level.key }), `${catalog.config.pdfBase}${level.pdfId}.pdf`);
      assert.equal(Object.hasOwn(level, 'ramzi'), false);
      for (const forbidden of ['canonicalSourceSha256', 'manifestSha256', 'answerMapSha256', 'wordSourceSha256', 'hintsBundleSha256']) assert.equal(Object.hasOwn(level, forbidden), false);
      const pin = proof.levels.find((p: any) => p.key === level.key);
      for (const field of ['pdfId', 'pdfSha256', 'sourceSha256', 'nativeExportSha256', 'worksheetId', 'revision']) assert.equal(pin[field], (level as any)[field]);
      assert.equal(pin.downloadChecks.length, 2);
      assert.ok(pin.downloadChecks.every((d: any) => d.status === 200 && d.sha256 === level.pdfSha256));
    }
  }
});

test('new PDFs cannot enter previous teacher, learning, viewer or Ramzi banks', () => {
  assert.deepEqual(buildTeacherCatalog(corrected), buildTeacherCatalog(previous));
  const teacher = buildTeacherLandingCatalog(corrected);
  assert.deepEqual(teacher, buildTeacherLandingCatalog(previous));
  for (const addition of reviewed.additions) {
    assert.equal(getTeacherLandingScope({ grade: addition.grade, topic: addition.topicId, edition: addition.editionId }, teacher), null);
    assert.ok(getTeacherLandingScope({ grade: addition.grade, topic: addition.topicId }, teacher));
  }
  assert.deepEqual(collectViewerPdfIds(corrected), collectViewerPdfIds(previous));
  const activation = loadRamziActivationEvidence(new URL('headless/catalog/', root).pathname, new URL('headless/astro-poc/public/', root).pathname);
  assert.deepEqual(buildLearningCatalog(loadIndexCatalog(), registry, activation), buildLearningCatalog(loadIndexCatalog(), priorRegistry, activation));
  const atPublication = beforeReviewedRamziActivation(beforeNovember21Catalog(loadCatalog()));
  for (const topicId of [21, 46]) assert.deepEqual(atPublication.grades.find(g => g.grade === 7)!.topics.find(t => t.id === topicId), previous.grades.find(g => g.grade === 7)!.topics.find(t => t.id === topicId));
});

test('seven scoped landing updates retain titles and CTA order and synchronize visible sections and FAQ schema', () => {
  assert.equal(reviewed.landingDeltas.length, 7);
  for (const delta of reviewed.landingDeltas) {
    const pageRaw = read(`headless/astro-poc/src/data/topic-pages/${delta.slug}.json`);
    const restored = beforeNext21Copy(delta.slug, pageRaw) as any;
    assert.equal(digest(restored), delta.baselineSha256);
    assert.equal(pageRaw.h1, restored.h1); assert.equal(pageRaw.title, restored.title);
    assert.deepEqual(pageRaw.catalogCta, restored.catalogCta);
    assert.deepEqual(pageRaw.catalogCtas, restored.catalogCtas);
    const page = loadTopicPage(delta.slug), added = pageRaw.sections.at(-1), flow = synthesizeBodyFlow(page);
    assert.equal(flow.filter(b => b.type === 'heading' && plain(b.text) === added.heading).length, 1);
    assert.equal(flow.filter(b => b.type === 'paragraph' && plain(b.text) === added.blocks[0].text).length, 1);
    for (const q of extractJsonLdFaq(page.jsonLd)) assert.deepEqual({ question: plain(q.question), answer: plain(q.answer) }, pageRaw.faq.find((f: any) => f.question === plain(q.question)));
    const describedTypes = ['WebPage', 'LearningResource'];
    const described = (page.jsonLd['@graph'] as any[]).filter(node => describedTypes.includes(node['@type']));
    assert.equal(described.length, restored.jsonLd['@graph'].filter((node: any) => describedTypes.includes(node['@type'])).length);
    for (const node of described) assert.equal(node.description, page.description);
  }
  assert.deepEqual(loadTopicPage('area-parallelogram-trapezoid-composite-grade-7').catalogCtas.map(c => c.catalogTopicId), [46, 45]);
  assert.deepEqual(loadTopicPage('patterns-and-graphs-grade-7').catalogCtas.map(c => c.catalogTopicId), [31, 21]);
  assert.match(reviewed.additions.find(a => a.topicId === 33)!.edition.label, /מצומצמ[תם]/);
  assert.match(reviewed.additions.find(a => a.topicId === 19)!.edition.label, /אלכסוניו מאונכים/);
});

test('preservation fences reject changed old links, substituted new provenance, duplicates and unsupported landing claims', () => {
  const old = structuredClone(raw);
  old.grades.find((g: any) => g.grade === 7).topics.find((t: any) => t.id === 19).levels[0].pdfId = 'old-link-changed';
  assert.throws(() => beforeNext21Catalog(old));
  const changed = structuredClone(raw);
  changed.grades.find((g: any) => g.grade === 7).topics.find((t: any) => t.id === 31).editions[0].levels[0].sourceSha256 = '0'.repeat(64);
  assert.throws(() => beforeNext21Catalog(changed));
  const duplicate = structuredClone(registry);
  duplicate.editions.push(structuredClone(reviewed.additions[0].edition));
  assert.throws(() => beforeNext21Registry(duplicate));
  const defaultFlip = structuredClone(registry);
  defaultFlip.editions.find((e: any) => e.editionId === ids[0]).isDefault = true;
  assert.throws(() => beforeNext21Registry(defaultFlip));
  const page = read('headless/astro-poc/src/data/topic-pages/patterns-and-graphs-grade-7.json');
  page.intro += ' כל PDF כולל רמזי ופתרון מלא';
  assert.throws(() => beforeNext21Copy('patterns-and-graphs-grade-7', page));
});
