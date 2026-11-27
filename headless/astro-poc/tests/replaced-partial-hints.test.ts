import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import indexes from '../src/data/partial-worksheet-hints.v1.json';
import { REPLACED_PARTIAL_PDFS, replacedPartialHintTarget } from '../src/lib/replacedPartialHints';
import { parsePartialHintIndex } from '../src/lib/partialWorksheetHints';

const catalog = readFileSync(new URL('../src/data/catalog.v1.json', import.meta.url), 'utf8');
const index = (id: string) => new URL('../public/noam-ai/partial-hints/' + id + '.json', import.meta.url);

test('a replaced partial reader PDF redirects once to its published correction', () => {
  assert.ok(REPLACED_PARTIAL_PDFS.size > 0);
  for (const [old, next] of REPLACED_PARTIAL_PDFS) {
    assert.notEqual(old, next);
    assert.ok(!REPLACED_PARTIAL_PDFS.has(next), 'targets never chain');
    assert.ok(!existsSync(index(old)) && !Object.hasOwn(indexes, old) && !catalog.includes(old));
    const parsed = parsePartialHintIndex(JSON.parse(readFileSync(index(next), 'utf8')), next);
    assert.ok(parsed && catalog.includes(next));
    assert.equal((indexes as Record<string, { pdfSha256: string }>)[next].pdfSha256, parsed.pdfSha256);
    assert.equal(replacedPartialHintTarget('/ramzi-partial', new URLSearchParams({ pdf: old })), '/ramzi-partial?pdf=' + next);
    assert.equal(replacedPartialHintTarget('/ramzi-partial', new URLSearchParams([['pdf', old], ['page', '3']])),
      '/ramzi-partial?pdf=' + next + '&page=3');
    assert.equal(replacedPartialHintTarget('/ramzi-partial', new URLSearchParams({ pdf: next })), null);
    assert.equal(replacedPartialHintTarget('/ramzi-partial', new URLSearchParams([['pdf', old], ['pdf', old]])), null);
    assert.equal(replacedPartialHintTarget('/worksheets', new URLSearchParams({ pdf: old })), null);
  }
  assert.equal(replacedPartialHintTarget('/ramzi-partial', new URLSearchParams({ pdf: '__proto__' })), null);
  assert.equal(replacedPartialHintTarget('/ramzi-partial', new URLSearchParams()), null);
});
