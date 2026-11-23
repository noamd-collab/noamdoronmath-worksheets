import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { loadCatalog } from '../src/lib/catalog/loadCatalog';
import { topicWorksheetEditionLinks } from '../src/lib/topicWorksheetEditions';
import { topicPageCatalogTopicIds, topicPagePdfParts } from '../src/lib/topicStructuredData';
import { loadTopicPage } from '../src/lib/topicPages';
import { catalogAtRelease, registryAtRelease, catalogBeforePackages, catalogBeforeReplacedRevisions, copyBeforeRelease, registryBeforeRelease, registryBeforeReplacedRevisions, eighthRenew } from './fixtures/middle-090-091-094';

const root = new URL('../../../', import.meta.url);
const read = (path: string) => JSON.parse(readFileSync(new URL(path, root), 'utf8'));
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value, null, 2) + '\n').digest('hex');

test('the regular Grade 9 transition topic links the three print-only bridge levels', () => {
  const releases = eighthRenew.packages;
  assert.deepEqual(releases.map(p => p.number), [119]);
  // The wave 8 baseline recorded 081 r03. Check and peel the later PDFs, then restore that exact revision.
  const catalog = catalogBeforeReplacedRevisions(catalogAtRelease(read('headless/catalog/catalog.v1.json'), eighthRenew));
  const registry = registryBeforeReplacedRevisions(registryAtRelease(read('headless/catalog/worksheet-editions.v1.json'), eighthRenew));
  assert.equal(digest(catalogBeforePackages(catalog, releases)), eighthRenew.baselineCatalogSha256);
  assert.equal(digest(registryBeforeRelease(registry, releases.map(p => p.edition))), eighthRenew.baselineRegistrySha256);
  assert.equal(releases.flatMap(p => p.studentFiles).reduce((total, file) => total + file.items, 0), 180);
  const pdfs = new Set<string>();
  for (const pack of releases) {
    const raw = read('headless/astro-poc/src/data/topic-pages/' + pack.slug + '.json');
    assert.equal(digest(copyBeforeRelease(pack.slug, raw, eighthRenew)), pack.priorPageSha256, pack.slug);
    assert.ok(topicPageCatalogTopicIds(loadTopicPage(pack.slug)).includes(pack.topicId));
    assert.ok(pack.reviewReceipts.length && pack.reviewReceipts.every(r => r.verdict.startsWith('PASS') && /^[a-f0-9]{64}$/.test(r.sha256)));
    assert.deepEqual(pack.waivers, []);
    assert.equal(pack.edition.publicationMode, 'pdf-only');
    assert.equal(pack.edition.isDefault, false);
    assert.equal(pack.grade, 9);
    assert.equal(pack.topicId, 20);
    assert.equal(pack.producerPackage, 'G9-T134');
    assert.equal(pack.studentRevision, 'r02');
    assert.deepEqual(pack.studentFiles.map(file => file.pages), [11, 13, 13]);
    assert.ok(pack.studentFiles.every(file => file.items === 60));
    assert.ok(pack.edition.label.includes('תוכנית רגילה'));
    assert.equal(pack.edition.bridgePrintEvidence.freezeSha256, pack.producerFreezeSha256);
    assert.ok(pack.reviewReceipts.some(r => r.sha256 === pack.edition.bridgePrintEvidence.independentReviewSha256));
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
  assert.equal(pdfs.size, 3);
});
