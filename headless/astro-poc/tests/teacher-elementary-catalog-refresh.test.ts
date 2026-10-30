import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { mergeElementaryCatalog } from '../scripts/build-teacher-catalog.mjs';

test('elementary refresh retains published middle PDFs and topic IDs', () => {
  const published = { grade: 9, band: 'middle', topics: [{ id: 46, sheets: [{ pdfId: 'published-pdf' }] }] };
  const elementary = { grade: 1, band: 'elementary', topics: [{ id: 1, sheets: [{ pdfId: 'new-elementary', mode: 'exercise' }] }] };
  const authoring = { grades: [elementary, { grade: 9, band: 'middle', topics: [{ id: 99, sheets: [{ pdfId: 'unpublished-revision' }] }] }] };
  const previous = { grades: [{ grade: 1, band: 'elementary', topics: [] }, published] };
  const merged = mergeElementaryCatalog(authoring, previous);
  assert.deepEqual(merged.grades, [elementary, published]);
  assert.throws(() => mergeElementaryCatalog(authoring, { grades: [] }), /Missing published teacher catalog/);
});


test('tight grade 3 fraction pair preserves denominators and separates the next question', () => {
  const manifest = JSON.parse(readFileSync(new URL('../../../noam-ai/manifests/3d56bca1424241c29d27bdf2fda0daef.json', import.meta.url), 'utf8'));
  const q16 = manifest.exercises.find((item: any) => item.q === 16).crop;
  const q17 = manifest.exercises.find((item: any) => item.q === 17).crop;
  const pageHeight = 841.89;
  const bottom = (q16.y + q16.h) * pageHeight;
  const top = q17.y * pageHeight;
  assert.ok(bottom > 283.437 && bottom < 288.33, 'Q16 includes denominator glyphs and stops before Q17 ink');
  assert.ok(top > 283.437 && top < 288.33, 'Q17 starts in the verified white gap');
  assert.ok(Math.abs(bottom - top) < 0.002, 'the two crops meet at the same safe boundary');
});


test('grade 6 pattern crops retain every square in the overflowing original diagrams', () => {
  const sourceEnds = [
    ['325dbe7b49a341aebe80b552c9cd80ec', 1, 562.275635],
    ['79cc6db7432d4fd6a683ef45980d4299', 1, 566.905518],
    ['325dbe7b49a341aebe80b552c9cd80ec', 7, 572.196899],
    ['608ccf74446b420e8d28a36ba023e34d', 7, 572.196899],
    ['79cc6db7432d4fd6a683ef45980d4299', 7, 572.196899],
  ] as const;
  for (const [pdfId, question, originalRight] of sourceEnds) {
    const manifest = JSON.parse(readFileSync(new URL('../../../noam-ai/manifests/' + pdfId + '.json', import.meta.url), 'utf8'));
    const crop = manifest.exercises.find((item: any) => item.q === question).crop;
    const right = (crop.x + crop.w) * 595.275574;
    assert.ok(right > originalRight + 1, `${pdfId} question ${question}: retain the last square and margin`);
    assert.ok(right <= 595.275574);
  }
});
