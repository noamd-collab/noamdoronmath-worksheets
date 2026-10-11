import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/print-regression-set.json', import.meta.url), 'utf8'));
const script = readFileSync(new URL('../scripts/print-regression.mjs', import.meta.url), 'utf8');

const REQUIRED = [
  'straddle-house-8d',
  'only-3b',
  'unpicked-part',
  '19d',
  'pythagoras-part2',
  'answer-key-wrap',
  'clipped-descenders',
];

function caseById(id: string) {
  return fixture.cases.find((item: { id: string }) => item.id === id);
}

describe('print regression set', () => {
  it('keeps the cases that already failed, and the renderer prints only that set', () => {
    assert.deepEqual(fixture.cases.map((item: { id: string }) => item.id), REQUIRED);
    assert.match(fixture.purpose, /render this set first/i);
    assert.match(fixture.purpose, /full print set/i);
    assert.match(script, /print-regression-set\.json/);
    assert.match(script, /\/regression/);
    assert.match(script, /statSync/);
    assert.equal(script.includes('house-8d-page'), false);
    assert.equal(script.includes('areas-b-9d'), false);
    for (const item of fixture.cases) {
      assert.equal(typeof item.sheetId, 'string');
      assert.ok(item.sheetId.length >= 8);
      assert.ok(Array.isArray(item.selection) && item.selection.length > 0);
      assert.equal(typeof item.failedBefore, 'string');
      assert.ok(item.failedBefore.length > 8);
      assert.equal(typeof item.grade, 'string');
      assert.equal(typeof item.topic, 'string');
      assert.equal(typeof item.level, 'string');
      const sheet = JSON.parse(readFileSync(
        new URL(`../public/teachers/sheets/${item.sheetId}.json`, import.meta.url),
        'utf8',
      ));
      const ids = new Set(sheet.questions.map((question: { id: string }) => question.id));
      for (const id of item.selection) assert.ok(ids.has(id), `${item.id} missing ${id}`);
      assert.equal(String(sheet.grade), item.grade);
      assert.equal(String(sheet.topicId), item.topic);
      assert.equal(sheet.level, item.level);
      assert.equal(sheet.pdfId, item.sheetId);
    }
  });

  it('records the failure each case is there to catch', () => {
    const straddle = caseById('straddle-house-8d');
    const only = caseById('only-3b');
    const unpicked = caseById('unpicked-part');
    const dalet = caseById('19d');
    const part2 = caseById('pythagoras-part2');
    const wrap = caseById('answer-key-wrap');
    assert.match(straddle.failedBefore, /footer/i);
    assert.match(straddle.failedBefore, /drawing/i);
    assert.deepEqual(only.selection, ['3ב']);
    assert.match(only.failedBefore, /stem/i);
    assert.deepEqual(unpicked.selection, ['3ב']);
    assert.equal(unpicked.sheetId, only.sheetId);
    assert.match(unpicked.failedBefore, /3א/);
    assert.notEqual(unpicked.failedBefore, only.failedBefore);
    assert.deepEqual(dalet.selection, ['19ד']);
    assert.match(dalet.failedBefore, /dashed/i);
    assert.match(dalet.failedBefore, /fragment/i);
    assert.match(dalet.failedBefore, /dots/i);
    assert.deepEqual(part2.selection, ['1א', '1ב', '2א']);
    assert.match(part2.failedBefore, /header/i);
    assert.deepEqual(wrap.selection, straddle.selection);
    assert.deepEqual(wrap.pages, [3]);
    assert.match(wrap.failedBefore, /wrap/i);
    assert.equal(wrap.sheetId, straddle.sheetId);
    const descenders = caseById('clipped-descenders');
    assert.match(descenders.failedBefore, /descender/i);
    assert.match(descenders.failedBefore, /ascender/i);
    assert.deepEqual(descenders.pages, [1, 2]);
    assert.equal(descenders.sheetId, straddle.sheetId);
    assert.deepEqual(descenders.selection, straddle.selection);
  });
});
