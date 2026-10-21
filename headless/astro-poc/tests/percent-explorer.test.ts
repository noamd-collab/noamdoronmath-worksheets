/**
 * percent-of-quantity-grade-6 mounts the 100-square explorer in place of its
 * CSS loop. The readout math matches the page text (45% of 200 = 90).
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { fmt, percentOf } from '../src/lib/percentExplorer.ts';

describe('percent explorer', () => {
  it('computes 1% and the answer the way the page explains it', () => {
    assert.deepEqual(percentOf(45, 200), { one: 2, ans: 90 });
    assert.deepEqual(percentOf(20, 150), { one: 1.5, ans: 30 });
    assert.equal(fmt(percentOf(37, 150).ans), '55.5');
    assert.equal(fmt(percentOf(45, 80).ans), '36');
    assert.equal(fmt(percentOf(3, 80).one), '0.8');
  });

  it('only the percent page mounts it, and it opens on the page example', () => {
    const topic = readFileSync('src/components/TopicPage.astro', 'utf8');
    assert.match(topic, /'percent-of-quantity-grade-6': 'percent',/);
    assert.match(topic, /\{explorer === 'percent' && <PercentExplorer \/>\}/);
    const comp = readFileSync('src/components/PercentExplorer.astro', 'utf8');
    assert.match(comp, /const START_Q = 200;/);
    assert.match(comp, /const START_P = 45;/);
    const page = readFileSync('src/data/topic-pages/percent-of-quantity-grade-6.json', 'utf8');
    assert.ok(page.includes('45% מתוך 200'));
  });
});
