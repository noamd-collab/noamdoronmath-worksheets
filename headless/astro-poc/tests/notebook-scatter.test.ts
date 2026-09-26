/**
 * KIMI-ANIM-6 — dense notebook scatter + margin selectors.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { selectDenseMargins } from '../src/lib/doodles/selectDenseMargins.ts';
import { selectNotebookScatter } from '../src/lib/doodles/selectNotebookScatter.ts';
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

  it('varies sizes and marks only a subset to float', () => {
    const s = selectNotebookScatter('home-values', catalog, { count: 6 });
    const sizes = new Set(s.motifs.map((m) => m.sizePx));
    assert.ok(sizes.size >= 2, 'expected size variety');
    const floats = s.motifs.filter((m) => m.float).length;
    assert.ok(floats >= 1 && floats < s.motifs.length);
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

  it('also densifies the homepage path', () => {
    const home = selectDenseMargins('/', catalog);
    assert.equal(home.length, catalog.length);
  });
});
