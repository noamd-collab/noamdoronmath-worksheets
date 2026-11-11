import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { transform as compileAstro } from '@astrojs/compiler';
import { transform as parseJavaScript } from 'esbuild';
import { CSS_LOOP_IDEAS, topicLandingLoop } from '../src/lib/landingLoops.ts';
import { LESSON_LOOPS, isLessonLoop } from '../src/lib/lessonLoops.ts';
import { lessonMathParts } from '../src/lib/lessonMath.ts';
import { loadTopicPage } from '../src/lib/topicPages.ts';

/** Independently reviewed expectations for all 52 catalog-gap pages. A broad
 * family fallback must not silently replace, for example, median with mean. */
const EXPECTED = {
  'annual-review-grade-7': 'signed-jump',
  'assessment-task-1-grade-7': 'measure',
  'congruent-polygons-transformations-grade-7': 'transform',
  'data-collection-reading-grade-7': 'read-linegraph',
  'equations-introduction-equivalence-grade-7': 'balance',
  'equilateral-triangle-grade-7': 'equilateral-60',
  'frequency-grade-7': 'data',
  'probability-introduction-grade-7': 'probability',
  'relative-frequency-experiments-grade-7': 'experimental-frequency',
  'relative-frequency-grade-7': 'relative-frequency',
  'two-step-equations-grade-7': 'two-step-equation',
  'assessment-task-1-grade-8': 'parallel',
  'axis-intercepts-grade-8': 'axis-intercepts',
  'bar-charts-pictograms-grade-8': 'read-bars',
  'choosing-measure-of-center-grade-8': 'choose-center',
  'data-literacy-grade-8': 'truncated-axis',
  'data-range-grade-8': 'compare-groups',
  'end-of-year-diagnostic-grade-8': 'map-scale',
  'equation-of-a-line-grade-8': 'line-from-points',
  'equations-with-fractions-grade-8': 'numeric-denominators',
  'function-concept-grade-8': 'pattern-graph',
  'function-notation-grade-8': 'read-graph',
  'function-representations-grade-8': 'linear-table',
  'gap-bridging-review-grade-8': 'signed',
  'graphical-inequalities-grade-8': 'graphical-inequality',
  'interpolation-extrapolation-grade-8': 'linear-interpolation',
  'investigation-generalization-grade-8': 'pattern',
  'lines-parallel-to-axes-grade-8': 'axis-parallel-lines',
  'mean-grade-8': 'mean-cols',
  'median-grade-8': 'data-median',
  'midyear-diagnostic-grade-8': 'balance',
  'motion-problems-grade-8': 'motion-rate',
  'non-routine-problems-grade-8': 'missing-mean',
  'percent-change-grade-8': 'pct-discount',
  'percent-representations-grade-8': 'pct-25',
  'pie-charts-grade-8': 'pie-sector',
  'prior-knowledge-diagnostic-grade-8': 'order',
  'probability-experiments-fairness-grade-8': 'experimental-frequency',
  'probability-sample-space-grade-8': 'probability',
  'rate-of-change-grade-8': 'linear-table',
  'ratio-proportion-grade-8': 'ratio-beads',
  'scale-grade-8': 'map-scale',
  'slope-line-through-origin-grade-8': 'slope',
  'square-root-grade-8': 'roots',
  'successive-percent-changes-grade-8': 'successive-percent',
  'summary-review-grade-8': 'ineq',
  'summative-assessment-grade-8': 'coords',
  'systems-algebraic-solution-grade-8': 'system-elimination',
  'systems-word-problems-grade-8': 'system-model',
  'two-data-sources-grade-8': 'compare-sources',
  'word-problems-choosing-unknowns-grade-8': 'choose-unknown',
  'equilateral-triangle-grade-9': 'equilateral-60',
} as const;

describe('52 new topic landing demonstrations', () => {
  it('compiles the actual Astro scenes to valid JavaScript', async () => {
    for (const name of ['MiddleLessonPicture', 'LessonLoop']) {
      const filename = new URL(`../src/components/${name}.astro`, import.meta.url);
      const compiled = await compileAstro(readFileSync(filename, 'utf8'), { filename: filename.pathname });
      await parseJavaScript(compiled.code, { loader: 'ts' });
    }
  });
  it('keeps a topic-specific demonstration on every reviewed route', () => {
    assert.equal(Object.keys(EXPECTED).length, 52);
    for (const [slug, expected] of Object.entries(EXPECTED)) {
      const loop = topicLandingLoop(loadTopicPage(slug));
      assert.notEqual(loop.kind, 'film', slug);
      if (loop.kind === 'film') continue;
      assert.equal(loop.variant, expected, slug);
      if (loop.kind === 'css' && isLessonLoop(loop.variant)) {
        assert.equal(CSS_LOOP_IDEAS[loop.variant], LESSON_LOOPS[loop.variant].idea, slug);
      }
    }
  });

  it('renders every authored slash expression through the stacked-fraction parser', () => {
    const tested = new Set<string>();
    for (const expected of Object.values(EXPECTED)) {
      if (!isLessonLoop(expected) || tested.has(expected)) continue;
      tested.add(expected);
      for (const { math } of LESSON_LOOPS[expected].steps) {
        if (!math.includes('/')) continue;
        const parsed = lessonMathParts(math);
        assert.ok(parsed.some(part => typeof part !== 'string'), math);
        assert.ok(parsed.every(part => typeof part !== 'string' || !part.includes('/')), math);
      }
    }
  });

  it('distinguishes the previously conflated mathematical topics', () => {
    assert.equal(LESSON_LOOPS['data-median'].picture, 'median-data');
    assert.match(LESSON_LOOPS['data-median'].steps[2].math, /^6$/);
    assert.match(LESSON_LOOPS['successive-percent'].steps[1].math, /192$/);
    assert.equal(200 * .8 * 1.2, 192);
    assert.match(LESSON_LOOPS['axis-intercepts'].steps[1].math, /\(0, −4\)/);
    assert.equal(2 * 2 - 4, 0);
    assert.match(LESSON_LOOPS['graphical-inequality'].steps[2].math, /x < 3$/);
    assert.ok(2 + 1 < 7 - 2);
    assert.ok(!(4 + 1 < 7 - 4));
    assert.match(LESSON_LOOPS['experimental-frequency'].idea, /מטבע הוגן/);
    assert.match(LESSON_LOOPS['experimental-frequency'].idea, /אינם מבטיחים/);
  });
});
