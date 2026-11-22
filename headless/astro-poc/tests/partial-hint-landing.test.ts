import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';
import type { CatalogV1 } from '../src/lib/catalog/types';
import { partialHintCount } from '../src/lib/catalog/partialHints';
import { parsePartialHintIndex } from '../src/lib/partialWorksheetHints';
import { topicWorksheetEditionLinks } from '../src/lib/topicWorksheetEditions';

test('every partial link matches the published edition, PDF bytes and indexed exercises', () => {
  const catalog: CatalogV1 = JSON.parse(readFileSync(new URL('../src/data/catalog.v1.json', import.meta.url), 'utf8'));
  const directory = new URL('../public/noam-ai/partial-hints/', import.meta.url);
  const assets = new Set(readdirSync(directory));
  assert(assets.size > 0);
  for (const g of catalog.grades) for (const topic of g.topics) {
    for (const e of topicWorksheetEditionLinks(catalog, g.grade, topic.id, '/worksheets')) {
      for (const level of e.levels) {
        if (!level.partialHints) continue;
        const rawEdition = topic.editions!.find(row => row.editionId === e.editionId)!;
        const rawLevel = rawEdition.levels.find(row => row.key === level.key)!;
        const id = rawLevel.pdfId;
        assert(level.href.endsWith(id + '.pdf'));
        assert.equal(level.partialHints.href, '/ramzi-partial?pdf=' + id);
        const index = parsePartialHintIndex(JSON.parse(readFileSync(new URL(id+'.json', directory),'utf8')),id);
        assert(index);
        assert.equal(index.editionId,e.editionId);
        assert.equal(index.level,level.key);
        assert.equal(index.items.length,partialHintCount(rawEdition,rawLevel));
        assert.equal(partialHintCount({...rawEdition, editionId:'unrelated'}, rawLevel),0);
        assert(assets.delete(id+'.json'));
      }
    }
  }
  assert.equal(assets.size,0,'orphan partial pin index');
});
