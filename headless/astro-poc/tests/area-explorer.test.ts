/**
 * The fraction and decimal area-model explorers open on each page's own
 * example, and their readout math matches the page text.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { dec, decimalProduct, fractionProduct } from '../src/lib/areaExplorer.ts';

describe('area explorer', () => {
  it('fraction × fraction: overlap cells and the reduced answer', () => {
    assert.deepEqual(fractionProduct(2, 3, 3, 4), { n: 6, m: 12, rn: 1, rm: 2 });
    assert.deepEqual(fractionProduct(1, 2, 1, 3), { n: 1, m: 6, rn: 1, rm: 6 });
    assert.deepEqual(fractionProduct(2, 5, 5, 6), { n: 10, m: 30, rn: 1, rm: 3 });
  });

  it('decimal × decimal: split into tenths and hundredths, as the page says', () => {
    const r = decimalProduct(0.8, 0.72);
    assert.equal(r.yt, 0.7);
    assert.equal(r.yh, 0.02);
    assert.equal(dec(r.p1), '0.56');
    assert.equal(dec(r.p2), '0.016');
    assert.equal(dec(r.ans, 4), '0.576');
    assert.equal(dec(decimalProduct(0.5, 0.4).ans, 4), '0.2');
    assert.equal(decimalProduct(0.3, 1).yh, 0);
    assert.equal(dec(decimalProduct(0.9, 0.09).ans, 4), '0.081');
  });

  it('each page mounts its explorer and opens on its example', () => {
    const topic = readFileSync('src/components/TopicPage.astro', 'utf8');
    assert.match(topic, /'fraction-times-fraction-grade-6': 'fraction',/);
    assert.match(topic, /'multiply-decimals-grade-6': 'decimal',/);
    assert.match(topic, /<AreaExplorer kind=\{explorer\} \/>/);
    const comp = readFileSync('src/components/AreaExplorer.astro', 'utf8');
    assert.match(comp, /const F = \{ a: 2, b: 3, c: 3, d: 4 \};/);
    assert.match(comp, /const D = \{ x: 0\.8, y: 0\.72 \};/);
    const frac = readFileSync('src/data/topic-pages/fraction-times-fraction-grade-6.json', 'utf8');
    assert.ok(frac.includes('2/3 × 3/4 = 6/12 = 1/2'));
    const decimals = readFileSync('src/data/topic-pages/multiply-decimals-grade-6.json', 'utf8');
    assert.ok(decimals.includes('0.8 × 0.72'));
  });
});
