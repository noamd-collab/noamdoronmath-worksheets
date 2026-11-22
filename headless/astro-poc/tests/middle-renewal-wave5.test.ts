import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { loadCatalog } from '../src/lib/catalog/loadCatalog';
import { topicWorksheetEditionLinks } from '../src/lib/topicWorksheetEditions';
import { topicPageCatalogTopicIds, topicPagePdfParts } from '../src/lib/topicStructuredData';
import { loadTopicPage } from '../src/lib/topicPages';
import { catalogBeforePackages, copyBeforeRelease, registryBeforeRelease, fifthRenew } from './fixtures/middle-090-091-094';

const root = new URL('../../../', import.meta.url);
const read = (path: string) => JSON.parse(readFileSync(new URL(path, root), 'utf8'));
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value, null, 2) + '\n').digest('hex');

test('reviewed middle-school worksheets and the first Grade 7 assessment link their frozen PDFs', () => {
  const releases = fifthRenew.packages;
  assert.deepEqual(releases.map(p => p.number), [66,68,88,89,118]);
  const catalog = read('headless/catalog/catalog.v1.json');
  const registry = read('headless/catalog/worksheet-editions.v1.json');
  assert.equal(digest(catalogBeforePackages(catalog, releases)), fifthRenew.baselineCatalogSha256);
  assert.equal(digest(registryBeforeRelease(registry, releases.map(p => p.edition))), fifthRenew.baselineRegistrySha256);
  const pdfs = new Set<string>();
  for (const pack of releases) {
    const raw = read('headless/astro-poc/src/data/topic-pages/' + pack.slug + '.json');
    assert.equal(digest(copyBeforeRelease(pack.slug, raw, fifthRenew)), pack.priorPageSha256, pack.slug);
    assert.ok(topicPageCatalogTopicIds(loadTopicPage(pack.slug)).includes(pack.topicId));
    assert.ok(pack.reviewReceipts.length && pack.reviewReceipts.every(r => r.verdict.startsWith('PASS') && /^[a-f0-9]{64}$/.test(r.sha256)));
    if (pack.number === 118) {
      assert.deepEqual(pack.waivers.map(w => w.gate), ['G70-assessment-specific-coverage']);
      assert.ok(pack.waivers.some(w => w.sha256 === pack.edition.assessmentPdfEvidence?.scopeApprovalSha256));
      assert.ok(pack.reviewReceipts.some(r => r.sha256 === pack.edition.assessmentPdfEvidence?.independentReviewSha256));
      assert.equal(pack.edition.assessmentPdfEvidence?.freezeSha256, pack.producerFreezeSha256);
      assert.ok(pack.edition.levels.every(level => !Object.hasOwn(level, 'nativeExportSha256')));
    } else {
      assert.deepEqual(pack.waivers, []);
    }
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
