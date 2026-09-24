/**
 * CMS-style unit tests for DOODLES-45 deterministic selection.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  doodleSelectionsDiffer,
  hashPathname,
  normalizeDoodlePathname,
  selectSiteDoodles,
  shouldSkipSiteDoodles,
  type DoodleMotif,
} from '../src/lib/doodles/selectSiteDoodles.ts';

const catalog: DoodleMotif[] = Array.from({ length: 10 }, (_, i) => {
  const n = String(i + 1).padStart(2, '0');
  return { id: `doodle-${n}`, src: `/brand/doodles/doodle-${n}.webp` };
});

describe('DOODLES-45 selectSiteDoodles', () => {
  it('normalizes trailing slash and case', () => {
    assert.equal(normalizeDoodlePathname('/Grade-7/'), '/grade-7');
    assert.equal(normalizeDoodlePathname('/'), '/');
    assert.equal(hashPathname('/grade-7'), hashPathname('/Grade-7/'));
  });

  it('skips homepage to avoid doubling HeroIllustrations', () => {
    assert.equal(shouldSkipSiteDoodles('/'), true);
    assert.equal(selectSiteDoodles('/', catalog).length, 0);
    assert.equal(shouldSkipSiteDoodles('/grade-7'), false);
  });

  it('is deterministic for the same pathname', () => {
    const a = selectSiteDoodles('/grade-7', catalog);
    const b = selectSiteDoodles('/grade-7', catalog);
    assert.deepEqual(a, b);
    assert.equal(a.length >= 2 && a.length <= 3, true);
  });

  it('never duplicates motif ids or slots on one page', () => {
    for (const path of ['/grade-1', '/aboutus', '/blog', '/equations-basics-grade-7', '/terms']) {
      const sel = selectSiteDoodles(path, catalog);
      const ids = sel.map((p) => p.id);
      const slots = sel.map((p) => p.slot);
      assert.equal(new Set(ids).size, ids.length, `dup id on ${path}`);
      assert.equal(new Set(slots).size, slots.length, `dup slot on ${path}`);
      assert.ok(sel.every((p) => p.src.startsWith('/brand/doodles/')));
      const mobile = sel.filter((p) => p.mobileVisible);
      assert.ok(mobile.length >= 1 && mobile.length <= 2);
    }
  });

  it('varies selection across distinct routes', () => {
    const home = selectSiteDoodles('/', catalog);
    const grade = selectSiteDoodles('/grade-7', catalog);
    const topic = selectSiteDoodles('/equations-basics-grade-7', catalog);
    const blog = selectSiteDoodles('/blog', catalog);
    const about = selectSiteDoodles('/aboutus', catalog);
    assert.equal(home.length, 0);
    assert.ok(doodleSelectionsDiffer(grade, topic) || doodleSelectionsDiffer(grade, blog));
    assert.ok(doodleSelectionsDiffer(about, blog) || doodleSelectionsDiffer(about, topic));
    // At least two of grade/topic/blog/about should not be identical placements
    const pack = [grade, topic, blog, about];
    let differed = 0;
    for (let i = 0; i < pack.length; i++) {
      for (let j = i + 1; j < pack.length; j++) {
        if (doodleSelectionsDiffer(pack[i], pack[j])) differed++;
      }
    }
    assert.ok(differed >= 3, `expected route variation, differed pairs=${differed}`);
  });

  it('returns empty when catalog empty', () => {
    assert.deepEqual(selectSiteDoodles('/grade-7', []), []);
  });

  it('marks 1–2 mobileVisible motifs for the reserved strip', () => {
    const sel = selectSiteDoodles('/grade-7', catalog);
    const mobile = sel.filter((p) => p.mobileVisible);
    assert.ok(mobile.length >= 1 && mobile.length <= 2);
    // Desktop still up to 3 including mobile-visible ones
    assert.ok(sel.length >= mobile.length && sel.length <= 3);
  });
});
