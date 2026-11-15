import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { loadCatalog } from '../src/lib/catalog/loadCatalog';
import { topicWorksheetEditionLinks } from '../src/lib/topicWorksheetEditions';
import { beforeExtra15Catalog, beforeExtra15Registry, reviewedExtra15 } from './fixtures/extra15-pdf';
import { reviewedExtSmlAfr, beforeExtSmlAfrCatalog } from './fixtures/ext-sml-afr-pdf';
import { reviewedSaoWpc, beforeSaoWpcCatalog } from './fixtures/sao-wpc-pdf';

const root = new URL('../../../', import.meta.url);
const read = (path: string) => JSON.parse(readFileSync(new URL(path, root), 'utf8'));
const sha = (value: unknown) => createHash('sha256').update(JSON.stringify(value, null, 2) + '\n').digest('hex');
const raw = read('headless/astro-poc/src/data/catalog.v1.json');
const registry = read('headless/catalog/worksheet-editions.v1.json');

test('all fifteen PDFs coexist and both exact reversals recover the complete canonical485 baseline', () => {
  assert.equal(reviewedExtSmlAfr.baselineCatalogSha256, reviewedSaoWpc.baselineCatalogSha256);
  assert.equal(reviewedExtSmlAfr.baselineRegistrySha256, reviewedSaoWpc.baselineRegistrySha256);
  const previous = beforeExtra15Catalog(raw);
  assert.equal(sha(previous), reviewedExtSmlAfr.baselineCatalogSha256);
  assert.equal(sha(beforeExtra15Registry(registry)), reviewedExtSmlAfr.baselineRegistrySha256);
  assert.deepEqual(beforeExtSmlAfrCatalog(beforeSaoWpcCatalog(raw)), beforeSaoWpcCatalog(beforeExtSmlAfrCatalog(raw)));
  assert.equal(registry.editions.length, 24);
  assert.equal(registry.editions.flatMap((e: any) => e.levels).length, 72);
  assert.equal(new Set(registry.editions.map((e: any) => `${e.grade}:${e.topicId}:${e.editionId}`)).size, 24);
  const catalog = loadCatalog();
  const links = new Set<string>();
  for (const addition of reviewedExtra15) {
    const groups = topicWorksheetEditionLinks(catalog, addition.grade, addition.topicId, '/');
    assert.deepEqual(groups.map(g => g.editionId), ['legacy', addition.editionId]);
    assert.deepEqual(groups[0], topicWorksheetEditionLinks(previous, addition.grade, addition.topicId, '/')[0]);
    assert.equal(groups[1].pdfOnly, true);
    for (const level of groups[1].levels) {
      assert.ok(level.href.startsWith(catalog.config.pdfBase));
      assert.ok(!level.href.includes('worksheet-viewer'));
      links.add(level.href);
    }
  }
  assert.equal(links.size, 15);
  const altered = structuredClone(registry);
  altered.editions.push(structuredClone(reviewedSaoWpc.additions[0].edition));
  assert.throws(() => beforeExtra15Registry(altered), 'duplicate composite edition identity must fail');
  const lost = structuredClone(raw);
  const a = reviewedExtSmlAfr.additions[0];
  delete lost.grades.find((g: any) => g.grade === a.grade).topics.find((t: any) => t.id === a.topicId).editions;
  assert.throws(() => beforeExtra15Catalog(lost), 'one surviving packet cannot conceal loss of the other');
});
