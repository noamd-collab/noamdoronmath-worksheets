import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { loadCatalog } from '../src/lib/catalog/loadCatalog';
import { topicWorksheetEditionLinks } from '../src/lib/topicWorksheetEditions';
import { topicPageCatalogTopicIds, topicPagePdfParts } from '../src/lib/topicStructuredData';
import { loadTopicPage } from '../src/lib/topicPages';
import { catalogBeforePackages, copyBeforeRelease, registryBeforeRelease, thirdRenew, nextRenew } from './fixtures/middle-090-091-094';

const root = new URL('../../../', import.meta.url);
const read = (path: string) => JSON.parse(readFileSync(new URL(path, root), 'utf8'));
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value, null, 2) + '\n').digest('hex');

test('reviewed worksheet additions preserve prior editions, hints, and landing copy', () => {
  const releases = nextRenew.packages;
  assert.deepEqual(releases.map(p => p.number), [29,55,56,62,69,70,73,80,82]);
  const catalog = catalogBeforePackages(read('headless/catalog/catalog.v1.json'), thirdRenew.packages);
  const registry = registryBeforeRelease(read('headless/catalog/worksheet-editions.v1.json'), thirdRenew.packages.map(p => p.edition));
  assert.equal(digest(catalogBeforePackages(catalog, releases)), nextRenew.baselineCatalogSha256);
  assert.equal(digest(registryBeforeRelease(registry, releases.map(p => p.edition))), nextRenew.baselineRegistrySha256);
  const pdfs = new Set<string>();
  for (const pack of releases) {
    const raw = read('headless/astro-poc/src/data/topic-pages/' + pack.slug + '.json');
    assert.equal(digest(copyBeforeRelease(pack.slug, raw, nextRenew)), pack.priorPageSha256, pack.slug);
    assert.ok(topicPageCatalogTopicIds(loadTopicPage(pack.slug)).includes(pack.topicId));
    assert.ok(pack.reviewReceipts.length && pack.reviewReceipts.every(r => r.verdict.startsWith('PASS') && /^[a-f0-9]{64}$/.test(r.sha256)));
    assert.deepEqual(pack.waivers.map(w => w.gate), pack.number === 70 ? ['G82-figref'] : []);
    assert.ok(pack.skillVersion.startsWith('7.3.3'));
    assert.deepEqual(pack.priorEditionIds, pack.number === 29 ? ['ms-20261117-grd-01-r1'] : []);
    const links = topicWorksheetEditionLinks(loadCatalog(), pack.grade, pack.topicId, '/' + pack.slug);
    assert.deepEqual(links.map(g => g.editionId), ['legacy', ...pack.priorEditionIds, pack.edition.editionId]);
    const added = links.at(-1)!;
    const parts = topicPagePdfParts(loadCatalog(), pack.grade, [pack.topicId]).parts;
    assert.deepEqual(pack.edition.levels.map(l => [l.key,l.viewerLevel]), [['a','A'],['b','B'],['c','E']]);
    for (const [i,level] of pack.edition.levels.entries()) {
      const file = pack.studentFiles[i];
      assert.ok(file.items > 0 && file.pages > 0);
      assert.equal(level.revision, pack.number === 29 ? 2 : 1);
      assert.deepEqual(file.downloads.map(d => new URL(d.url).hostname), ['static.wixstatic.com','www.noamdoronmath.co.il']);
      assert.ok(file.downloads.every(d => d.status === 200 && d.match && d.sha256 === level.pdfSha256));
      assert.equal(added.levels[i].href, file.downloads[0].url);
      assert.ok(parts.some(p => p.contentUrl === file.downloads[0].url));
      pdfs.add(level.pdfId);
    }
  }
  assert.equal(pdfs.size, 27);
});
