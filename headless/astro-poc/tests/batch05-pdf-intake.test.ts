import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { loadCatalog } from '../src/lib/catalog/loadCatalog';
import { buildWorksheetHref } from '../src/lib/worksheetLinks';
import { topicWorksheetEditionLinks } from '../src/lib/topicWorksheetEditions';
import { loadTopicPage } from '../src/lib/topicPages';
import { beforeBatch06Catalog, beforeBatch06Registry, reviewedBatch06 } from './fixtures/batch06-pdf';
import { beforeBatch05Catalog, beforeBatch05Copy, beforeBatch05Registry,
  reviewedBatch05 as reviewed, reviewedBatch05Ids as ids } from './fixtures/batch05-pdf';

const root = new URL('../../../', import.meta.url);
const read = (path: string) => JSON.parse(readFileSync(new URL(path, root), 'utf8'));
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value, null, 2) + '\n').digest('hex');
const raw = read('headless/astro-poc/src/data/catalog.v1.json');
const catalog = loadCatalog();
const batch05Catalog: ReturnType<typeof loadCatalog> = structuredClone(catalog);
const previous = beforeBatch05Catalog(raw) as ReturnType<typeof loadCatalog>;
const previousSsr: any = structuredClone(catalog);
for (const addition of reviewedBatch06.additions) {
  const topic = batch05Catalog.grades.find(g => g.grade === addition.grade)!
    .topics.find(t => t.id === addition.topicId)!;
  topic.editions = topic.editions!.filter(e => e.editionId !== addition.editionId);
}
for (const addition of [...reviewed.additions, ...reviewedBatch06.additions]) {
  const topic = previousSsr.grades.find((g: any) => g.grade === addition.grade)
    .topics.find((t: any) => t.id === addition.topicId);
  topic.editions = topic.editions?.filter((e: any) => !ids.includes(e.editionId));
  if (!topic.editions?.length) {
    delete topic.editions;
    delete topic.defaultEditionId;
  }
}
const registry = read('headless/catalog/worksheet-editions.v1.json');
const batch05Registry = beforeBatch06Registry(registry);
const priorRegistry = beforeBatch05Registry(registry);
const receipt = read('docs/batch05-pdf-first-20261117.json');
const expectedIds = ['dat-01', 'wpm-01', 'fnc-01', 'int-01', 'pct-01', 'pyt-01',
  'dis-01', 'eqd-01', 'par-05', 'pow-02', 'wqp-01'].map(key => `ms-20261117-${key}-r1`);
const mappings: Array<[number, number, string]> = [
  [7, 24, 'data-collection-reading-grade-7'], [7, 41, 'equations-both-sides-word-problems-grade-7'],
  [8, 21, 'function-representations-grade-8'], [8, 61, 'interpolation-extrapolation-grade-8'],
  [8, 7, 'percentage-problems-grade-8'], [8, 11, 'pythagorean-theorem-grade-8'],
  [9, 1, 'distributive-law-grade-9'], [9, 1, 'distributive-law-grade-9'],
  [9, 7, 'parallelogram-grade-9'], [9, 16, 'exponent-rules-grade-9'],
  [9, 18, 'word-problems-grade-9'],
];

test('eleven additive editions recover the pinned 46765664 baseline without changing existing defaults', () => {
  assert.equal(reviewed.baselineCommit, '46765664bc70feedadf430c0ba82df5829588a0f');
  assert.equal(digest(previous), reviewed.baselineCatalogSha256);
  assert.equal(digest(priorRegistry), reviewed.baselineRegistrySha256);
  assert.deepEqual(ids, expectedIds);
  assert.deepEqual(reviewed.additions.map(a => [a.grade, a.topicId, a.slug]), mappings);
  assert.equal(receipt.status, 'REVIEWED_MEDIA_SITE_CANDIDATE_NOT_PUBLISHED');
  assert.equal(receipt.sitePublicationClaimed, false);
  assert.deepEqual(receipt.scope, { packages: 11, pdfs: 33, pages: 231, subitems: 976, landingRoutes: 10 });
  assert.equal(batch05Registry.editions.length, priorRegistry.editions.length + 11);
  assert.deepEqual(batch05Registry.editions.slice(0, -11), priorRegistry.editions);
  assert.deepEqual(batch05Registry.editions.slice(-11), reviewed.additions.map(a => a.edition));
  assert.equal(raw.grades.flatMap((g: any) => g.topics.flatMap((t: any) => t.levels)).length, 976);
  assert.equal(previous.grades.flatMap((g: any) => g.topics.flatMap((t: any) => t.levels)).length, 976);

  for (const [index, addition] of reviewed.additions.entries()) {
    const topic = batch05Catalog.grades.find(g => g.grade === addition.grade)!.topics.find(t => t.id === addition.topicId)!;
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
    assert.equal(proof.isDefault, false);
    assert.equal(proof.reviewVerdict, 'PASS_STUDENT_PDF_ESSENTIALS');
    assert.equal(proof.deltaVerdict, 'PASS_DELTA');
    assert.ok(proof.originalReviewer);
    assert.match(proof.deltaReviewer, /Google Antigravity/);
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

test('ten landing routes add only reviewed PDF copy and preserve their complete baseline data', () => {
  assert.equal(reviewed.landingDeltas.length, 10);
  const slugs = [...new Set(reviewed.additions.map(a => a.slug))].sort();
  assert.deepEqual(reviewed.landingDeltas.map(d => d.slug).sort(), slugs);
  for (const delta of reviewed.landingDeltas) {
    assert.ok(delta.slug);
    const slug = delta.slug;
    const page = read(`headless/astro-poc/src/data/topic-pages/${slug}.json`);
    const restored = beforeBatch05Copy(slug, page);
    assert.equal(digest(restored), delta.baselineSha256, `${delta.slug}: exact previous page`);
    const loaded = loadTopicPage(slug)!;
    const sections = loaded.sections.filter(section => section.heading === delta.appendedSection.heading);
    assert.equal(sections.length, 1);
    assert.ok(sections[0].blocks.some(block => /רמה א׳/.test(block.text ?? '')));
    assert.ok(sections[0].blocks.some(block => /רמה ב׳/.test(block.text ?? '')));
    assert.ok(sections[0].blocks.some(block => /מצוינות/.test(block.text ?? '')));
    assert.ok(sections[0].blocks.every(block => !/רמה ג׳|פתרונות מפורטים|רמזים/.test(block.text ?? '')));
  }
  const reduced = reviewed.additions.filter(a => ['G9-DIS-01', 'G9-EQD-01'].includes(a.sheetId));
  assert.equal(reduced.length, 2);
  assert.ok(reduced.every(a => a.track === 'ט_מצומצמת' && a.edition.label.includes('ט׳ מצומצמת')));
  const enrichment = reviewed.additions.find(a => a.sheetId === 'G9-POW-02')!;
  assert.match(enrichment.edition.label, /העשרה/);
  const powersSlug = enrichment.slug;
  if (!powersSlug) throw new Error('G9-POW-02 landing slug missing');
  const powers = loadTopicPage(powersSlug)!;
  assert.ok(powers.sections.some(section => typeof section.heading === 'string' && /PDF/.test(section.heading)
    && section.blocks.some(block => /העשרה/.test(block.text ?? ''))));
});
