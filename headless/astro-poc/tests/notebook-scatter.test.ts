/**
 * Golden-ratio notebook scatter + margin selectors.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { selectDenseMargins } from '../src/lib/doodles/selectDenseMargins.ts';
import {
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
  it('is deterministic and returns 3–6 motifs plus scribbles', () => {
    const a = selectNotebookScatter('home-grades', catalog, {
      preferred: ['telescope', 'sleepy-owl'],
      count: 6,
    });
    const b = selectNotebookScatter('home-grades', catalog, {
      preferred: ['telescope', 'sleepy-owl'],
      count: 6,
    });
    assert.deepEqual(a, b);
    assert.ok(a.motifs.length >= 3 && a.motifs.length <= 6);
    assert.ok(a.scribbles.length >= 2 && a.scribbles.length <= 4);
    assert.ok(a.motifs.some((m) => m.src.includes('telescope')));
    assert.ok(
      a.scribbles.some((s) => s.kind === 'formula'),
      'expected a readable formula scribble'
    );
  });

  it('uses φ sizes and animates every motif (no sync)', () => {
    const s = selectNotebookScatter('home-values', catalog, { count: 6 });
    assert.ok(s.motifs.every((m) => (PHI_SIZES as readonly number[]).includes(m.sizePx)));
    assert.ok(s.motifs.every((m) => m.float === true));
    assert.ok(s.motifs.every((m) => m.duration >= 4 && m.duration <= 9));
    assert.ok(s.motifs.every((m) => m.bobPx >= 4 && m.bobPx <= 8));
    assert.ok(s.motifs.every((m) => m.wobbleDeg >= 3 && m.wobbleDeg <= 6));
    const durs = new Set(s.motifs.map((m) => m.duration));
    const delays = new Set(s.motifs.map((m) => m.delay));
    assert.ok(durs.size + delays.size >= 3, 'expected staggered motion params');
  });

  it('places on golden-ratio anchors — never a shared baseline', () => {
    const s = selectNotebookScatter('home-hero', catalog, { count: 5 });
    assert.ok(s.motifs.every((m) => m.xPct >= 8 && m.xPct <= 88));
    assert.ok(s.motifs.every((m) => m.yPct >= 8 && m.yPct <= 88));
    // No two consecutive Y within 6% (common baseline guard)
    for (let i = 1; i < s.motifs.length; i++) {
      assert.ok(
        Math.abs(s.motifs[i].yPct - s.motifs[i - 1].yPct) >= 6,
        `shared baseline: ${s.motifs[i - 1].yPct} then ${s.motifs[i].yPct}`
      );
    }
    // At least one motif near a canonical φ point
    const nearPhi = s.motifs.some((m) =>
      PHI_POINTS.some((p) => Math.abs(m.xPct - p) < 4 || Math.abs(m.yPct - p) < 4)
    );
    assert.ok(nearPhi, 'expected a φ-point anchor');
    assert.ok(s.scribbles.every((sc) => typeof sc.xPct === 'number' && sc.float));
  });
});

describe('selectDenseMargins', () => {
  it('places every catalog motif with alternating sides', () => {
    const sel = selectDenseMargins('/statistics-grade-8', catalog);
    assert.equal(sel.length, catalog.length);
    const ids = new Set(sel.map((p) => p.id));
    assert.equal(ids.size, catalog.length);
    assert.ok(sel.some((p) => p.side === 'start'));
    assert.ok(sel.some((p) => p.side === 'end'));
    const mobile = sel.filter((p) => p.mobileVisible);
    assert.ok(mobile.length >= 4);
  });

  it('is deterministic per pathname and differs across routes', () => {
    const a = selectDenseMargins('/grade-7', catalog);
    const b = selectDenseMargins('/grade-7', catalog);
    const c = selectDenseMargins('/aboutus', catalog);
    assert.deepEqual(a, b);
    const sig = (x: typeof a) => x.map((p) => `${p.id}:${p.side}:${p.topPct}`).join('|');
    assert.notEqual(sig(a), sig(c));
  });

  it('also densifies the homepage path and always floats', () => {
    const home = selectDenseMargins('/', catalog);
    assert.equal(home.length, catalog.length);
    assert.ok(home.every((p) => p.float === true));
    assert.ok(home.every((p) => p.duration >= 4 && p.duration <= 9));
  });
});
