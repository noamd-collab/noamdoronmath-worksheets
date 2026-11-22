import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { loadCatalog } from '../src/lib/catalog/loadCatalog';
import { topicWorksheetEditionLinks } from '../src/lib/topicWorksheetEditions';
import { topicPageCatalogTopicIds, topicPagePdfParts } from '../src/lib/topicStructuredData';
import { loadTopicPage } from '../src/lib/topicPages';
import { catalogBeforePackages, copyBeforeRelease, registryBeforeRelease, fifthRenew, fourthRenew, thirdRenew, nextRenew, renew } from './fixtures/middle-090-091-094';

const root = new URL('../../../', import.meta.url);
const read = (path: string) => JSON.parse(readFileSync(new URL(path, root), 'utf8'));
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value, null, 2) + '\n').digest('hex');

test('the 15 reviewed topics preserve the preceding catalog, registry and each landing page', () => {
  const releases = renew.packages;
  assert.deepEqual(releases.map(p => p.number), [50,51,52,53,54,57,58,59,60,61,71,72,74,75,76]);
  const catalog = catalogBeforePackages(catalogBeforePackages(catalogBeforePackages(catalogBeforePackages(read('headless/catalog/catalog.v1.json'), fifthRenew.packages), fourthRenew.packages), thirdRenew.packages), nextRenew.packages);
  const registry = registryBeforeRelease(registryBeforeRelease(registryBeforeRelease(registryBeforeRelease(read('headless/catalog/worksheet-editions.v1.json'), fifthRenew.packages.map(p => p.edition)), fourthRenew.packages.map(p => p.edition)), thirdRenew.packages.map(p => p.edition)), nextRenew.packages.map(p => p.edition));
  assert.equal(digest(catalogBeforePackages(catalog, releases)), renew.baselineCatalogSha256);
  assert.equal(digest(registryBeforeRelease(registry, releases.map(p => p.edition))), renew.baselineRegistrySha256);
  const hrefs = new Set<string>();
  for (const p of releases) {
    const rawPage = read('headless/astro-poc/src/data/topic-pages/' + p.slug + '.json');
    assert.equal(digest(copyBeforeRelease(p.slug, copyBeforeRelease(p.slug, rawPage, nextRenew), renew)), p.priorPageSha256, p.slug);
    assert.ok(topicPageCatalogTopicIds(loadTopicPage(p.slug)).includes(p.topicId));
    assert.ok(p.reviewReceipts.length && p.reviewReceipts.every(r => r.verdict.startsWith('PASS') && /^[a-f0-9]{64}$/.test(r.sha256)));
    assert.equal(p.skillVersion, '7.3.3');
    const links = topicWorksheetEditionLinks(loadCatalog(), p.grade, p.topicId, '/' + p.slug);
    assert.deepEqual(links.map(group => group.editionId), ['legacy', p.edition.editionId]);
    const parts = topicPagePdfParts(loadCatalog(), p.grade, [p.topicId]).parts;
    assert.deepEqual(p.edition.levels.map(level => [level.key,level.viewerLevel]), [['a','A'],['b','B'],['c','E']]);
    for (const [i,level] of p.edition.levels.entries()) {
      const file = p.studentFiles[i];
      assert.equal(file.key, level.key);
      assert.deepEqual(file.downloads.map(d => new URL(d.url).hostname), ['static.wixstatic.com','www.noamdoronmath.co.il']);
      assert.ok(file.downloads.every(d => d.status === 200 && d.match && d.sha256 === level.pdfSha256));
      const href = links[1].levels[i].href;
      assert.equal(href, file.downloads[0].url);
      assert.ok(parts.some(part => part.contentUrl === href));
      hrefs.add(href);
    }
  }
  assert.equal(hrefs.size, 45);
});
