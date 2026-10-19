/**
 * The fraction add / subtract explorer: its arithmetic, its Hebrew wording,
 * the below-zero rule, the scene it draws, where it mounts, and that no slash
 * reaches a reader or a screen reader.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import {
  BELOW_ZERO_TEXT,
  START,
  belowZeroBlocks,
  canStep,
  combine,
  liveText,
  sayMixed,
  sayParts,
  scene,
  sentence,
  smallestHint,
  splitLabel,
} from '../src/lib/fractionAddSubExplorer.ts';
import { scanSource } from '../../../.github/scripts/check-slash-fractions.mjs';

const half = { a: 1, b: 2, c: 1, d: 3 }; // 1/2 and 1/3

describe('fraction add / subtract explorer', () => {
  it('adds over the least common denominator and names the result in Hebrew', () => {
    const r = combine(half, 'add');
    assert.deepEqual([r.L, r.an, r.cn, r.n, r.rn, r.rm, r.whole], [6, 3, 2, 5, 5, 6, 0]);
    assert.equal(splitLabel(6), 'נחלק לשישיות');
    assert.equal(sentence(half, 'add', r), 'חצי ועוד שליש שווה חמש שישיות');
    // the page's own example, 1/2 + 1/4 = 3/4
    const q = combine({ a: 1, b: 2, c: 1, d: 4 }, 'add');
    assert.deepEqual([q.L, q.n, q.rn, q.rm], [4, 3, 3, 4]);
    assert.equal(sayParts(3, 4), 'שלושה רבעים');
    // more than one whole becomes a mixed number
    const m = combine({ a: 3, b: 4, c: 1, d: 2 }, 'add');
    assert.deepEqual([m.n, m.rn, m.rm, m.whole, m.pn, m.pm], [5, 5, 4, 1, 1, 4]);
    assert.equal(sentence({ a: 3, b: 4, c: 1, d: 2 }, 'add', m), 'שלושה רבעים ועוד חצי שווה שלם אחד ורבע');
    assert.equal(sayMixed(2, 0, 1), 'שני שלמים');
    // reduced: 1/6 + 1/3 = 3/6 = 1/2
    const s = combine({ a: 1, b: 6, c: 1, d: 3 }, 'add');
    assert.deepEqual([s.n, s.rn, s.rm], [3, 1, 2]);
    assert.equal(sayMixed(s.whole, s.pn, s.pm), 'חצי');
  });

  it('the common-denominator page: 6 and 8 give 24, not 48', () => {
    const v = START['common-denominator-grade-5'];
    const r = combine(v, 'add');
    assert.equal(r.L, 24);
    assert.equal(r.smallerThanProduct, true);
    assert.equal(smallestHint(v, r), 'המכנה המשותף הקטן ביותר של 6 ו־8 הוא 24, לא 48.');
    assert.equal(splitLabel(24), 'נחלק ל־24 חלקים');
    assert.equal(sayParts(7, 24), '7 חלקים מתוך 24');
    assert.equal(combine(half, 'add').smallerThanProduct, false);
  });

  it('subtracts and never goes below zero', () => {
    const r = combine(half, 'sub');
    assert.deepEqual([r.n, r.rn, r.rm], [1, 1, 6]);
    assert.equal(sentence(half, 'sub', r), 'חצי פחות שליש שווה שישית');
    const t = combine({ a: 5, b: 6, c: 1, d: 2 }, 'sub');
    assert.deepEqual([t.n, t.rn, t.rm], [2, 1, 3]);
    assert.equal(sayMixed(0, 0, 1), 'אפס');
    assert.equal(combine({ a: 1, b: 2, c: 1, d: 2 }, 'sub').n, 0);
    const below = combine({ a: 1, b: 3, c: 1, d: 2 }, 'sub');
    assert.equal(below.belowZero, true);
    assert.equal(below.n, 0);
    // in subtraction the step that would make the second fraction larger is disabled
    assert.equal(canStep(half, 'sub', 'c', 1), false); // 2/3 > 1/2
    assert.equal(canStep(half, 'sub', 'b', 1), true); // 1/3 − 1/3 = 0 is allowed
    assert.equal(canStep(half, 'add', 'c', 1), true);
    assert.equal(canStep(half, 'add', 'a', -1), false); // numerators start at 1
    assert.equal(canStep({ a: 2, b: 2, c: 1, d: 3 }, 'add', 'a', 1), false); // never more than one whole
    assert.equal(belowZeroBlocks(half, 'sub'), true);
    assert.equal(belowZeroBlocks(half, 'add'), false);
    assert.equal(belowZeroBlocks({ a: 1, b: 3, c: 1, d: 2 }, 'add'), true); // the − toggle is blocked
    assert.match(BELOW_ZERO_TEXT, /מתחת לאפס/);
  });

  it('draws two strips, re-divides them, combines the parts and names the result', () => {
    const sc = scene(half, 'add');
    const fine = sc.shapes.filter((s) => s.k === 'line' && s.cls === 'fs-fine ph1');
    assert.equal(fine.length, 4 + 3, 'new sixth lines: 4 on the halves strip, 3 on the thirds strip');
    const cells = sc.shapes.filter((s) => s.k === 'rect' && /^fs-[ab] ph2$/.test(s.cls));
    assert.equal(cells.length, 5);
    assert.equal(cells.filter((s) => s.cls.startsWith('fs-a')).length, 3);
    const texts = sc.shapes.filter((s) => s.k === 'text').map((s) => (s.k === 'text' ? s.text : ''));
    assert.ok(texts.includes('נחלק לשישיות'));
    assert.ok(texts.includes('חמש שישיות'));
    assert.ok(texts.every((t) => !t.includes('/')), 'no slash in the drawing');
    assert.equal(sc.twoRows, false);
    assert.equal(scene({ a: 3, b: 4, c: 1, d: 2 }, 'add').twoRows, true);
    const sub = scene(half, 'sub');
    assert.equal(sub.shapes.filter((s) => s.k === 'rect' && s.cls === 'fs-gone ph2').length, 2);
    assert.equal(sub.shapes.filter((s) => s.k === 'rect' && s.cls === 'fs-result ph3').length, 1);
  });

  it('mounts on both pages, opens on each page example, and screen readers hear no slash', () => {
    const topic = readFileSync('src/components/TopicPage.astro', 'utf8');
    assert.match(topic, /'add-subtract-fractions-grade-5': 'fraction-add',/);
    assert.match(topic, /'common-denominator-grade-5': 'fraction-add',/);
    assert.match(topic, /\{explorer === 'fraction-add' && <FractionAddSubExplorer slug=\{slug\} \/>\}/);
    assert.deepEqual(START['add-subtract-fractions-grade-5'], half);
    assert.deepEqual(START['common-denominator-grade-5'], { a: 1, b: 6, c: 1, d: 8 });
    const page = readFileSync('src/data/topic-pages/add-subtract-fractions-grade-5.json', 'utf8');
    assert.ok(page.includes('⟨1¦2⟩ + ⟨1¦3⟩') && page.includes('⟨5¦6⟩'));
    const cd = readFileSync('src/data/topic-pages/common-denominator-grade-5.json', 'utf8');
    assert.ok(cd.includes('ל־6 ו־8 המכנה המשותף הקטן הוא 24'));
    const comp = readFileSync('src/components/FractionAddSubExplorer.astro', 'utf8');
    assert.match(comp, /data-fraction-add-sub/);
    assert.match(comp, /aria-live="polite"/);
    const live = liveText(half, 'add', combine(half, 'add'));
    assert.equal(live, 'חצי ועוד שליש שווה חמש שישיות. 3 חלקי 6 ועוד 2 חלקי 6 שווה 5 חלקי 6');
    assert.ok(!live.includes('/'));
    const engine = readFileSync('src/lib/fractionAddSubExplorer.ts', 'utf8');
    assert.equal(scanSource('headless/astro-poc/src/components/FractionAddSubExplorer.astro', comp).length, 0);
    assert.equal(scanSource('headless/astro-poc/src/lib/fractionAddSubExplorer.ts', engine).length, 0);
    assert.equal(scanSource('headless/astro-poc/tests/x.ts', readFileSync('src/lib/fractionAddSubExplorer.ts', 'utf8')).length, 0);
  });
});
