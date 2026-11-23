import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { loadCatalog } from '../src/lib/catalog/loadCatalog';
import { topicPageCatalogTopicIds, topicPagePdfParts } from '../src/lib/topicStructuredData';
import { loadTopicPage } from '../src/lib/topicPages';
import { topicWorksheetEditionLinks } from '../src/lib/topicWorksheetEditions';
import { catalogAtRelease, registryAtRelease, beforeNovember21Copy, registryBeforeRelease, three } from './fixtures/middle-090-091-094';

const root = new URL('../../../', import.meta.url);
const read = (path: string) => JSON.parse(readFileSync(new URL(path, root), 'utf8'));
const checksum = (data: unknown) => createHash('sha256').update(JSON.stringify(data, null, 2) + '\n').digest('hex');

test('grade 7 algebra PDFs preserve existing grades, catalog groups and the preceding release', () => {
  const scope = [
    [77, 'r02', 7, 21, 'G7-T123', 'G7-PAT-01', 54, 20],
    [78, 'r02', 7, 30, 'G7-T124', 'G7-CFM-01', 63, 15],
    [79, 'r01', 7, 33, 'G7-T125', 'G7-EQI-01', 92, 22],
  ];
  assert.deepEqual(three.packages.map(p => [
    p.number, p.studentRevision, p.grade, p.topicId, p.producerPackage, p.sheetId,
    p.studentFiles.reduce((sum, f) => sum + f.items, 0), p.studentFiles.reduce((sum, f) => sum + f.pages, 0),
  ]), scope);

  const registry = registryAtRelease(read('headless/catalog/worksheet-editions.v1.json'), three);
  const preWave = registryBeforeRelease(registry, three.packages.map(p => p.edition));
  assert.equal(checksum(preWave), three.baselineRegistrySha256);
  const previous = catalogAtRelease(read('headless/catalog/catalog.v1.json'), three);
  const catalog = loadCatalog();
  const gradeNineReview = previous.grades.find((g: any) => g.grade === 9).topics.find((t: any) => t.id === 21);
  assert.equal(gradeNineReview.noamTopicId, 'G9-T14');
  assert.equal(gradeNineReview.title, 'משולשים מיוחדים — חזרה מכיתה ז׳');
  const reviewLinks = topicWorksheetEditionLinks(catalog, 9, 21, '/worksheets?grade=9&topic=21');
  assert.deepEqual(reviewLinks.map(group => group.editionId), ['legacy']);
  const files = new Set<string>();
  for (const p of three.packages) {
    assert.equal(p.skillVersion, '7.3.3');
    assert.ok(p.reviewReceipts.length);
    assert.deepEqual(p.edition.levels.map(l => [l.key, l.viewerLevel]), [['a','A'], ['b','B'], ['c','E']]);
    const topic = previous.grades.find((g: any) => g.grade === p.grade).topics.find((t: any) => t.id === p.topicId);
    assert.deepEqual(topic.editions.map((e: any) => e.editionId), [p.edition.editionId]);
    const routing = topic.editions[0].routing;
    assert.equal(routing.resolvedNoamPrefix, p.producerPackage);
    assert.equal(routing.usesViewer, false);
    assert.equal(routing.aiHintShown, false);
    delete topic.editions;
    delete topic.defaultEditionId;

    const oldPage = read('headless/astro-poc/src/data/topic-pages/' + p.slug + '.json');
    assert.equal(checksum(beforeNovember21Copy(p.slug, oldPage)), p.priorPageSha256);
    const page = loadTopicPage(p.slug);
    assert.ok(topicPageCatalogTopicIds(page).includes(p.topicId), p.slug);
    const groups = topicWorksheetEditionLinks(catalog, p.grade, p.topicId, '/' + p.slug);
    assert.deepEqual(groups.map(g => g.editionId), ['legacy', p.edition.editionId]);
    assert.equal(groups[0].pdfOnly, false);
    assert.equal(groups[1].pdfOnly, true);
    assert.equal(groups[1].note, 'קובצי PDF להדפסה');
    const parts = topicPagePdfParts(catalog, p.grade, [p.topicId]).parts;
    for (const [i, file] of p.studentFiles.entries()) {
      const level = p.edition.levels[i];
      assert.equal(file.key, level.key);
      assert.equal(file.sha256, level.pdfSha256);
      assert.equal(groups[1].levels[i].href, file.downloads[0].url);
      assert.deepEqual(file.downloads.map(d => new URL(d.url).host), ['static.wixstatic.com','www.noamdoronmath.co.il']);
      assert.ok(file.downloads.every(d => d.match && d.status === 200 && d.sha256 === level.pdfSha256));
      assert.ok(parts.some(part => part.contentUrl === file.downloads[0].url));
      files.add(level.pdfId);
    }
  }
  assert.equal(files.size, 9);
  assert.equal(checksum(previous), three.baselineCatalogSha256);
});
