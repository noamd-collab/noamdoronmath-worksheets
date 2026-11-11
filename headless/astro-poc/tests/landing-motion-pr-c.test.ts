/**
 * Audit 10.11.2026, sections 3 and 4: sketch landings that only faded one
 * element in, and formula landings that only changed text. Now the picture
 * itself moves on every one of them.
 */
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import type { Browser } from 'puppeteer-core';
import { topicLandingLoop } from '../src/lib/landingLoops.ts';
import { loadTopicPage, TOPIC_PAGE_SLUGS } from '../src/lib/topicPages.ts';
import { launchBrowser, measureGallery, startReviewServer, type CardMotion, type ReviewServer } from './helpers/landingMotion.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const sketch = readFileSync(join(root, 'src/components/LoopSketch.astro'), 'utf8');
const formula = readFileSync(join(root, 'src/components/LoopFormula.astro'), 'utf8');

const SECTION_3: Record<string, string> = {
  'subtraction-to-20-grade-1': 'sub-via-10',
  'subtraction-two-digit-borrowing-grade-2': 'baseten-sub',
  'column-subtraction-borrowing-grade-3': 'baseten-sub',
  'multi-digit-subtraction-grade-4': 'baseten-sub',
  'number-bonds-10-20-grade-2': 'bonds-10-20',
  'quadrilaterals-properties-grade-3': 'quad-sides',
  'multiplication-multi-digit-grade-4': 'col-mul',
  'multiplication-multi-digit-grade-5': 'long-mul',
  'mean-data-inquiry-grade-5': 'stats',
  'solids-explore-grade-6': 'solids',
  'area-rectangle-perimeter-grade-7': 'area',
  'rectangle-square-area-grade-9': 'area',
  'area-parallelogram-trapezoid-composite-grade-7': 'area-para',
  'composite-polygons-area-grade-9': 'area-split',
  'parallelogram-grade-9': 'quads',
  'rectangle-grade-9': 'rect',
  'cylinder-surface-area-grade-8': 'cyl-area',
  'triangular-prism-surface-area-grade-9': 'prism-area',
  'triangular-prism-volume-grade-9': 'prism-vol',
  'coordinate-plane-four-quadrants-grade-7': 'coords',
  'coordinate-plane-quadrants-grade-7': 'coords',
  'patterns-and-graphs-grade-7': 'pattern-graph',
  'coordinate-plane-scale-grade-7': 'scale',
  'isosceles-triangle-grade-8': 'isosceles',
  'isosceles-triangle-properties-grade-8': 'isosceles',
  'isosceles-triangle-grade-9': 'isosceles',
  'special-triangles-grade-7-new': 'isosceles',
  'triangle-area-grade-7': 'triangle-area',
  'triangle-calculations-grade-9': 'triangles',
  'triangle-sides-angles-grade-9': 'side-angle',
  'congruence-theorems-grade-8': 'congruence',
  'triangle-congruence-proofs-grade-8': 'congruence',
  'triangle-median-grade-8': 'median',
  'inequalities-grade-8': 'ineq',
  'quadratic-inequalities-systems-grade-9': 'quad-ineq',
  'quadratic-equations-grade-9': 'quad-eq',
  'reading-graphs-grade-9': 'read-graph',
  'systems-of-equations-grade-8': 'systems',
  'congruent-polygons-transformations-grade-9': 'transform',
  'precalculus-functions-graphs-grade-9': 'parabola',
};
/** Thin sketch landings the audit missed. */
const MISSED: Record<string, string> = {
  'number-line-absolute-value-grade-7': 'absolute',
  'similar-triangles-area-ratio-grade-8': 'similar-area',
  'triangle-similarity-aa-grade-9': 'similar-aa',
  'triangle-similarity-proof-grade-8': 'similar-aa',
};
const SECTION_4: Record<string, string> = {
  'powers-grade-7': 'powers',
  'exponent-rules-grade-9': 'exp-rules',
  'square-root-grade-7': 'roots',
  'square-roots-grade-9': 'roots',
  'order-of-operations-signed-numbers-grade-7': 'order',
  'multiplying-signed-numbers-grade-7': 'signed-mul',
  'dividing-signed-numbers-grade-7': 'signed-div',
  'geometric-proof-grade-8': 'proof',
  'transition-to-high-school-grade-9': 'quad-factor',
  'fraction-division-algorithm-grade-6': 'frac-recip',
};
/** Newly integrated topic pages that reuse the audited sketches and formulas. */
const INTEGRATED: Record<string, string> = {
  'congruent-polygons-transformations-grade-7': 'transform',
  'prior-knowledge-diagnostic-grade-8': 'order',
  'square-root-grade-8': 'roots',
  'function-concept-grade-8': 'pattern-graph',
  'function-notation-grade-8': 'read-graph',
  'summary-review-grade-8': 'ineq',
  'summative-assessment-grade-8': 'coords',
};
const ALL = { ...SECTION_3, ...MISSED, ...SECTION_4, ...INTEGRATED };
/** Pages whose base copy already slid into place; only its shape was wrong. */
const SAME_MOTION: Record<string, string> = {
  'congruence-theorems-grade-8': 'the copy slid before too, but was not congruent',
  'triangle-congruence-proofs-grade-8': 'the copy slid before too, but was not congruent',
};

const points = (block: RegExp) => {
  const m = sketch.match(block);
  assert.ok(m, String(block));
  return m[1].split(' ').map((p) => p.split(',').map(Number));
};
const dist = ([ax, ay]: number[], [bx, by]: number[]) => Math.hypot(ax - bx, ay - by);

