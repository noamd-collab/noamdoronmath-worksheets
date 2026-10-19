import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { cleanText } from '../src/lib/parity/topicParity.ts';
import { splitFractionMarkers } from '../src/lib/topicFractionMarkers.ts';
import { lessonMathParts } from '../src/lib/lessonMath.ts';

const LRI = '\u2066';
const PDI = '\u2069';

describe('splitFractionMarkers', () => {
  it('splits a marker into text and a fraction; parentheses stay on one side', () => {
    const parts = splitFractionMarkers('השבר −⟨3¦4⟩ שווה ל־⟨(−3)¦4⟩ ול־⟨3¦(−4)⟩ וגם ⟨(−3)¦(−4)⟩.');
    const fracs = parts.filter((part) => part.kind === 'frac');
    assert.deepEqual(
      fracs.map((part) => (part.kind === 'frac' ? [part.n, part.d] : [])),
      [
        ['3', '4'],
        ['(−3)', '4'],
        ['3', '(−4)'],
        ['(−3)', '(−4)'],
      ],
    );
    assert.match(parts[0]?.kind === 'text' ? parts[0].text : '', /−$/, 'the leading minus stays as text before the bar');
  });

  it('leaves a product of two fractions as two bars', () => {
    const parts = splitFractionMarkers('⟨2¦3⟩ × ⟨1¦2⟩');
    assert.equal(parts.filter((part) => part.kind === 'frac').length, 2);
  });

  it('lesson math draws a marker as numerator over denominator, not a slash', () => {
    const parts = lessonMathParts(`${LRI}⟨2¦3⟩ + ⟨1¦3⟩ = 1${PDI}`);
    assert.equal(parts.filter((part) => typeof part !== 'string').length, 2);
  });
});

describe('parity expand', () => {
  it('turns bar markers back into the production slash form', () => {
    assert.equal(cleanText('השבר −⟨3¦4⟩ שווה ל־⟨(−3)¦4⟩'), 'השבר −3/4 שווה ל־(−3)/4');
    assert.equal(cleanText('⟨(x²−9)¦(x−3)⟩'), '(x²−9)/(x−3)');
    assert.equal(cleanText(`${LRI}⟨AB¦DE⟩=⟨2¦3⟩${PDI}`), 'AB/DE=2/3');
  });
});
