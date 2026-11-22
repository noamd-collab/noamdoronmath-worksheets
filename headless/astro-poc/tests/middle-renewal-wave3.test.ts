import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { loadCatalog } from '../src/lib/catalog/loadCatalog';
import { topicWorksheetEditionLinks } from '../src/lib/topicWorksheetEditions';
import { topicPageCatalogTopicIds, topicPagePdfParts } from '../src/lib/topicStructuredData';
import { loadTopicPage } from '../src/lib/topicPages';
import { catalogBeforePackages, copyBeforeRelease, registryBeforeRelease, eighthRenew, seventhRenew, sixthRenew, fifthRenew, fourthRenew, thirdRenew } from './fixtures/middle-090-091-094';

const root = new URL('../../../', import.meta.url);
const read = (path: string) => JSON.parse(readFileSync(new URL(path, root), 'utf8'));
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value, null, 2) + '\n').digest('hex');

test('five reviewed statistics and equation packages preserve the previous catalog and link all 15 frozen PDFs', () => {
  const releases = thirdRenew.packages;
  assert.deepEqual(releases.map(p => p.number), [63,65,83,84,85]);
  const catalog = catalogBeforePackages(catalogBeforePackages(catalogBeforePackages(catalogBeforePackages(catalogBeforePackages(read('headless/catalog/catalog.v1.json'), eighthRenew.packages), seventhRenew.packages), sixthRenew.packages), fifthRenew.packages), fourthRenew.packages);
  const registry = registryBeforeRelease(registryBeforeRelease(registryBeforeRelease(registryBeforeRelease(registryBeforeRelease(read('headless/catalog/worksheet-editions.v1.json'), eighthRenew.packages.map(p => p.edition)), seventhRenew.packages.map(p => p.edition)), sixthRenew.packages.map(p => p.edition)), fifthRenew.packages.map(p => p.edition)), fourthRenew.packages.map(p => p.edition));
  assert.equal(digest(catalogBeforePackages(catalog, releases)), thirdRenew.baselineCatalogSha256);
  assert.equal(digest(registryBeforeRelease(registry, releases.map(p => p.edition))), thirdRenew.baselineRegistrySha256);
  const pdfs = new Set<string>();
  for (const pack of releases) {
    const raw = read('headless/astro-poc/src/data/topic-pages/' + pack.slug + '.json');
    assert.equal(digest(copyBeforeRelease(pack.slug, raw, thirdRenew)), pack.priorPageSha256, pack.slug);
    assert.ok(topicPageCatalogTopicIds(loadTopicPage(pack.slug)).includes(pack.topicId));
    assert.ok(pack.reviewReceipts.length && pack.reviewReceipts.every(r => r.verdict.startsWith('PASS') && /^[a-f0-9]{64}$/.test(r.sha256)));
    assert.deepEqual(pack.waivers, []);
    assert.ok(pack.skillVersion.startsWith('7.3.3'));
    assert.deepEqual(pack.priorEditionIds, []);
    const links = topicWorksheetEditionLinks(loadCatalog(), pack.grade, pack.topicId, '/' + pack.slug);
    assert.deepEqual(links.map(g => g.editionId), ['legacy', ...pack.priorEditionIds, pack.edition.editionId]);
    const added = links.at(-1)!;
    const parts = topicPagePdfParts(loadCatalog(), pack.grade, [pack.topicId]).parts;
    assert.deepEqual(pack.edition.levels.map(l => [l.key,l.viewerLevel]), [['a','A'],['b','B'],['c','E']]);
    for (const [i,level] of pack.edition.levels.entries()) {
      const file = pack.studentFiles[i];
      assert.ok(file.items > 0 && file.pages > 0);
      assert.equal(level.revision, 1);
      assert.deepEqual(file.downloads.map(d => new URL(d.url).hostname), ['static.wixstatic.com','www.noamdoronmath.co.il']);
      assert.ok(file.downloads.every(d => d.status === 200 && d.match && d.sha256 === level.pdfSha256));
      assert.equal(added.levels[i].href, file.downloads[0].url);
      assert.ok(parts.some(p => p.contentUrl === file.downloads[0].url));
      pdfs.add(level.pdfId);
    }
  }
  assert.equal(pdfs.size, 15);
});
