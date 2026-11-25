import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { loadCatalog } from '../src/lib/catalog/loadCatalog';
import { studentFacingEditions } from '../src/lib/catalog/editions';
import {
  RETIRED_JUNIOR_WORKSHEET_REDIRECTS,
  retiredJuniorRequestTarget,
} from '../src/lib/retiredJuniorWorksheets';
import { currentRetiredRedirects } from '../scripts/build-retired-junior-redirects';

test('retired junior-high redirects match the catalog and keep a sheet that is still listed', () => {
  assert.deepEqual(RETIRED_JUNIOR_WORKSHEET_REDIRECTS, currentRetiredRedirects());
  const catalog = loadCatalog();
  const stillListed = new Set<string>();
  for (const grade of catalog.grades) {
    for (const topic of grade.topics) {
      for (const edition of studentFacingEditions(topic, grade.grade)) {
        for (const level of edition.levels) stillListed.add(level.pdfId);
      }
    }
  }
  for (const pdfId of Object.keys(RETIRED_JUNIOR_WORKSHEET_REDIRECTS)) {
    assert.equal(stillListed.has(pdfId), false, pdfId);
    assert.match(RETIRED_JUNIOR_WORKSHEET_REDIRECTS[pdfId], /^\//);
  }
  const keptReview = catalog.grades.find(g => g.grade === 9)!.topics.find(t => t.id === 21)!;
  for (const level of keptReview.levels) {
    assert.equal(RETIRED_JUNIOR_WORKSHEET_REDIRECTS[level.pdfId], undefined);
  }
  const removed = catalog.grades.find(g => g.grade === 7)!.topics.find(t => t.id === 1)!.levels[0].pdfId;
  const target = RETIRED_JUNIOR_WORKSHEET_REDIRECTS[removed];
  assert.ok(target);
  assert.equal(retiredJuniorRequestTarget('/worksheet-viewer-noam.html', new URLSearchParams({ pdf: removed, g: '7' })), target);
  assert.equal(retiredJuniorRequestTarget(`/_files/ugd/d8e7ad_${removed}.pdf`, new URLSearchParams()), target);
  assert.equal(retiredJuniorRequestTarget('/worksheet-viewer-noam.html', new URLSearchParams({ pdf: '0123456789abcdef0123456789abcdef' })), null);
  assert.equal(retiredJuniorRequestTarget('/grade-1', new URLSearchParams({ pdf: removed })), null);
});
