/**
 * Audit 10.11.2026, sections 5 and 1: the carousel films are wired to their
 * topic pages, and every listed landing shows a picture that really moves.
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

const FILMS: Record<string, string> = {
  'frequency-chance-grade-5': 'data',
  'circle-area-circumference-grade-8': 'circ-unroll',
  'exterior-angle-triangle-grade-8': 'exterior',
  'linear-function-grade-8': 'slope',
  'linear-function-grade-9': 'slope',
  'probability-grade-9': 'two-coins',
  'square-grade-9': 'quad-tree',
  'trapezoid-grade-9': 'trap-area',
  'triangle-30-60-90-grade-9': 'half-eq',
  'square-rectangle-grade-1': 'sq-stretch',
  'numbers-to-1000-grade-2': 'mark-250',
  'unit-fractions-part-of-whole-grade-3': 'unit-frac',
  'collecting-data-grade-3': 'data',
  'long-division-remainder-grade-4': 'cookies',
  'box-volume-grade-6': 'box-vol',
  'scaling-dimensions-grade-6': 'area-x4',
  'angles-review-grade-7': 'sup-angles',
  'equations-basics-grade-7': 'balance',
  'signed-numbers-grade-7': 'signed-jump',
  'solids-box-cube-prism-grade-7': 'cube-8',
  'coordinate-plane-grade-8': 'coord-walk',
  'cylinder-volume-grade-8': 'cyl-stack',
  'similar-triangles-grade-8': 'similar',
  'statistics-grade-8': 'mean-cols',
  'triangle-congruence-grade-8': 'sas-snap',
  'parallelogram-trapezoid-area-grade-9': 'para-rect',
  'quadratic-function-grade-9': 'parab',
  'similar-triangles-grade-9': 'similar',
  'statistics-grade-9': 'mean-cols',
  'frequency-grade-7': 'data',
  'equations-introduction-equivalence-grade-7': 'balance',
  'annual-review-grade-7': 'signed-jump',
  'mean-grade-8': 'mean-cols',
  'slope-line-through-origin-grade-8': 'slope',
  'midyear-diagnostic-grade-8': 'balance',
};

const SCENES: Record<string, string> = {
  'fraction-decimal-percent-grade-6': 'percent',
  'coordinate-plane-applications-grade-7': 'axis-rect',
  'cone-grade-8': 'cone',
  'percentage-problems-grade-8': 'pct-discount',
  'coordinate-plane-applications-grade-9': 'distance',
  'rhombus-grade-9': 'rhombus',
  'percent-change-grade-8': 'pct-discount',
};

/** Audit section 5 films that stay off topic pages, and why. */
const NOT_WIRED: Record<string, string> = {
  'apples-5': 'addition-to-10-grade-1 keeps add-within, which shows its own example 4 + 3 = 7',
  'signed-ops': 'a formula-only film, so it would not add picture motion',
  'quad-gate': 'no page teaches its idea better than the page it would replace',
  'corr-angles': 'parallel-lines-angles-grade-8 has its own authored film',
  'angle-sum': 'already on triangle-quadrilateral-angle-sum-grade-7 as the vertex-descent film',
};

const SECTION_5 = [
  'apples-5', 'cookies', 'unit-frac', 'quad-gate', 'mark-250', 'data', 'signed-jump', 'signed-ops', 'box-vol',
  'coord-walk', 'cube-8', 'sq-stretch', 'trap-area', 'sup-angles', 'angle-sum', 'exterior', 'corr-angles',
  'circ-unroll', 'sas-snap', 'cyl-stack', 'similar', 'slope', 'mean-cols', 'half-eq', 'parab', 'area-x4', 'two-coins',
];

const SECTION_1 = [
  'frequency-chance-grade-5', 'fraction-decimal-percent-grade-6', 'coordinate-plane-applications-grade-7',
  'circle-area-circumference-grade-8', 'cone-grade-8', 'exterior-angle-triangle-grade-8', 'linear-function-grade-8',
  'percentage-problems-grade-8', 'coordinate-plane-applications-grade-9', 'linear-function-grade-9',
  'probability-grade-9', 'rhombus-grade-9', 'square-grade-9', 'trapezoid-grade-9', 'triangle-30-60-90-grade-9',
];

