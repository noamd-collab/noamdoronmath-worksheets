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
/** Lessons that had no picture at all, only their three steps. */
const NEW_PICTURES = { 'weight-units': 'weights', 'round-large': 'rounding', 'long-division': 'division', 'prime-factorization': 'factortree' };

describe('audit section 2: wiring', () => {
  it('keeps every section 2 page on its lesson, except the three PR A films', () => {
    for (const slug of [...SECTION_2, ...MISSED]) {
      const loop = topicLandingLoop(loadTopicPage(slug));
      assert.equal(loop.kind === 'css' && isLessonLoop(loop.variant), true, slug);
    }
    for (const slug of NOW_FILMS) assert.equal(topicLandingLoop(loadTopicPage(slug)).kind, 'concept', slug);
  });

  it('covers every lesson landing on the site, and gives the four step-only lessons a picture', () => {
    const lessonPages = TOPIC_PAGE_SLUGS.filter((slug) => {
      const loop = topicLandingLoop(loadTopicPage(slug));
      return loop.kind === 'css' && isLessonLoop(loop.variant);
    });
    assert.deepEqual([...lessonPages].sort(), [...SECTION_2, ...MISSED].sort());
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
    const expected = SECTION_2.length + MISSED.length;
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
});
