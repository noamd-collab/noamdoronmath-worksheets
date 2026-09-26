/**
 * Golden-ratio notebook marginalia + edge margin selectors.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  MOBILE_EDGE_SIZES,
  PHI_EDGE_SIZES,
  selectDenseMargins,
} from '../src/lib/doodles/selectDenseMargins.ts';
import {
  PHI_MOBILE_SIZES,
  PHI_POINTS,
  PHI_SIZES,
  selectNotebookScatter,
} from '../src/lib/doodles/selectNotebookScatter.ts';
import type { DoodleMotif } from '../src/lib/doodles/selectSiteDoodles.ts';

const catalog: DoodleMotif[] = [
  'telescope',
  'kite',
  'curious-cat',
  'snail',
  'cube-plant',
  'orbit-pencil',
  'sleepy-owl',
  'geometry-fish',
  'eye-spiral',
  'paper-boat',
].map((id) => ({ id, src: `/brand/doodles/${id}.webp` }));

describe('selectNotebookScatter', () => {
  it('is deterministic and returns 2–4 motifs plus scribbles', () => {
    const a = selectNotebookScatter('home-grades', catalog, {
      preferred: ['telescope', 'sleepy-owl'],
      count: 4,
    });
    const b = selectNotebookScatter('home-grades', catalog, {
      preferred: ['telescope', 'sleepy-owl'],
      count: 4,
    });
    assert.deepEqual(a, b);
    assert.ok(a.motifs.length >= 2 && a.motifs.length <= 4);
    assert.ok(a.scribbles.length >= 1 && a.scribbles.length <= 3);
    assert.ok(a.motifs.some((m) => m.src.includes('telescope')));
    assert.ok(
      a.scribbles.some((s) => s.kind === 'formula'),
      'expected a readable formula scribble'
    );
  });

  it('uses φ sizes, opacity/rotate ranges, and staggered 5–9s motion', () => {
    const s = selectNotebookScatter('home-values', catalog, { count: 4 });
    assert.ok(s.motifs.every((m) => (PHI_SIZES as readonly number[]).includes(m.sizePx)));
    assert.ok(
      s.motifs.every((m) => (PHI_MOBILE_SIZES as readonly number[]).includes(m.mobileSizePx))
    );
    assert.ok(s.motifs.every((m) => m.float === true));
    assert.ok(s.motifs.every((m) => m.duration >= 5 && m.duration <= 9));
    assert.ok(s.motifs.every((m) => m.bobPx >= 4 && m.bobPx <= 8));
    assert.ok(s.motifs.every((m) => m.wobbleDeg >= 3 && m.wobbleDeg <= 5));
    assert.ok(s.motifs.every((m) => m.rotate >= -14 && m.rotate <= 12));
    assert.ok(s.motifs.every((m) => m.opacity >= 0.5 && m.opacity <= 0.88));
    // ≥30% size deltas between consecutive motifs when count≥2
    for (let i = 1; i < s.motifs.length; i++) {
      const a = s.motifs[i - 1].sizePx;
      const b = s.motifs[i].sizePx;
      const delta = Math.abs(a - b) / Math.max(a, b);
      assert.ok(delta >= 0.3, `size delta ${a}→${b} < 30%`);
    }
    const durs = new Set(s.motifs.map((m) => m.duration));
    const delays = new Set(s.motifs.map((m) => m.delay));
    assert.ok(durs.size + delays.size >= 3, 'expected staggered motion params');
  });

  it('places in edge gutters with diagonal descent — no shared Y band', () => {
    const s = selectNotebookScatter('home-hero', catalog, { count: 4 });
    assert.ok(s.motifs.every((m) => m.inlineInsetPct >= 1 && m.inlineInsetPct <= 12));
    assert.ok(s.motifs.every((m) => m.yPct >= 10 && m.yPct <= 88));
    assert.ok(s.motifs.every((m) => m.side === 'start' || m.side === 'end'));
    // Sorted diagonal: alternating sides, unique Y bands
    for (let i = 1; i < s.motifs.length; i++) {
      assert.ok(
        Math.abs(s.motifs[i].yPct - s.motifs[i - 1].yPct) >= 10,
        `shared horizontal band: ${s.motifs[i - 1].yPct} then ${s.motifs[i].yPct}`
      );
      assert.notEqual(
        s.motifs[i].side,
        s.motifs[i - 1].side,
        'expected alternating sides (diagonal)'
      );
    }
    const nearPhi = s.motifs.some((m) =>
      PHI_POINTS.some((p) => Math.abs(m.yPct - p) < 6)
    );
    assert.ok(nearPhi, 'expected a φ-point block anchor');
    assert.ok(s.scribbles.every((sc) => typeof sc.yPct === 'number' && sc.float));
  });
});

describe('selectDenseMargins', () => {
  it('places every catalog motif on alternating edge columns', () => {
    const sel = selectDenseMargins('/statistics-grade-8', catalog);
    assert.equal(sel.length, catalog.length);
    const ids = new Set(sel.map((p) => p.id));
    assert.equal(ids.size, catalog.length);
    assert.ok(sel.some((p) => p.side === 'start'));
    assert.ok(sel.some((p) => p.side === 'end'));
    assert.ok(sel.every((p) => (MOBILE_EDGE_SIZES as readonly number[]).includes(p.mobileSizePx)));
    assert.ok(sel.every((p) => (PHI_EDGE_SIZES as readonly number[]).includes(p.sizePx)));
    assert.ok(sel.every((p) => p.bleed >= 0.15 && p.bleed <= 0.3));
    assert.ok(sel.every((p) => p.opacity >= 0.5 && p.opacity <= 0.88));
    assert.ok(sel.every((p) => p.rotate >= -14 && p.rotate <= 12));
  });

  it('is deterministic per pathname and differs across routes', () => {
    const a = selectDenseMargins('/grade-7', catalog);
    const b = selectDenseMargins('/grade-7', catalog);
    const c = selectDenseMargins('/aboutus', catalog);
    assert.deepEqual(a, b);
    const sig = (x: typeof a) => x.map((p) => `${p.id}:${p.side}:${p.topPct}`).join('|');
    assert.notEqual(sig(a), sig(c));
  });

  it('spreads φ vertical bands, floats 5–9s, sparse mobileVisible', () => {
    const home = selectDenseMargins('/', catalog);
    assert.equal(home.length, catalog.length);
    assert.ok(home.every((p) => p.float === true));
    assert.ok(home.every((p) => p.duration >= 5 && p.duration <= 9));
    assert.ok(home.every((p) => p.wobbleDeg >= 3 && p.wobbleDeg <= 5));
    const tops = home.map((p) => p.topPct);
    const unique = new Set(tops.map((t) => Math.round(t)));
    assert.ok(unique.size >= 6, `expected φ spread, got ${unique.size}`);
    const mobile = home.filter((p) => p.mobileVisible);
    assert.ok(mobile.length >= 3 && mobile.length <= 4, `mobileVisible=${mobile.length}`);
    // Mobile tops spaced ≥22% so ≤2–3 fit a viewport
    const mt = [...mobile].sort((a, b) => a.topPct - b.topPct);
    for (let i = 1; i < mt.length; i++) {
      assert.ok(
        mt[i].topPct - mt[i - 1].topPct >= 20,
        `mobile gap too tight: ${mt[i - 1].topPct} → ${mt[i].topPct}`
      );
    }
  });
});
