import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isolateMath, spokenTextProblems, stripNiqqud, unisolatedMath, vocalize } from '../lib/hebrew.mjs';
import { loadGlossary } from '../lib/pipeline.mjs';

const g = loadGlossary();

test('every glossary entry: NFC, strips back to the exact same letters, only allowed marks', () => {
  for (const e of g.entries) {
    assert.equal(e.niqqud, e.niqqud.normalize('NFC'), e.token);
    assert.equal(stripNiqqud(e.niqqud), e.token, `${e.token}: niqqud changes letters`);
    assert.deepEqual(spokenTextProblems(e.niqqud), [], e.token);
    assert.ok(e.rationale && e.say && ['text-checked', 'needs-listening-priority'].includes(e.status), e.token);
  }
});

test('a pointed form with a missing ktiv-male letter is detected', () => {
  // רִבּוּעַ (no yod) vs the post's spelling ריבוע.
  assert.notEqual(stripNiqqud('בְּרִבּוּעַ'), 'בריבוע');
});

test('vocalize points only glossary tokens and keeps punctuation', () => {
  const out = vocalize('שלוש בחזקת ארבע, והמספר ארבע הוא המעריך.', g.byToken);
  assert.ok(out.includes('בְּחֶזְקַת'));
  assert.ok(out.includes('הַמַּעֲרִיךְ.'));
  assert.ok(out.includes('שלוש ') && out.includes('ארבע,'));
  assert.equal(stripNiqqud(out), 'שלוש בחזקת ארבע, והמספר ארבע הוא המעריך.');
});

test('spoken text rejects what a voice would read aloud wrongly', () => {
  assert.deepEqual(spokenTextProblems('שמונה ועוד שש'), []);
  assert.ok(spokenTextProblems('8 ועוד 6').length);
  assert.ok(spokenTextProblems('שמונה + שש').length);
  assert.ok(spokenTextProblems('(בימוי: חיוך) שלום').length);
  assert.ok(spokenTextProblems('ראו https://x.co').length);
  assert.ok(spokenTextProblems('שָׁלוֹם֑').length); // cantillation mark
});

test('formulas in captions must be LTR-isolated', () => {
  assert.ok(unisolatedMath('התרגיל 8 + 2 × 3 נראה קצר').length);
  assert.deepEqual(unisolatedMath(isolateMath('התרגיל {{8 + 2 × 3}} נראה קצר: 30 או 14.')), []);
  assert.ok(unisolatedMath('מחשבים 24 : 4 קודם').length);
});
