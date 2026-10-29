/**
 * Decimal division (number line) and decimal place value (hundredths grid)
 * explorers open on each page's own example.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { decimalQuotient, hundredths, placeValue, placeWholeText, tenths } from '../src/lib/decimalExplorer.ts';

describe('decimal explorers', () => {
  it('division counts jumps of the divisor in tenths', () => {
    assert.deepEqual(decimalQuotient(8, 2), { jumps: 4, rem: 0, quotient: 4, approx: false });
    assert.deepEqual(decimalQuotient(9, 3), { jumps: 3, rem: 0, quotient: 3, approx: false });
    assert.deepEqual(decimalQuotient(9, 4), { jumps: 2, rem: 1, quotient: 2.25, approx: false });
    assert.deepEqual(decimalQuotient(10, 3), { jumps: 3, rem: 1, quotient: 3.33, approx: true });
    assert.equal(tenths(8), '0.8');
    assert.equal(tenths(10), '1');
  });

  it('place value splits hundredths into tenths and hundredths', () => {
    assert.deepEqual(placeValue(25), { tenths: 2, hundredths: 5 });
    assert.deepEqual(placeValue(47), { tenths: 4, hundredths: 7 });
    assert.deepEqual(placeValue(100), { tenths: 10, hundredths: 0 });
    assert.equal(hundredths(25), '0.25');
    assert.equal(hundredths(30), '0.3');
  });

  it('each page mounts its explorer on its own example', () => {
    const topic = readFileSync('src/components/TopicPage.astro', 'utf8');
    assert.match(topic, /'divide-decimals-grade-6': 'divide',/);
    assert.match(topic, /'decimal-place-value-grade-5': 'place',/);
    assert.match(topic, /<DecimalExplorer kind=\{explorer\} \/>/);
    const comp = readFileSync('src/components/DecimalExplorer.astro', 'utf8');
    assert.match(comp, /const X10 = 8;\nconst Y10 = 2;/);
    assert.match(comp, /const H = 25;/);
    assert.ok(readFileSync('src/data/topic-pages/divide-decimals-grade-6.json', 'utf8').includes('0.8 : 0.2 = 4'));
    assert.ok(readFileSync('src/data/topic-pages/decimal-place-value-grade-5.json', 'utf8').includes('0.25 זה 2 עשיריות ו־5 מאיות'));
  });

  it('at 1.00 the place-value sentence names the whole, not "10 tenths and 0 hundredths"', () => {
    assert.equal(placeWholeText, '1 הוא 10 עשיריות, שהן 100 מאיות');
    const comp = readFileSync('src/components/DecimalExplorer.astro', 'utf8');
    assert.match(comp, /<span data-el="whole" hidden>\{placeWholeText\}<\/span>/);
  });
});
