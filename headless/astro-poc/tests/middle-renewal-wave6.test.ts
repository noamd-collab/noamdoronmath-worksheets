import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { loadCatalog } from '../src/lib/catalog/loadCatalog';
import { topicWorksheetEditionLinks } from '../src/lib/topicWorksheetEditions';
import { topicPageCatalogTopicIds, topicPagePdfParts } from '../src/lib/topicStructuredData';
import { loadTopicPage } from '../src/lib/topicPages';
import { catalogBeforePackages, copyBeforeRelease, registryBeforeRelease, sixthRenew } from './fixtures/middle-090-091-094';

const root = new URL('../../../', import.meta.url);
const read = (path: string) => JSON.parse(readFileSync(new URL(path, root), 'utf8'));
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value, null, 2) + '\n').digest('hex');

test('the six reviewed Grade 8 and 9 topics link 18 PDFs with the correct Grade 9 programs', () => {
  const releases = sixthRenew.packages;
  assert.deepEqual(releases.map(p => p.number), [67,100,101,102,105,106]);
  const catalog = read('headless/catalog/catalog.v1.json');
  const registry = read('headless/catalog/worksheet-editions.v1.json');
  assert.equal(digest(catalogBeforePackages(catalog, releases)), sixthRenew.baselineCatalogSha256);
  assert.equal(digest(registryBeforeRelease(registry, releases.map(p => p.edition))), sixthRenew.baselineRegistrySha256);
  assert.equal(releases.flatMap(p => p.studentFiles).reduce((total, file) => total + file.items, 0), 366);
  const pdfs = new Set<string>();
  for (const pack of releases) {
    const raw = read('headless/astro-poc/src/data/topic-pages/' + pack.slug + '.json');
    assert.equal(digest(copyBeforeRelease(pack.slug, raw, sixthRenew)), pack.priorPageSha256, pack.slug);
    assert.ok(topicPageCatalogTopicIds(loadTopicPage(pack.slug)).includes(pack.topicId));
    assert.ok(pack.reviewReceipts.length && pack.reviewReceipts.every(r => r.verdict.startsWith('PASS') && /^[a-f0-9]{64}$/.test(r.sha256)));
    assert.deepEqual(pack.waivers, []);
    assert.equal(pack.edition.publicationMode, 'pdf-only');
    assert.equal(pack.edition.isDefault, false);
    if (pack.grade === 9) {
      const program = pack.number === 106 ? 'רגילה' : 'מצומצמת';
      assert.ok(pack.edition.label.includes('תוכנית ' + program));
      assert.ok(pack.section.blocks.some(b => b.text.includes('לתוכנית ה' + program + ' לכיתה ט׳')));
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
  assert.equal(pdfs.size, 18);
});
