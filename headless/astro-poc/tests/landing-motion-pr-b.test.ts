/**
 * Audit 10.11.2026, section 2: the lesson landings pulsed only their step
 * badges. Now the lesson picture itself moves on every one of them.
 */
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import type { Browser } from 'puppeteer-core';
import { topicLandingLoop } from '../src/lib/landingLoops.ts';
import { LESSON_LOOPS, isLessonLoop } from '../src/lib/lessonLoops.ts';
import { loadTopicPage, TOPIC_PAGE_SLUGS } from '../src/lib/topicPages.ts';
import { launchBrowser, measureGallery, startReviewServer, type CardMotion, type ReviewServer } from './helpers/landingMotion.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const SECTION_2 = [
  'data-grade-1', 'hundred-chart-grade-1', 'adding-tens-decompose-grade-2', 'addition-two-digit-no-carry-grade-2',
  'shapes-vs-solids-grade-2', 'subtraction-two-digit-no-borrow-grade-2', 'tables-bar-charts-grade-2',
  'classify-triangles-grade-3', 'read-bar-diagram-grade-3', 'diagrams-conclusions-grade-4',
  'fractions-numberline-compare-grade-4', 'order-rounding-million-grade-4', 'add-subtract-decimals-grade-5',
  'add-subtract-fractions-grade-5', 'add-subtract-mixed-numbers-grade-5', 'big-numbers-rounding-grade-5',
  'common-denominator-grade-5', 'compare-fractions-decimals-grade-5', 'completing-fractions-grade-5',
  'fraction-of-quantity-grade-5', 'fractions-mixed-numbers-grade-5', 'fractions-numberline-compare-grade-5',
  'long-division-grade-5', 'missing-number-fractions-grade-5', 'prime-factors-grade-5', 'read-graphs-grade-5',
  'read-tables-grade-5', 'unit-conversion-weight-grade-5', 'box-surface-area-grade-6', 'boxes-nets-grade-6',
  'capacity-ml-l-m3-grade-6', 'collect-represent-data-grade-6', 'compare-groups-conclusions-grade-6',
  'divide-decimals-grade-6', 'find-the-whole-grade-6', 'multiply-decimals-grade-6', 'multiply-mixed-numbers-grade-6',
  'percent-of-quantity-grade-6',
];
/** Section 2 pages that PR A moved to a film. */
const NOW_FILMS = ['square-rectangle-grade-1', 'collecting-data-grade-3', 'long-division-remainder-grade-4'];
/** Lesson landing the audit missed: only its mirror half moved. */
const MISSED = ['reflection-symmetry-grade-2'];
/** Newly integrated topic pages that reuse the audited lesson pictures. */
const INTEGRATED_LESSONS: Record<string, string> = {
  'data-collection-reading-grade-7': 'read-linegraph',
  'bar-charts-pictograms-grade-8': 'read-bars',
  'data-range-grade-8': 'compare-groups',
  'equilateral-triangle-grade-7': 'equilateral-60',
  'equilateral-triangle-grade-9': 'equilateral-60',
  'relative-frequency-experiments-grade-7': 'experimental-frequency',
  'probability-experiments-fairness-grade-8': 'experimental-frequency',
  'relative-frequency-grade-7': 'relative-frequency',
  'two-step-equations-grade-7': 'two-step-equation',
  'axis-intercepts-grade-8': 'axis-intercepts',
  'equation-of-a-line-grade-8': 'line-from-points',
  'equations-with-fractions-grade-8': 'numeric-denominators',
  'graphical-inequalities-grade-8': 'graphical-inequality',
  'interpolation-extrapolation-grade-8': 'linear-interpolation',
  'lines-parallel-to-axes-grade-8': 'axis-parallel-lines',
  'median-grade-8': 'data-median',
  'choosing-measure-of-center-grade-8': 'choose-center',
  'data-literacy-grade-8': 'truncated-axis',
  'motion-problems-grade-8': 'motion-rate',
  'non-routine-problems-grade-8': 'missing-mean',
  'pie-charts-grade-8': 'pie-sector',
  'successive-percent-changes-grade-8': 'successive-percent',
  'systems-algebraic-solution-grade-8': 'system-elimination',
  'systems-word-problems-grade-8': 'system-model',
  'two-data-sources-grade-8': 'compare-sources',
  'word-problems-choosing-unknowns-grade-8': 'choose-unknown',
  'function-representations-grade-8': 'linear-table',
  'rate-of-change-grade-8': 'linear-table',
};
/** Lessons that had no picture at all, only their three steps. */
const NEW_PICTURES = { 'weight-units': 'weights', 'round-large': 'rounding', 'long-division': 'division', 'prime-factorization': 'factortree' };

