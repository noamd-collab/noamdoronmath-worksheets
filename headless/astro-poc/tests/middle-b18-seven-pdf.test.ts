import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { loadCatalog } from '../src/lib/catalog/loadCatalog';
import { topicPageCatalogTopicIds, topicPagePdfParts } from '../src/lib/topicStructuredData';
import { loadTopicPage } from '../src/lib/topicPages';
import { topicWorksheetEditionLinks } from '../src/lib/topicWorksheetEditions';
import { registryAtRelease, beforeNovember21Copy, registryBeforeRelease, seven, three } from './fixtures/middle-090-091-094';

const scope = [
  [92, 'r01', 7, 46, 'G7-CPL-01'], [93, 'r02', 7, 47, 'G7-TPV-01'],
  [95, 'r02', 9, 15, 'G9-AGM-01'], [96, 'r02', 9, 17, 'G9-SRT-01'],
  [97, 'r02', 9, 24, 'G9-PYB-01'], [98, 'r01', 9, 25, 'G9-PYA-01'],
  [99, 'r02', 9, 26, 'G9-RSA-01'],
];
const catalog = loadCatalog();
const root = new URL('../../../', import.meta.url);
const read = (path: string) => JSON.parse(readFileSync(new URL(path, root), 'utf8'));
const digest = (data: unknown) => createHash('sha256').update(JSON.stringify(data, null, 2) + '\n').digest('hex');

test('seven middle-school editions serve their exact student PDFs and preserve the preceding registry', () => {
  assert.deepEqual(seven.packages.map(p => [p.number, p.studentRevision, p.grade, p.topicId, p.sheetId]), scope);
  const registry = registryAtRelease(read('headless/catalog/worksheet-editions.v1.json'), three);
  const firstWave = registryBeforeRelease(registry, three.packages.map(p => p.edition));
  assert.equal(digest(firstWave), three.baselineRegistrySha256);
  const beforeSeven = registryBeforeRelease(firstWave, seven.packages.map(p => p.edition));
  assert.equal(digest(beforeSeven), seven.baselineRegistrySha256);
  const files = new Set<string>();
  for (const p of seven.packages) {
    assert.equal(p.skillVersion, '7.3.3');
    assert.equal(p.reviewReceipts.length, 2);
    assert.equal(p.reviewReceipts[1].sha256, '632d99f2053918eda87ed6a68606b4863f19ce64d2fad4009de97bf73aad79b6');
    const prior = read('headless/astro-poc/src/data/topic-pages/' + p.slug + '.json');
    assert.equal(digest(beforeNovember21Copy(p.slug, prior)), p.priorPageSha256, p.slug);
    const page = loadTopicPage(p.slug);
    assert.ok(topicPageCatalogTopicIds(page).includes(p.topicId));
    const edition = p.edition;
    const links = topicWorksheetEditionLinks(catalog, p.grade, p.topicId, '/' + p.slug);
    assert.deepEqual(links.map(row => row.editionId), [edition.editionId], p.sheetId);
    const structured = topicPagePdfParts(catalog, p.grade, [p.topicId]).parts;
    assert.deepEqual(edition.levels.map(l => [l.key, l.viewerLevel]), [['a', 'A'], ['b', 'B'], ['c', 'E']]);
    for (const [index, level] of edition.levels.entries()) {
      const f = p.studentFiles[index];
      assert.equal(f.key, level.key);
      assert.equal(f.sha256, level.pdfSha256);
      assert.equal(f.downloads.length, 2);
      assert.ok(f.downloads.every(d => d.status === 200 && d.match && d.sha256 === f.sha256));
      assert.equal(links[0].levels[index].href, f.downloads[0].url);
      assert.ok(structured.some(part => part.contentUrl === f.downloads[0].url));
      files.add(level.pdfId);
    }
  }
  assert.equal(files.size, 21);
});