describe('audit sections 5 and 1: wiring', () => {
  it('mounts each matching film on its topic page', () => {
    for (const [slug, variant] of Object.entries(FILMS)) {
      assert.deepEqual(topicLandingLoop(loadTopicPage(slug)), { kind: 'concept', variant, marker: `concept-${variant}` }, slug);
    }
    for (const [slug, variant] of Object.entries(SCENES)) {
      assert.deepEqual(topicLandingLoop(loadTopicPage(slug)), { kind: 'css', variant, marker: variant }, slug);
    }
  });

  it('wires every section 5 film or states why it stays off', () => {
    const used = new Set<string>();
    for (const slug of TOPIC_PAGE_SLUGS) {
      const loop = topicLandingLoop(loadTopicPage(slug));
      if (loop.kind === 'concept') used.add(loop.variant);
    }
    for (const film of SECTION_5) {
      if (film === 'angle-sum') continue;
      assert.equal(used.has(film) || film in NOT_WIRED, true, film);
      assert.equal(used.has(film) && film in NOT_WIRED, false, `${film} is wired and also listed as not wired`);
    }
    assert.equal(topicLandingLoop(loadTopicPage('triangle-quadrilateral-angle-sum-grade-7')).kind, 'film');
  });

  it('gives every section 1 page a loop in the review gallery', () => {
    const gallery = readFileSync(join(root, 'src/dev-pages/review/landing-loops-pr-a.astro'), 'utf8');
    for (const slug of [...SECTION_1, ...Object.keys(FILMS), ...Object.keys(SCENES)]) {
      assert.equal(slug in FILMS || slug in SCENES, true, slug);
      assert.match(gallery, new RegExp(`slug: '${slug}'`), slug);
    }
  });
});

describe('audit sections 5 and 1: real motion in the browser', { timeout: 15 * 60 * 1000 }, () => {
  let server: ReviewServer;
  let browser: Browser;
  const cards: CardMotion[] = [];
  let baseCards: CardMotion[] = [];

  before(async () => {
    server = await startReviewServer('/review/landing-loops-pr-a');
    browser = await launchBrowser();
    const url = `${server.origin}/review/landing-loops-pr-a`;
    for (const width of [390, 1280]) cards.push(...(await measureGallery(browser, url, width)));
    baseCards = await measureGallery(browser, url, 1280, 'before');
    mkdirSync(join(root, 'reports'), { recursive: true });
    writeFileSync(join(root, 'reports/landing-motion-pr-a.json'), `${JSON.stringify({ after: cards, before: baseCards }, null, 1)}\n`);
  });

  after(async () => {
    await browser?.close();
    server?.stop();
  });

  it('measures every gallery card at 390 and 1280', () => {
    const expected = Object.keys(FILMS).length + Object.keys(SCENES).length;
    assert.equal(cards.filter((c) => c.width === 390).length, expected);
    assert.equal(cards.filter((c) => c.width === 1280).length, expected);
  });

  it('starts by itself and the picture moves, not only its opacity', () => {
    for (const card of cards) {
      const id = `${card.slug} @${card.width}`;
      assert.equal(card.started, true, `${id} did not start`);
      assert.equal(card.engine, card.slug in FILMS ? 'film' : 'css', id);
      if (card.engine === 'css') assert.ok(card.transformAnimations >= 2, `${id} has ${card.transformAnimations} transform animations`);
      assert.ok(card.movingShapes >= 2, `${id} moves ${card.movingShapes} shapes`);
      assert.ok(card.changedPct >= 0.3, `${id} changed ${card.changedPct}% of its pixels`);
      assert.ok(card.changedBoxPct >= 5, `${id} changes stay in ${card.changedBoxPct}% of the card`);
    }
  });

  it('finds no picture motion on the base side of the section 1 pages', () => {
    for (const slug of SECTION_1) {
      const card = baseCards.find((c) => c.slug === slug);
      assert.ok(card, slug);
      assert.equal(card.movingShapes, 0, slug);
      assert.ok(card.changedPct < 0.3, `${slug} base changed ${card.changedPct}%`);
    }
  });

  it('keeps one card height, no sideways scroll, and stops with the site Stop control', () => {
    for (const card of cards) {
      const id = `${card.slug} @${card.width}`;
      assert.equal(card.stableHeight, true, `${id} changes height`);
      assert.equal(card.overflowX, false, `${id} scrolls sideways`);
      assert.equal(card.runningAfterStop, 0, `${id} keeps running after Stop`);
      assert.equal(card.filmPlayingAfterStop, false, `${id} film plays after Stop`);
    }
  });
});
