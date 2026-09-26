/**
 * Pre-designed doodle layouts obey marginalia rules.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  EDGE_LAYOUTS,
  PHI_EDGE_SIZES,
  PHI_MOBILE_SIZES,
  SECTION_LAYOUTS,
  assertLayoutRules,
} from '../src/lib/doodles/doodleLayouts.ts';

describe('doodleLayouts', () => {
  it('has 4–6 edge and section layouts', () => {
    assert.ok(EDGE_LAYOUTS.length >= 4 && EDGE_LAYOUTS.length <= 6);
    assert.ok(SECTION_LAYOUTS.length >= 4 && SECTION_LAYOUTS.length <= 6);
  });

  it('each edge layout obeys φ sizes, bleed, mobile sparse gaps', () => {
    for (let i = 0; i < EDGE_LAYOUTS.length; i++) {
      const edge = EDGE_LAYOUTS[i];
      assert.ok(edge.length >= 6, `layout ${i} too short`);
      for (const s of edge) {
        assert.ok((PHI_EDGE_SIZES as readonly number[]).includes(s.sizePx));
        assert.ok((PHI_MOBILE_SIZES as readonly number[]).includes(s.mobileSizePx));
        assert.ok(s.bleed >= 0.15 && s.bleed <= 0.3);
        assert.ok(s.opacity >= 0.5 && s.opacity <= 0.88);
        assert.ok(s.rotate >= -14 && s.rotate <= 12);
        assert.ok(s.duration >= 5 && s.duration <= 9);
      }
      // unique tops (no shared horizontal band)
      const tops = edge.map((s) => Math.round(s.topPct));
      assert.equal(new Set(tops).size, tops.length, `layout ${i} shared top`);
      assertLayoutRules(edge, SECTION_LAYOUTS[i % SECTION_LAYOUTS.length]);
    }
  });

  it('each section layout is diagonal with unique Y bands', () => {
    for (let i = 0; i < SECTION_LAYOUTS.length; i++) {
      const sec = SECTION_LAYOUTS[i];
      assert.ok(sec.length >= 2 && sec.length <= 4);
      for (let j = 1; j < sec.length; j++) {
        assert.notEqual(sec[j].side, sec[j - 1].side, `layout ${i} not diagonal`);
        assert.ok(
          Math.abs(sec[j].yPct - sec[j - 1].yPct) >= 10,
          `layout ${i} shared Y band`
        );
      }
    }
  });

  it('layouts differ from each other (refresh variety)', () => {
    const sig = (e: (typeof EDGE_LAYOUTS)[number]) =>
      e.map((s) => `${s.side}:${s.topPct}:${s.sizePx}`).join('|');
    const sigs = EDGE_LAYOUTS.map(sig);
    assert.equal(new Set(sigs).size, sigs.length);
  });
});
