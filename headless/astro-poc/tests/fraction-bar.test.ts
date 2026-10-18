import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { cleanText } from '../src/lib/parity/topicParity.ts';
import { layoutMathRuns, splitFractionMarkers } from '../src/lib/topicMathText.ts';

const LRI = '\u2066';
const PDI = '\u2069';

describe('splitFractionMarkers', () => {
  it('keeps a leading minus on the whole fraction, and parentheses on one side', () => {
    const parts = splitFractionMarkers('השבר −⟨3¦4⟩ שווה ל־⟨(−3)¦4⟩ ול־⟨3¦(−4)⟩ וגם ⟨(−3)¦(−4)⟩.');
    const fracs = parts.filter((part) => part.kind === 'frac');
    assert.deepEqual(
      fracs.map((part) => (part.kind === 'frac' ? [part.sign, part.n, part.d] : [])),
      [
        ['−', '3', '4'],
        ['', '(−3)', '4'],
        ['', '3', '(−4)'],
        ['', '(−3)', '(−4)'],
      ],
    );
  });

  it('does not peel a minus that is subtraction', () => {
    const parts = splitFractionMarkers(`${LRI}x−⟨3¦4⟩${PDI}`);
    const frac = parts.find((part) => part.kind === 'frac');
    assert.ok(frac && frac.kind === 'frac');
    assert.equal(frac.sign, '');
    assert.equal(frac.n, '3');
  });

  it('leaves a product of two fractions as two bars', () => {
    const parts = splitFractionMarkers('⟨2¦3⟩ × ⟨1¦2⟩');
    assert.equal(parts.filter((part) => part.kind === 'frac').length, 2);
  });
});

describe('layoutMathRuns', () => {
  it('keeps a short marked formula on one line', () => {
    const parts = layoutMathRuns(`דוגמה: ${LRI}⟨2¦3⟩ + ⟨1¦3⟩ = 1${PDI}.`);
    assert.equal(parts.filter((part) => part.nowrap).length, 1);
    assert.match(parts.find((part) => part.nowrap)?.text || '', /⟨2¦3⟩/);
  });
});

describe('parity expand', () => {
  it('turns bar markers back into the production slash form', () => {
    assert.equal(cleanText('השבר −⟨3¦4⟩ שווה ל־⟨(−3)¦4⟩'), 'השבר −3/4 שווה ל־(−3)/4');
    assert.equal(cleanText('⟨(x²−9)¦(x−3)⟩'), '(x²−9)/(x−3)');
    assert.equal(cleanText(`${LRI}⟨AB¦DE⟩=⟨2¦3⟩${PDI}`), 'AB/DE=2/3');
  });
});
