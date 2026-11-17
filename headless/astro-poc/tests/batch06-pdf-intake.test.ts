import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { loadCatalog } from '../src/lib/catalog/loadCatalog';
import { buildWorksheetHref } from '../src/lib/worksheetLinks';
import { topicWorksheetEditionLinks } from '../src/lib/topicWorksheetEditions';
import { loadTopicPage } from '../src/lib/topicPages';
import {
  beforeBatch06Catalog, beforeBatch06Copy, beforeBatch06Registry,
  reviewedBatch06 as reviewed, reviewedBatch06Ids as ids,
} from './fixtures/batch06-pdf';

const root = new URL('../../../', import.meta.url);
const read = (path: string) => JSON.parse(readFileSync(new URL(path, root), 'utf8'));
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value, null, 2) + '\n').digest('hex');
const raw = read('headless/astro-poc/src/data/catalog.v1.json');
const catalog = loadCatalog();
const previous = beforeBatch06Catalog(raw) as ReturnType<typeof loadCatalog>;
const previousSsr: any = structuredClone(catalog);
for (const addition of reviewed.additions) {
  const topic = previousSsr.grades.find((g: any) => g.grade === addition.grade)
    .topics.find((t: any) => t.id === addition.topicId);
  topic.editions = topic.editions.filter((e: any) => e.editionId !== addition.editionId);
}
const registry = read('headless/catalog/worksheet-editions.v1.json');
const priorRegistry = beforeBatch06Registry(registry);
const receipt = read('docs/batch06-pdf-first-20261117.json');
const expectedIds = ['alg-02', 'alg-04', 'crd-01', 'ine-01', 'fpr-01', 'fsh-01',
  'grd-01', 'pbm-01', 'qfm-01', 'qvl-01', 'smm-01'].map(key => `ms-20261117-${key}-r1`);
const mappings: Array<[number, number, string]> = [
  [7, 29, 'combining-like-terms-grade-7'], [7, 29, 'combining-like-terms-grade-7'],
  [7, 9, 'coordinate-plane-four-quadrants-grade-7'], [8, 52, 'inequalities-grade-8'],
  [9, 12, 'precalculus-functions-graphs-grade-9'], [9, 12, 'precalculus-functions-graphs-grade-9'],
  [9, 36, 'reading-graphs-grade-9'], [9, 10, 'probability-grade-9'],
  [9, 6, 'quadratic-equations-grade-9'], [9, 5, 'quadratic-function-grade-9'],
  [9, 40, 'triangle-similarity-aa-grade-9'],
];