describe('audit section 2: wiring', () => {
  it('keeps every section 2 page on its lesson, except the three PR A films', () => {
    for (const slug of [...SECTION_2, ...MISSED]) {
      const loop = topicLandingLoop(loadTopicPage(slug));
      assert.equal(loop.kind === 'css' && isLessonLoop(loop.variant), true, slug);
    }
    for (const slug of NOW_FILMS) assert.equal(topicLandingLoop(loadTopicPage(slug)).kind, 'concept', slug);
    for (const [slug, variant] of Object.entries(INTEGRATED_LESSONS)) {
      assert.deepEqual(topicLandingLoop(loadTopicPage(slug)), { kind: 'css', variant, marker: variant }, slug);
    }
  });

  it('covers every lesson landing on the site, and gives the four step-only lessons a picture', () => {
    const lessonPages = TOPIC_PAGE_SLUGS.filter((slug) => {
      const loop = topicLandingLoop(loadTopicPage(slug));
      return loop.kind === 'css' && isLessonLoop(loop.variant);
    });
    assert.deepEqual([...lessonPages].sort(), [...SECTION_2, ...MISSED, ...Object.keys(INTEGRATED_LESSONS)].sort());
    for (const [variant, picture] of Object.entries(NEW_PICTURES)) {
      assert.equal(LESSON_LOOPS[variant as keyof typeof LESSON_LOOPS].picture, picture, variant);
    }
    const gallery = readFileSync(join(root, 'src/dev-pages/review/landing-loops-pr-b.astro'), 'utf8');
    for (const slug of lessonPages) assert.match(gallery, new RegExp(`slug: '${slug}'`), slug);
  });
});

describe('audit section 2: real motion in the browser', { timeout: 15 * 60 * 1000 }, () => {
  let server: ReviewServer;
  let browser: Browser;
  const cards: CardMotion[] = [];
  let baseCards: CardMotion[] = [];

  before(async () => {
    server = await startReviewServer('/review/landing-loops-pr-b');
    browser = await launchBrowser();
    const url = `${server.origin}/review/landing-loops-pr-b`;
    for (const width of [390, 1280]) cards.push(...(await measureGallery(browser, url, width)));
    baseCards = await measureGallery(browser, url, 1280, 'before');
    mkdirSync(join(root, 'reports'), { recursive: true });
    writeFileSync(join(root, 'reports/landing-motion-pr-b.json'), `${JSON.stringify({ after: cards, before: baseCards }, null, 1)}\n`);
  });

  after(async () => {
    await browser?.close();
    server?.stop();
  });

  it('measures every gallery card at 390 and 1280', () => {
    const expected = SECTION_2.length + MISSED.length + Object.keys(INTEGRATED_LESSONS).length;
    assert.equal(cards.filter((c) => c.width === 390).length, expected);
    assert.equal(cards.filter((c) => c.width === 1280).length, expected);
  });

  it('starts by itself and the picture moves, not only the step badges', () => {
    for (const card of cards) {
      const id = `${card.slug} @${card.width}`;
      assert.equal(card.started, true, `${id} did not start`);
      assert.equal(card.engine, 'css', id);
      assert.ok(card.transformAnimations >= 2, `${id} has ${card.transformAnimations} transform animations`);
      assert.ok(card.movingShapes >= 2, `${id} moves ${card.movingShapes} shapes`);
      assert.ok(card.changedPct >= 0.3, `${id} changed ${card.changedPct}% of its pixels`);
      assert.ok(card.changedBoxPct >= 5, `${id} changes stay in ${card.changedBoxPct}% of the card`);
    }
  });

  it('finds only the badge pulse on the base side of the section 2 pages', () => {
    for (const slug of SECTION_2) {
      const card = baseCards.find((c) => c.slug === slug);
      assert.ok(card, slug);
      assert.equal(card.movingShapes, 0, slug);
      assert.equal(card.transformAnimations, 0, slug);
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

  it('keeps the mean bars balanced at nine when motion is stopped', async () => {
    const page = await browser.newPage();
    try {
      await page.goto(`${server.origin}/review/landing-loops-pr-b`, { waitUntil: 'load' });
      const pieces = '[data-review-slug="collect-represent-data-grade-6"] [data-review-side="after"] .level-piece';
      for (const stopClass of ['nd-motion-off', 'noam-a11y-motion']) {
        await page.evaluate((name) => {
          document.documentElement.classList.remove('nd-motion-off', 'noam-a11y-motion');
          document.documentElement.classList.add(name);
        }, stopClass);
        const positions = await page.$$eval(pieces, (elements) => elements.map((el) => {
          const style = getComputedStyle(el);
          const matrix = new DOMMatrixReadOnly(style.transform);
          return { x: matrix.m41, y: matrix.m42, animation: style.animationName };
        }));
        assert.deepEqual(positions, [
          { x: -90, y: 42, animation: 'none' },
          { x: 270, y: 14, animation: 'none' },
        ], stopClass);
      }
    } finally {
      await page.close();
    }
  });

  it('renders new pages with an honest missing-before state and their current lesson', async () => {
    const page = await browser.newPage();
    try {
      const response = await page.goto(`${server.origin}/review/landing-loops-pr-b`, { waitUntil: 'load' });
      assert.equal(response?.status(), 200);
      for (const [slug, variant] of Object.entries(INTEGRATED_LESSONS)) {
        const card = `[data-review-slug="${slug}"]`;
        assert.ok(await page.$(`${card} [data-review-side="before"] [data-review-missing]`), slug);
        assert.equal(await page.$(`${card} [data-review-side="before"] [data-landing-loop]`), null, slug);
        assert.ok(await page.$(`${card} [data-review-side="after"] [data-lesson="${variant}"]`), slug);
      }
      for (const slug of [...SECTION_2, ...MISSED]) {
        assert.equal(await page.$(`[data-review-slug="${slug}"] [data-review-side="before"] [data-review-missing]`), null, slug);
      }
    } finally {
      await page.close();
    }
  });
});