describe('audit sections 3 and 4: wiring', () => {
  it('keeps every page on its sketch or formula, with quadrilateral properties on its own sketch', () => {
    for (const [slug, variant] of Object.entries(ALL)) {
      const loop = topicLandingLoop(loadTopicPage(slug));
      assert.deepEqual([loop.kind, loop.kind === 'css' && loop.variant], ['css', variant], slug);
    }
    assert.match(sketch, /variant === 'quad-sides'/);
  });

  it('lists every page using a changed variant in the review gallery', () => {
    const variants = new Set(Object.values(ALL));
    const gallery = readFileSync(join(root, 'src/dev-pages/review/landing-loops-pr-c.astro'), 'utf8');
    const users = TOPIC_PAGE_SLUGS.filter((slug) => {
      const loop = topicLandingLoop(loadTopicPage(slug));
      return loop.kind === 'css' && variants.has(loop.variant);
    });
    assert.deepEqual([...users].sort(), Object.keys(ALL).sort());
    for (const slug of users) assert.match(gallery, new RegExp(`slug: '${slug}'`), slug);
  });

  it('draws a picture next to every text-only formula', () => {
    const listed = formula.match(/const PICTURE_VARIANTS = \[([^\]]*)\]/)?.[1] ?? '';
    const pictures = formula.slice(formula.indexOf('<svg class="lf-pic"'));
    for (const variant of Object.values(SECTION_4).filter((v) => v !== 'roots')) {
      assert.match(listed, new RegExp(`'${variant}'`), variant);
      assert.match(pictures, new RegExp(`variant === '${variant}' && \\(`), variant);
    }
  });

  it('draws congruent and similar triangles where the sketch says so', () => {
    const left = points(/<polygon class="sk-box" points="(50,60 160,180 30,180)"/);
    const right = points(/<polygon class="sk-box sk-box--gold" points="(250,60 360,180 2\d0,180)"/);
    for (let i = 0; i < 3; i += 1) {
      assert.equal(dist(left[i], left[(i + 1) % 3]).toFixed(3), dist(right[i], right[(i + 1) % 3]).toFixed(3), `congruence side ${i}`);
    }
    const small = points(/<polygon class="sk-box" points="(70,170 190,170 110,70)"/);
    const big = points(/<polygon class="sk-box sk-box--gold" points="(250,180 430,180 310,\d+)"/);
    for (let i = 0; i < 3; i += 1) {
      assert.equal(dist(big[i], big[(i + 1) % 3]).toFixed(3), (dist(small[i], small[(i + 1) % 3]) * 1.5).toFixed(3), `similar-aa side ${i}`);
    }
  });
});

describe('audit sections 3 and 4: real motion in the browser', { timeout: 20 * 60 * 1000 }, () => {
  let server: ReviewServer;
  let browser: Browser;
  const cards: CardMotion[] = [];
  let baseCards: CardMotion[] = [];

  before(async () => {
    server = await startReviewServer('/review/landing-loops-pr-c');
    browser = await launchBrowser();
    const url = `${server.origin}/review/landing-loops-pr-c`;
    for (const width of [390, 1280]) cards.push(...(await measureGallery(browser, url, width)));
    baseCards = await measureGallery(browser, url, 1280, 'before');
    mkdirSync(join(root, 'reports'), { recursive: true });
    writeFileSync(join(root, 'reports/landing-motion-pr-c.json'), `${JSON.stringify({ after: cards, before: baseCards }, null, 1)}\n`);
  });

  after(async () => {
    await browser?.close();
    server?.stop();
  });

  it('measures every gallery card at 390 and 1280', () => {
    const expected = Object.keys(ALL).length;
    assert.equal(cards.filter((c) => c.width === 390).length, expected);
    assert.equal(cards.filter((c) => c.width === 1280).length, expected);
  });

  it('starts by itself and moves at least two shapes of the picture', () => {
    for (const card of cards) {
      const id = `${card.slug} @${card.width}`;
      assert.equal(card.started, true, `${id} did not start`);
      assert.equal(card.engine, 'css', id);
      assert.ok(card.transformAnimations >= 1, `${id} has no transform animation`);
      assert.ok(card.movingShapes >= 2, `${id} moves ${card.movingShapes} shapes`);
      assert.ok(card.changedPct >= 0.3, `${id} changed ${card.changedPct}% of its pixels`);
    }
  });

  it('moves more of the picture than the base, which moved no shape on the formula pages', () => {
    for (const slug of Object.keys(ALL).filter((s) => !(s in SAME_MOTION))) {
      const now = cards.find((c) => c.slug === slug && c.width === 1280);
      const base = baseCards.find((c) => c.slug === slug);
      assert.ok(now && base, slug);
      assert.ok(now.movingShapes > base.movingShapes, `${slug}: ${base.movingShapes} -> ${now.movingShapes}`);
    }
    for (const slug of Object.keys(SECTION_4)) {
      assert.equal(baseCards.find((c) => c.slug === slug)?.movingShapes, 0, slug);
    }
  });

  it('keeps one card height, no sideways scroll, and stops with the site Stop control', () => {
    for (const card of cards) {
      const id = `${card.slug} @${card.width}`;
      assert.equal(card.stableHeight, true, `${id} changes height`);
      assert.equal(card.overflowX, false, `${id} scrolls sideways`);
      assert.equal(card.runningAfterStop, 0, `${id} keeps running after Stop`);
    }
  });
});