test('eleven additive editions recover the pinned batch 5 baseline without changing defaults', () => {
  assert.equal(reviewed.baselineCommit, '68757e1945b836a2501ff84c1bb198fad90f9108');
  assert.equal(digest(previous), reviewed.baselineCatalogSha256);
  assert.equal(digest(priorRegistry), reviewed.baselineRegistrySha256);
  assert.deepEqual(ids, expectedIds);
  assert.deepEqual(reviewed.additions.map(a => [a.grade, a.topicId, a.slug]), mappings);
  assert.equal(receipt.status, 'REVIEWED_MEDIA_SITE_CANDIDATE_NOT_PUBLISHED');
  assert.equal(receipt.sitePublicationClaimed, false);
  assert.deepEqual(receipt.scope, { packages: 11, pdfs: 33, pages: 241, subitems: 880, landingRoutes: 9 });
  assert.equal(registry.editions.length, priorRegistry.editions.length + 11);
  assert.deepEqual(registry.editions.slice(0, -11), priorRegistry.editions);
  assert.deepEqual(registry.editions.slice(-11), reviewed.additions.map(a => a.edition));
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
    assert.deepEqual(edition.levels.map(l => [l.key, l.viewerLevel]), [['a', 'A'], ['b', 'B'], ['c', 'E']]);
    assert.deepEqual(edition.levels.map(l => l.worksheetId),
      ['a', 'b', 'c'].map(key => `ms-${addition.sheetId.toLowerCase()}-${key}-r1`));
    assert.equal(new Set(edition.levels.map(l => l.pdfId)).size, 3);
    assert.ok(edition.levels.every(l => !Object.hasOwn(l, 'ramzi')));

    const proof = receipt.packages[index];
    assert.equal(proof.sheetId, addition.sheetId);
    assert.equal(proof.editionId, addition.editionId);
    assert.equal(proof.author, 'Claude (Anthropic)');
    assert.equal(proof.isDefault, false);
    assert.equal(proof.reviewVerdict, 'PASS_STUDENT_PDF_ESSENTIALS');
    assert.match(proof.originalReviewer, /Google Antigravity/);
    assert.equal(proof.reviewReceipts.length, 1);
    assert.ok(proof.reviewReceipts.every((r: any) => !r.path.startsWith('/') && /^[0-9a-f]{64}$/.test(r.sha256)));
    assert.deepEqual(proof.levels.map((l: any) => [l.key, l.pdfId, l.pdfSha256]),
      addition.edition.levels.map(l => [l.key, l.pdfId, l.pdfSha256]));

    for (const level of edition.levels) {
      const downloads = proof.levels.find((p: any) => p.key === level.key).downloadChecks;
      assert.equal(downloads.length, 2);
      assert.ok(downloads.every((d: any) => d.status === 200 && d.matchesFrozenPdf && d.sha256 === level.pdfSha256));
      assert.equal(buildWorksheetHref({ catalog, grade: addition.grade, topic, editionId: addition.editionId, levelKey: level.key }),
        `https://static.wixstatic.com/ugd/d8e7ad_${level.pdfId}.pdf`);
    }

    const back = `/worksheets?grade=${addition.grade}&topic=${addition.topicId}`;
    const groups = topicWorksheetEditionLinks(catalog, addition.grade, addition.topicId, back);
    const priorIds = addition.baselineEditionIds;
    const selectedId = oldTopic.defaultEditionId ?? 'legacy';
    const topicAdditions = reviewed.additions.filter(a => a.grade === addition.grade && a.topicId === addition.topicId);
    assert.deepEqual(groups.map(g => g.editionId),
      [selectedId, ...priorIds.filter(id => id !== selectedId), ...topicAdditions.map(a => a.editionId)]);
    const oldGroupCount = priorIds.length + 1;
    assert.deepEqual(groups.slice(0, oldGroupCount), topicWorksheetEditionLinks(previousSsr, addition.grade, addition.topicId, back));
    assert.deepEqual(groups.find(g => g.editionId === addition.editionId)!.levels.map(l => l.key), ['a', 'b', 'c']);
  }
});

test('nine landing routes append only the exact reviewed copy and preserve their complete batch 5 data', () => {
  assert.equal(reviewed.landingDeltas.length, 9);
  const slugs = [...new Set(reviewed.additions.map(a => a.slug))].sort();
  assert.deepEqual(reviewed.landingDeltas.map(d => d.slug).sort(), slugs);
  for (const delta of reviewed.landingDeltas) {
    const page = read(`headless/astro-poc/src/data/topic-pages/${delta.slug}.json`);
    const restored = beforeBatch06Copy(delta.slug, page);
    assert.equal(digest(restored), delta.baselineSha256, `${delta.slug}: exact previous page`);
    assert.ok(delta.fields.every((field: any) => field.path.length === 1
      && ['sections', 'bodyFlow', 'updatedLine', 'updatedLinePlacement'].includes(field.path[0])));
    const loaded = loadTopicPage(delta.slug)!;
    const sections = loaded.sections.filter(section => section.heading === delta.appendedSection.heading);
    assert.equal(sections.length, 1);
    assert.deepEqual(sections[0].blocks.map(block => block.text), delta.appendedSection.blocks.map((block: any) => block.text));
    assert.ok(sections[0].blocks.some(block => /רמה א׳/.test(block.text ?? '')));
    assert.ok(sections[0].blocks.some(block => /רמה ב׳/.test(block.text ?? '')));
    assert.ok(sections[0].blocks.some(block => /מצוינות/.test(block.text ?? '')));
    assert.ok(sections[0].blocks.every(block => !/רמה ג׳|פתרונות מפורטים|רמזים|\//.test(block.text ?? '')));
  }
  const reduced = reviewed.additions.filter(a =>
    ['G9-GRD-01', 'G9-PBM-01', 'G9-QFM-01', 'G9-QVL-01', 'G9-SMM-01'].includes(a.sheetId));
  assert.equal(reduced.length, 5);
  assert.ok(reduced.every(a => a.track === 'ט_מצומצמת' && a.edition.label.includes('ט׳ מצומצמת')));
});
