import test from 'node:test';
import assert from 'node:assert/strict';
import { checkFormula } from '../lib/mathcheck.mjs';
import { compareSpokenToDisplay, spokenToFormula } from '../lib/spokenmath.mjs';

test('correct school-notation formulas pass exactly', () => {
  for (const f of ['8 + 2 × 3 = 14', '24 : 4 × 3 = 18', '36 : (8 − 2) + 5 × 2 = 16', '18 − [2 × (6 − 4)] = 14', '(−3)² = (−3) × (−3) = 9', '−3² = −(3²) = −9', '7⁵ : 7² = 7⁵⁻² = 7³', '3⁴ ≠ 3 × 4', '0.8 = 0.80', '12⁰ = 1']) {
    assert.equal(checkFormula(f).status, 'ok', f);
  }
});

test('injected defects are caught: wrong answer, flipped sign, wrong precedence, false inequality', () => {
  assert.equal(checkFormula('8 + 2 × 3 = 30').status, 'wrong'); // left-to-right mistake
  assert.equal(checkFormula('−3² = 9').status, 'wrong'); // sign flipped
  assert.equal(checkFormula('24 : 4 × 3 = 2').status, 'wrong'); // multiplication done first
  assert.equal(checkFormula('3⁴ ≠ 81').status, 'wrong');
  assert.equal(checkFormula('√(−9)').status, 'error'); // no real value
});

test('letters and irrational results are left to the reviewer, not passed', () => {
  assert.equal(checkFormula('x² = 25').status, 'symbolic');
  assert.equal(checkFormula('√20 = 2√5').status, 'symbolic');
});

test('spoken Hebrew math is compared with the display by value', () => {
  assert.equal(spokenToFormula('עשרים וארבע חלקי ארבע כפול שלוש שווה שמונה עשרה'), '24 : 4 × 3 = 18');
  assert.ok(compareSpokenToDisplay('שמונה ועוד שש שווה ארבע עשרה', '8 + 6 = 14').ok);
  assert.ok(compareSpokenToDisplay('שלוש בחזקת ארבע לא שווה לשלוש כפול ארבע', '3⁴ ≠ 3 × 4').ok);
  // A different wording of the same statement still passes.
  assert.ok(compareSpokenToDisplay('שבע בריבוע זה ארבעים ותשע', '7² = 49').ok);
  assert.ok(compareSpokenToDisplay('שבע בחזקת שתיים שווה ארבעים ותשע', '7² = 49').ok);
});

test('spoken/display mismatches are caught', () => {
  assert.equal(compareSpokenToDisplay('שמונה ועוד שש שווה שתים עשרה', '8 + 6 = 14').ok, false); // wrong spoken answer
  assert.equal(compareSpokenToDisplay('שמונה ועוד שש', '8 + 6 = 14').ok, false); // relation missing
  assert.equal(compareSpokenToDisplay('מינוס שלוש בריבוע שווה תשע', '(−3)² = 9').ok, false); // spoken form means −3², not (−3)²
  assert.throws(() => spokenToFormula('שמונה ועוד בערך שש'));
});
