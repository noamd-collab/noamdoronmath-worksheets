import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { loadCatalog } from '../src/lib/catalog/loadCatalog';
import { buildWorksheetHref } from '../src/lib/worksheetLinks';
import { topicWorksheetEditionLinks } from '../src/lib/topicWorksheetEditions';
import { buildTeacherCatalog } from '../scripts/build-teacher-catalog.mjs';
import { buildTeacherLandingCatalog, getTeacherLandingScope } from '../src/lib/teacherLandingCatalog';
import { collectViewerPdfIds } from '../scripts/sync-github-static.mjs';
import { beforeEqnSgnFacCatalog } from './fixtures/eqn-sgn-fac-pdf';
import { beforeBatch01Copy } from './fixtures/batch01-pdf';

const read = (p: string) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'));
const require = createRequire(import.meta.url);
const { loadIndexCatalog } = require('../../../scripts/lib/headless-catalog.cjs');
const { buildLearningCatalog } = require('../../../scripts/build-learning-catalog.cjs');
const { loadRamziActivationEvidence } = require('../../../scripts/lib/worksheet-ramzi-activation.cjs');
const id = 'ms-20261113-par-04-r1';
const pdfs = ['d1af58a5e73745faba0aba254b4e2c6c', 'e957f5b06d514375a1fc32c468a250a1', 'bf58cc24b85643c798c77049ebf619b8'];
const catalog = loadCatalog();
const previous = structuredClone(catalog);
const topic = catalog.grades.find(g => g.grade === 9)!.topics.find(t => t.id === 7)!;
previous.grades.find(g => g.grade === 9)!.topics.find(t => t.id === 7)!.editions = topic.editions!.filter(e => e.editionId !== id);

test('T90 adds exactly the three frozen PDFs while every prior catalog byte remains intact', () => {
  const raw = beforeEqnSgnFacCatalog(read('../src/data/catalog.v1.json'));
  const t = raw.grades.find((g: any) => g.grade === 9).topics.find((t: any) => t.id === 7);
  const additions = t.editions.filter((e: any) => e.editionId === id);
  assert.equal(additions.length, 1);
  assert.equal(createHash('sha256').update(JSON.stringify(additions[0])).digest('hex'),
    'aa6d8b18e75c1af716d4ae06b059831fc27c397cf4fd70bb992afea991a03ed9');
  t.editions = t.editions.filter((e: any) => e.editionId !== id);
  assert.equal(createHash('sha256').update(JSON.stringify(raw, null, 2) + '\n').digest('hex'),
    'd901946264298ca02419cea6bdb2eaee3171c95375d6133024a4ca5afae8c7f7');
  const receipt = read('../../../docs/g9-t90-pdf-first-20261115.json');
  assert.deepEqual(receipt.levels.map((l: any) => l.pdfId), pdfs);
  assert.deepEqual(receipt.counts, { pdfs: 3, pages: 31, subitems: 72, pagesByLevel: { a: 10, b: 10, c: 11 } });
  assert.equal(receipt.review.automatedPass, 24); assert.equal(receipt.review.automatedSkip, 1);
  assert.equal(receipt.review.wholePackagePass, false);
});

test('T90 stays a non-default direct-PDF edition with no teacher, learning, or native activation', () => {
  assert.equal(topic.defaultEditionId, 'legacy');
  const edition = topic.editions!.find(e => e.editionId === id)!;
  assert.equal(edition.publicationMode, 'pdf-only');
  assert.equal(edition.routing.usesViewer, false); assert.equal(edition.routing.aiHintShown, false);
  assert.equal(edition.routing.resolvedNoamPrefix, 'G9-T90');
  const groups = topicWorksheetEditionLinks(catalog, 9, 7, '/worksheets?grade=9&topic=7');
  assert.deepEqual(groups.filter(g => g.editionId !== id), topicWorksheetEditionLinks(previous, 9, 7, '/worksheets?grade=9&topic=7'));
  for (const [i, level] of edition.levels.entries()) {
    assert.equal(buildWorksheetHref({ catalog, grade: 9, topic, editionId: id, levelKey: level.key }), `${catalog.config.pdfBase}${pdfs[i]}.pdf`);
    assert.equal(Object.hasOwn(level, 'ramzi'), false);
  }
  assert.deepEqual(buildTeacherCatalog(catalog), buildTeacherCatalog(previous));
  assert.deepEqual(buildTeacherLandingCatalog(catalog), buildTeacherLandingCatalog(previous));
  assert.equal(getTeacherLandingScope({ grade: 9, topic: 7, edition: id }, buildTeacherLandingCatalog(catalog)), null);
  assert.deepEqual(collectViewerPdfIds(catalog), collectViewerPdfIds(previous));
  assert.ok(pdfs.every(p => !collectViewerPdfIds(catalog).includes(p)));
  const raw = loadIndexCatalog();
  const registry = read('../../catalog/worksheet-editions.v1.json');
  const before = { ...registry, editions: registry.editions.filter((e: any) => e.editionId !== id) };
  const evidence = loadRamziActivationEvidence(new URL('../../catalog/', import.meta.url).pathname, new URL('../public/', import.meta.url).pathname);
  assert.deepEqual(buildLearningCatalog(raw, registry, evidence), buildLearningCatalog(raw, before, evidence));
});

test('the existing parallelogram landing describes the precise T90 scope and retains its canonical identity', () => {
  // Batch 01 later appended the PAR-05 series; reverse exactly that reviewed delta first.
  const page = beforeBatch01Copy('parallelogram-grade-9', read('../src/data/topic-pages/parallelogram-grade-9.json'));
  assert.equal(page.path, '/parallelogram-grade-9'); assert.equal(page.h1, 'מקבילית לכיתה ט׳');
  assert.equal(page.updatedLine, 'נועם דורון מתמטיקה · עודכן 15.11.2026');
  assert.equal(page.title, 'מקבילית לכיתה ט׳ | דפי עבודה במתמטיקה – נועם דורון');
  assert.equal(page.catalogCta.catalogTopicId, 7); assert.equal(page.catalogCta.href, '/worksheets?grade=9&topic=7');
  assert.equal(page.description, 'מקבילית לכיתה ט׳: תכונות הצלעות והזוויות, אלכסונים והוכחות. דפי עבודה ברמות א׳, ב׳ ומצוינות, בחינם וללא הרשמה.');
  assert.equal(page.sections.filter((s: any) => s.heading === 'תרגול נוסף: טרפז שווה־שוקיים — תוצאות מתכונות המקבילית').length, 1);
  assert.equal(page.bodyFlow, undefined);
  for (const entry of page.jsonLd['@graph'].filter((x: any) => ['WebPage', 'LearningResource'].includes(x['@type']))) {
    assert.equal(entry.url, 'https://www.noamdoronmath.co.il/parallelogram-grade-9');
    assert.equal(entry.description, page.description);
  }
});
