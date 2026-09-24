#!/usr/bin/env node
/**
 * HEADLESS-MIGRATION-15 — read-only route coverage audit.
 *
 * Compares the public production sitemap (+ homepage nav hrefs) against
 * routes currently represented in this Astro POC preview.
 *
 * Distinguishes:
 *   - functional coverage (e.g. /grade-N ≈ /worksheets?grade=N catalog)
 *   - route/URL parity (exact production path present in preview)
 *
 * missingBucketCounts are mutually exclusive and MUST sum to missingFromPreview.
 *
 * Does NOT copy SEO prose, change canonical/robots, or mutate production.
 *
 * Usage:
 *   node scripts/audit-production-routes.mjs
 *   node scripts/audit-production-routes.mjs --json
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PROD = 'https://www.noamdoronmath.co.il';
const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', 'reports');
const asJson = process.argv.includes('--json');

/** Routes this isolated preview intentionally covers today. */
const EXACT_GRADE_HUBS = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const TOPIC_PAGE_EXACT = [
  // M18 pilot
  '/signed-numbers-grade-7',
  '/pythagorean-theorem-grade-8',
  '/quadratic-function-grade-9',
  // M19 batch
  '/equations-basics-grade-7',
  '/coordinate-plane-quadrants-grade-7',
  '/linear-function-grade-8',
  '/triangle-congruence-grade-8',
  '/quadratic-equations-grade-9',
  '/rectangle-grade-9',
  // M20 batch
  '/pythagorean-theorem-grade-7',
  '/algebraic-expressions-grade-7',
  '/powers-grade-7',
  '/systems-of-equations-grade-8',
  '/statistics-grade-8',
  '/geometric-proof-grade-8',
  '/similar-triangles-grade-8',
  '/factoring-grade-9',
  '/linear-function-grade-9',
  '/parallelogram-grade-9',
  '/square-grade-9',
  // M21 batch (24; incl. paragraph-only self-check pages)
  '/combining-like-terms-grade-7',
  '/multiplying-signed-numbers-grade-7',
  '/dividing-signed-numbers-grade-7',
  '/order-of-operations-signed-numbers-grade-7',
  '/number-line-absolute-value-grade-7',
  '/square-root-grade-7',
  '/angles-introduction-measurement-grade-7',
  '/adjacent-vertical-angles-grade-7',
  '/linear-equations-grade-8',
  '/inequalities-grade-8',
  '/percentage-problems-grade-8',
  '/coordinate-plane-grade-8',
  '/congruence-theorems-grade-8',
  '/triangle-congruence-proofs-grade-8',
  '/exterior-angle-triangle-grade-8',
  '/isosceles-triangle-properties-grade-8',
  '/distributive-law-grade-9',
  '/quadratic-inequalities-systems-grade-9',
  '/exponent-rules-grade-9',
  '/square-roots-grade-9',
  '/word-problems-grade-9',
  '/binomial-square-grade-9',
  '/difference-of-squares-grade-9',
  '/algebraic-fractions-grade-9',
  // M22 batch (24; AA skipped, 30-60-90 replacement)
  '/angles-review-grade-7',
  '/triangle-quadrilateral-angle-sum-grade-7',
  '/coordinate-plane-four-quadrants-grade-7',
  '/coordinate-plane-scale-grade-7',
  '/coordinate-plane-applications-grade-7',
  '/equations-advanced-grade-7',
  '/equations-both-sides-word-problems-grade-7',
  '/pythagoras-applications-grade-7',
  '/isosceles-triangle-grade-8',
  '/triangle-median-grade-8',
  '/parallel-lines-angles-grade-8',
  '/triangle-similarity-proof-grade-8',
  '/similar-triangles-area-ratio-grade-8',
  '/advanced-pythagoras-grade-8',
  '/pythagoras-in-space-grade-8',
  '/circle-area-circumference-grade-8',
  '/precalculus-functions-graphs-grade-9',
  '/reading-graphs-grade-9',
  '/analytic-geometry-grade-9',
  '/coordinate-plane-applications-grade-9',
  '/rhombus-grade-9',
  '/trapezoid-grade-9',
  '/similar-triangles-grade-9',
  '/triangle-30-60-90-grade-9',
  // M23 remaining live topic-SEO
  '/angles-grade-7',
  '/area-parallelogram-trapezoid-composite-grade-7',
  '/area-rectangle-perimeter-grade-7',
  '/composite-polygons-area-grade-9',
  '/cone-grade-8',
  '/congruent-polygons-transformations-grade-9',
  '/cylinder-surface-area-grade-8',
  '/cylinder-volume-grade-8',
  '/isosceles-triangle-grade-9',
  '/parallelogram-trapezoid-area-grade-9',
  '/probability-grade-9',
  '/pythagoras-applications-grade-9',
  '/pythagoras-basics-grade-9',
  '/pythagorean-theorem-grade-9',
  '/rectangle-square-area-grade-9',
  '/solids-box-cube-prism-grade-7',
  '/statistics-grade-9',
  '/transition-to-high-school-grade-9',
  '/triangle-area-grade-9',
  '/triangle-calculations-grade-9',
  '/triangle-sides-angles-grade-9',
  '/triangular-prism-surface-area-grade-9',
  '/triangular-prism-volume-grade-9',
  // M30 last topic-SEO gaps
  '/triangle-area-grade-7',
  '/triangle-similarity-aa-grade-9',
  '/special-triangles-grade-7-new',
  '/patterns-and-graphs-grade-7',
  // M30 redirect (counts as covered exact route)
  '/equations-grade-7',
];

/** Non-topic site / policy / other pages covered exactly in preview (M24). */
const SITE_PAGE_EXACT = [
  '/aboutus',
  '/math-tools',
  '/accessibilityadaptation',
  '/terms',
  '/conditionforfreeworksheets',
  '/high-school-math',
  // redirects represented as routes
  '/high-school-math-1',
  '/page',
];

const POLICY_PATHS = new Set([
  '/accessibilityadaptation',
  '/terms',
  '/conditionforfreeworksheets',
]);

const SITE_NAV_PATHS = new Set(['/aboutus', '/math-tools', '/high-school-math-1']);

/** M25–M29 served blog posts (all 59). */
const BLOG_POST_PILOT_EXACT = [
  "/post/%D7%AA%D7%A8%D7%92%D7%99%D7%9C%D7%99-%D7%97%D7%99%D7%91%D7%95%D7%A8-%D7%95%D7%97%D7%99%D7%A1%D7%95%D7%A8-%D7%9C%D7%9B%D7%99%D7%AA%D7%94-%D7%90-%D7%9C%D7%AA%D7%A8%D7%92%D7%95%D7%9C-%D7%A0%D7%9B%D7%95%D7%9F-%D7%91%D7%91%D7%99%D7%AA",
  "/post/%D7%A1%D7%95%D7%9B%D7%9F-ai-%D7%9C%D7%AA%D7%A8%D7%92%D7%99%D7%9C%D7%99%D7%9D-%D7%9B%D7%9E%D7%95-%D7%9E%D7%95%D7%A8%D7%94-%D7%A4%D7%A8%D7%98%D7%99-%D7%95%D7%94%D7%9B%D7%95%D7%9C-%D7%91%D7%97%D7%99%D7%A0%D7%9D",
  "/post/annual-review-grade-7",
  "/post/assessment-1-grade-7",
  "/post/box-and-cube-grade-7",
  "/post/%D7%AA%D7%A8%D7%92%D7%99%D7%9C%D7%99-%D7%90%D7%AA%D7%92%D7%A8-%D7%91%D7%9E%D7%AA%D7%9E%D7%98%D7%99%D7%A7%D7%94-%D7%9C%D7%9B%D7%99%D7%AA%D7%94-%D7%93-%D7%A9%D7%9E%D7%A7%D7%93%D7%9E%D7%99%D7%9D-%D7%97%D7%A9%D7%99%D7%91%D7%94",
  "/post/common-factor-and-minus-parentheses-grade-7",
  "/post/composite-polygons-area-grade-7",
  "/post/congruent-polygons-transformations-grade-7",
  "/post/%D7%9E%D7%93%D7%A8%D7%99%D7%9A-%D7%9C%D7%AA%D7%A8%D7%92%D7%95%D7%9C-%D7%A6%D7%99%D7%A8%D7%99%D7%9D-%D7%A7%D7%95%D7%90%D7%95%D7%A8%D7%93%D7%99%D7%A0%D7%98%D7%95%D7%AA-%D7%A9%D7%9E%D7%AA%D7%97%D7%99%D7%9C-%D7%A0%D7%9B%D7%95%D7%9F",
  "/post/data-collection-reading-grade-7",
  "/post/%D7%AA%D7%A8%D7%92%D7%95%D7%9C-%D7%9E%D7%A1%D7%A4%D7%A8%D7%99%D7%9D-%D7%A2%D7%A9%D7%A8%D7%95%D7%A0%D7%99%D7%99%D7%9D-%D7%9C%D7%9B%D7%99%D7%AA%D7%94-%D7%95-%D7%91%D7%91%D7%99%D7%AA-%D7%95%D7%91%D7%9B%D7%99%D7%AA%D7%94",
  "/post/distributive-property-parentheses-grade-7",
  "/post/%D7%91%D7%99%D7%A0%D7%94-%D7%97%D7%99%D7%A0%D7%95%D7%9B%D7%99%D7%AA-%D7%A9%D7%9E%D7%A7%D7%93%D7%9E%D7%AA-%D7%9B%D7%9C-%D7%AA%D7%9C%D7%9E%D7%99%D7%93-%D7%91%D7%9E%D7%AA%D7%9E%D7%98%D7%99%D7%A7%D7%94",
  "/post/%D7%9E%D7%A9%D7%95%D7%95%D7%90%D7%95%D7%AA-%D7%9C%D7%9B%D7%99%D7%AA%D7%94-%D7%97-%D7%AA%D7%A8%D7%92%D7%95%D7%9C-%D7%A9%D7%9E%D7%A1%D7%93%D7%A8-%D7%90%D7%AA-%D7%94%D7%93%D7%A8%D7%9A",
  "/post/equations-parentheses-equivalence-grade-7",
  "/post/equilateral-triangle-advanced-grade-7",
  "/post/%D7%94%D7%9B%D7%A0%D7%94-%D7%9C%D7%9E%D7%91%D7%97%D7%9F-%D7%91%D7%9E%D7%AA%D7%9E%D7%98%D7%99%D7%A7%D7%94-%D7%9C%D7%9B%D7%99%D7%AA%D7%94-%D7%94-%D7%91-7-%D7%99%D7%9E%D7%99%D7%9D",
  "/post/first-quadrant-graph-points-grade-7",
  "/post/%D7%97%D7%96%D7%A8%D7%94-%D7%9E%D7%9E%D7%95%D7%A7%D7%93%D7%AA-%D7%91%D7%9E%D7%AA%D7%9E%D7%98%D7%99%D7%A7%D7%94-%D7%90%D7%95%D7%A0%D7%9C%D7%99%D7%99%D7%9F-%D7%A9%D7%9E%D7%A7%D7%93%D7%9E%D7%AA-%D7%91%D7%90%D7%9E%D7%AA",
  "/post/%D7%AA%D7%A8%D7%92%D7%95%D7%9C-%D7%A9%D7%91%D7%A8%D7%99%D7%9D-%D7%9C%D7%9B%D7%99%D7%AA%D7%94-%D7%93-%D7%A9%D7%9E%D7%97%D7%96%D7%A7-%D7%94%D7%91%D7%A0%D7%94-%D7%95%D7%91%D7%99%D7%98%D7%97%D7%95%D7%9F",
  "/post/%D7%93%D7%A4%D7%99-%D7%A2%D7%91%D7%95%D7%93%D7%94-%D7%91%D7%9E%D7%AA%D7%9E%D7%98%D7%99%D7%A7%D7%94-%D7%91%D7%97%D7%99%D7%A0%D7%9D-%D7%9C%D7%9B%D7%99%D7%AA%D7%95%D7%AA-%D7%90-%D7%98-%D7%9C%D7%91%D7%99%D7%AA-%D7%95%D7%91%D7%A7%D7%A8%D7%95%D7%91-%D7%92%D7%9D-%D7%A1%D7%95%D7%9B%D7%9F-ai-%D7%AA%D7%95%D7%9E%D7%9A",
  "/post/frequency-tables-grade-7",
  "/post/%D7%A4%D7%95%D7%A0%D7%A7%D7%A6%D7%99%D7%95%D7%AA-%D7%9C%D7%9B%D7%99%D7%AA%D7%94-%D7%98-%D7%9C%D7%94%D7%91%D7%99%D7%9F-%D7%92%D7%A8%D7%A4%D7%99%D7%9D-%D7%95%D7%9C%D7%A4%D7%AA%D7%95%D7%A8-%D7%A0%D7%9B%D7%95%D7%9F",
  "/post/%D7%90%D7%99%D7%9A-%D7%9C%D7%AA%D7%A8%D7%92%D7%9C-%D7%92%D7%90%D7%95%D7%9E%D7%98%D7%A8%D7%99%D7%94-%D7%9C%D7%9B%D7%99%D7%AA%D7%94-%D7%95-%D7%95%D7%9C%D7%94%D7%A6%D7%9C%D7%99%D7%97-%D7%91%D7%9E%D7%91%D7%97%D7%A0%D7%99%D7%9D",
  "/post/%D7%93%D7%A4%D7%99-%D7%A2%D7%91%D7%95%D7%93%D7%94-%D7%9C%D7%9B%D7%99%D7%AA%D7%94-%D7%90-%D7%A9%D7%9E%D7%97%D7%96%D7%A7%D7%99%D7%9D-%D7%91%D7%99%D7%98%D7%97%D7%95%D7%9F-%D7%91%D7%9E%D7%AA%D7%9E%D7%98%D7%99%D7%A7%D7%94",
  "/post/%D7%93%D7%A4%D7%99-%D7%A2%D7%91%D7%95%D7%93%D7%94-%D7%9C%D7%A9%D7%99%D7%A2%D7%95%D7%A8%D7%99-%D7%91%D7%99%D7%AA-%D7%91%D7%9E%D7%AA%D7%9E%D7%98%D7%99%D7%A7%D7%94-%D7%A9%D7%9E%D7%A7%D7%93%D7%9E%D7%99%D7%9D-%D7%91%D7%99%D7%98%D7%97%D7%95%D7%9F",
  "/post/%D7%9E%D7%AA%D7%9E%D7%98%D7%99%D7%A7%D7%94-%D7%9C%D7%99%D7%9C%D7%93%D7%99%D7%9D-%D7%A9%D7%91%D7%95%D7%A0%D7%94-%D7%91%D7%99%D7%98%D7%97%D7%95%D7%9F-%D7%95%D7%AA%D7%A8%D7%92%D7%95%D7%9C-%D7%A0%D7%9B%D7%95%D7%9F",
  "/post/%D7%AA%D7%A8%D7%92%D7%95%D7%9C-%D7%97%D7%A9%D7%99%D7%91%D7%94-%D7%9E%D7%AA%D7%9E%D7%98%D7%99%D7%AA-%D7%9C%D7%99%D7%9C%D7%93%D7%99%D7%9D-%D7%A9%D7%91%D7%95%D7%A0%D7%94-%D7%91%D7%99%D7%98%D7%97%D7%95%D7%9F",
  "/post/%D7%93%D7%A4%D7%99-%D7%A2%D7%91%D7%95%D7%93%D7%94-%D7%9C%D7%9C%D7%95%D7%97-%D7%94%D7%9B%D7%A4%D7%9C-%D7%9C%D7%AA%D7%A8%D7%92%D7%95%D7%9C-%D7%A0%D7%9B%D7%95%D7%9F-%D7%91%D7%91%D7%99%D7%AA",
  "/post/%D7%91%D7%A7%D7%A8%D7%95%D7%91-%D7%A1%D7%95%D7%9B%D7%9F-%D7%91%D7%99%D7%A0%D7%94-%D7%9E%D7%9C%D7%90%D7%9B%D7%95%D7%AA%D7%99%D7%AA-%D7%9C%D7%AA%D7%A8%D7%92%D7%95%D7%9C-%D7%93%D7%A4%D7%99-%D7%A2%D7%91%D7%95%D7%93%D7%94",
  "/post/one-step-equations-grade-7",
  "/post/%D7%90%D7%99%D7%9A-%D7%A4%D7%95%D7%AA%D7%A8%D7%99%D7%9D-%D7%A1%D7%93%D7%A8-%D7%A4%D7%A2%D7%95%D7%9C%D7%95%D7%AA-%D7%97%D7%A9%D7%91%D7%95%D7%9F-%D7%91%D7%9C%D7%99-%D7%9C%D7%94%D7%AA%D7%91%D7%9C%D7%91%D7%9C",
  "/post/parallelogram-trapezoid-area-grade-7",
  "/post/patterns-grade-7",
  "/post/%D7%AA%D7%A8%D7%92%D7%99%D7%9C%D7%99-%D7%90%D7%97%D7%95%D7%96%D7%99%D7%9D-%D7%9C%D7%9B%D7%99%D7%AA%D7%94-%D7%96-%D7%9C%D7%AA%D7%A8%D7%92%D7%95%D7%9C-%D7%91%D7%98%D7%95%D7%97-%D7%95%D7%9E%D7%93%D7%95%D7%99%D7%A7",
  "/post/perimeter-complex-shapes-algebra-grade-7",
  "/post/%D7%9E%D7%93%D7%A8%D7%99%D7%9A-%D7%9C%D7%97%D7%96%D7%A7%D7%95%D7%AA-%D7%95%D7%A9%D7%95%D7%A8%D7%A9%D7%99%D7%9D-%D7%91%D7%97%D7%98%D7%99%D7%91%D7%94-%D7%9C%D7%AA%D7%A8%D7%92%D7%95%D7%9C-%D7%91%D7%98%D7%95%D7%97",
  "/post/probability-introduction-grade-7",
  "/post/%D7%9E%D7%93%D7%A8%D7%99%D7%9A-%D7%9C%D7%A7%D7%A8%D7%99%D7%90%D7%AA-%D7%92%D7%A8%D7%A4%D7%99%D7%9D-%D7%9C%D7%99%D7%9C%D7%93%D7%99%D7%9D-%D7%91%D7%A6%D7%95%D7%A8%D7%94-%D7%A4%D7%A9%D7%95%D7%98%D7%94",
  "/post/rectangle-square-area-advanced-grade-7",
  "/post/relative-frequency-experiments-grade-7",
  "/post/relative-frequency-introduction-grade-7",
  "/post/simplify-then-solve-equations-grade-7",
  "/post/%D7%AA%D7%A8%D7%92%D7%95%D7%9C-%D7%9E%D7%AA%D7%9E%D7%98%D7%99%D7%A7%D7%94-%D7%9C%D7%AA%D7%9C%D7%9E%D7%99%D7%93%D7%99%D7%9D-%D7%9E%D7%AA%D7%A7%D7%A9%D7%99%D7%9D-%D7%A9%D7%9E%D7%A7%D7%93%D7%9D-%D7%91%D7%99%D7%98%D7%97%D7%95%D7%9F",
  "/post/substitution-in-algebraic-expressions-grade-7",
  "/post/three-representations-equation-solution-grade-7",
  "/post/triangular-prism-surface-area-grade-7",
  "/post/triangular-prism-volume-grade-7",
  "/post/two-step-equations-grade-7",
  "/post/unknown-on-both-sides-grade-7",
  "/post/variables-and-algebraic-modeling-grade-7",
  "/post/what-is-an-equation-solution-grade-7",
  "/post/%D7%9E%D7%AA%D7%99-%D7%9C%D7%95%D7%9E%D7%93%D7%99%D7%9D-%D7%90%D7%97%D7%95%D7%96%D7%99%D7%9D-%D7%95%D7%90%D7%99%D7%9A-%D7%91%D7%95%D7%A0%D7%99%D7%9D-%D7%94%D7%91%D7%A0%D7%94-%D7%A0%D7%9B%D7%95%D7%A0%D7%94-%D7%91%D7%9B%D7%99%D7%AA%D7%94-%D7%95",
  "/post/%D7%91%D7%A2%D7%99%D7%95%D7%AA-%D7%9E%D7%99%D7%9C%D7%95%D7%9C%D7%99%D7%95%D7%AA-%D7%91%D7%9E%D7%AA%D7%9E%D7%98%D7%99%D7%A7%D7%94-%D7%A4%D7%95%D7%AA%D7%A8%D7%99%D7%9D-%D7%A9%D7%9C%D7%91-%D7%90%D7%97%D7%A8-%D7%A9%D7%9C%D7%91",
  "/post/word-problems-with-equations-grade-7",
  "/post/%D7%97%D7%95%D7%91%D7%A8%D7%95%D7%AA-%D7%97%D7%A9%D7%91%D7%95%D7%9F-%D7%9E%D7%95%D7%9C-%D7%93%D7%A4%D7%99-%D7%AA%D7%A8%D7%92%D7%95%D7%9C-%D7%9E%D7%94-%D7%9E%D7%AA%D7%90%D7%99%D7%9D-%D7%9C%D7%99%D7%9C%D7%93",
  "/post/%D7%93%D7%A4%D7%99-%D7%A2%D7%91%D7%95%D7%93%D7%94-%D7%9C%D7%9E%D7%95%D7%A8%D7%99%D7%9D-%D7%91%D7%9E%D7%AA%D7%9E%D7%98%D7%99%D7%A7%D7%94-%D7%A9%D7%9E%D7%A7%D7%A6%D7%A8%D7%99%D7%9D-%D7%94%D7%9B%D7%A0%D7%94-%D7%9C%D7%A9%D7%99%D7%A2%D7%95%D7%A8",
  "/post/%D7%93%D7%A4%D7%99-%D7%A2%D7%91%D7%95%D7%93%D7%94-%D7%91%D7%9E%D7%AA%D7%9E%D7%98%D7%99%D7%A7%D7%94-%D7%9C%D7%9C%D7%90-%D7%94%D7%A8%D7%A9%D7%9E%D7%94-%D7%9C%D7%9B%D7%9C-%D7%9B%D7%99%D7%AA%D7%94-%D7%95%D7%A0%D7%95%D7%A9%D7%90"
];

/** M26 blog archives (index + 3 categories). */
const BLOG_ARCHIVE_EXACT = [
  '/blog',
  '/blog/categories/elementary-math',
  '/blog/categories/middle-school-math',
  '/blog/categories/teachers-and-parents',
];

const PREVIEW_COVERED = [
  { pattern: '^/$', label: 'home', preview: '/', kind: 'exact' },
  { pattern: '^/worksheets$', label: 'worksheets catalog', preview: '/worksheets?grade=7', kind: 'exact' },
  {
    pattern: '^/grade-[1-9]$',
    label: 'grade hubs 1–9 (exact code-managed routes)',
    preview: '/grade-{N}',
    kind: 'exact',
  },
  {
    pattern:
      '^/(signed-numbers-grade-7|pythagorean-theorem-grade-8|quadratic-function-grade-9|equations-basics-grade-7|coordinate-plane-quadrants-grade-7|linear-function-grade-8|triangle-congruence-grade-8|quadratic-equations-grade-9|rectangle-grade-9|pythagorean-theorem-grade-7|algebraic-expressions-grade-7|powers-grade-7|systems-of-equations-grade-8|statistics-grade-8|geometric-proof-grade-8|similar-triangles-grade-8|factoring-grade-9|linear-function-grade-9|parallelogram-grade-9|square-grade-9|combining-like-terms-grade-7|multiplying-signed-numbers-grade-7|dividing-signed-numbers-grade-7|order-of-operations-signed-numbers-grade-7|number-line-absolute-value-grade-7|square-root-grade-7|angles-introduction-measurement-grade-7|adjacent-vertical-angles-grade-7|linear-equations-grade-8|inequalities-grade-8|percentage-problems-grade-8|coordinate-plane-grade-8|congruence-theorems-grade-8|triangle-congruence-proofs-grade-8|exterior-angle-triangle-grade-8|isosceles-triangle-properties-grade-8|distributive-law-grade-9|quadratic-inequalities-systems-grade-9|exponent-rules-grade-9|square-roots-grade-9|word-problems-grade-9|binomial-square-grade-9|difference-of-squares-grade-9|algebraic-fractions-grade-9|angles-review-grade-7|triangle-quadrilateral-angle-sum-grade-7|coordinate-plane-four-quadrants-grade-7|coordinate-plane-scale-grade-7|coordinate-plane-applications-grade-7|equations-advanced-grade-7|equations-both-sides-word-problems-grade-7|pythagoras-applications-grade-7|isosceles-triangle-grade-8|triangle-median-grade-8|parallel-lines-angles-grade-8|triangle-similarity-proof-grade-8|similar-triangles-area-ratio-grade-8|advanced-pythagoras-grade-8|pythagoras-in-space-grade-8|circle-area-circumference-grade-8|precalculus-functions-graphs-grade-9|reading-graphs-grade-9|analytic-geometry-grade-9|coordinate-plane-applications-grade-9|rhombus-grade-9|trapezoid-grade-9|similar-triangles-grade-9|triangle-30-60-90-grade-9|angles-grade-7|area-parallelogram-trapezoid-composite-grade-7|area-rectangle-perimeter-grade-7|composite-polygons-area-grade-9|cone-grade-8|congruent-polygons-transformations-grade-9|cylinder-surface-area-grade-8|cylinder-volume-grade-8|isosceles-triangle-grade-9|parallelogram-trapezoid-area-grade-9|probability-grade-9|pythagoras-applications-grade-9|pythagoras-basics-grade-9|pythagorean-theorem-grade-9|rectangle-square-area-grade-9|solids-box-cube-prism-grade-7|statistics-grade-9|transition-to-high-school-grade-9|triangle-area-grade-9|triangle-calculations-grade-9|triangle-sides-angles-grade-9|triangular-prism-surface-area-grade-9|triangular-prism-volume-grade-9)$',
    label: 'topic SEO pages (M18–M23; some intentionally unmigrated)',
    preview: '/{slug}',
    kind: 'exact',
  },
  {
    pattern: '^/worksheet-viewer',
    label: 'worksheet viewer (Headless static copy)',
    preview: '/worksheet-viewer-noam.html',
    kind: 'exact',
  },
  { pattern: '^/learning(\\.html)?$', label: 'learning portal', preview: '/learning.html', kind: 'exact' },
  {
    pattern:
      '^/(aboutus|math-tools|accessibilityadaptation|terms|conditionforfreeworksheets|high-school-math|high-school-math-1|page)$',
    label: 'site / policy pages (M24; redirects included)',
    preview: '/{slug}',
    kind: 'exact',
  },
  {
    // M25–M29 = 59 posts; 0 remaining post bodies (5 topics deferred)
    pattern:
      '^/post/(%D7%AA%D7%A8%D7%92%D7%99%D7%9C%D7%99-%D7%97%D7%99%D7%91%D7%95%D7%A8-%D7%95%D7%97%D7%99%D7%A1%D7%95%D7%A8-%D7%9C%D7%9B%D7%99%D7%AA%D7%94-%D7%90-%D7%9C%D7%AA%D7%A8%D7%92%D7%95%D7%9C-%D7%A0%D7%9B%D7%95%D7%9F-%D7%91%D7%91%D7%99%D7%AA|%D7%A1%D7%95%D7%9B%D7%9F-ai-%D7%9C%D7%AA%D7%A8%D7%92%D7%99%D7%9C%D7%99%D7%9D-%D7%9B%D7%9E%D7%95-%D7%9E%D7%95%D7%A8%D7%94-%D7%A4%D7%A8%D7%98%D7%99-%D7%95%D7%94%D7%9B%D7%95%D7%9C-%D7%91%D7%97%D7%99%D7%A0%D7%9D|annual-review-grade-7|assessment-1-grade-7|box-and-cube-grade-7|%D7%AA%D7%A8%D7%92%D7%99%D7%9C%D7%99-%D7%90%D7%AA%D7%92%D7%A8-%D7%91%D7%9E%D7%AA%D7%9E%D7%98%D7%99%D7%A7%D7%94-%D7%9C%D7%9B%D7%99%D7%AA%D7%94-%D7%93-%D7%A9%D7%9E%D7%A7%D7%93%D7%9E%D7%99%D7%9D-%D7%97%D7%A9%D7%99%D7%91%D7%94|common-factor-and-minus-parentheses-grade-7|composite-polygons-area-grade-7|congruent-polygons-transformations-grade-7|%D7%9E%D7%93%D7%A8%D7%99%D7%9A-%D7%9C%D7%AA%D7%A8%D7%92%D7%95%D7%9C-%D7%A6%D7%99%D7%A8%D7%99%D7%9D-%D7%A7%D7%95%D7%90%D7%95%D7%A8%D7%93%D7%99%D7%A0%D7%98%D7%95%D7%AA-%D7%A9%D7%9E%D7%AA%D7%97%D7%99%D7%9C-%D7%A0%D7%9B%D7%95%D7%9F|data-collection-reading-grade-7|%D7%AA%D7%A8%D7%92%D7%95%D7%9C-%D7%9E%D7%A1%D7%A4%D7%A8%D7%99%D7%9D-%D7%A2%D7%A9%D7%A8%D7%95%D7%A0%D7%99%D7%99%D7%9D-%D7%9C%D7%9B%D7%99%D7%AA%D7%94-%D7%95-%D7%91%D7%91%D7%99%D7%AA-%D7%95%D7%91%D7%9B%D7%99%D7%AA%D7%94|distributive-property-parentheses-grade-7|%D7%91%D7%99%D7%A0%D7%94-%D7%97%D7%99%D7%A0%D7%95%D7%9B%D7%99%D7%AA-%D7%A9%D7%9E%D7%A7%D7%93%D7%9E%D7%AA-%D7%9B%D7%9C-%D7%AA%D7%9C%D7%9E%D7%99%D7%93-%D7%91%D7%9E%D7%AA%D7%9E%D7%98%D7%99%D7%A7%D7%94|%D7%9E%D7%A9%D7%95%D7%95%D7%90%D7%95%D7%AA-%D7%9C%D7%9B%D7%99%D7%AA%D7%94-%D7%97-%D7%AA%D7%A8%D7%92%D7%95%D7%9C-%D7%A9%D7%9E%D7%A1%D7%93%D7%A8-%D7%90%D7%AA-%D7%94%D7%93%D7%A8%D7%9A|equations-parentheses-equivalence-grade-7|equilateral-triangle-advanced-grade-7|%D7%94%D7%9B%D7%A0%D7%94-%D7%9C%D7%9E%D7%91%D7%97%D7%9F-%D7%91%D7%9E%D7%AA%D7%9E%D7%98%D7%99%D7%A7%D7%94-%D7%9C%D7%9B%D7%99%D7%AA%D7%94-%D7%94-%D7%91-7-%D7%99%D7%9E%D7%99%D7%9D|first-quadrant-graph-points-grade-7|%D7%97%D7%96%D7%A8%D7%94-%D7%9E%D7%9E%D7%95%D7%A7%D7%93%D7%AA-%D7%91%D7%9E%D7%AA%D7%9E%D7%98%D7%99%D7%A7%D7%94-%D7%90%D7%95%D7%A0%D7%9C%D7%99%D7%99%D7%9F-%D7%A9%D7%9E%D7%A7%D7%93%D7%9E%D7%AA-%D7%91%D7%90%D7%9E%D7%AA|%D7%AA%D7%A8%D7%92%D7%95%D7%9C-%D7%A9%D7%91%D7%A8%D7%99%D7%9D-%D7%9C%D7%9B%D7%99%D7%AA%D7%94-%D7%93-%D7%A9%D7%9E%D7%97%D7%96%D7%A7-%D7%94%D7%91%D7%A0%D7%94-%D7%95%D7%91%D7%99%D7%98%D7%97%D7%95%D7%9F|%D7%93%D7%A4%D7%99-%D7%A2%D7%91%D7%95%D7%93%D7%94-%D7%91%D7%9E%D7%AA%D7%9E%D7%98%D7%99%D7%A7%D7%94-%D7%91%D7%97%D7%99%D7%A0%D7%9D-%D7%9C%D7%9B%D7%99%D7%AA%D7%95%D7%AA-%D7%90-%D7%98-%D7%9C%D7%91%D7%99%D7%AA-%D7%95%D7%91%D7%A7%D7%A8%D7%95%D7%91-%D7%92%D7%9D-%D7%A1%D7%95%D7%9B%D7%9F-ai-%D7%AA%D7%95%D7%9E%D7%9A|frequency-tables-grade-7|%D7%A4%D7%95%D7%A0%D7%A7%D7%A6%D7%99%D7%95%D7%AA-%D7%9C%D7%9B%D7%99%D7%AA%D7%94-%D7%98-%D7%9C%D7%94%D7%91%D7%99%D7%9F-%D7%92%D7%A8%D7%A4%D7%99%D7%9D-%D7%95%D7%9C%D7%A4%D7%AA%D7%95%D7%A8-%D7%A0%D7%9B%D7%95%D7%9F|%D7%90%D7%99%D7%9A-%D7%9C%D7%AA%D7%A8%D7%92%D7%9C-%D7%92%D7%90%D7%95%D7%9E%D7%98%D7%A8%D7%99%D7%94-%D7%9C%D7%9B%D7%99%D7%AA%D7%94-%D7%95-%D7%95%D7%9C%D7%94%D7%A6%D7%9C%D7%99%D7%97-%D7%91%D7%9E%D7%91%D7%97%D7%A0%D7%99%D7%9D|%D7%93%D7%A4%D7%99-%D7%A2%D7%91%D7%95%D7%93%D7%94-%D7%9C%D7%9B%D7%99%D7%AA%D7%94-%D7%90-%D7%A9%D7%9E%D7%97%D7%96%D7%A7%D7%99%D7%9D-%D7%91%D7%99%D7%98%D7%97%D7%95%D7%9F-%D7%91%D7%9E%D7%AA%D7%9E%D7%98%D7%99%D7%A7%D7%94|%D7%93%D7%A4%D7%99-%D7%A2%D7%91%D7%95%D7%93%D7%94-%D7%9C%D7%A9%D7%99%D7%A2%D7%95%D7%A8%D7%99-%D7%91%D7%99%D7%AA-%D7%91%D7%9E%D7%AA%D7%9E%D7%98%D7%99%D7%A7%D7%94-%D7%A9%D7%9E%D7%A7%D7%93%D7%9E%D7%99%D7%9D-%D7%91%D7%99%D7%98%D7%97%D7%95%D7%9F|%D7%9E%D7%AA%D7%9E%D7%98%D7%99%D7%A7%D7%94-%D7%9C%D7%99%D7%9C%D7%93%D7%99%D7%9D-%D7%A9%D7%91%D7%95%D7%A0%D7%94-%D7%91%D7%99%D7%98%D7%97%D7%95%D7%9F-%D7%95%D7%AA%D7%A8%D7%92%D7%95%D7%9C-%D7%A0%D7%9B%D7%95%D7%9F|%D7%AA%D7%A8%D7%92%D7%95%D7%9C-%D7%97%D7%A9%D7%99%D7%91%D7%94-%D7%9E%D7%AA%D7%9E%D7%98%D7%99%D7%AA-%D7%9C%D7%99%D7%9C%D7%93%D7%99%D7%9D-%D7%A9%D7%91%D7%95%D7%A0%D7%94-%D7%91%D7%99%D7%98%D7%97%D7%95%D7%9F|%D7%93%D7%A4%D7%99-%D7%A2%D7%91%D7%95%D7%93%D7%94-%D7%9C%D7%9C%D7%95%D7%97-%D7%94%D7%9B%D7%A4%D7%9C-%D7%9C%D7%AA%D7%A8%D7%92%D7%95%D7%9C-%D7%A0%D7%9B%D7%95%D7%9F-%D7%91%D7%91%D7%99%D7%AA|%D7%91%D7%A7%D7%A8%D7%95%D7%91-%D7%A1%D7%95%D7%9B%D7%9F-%D7%91%D7%99%D7%A0%D7%94-%D7%9E%D7%9C%D7%90%D7%9B%D7%95%D7%AA%D7%99%D7%AA-%D7%9C%D7%AA%D7%A8%D7%92%D7%95%D7%9C-%D7%93%D7%A4%D7%99-%D7%A2%D7%91%D7%95%D7%93%D7%94|one-step-equations-grade-7|%D7%90%D7%99%D7%9A-%D7%A4%D7%95%D7%AA%D7%A8%D7%99%D7%9D-%D7%A1%D7%93%D7%A8-%D7%A4%D7%A2%D7%95%D7%9C%D7%95%D7%AA-%D7%97%D7%A9%D7%91%D7%95%D7%9F-%D7%91%D7%9C%D7%99-%D7%9C%D7%94%D7%AA%D7%91%D7%9C%D7%91%D7%9C|parallelogram-trapezoid-area-grade-7|patterns-grade-7|%D7%AA%D7%A8%D7%92%D7%99%D7%9C%D7%99-%D7%90%D7%97%D7%95%D7%96%D7%99%D7%9D-%D7%9C%D7%9B%D7%99%D7%AA%D7%94-%D7%96-%D7%9C%D7%AA%D7%A8%D7%92%D7%95%D7%9C-%D7%91%D7%98%D7%95%D7%97-%D7%95%D7%9E%D7%93%D7%95%D7%99%D7%A7|perimeter-complex-shapes-algebra-grade-7|%D7%9E%D7%93%D7%A8%D7%99%D7%9A-%D7%9C%D7%97%D7%96%D7%A7%D7%95%D7%AA-%D7%95%D7%A9%D7%95%D7%A8%D7%A9%D7%99%D7%9D-%D7%91%D7%97%D7%98%D7%99%D7%91%D7%94-%D7%9C%D7%AA%D7%A8%D7%92%D7%95%D7%9C-%D7%91%D7%98%D7%95%D7%97|probability-introduction-grade-7|%D7%9E%D7%93%D7%A8%D7%99%D7%9A-%D7%9C%D7%A7%D7%A8%D7%99%D7%90%D7%AA-%D7%92%D7%A8%D7%A4%D7%99%D7%9D-%D7%9C%D7%99%D7%9C%D7%93%D7%99%D7%9D-%D7%91%D7%A6%D7%95%D7%A8%D7%94-%D7%A4%D7%A9%D7%95%D7%98%D7%94|rectangle-square-area-advanced-grade-7|relative-frequency-experiments-grade-7|relative-frequency-introduction-grade-7|simplify-then-solve-equations-grade-7|%D7%AA%D7%A8%D7%92%D7%95%D7%9C-%D7%9E%D7%AA%D7%9E%D7%98%D7%99%D7%A7%D7%94-%D7%9C%D7%AA%D7%9C%D7%9E%D7%99%D7%93%D7%99%D7%9D-%D7%9E%D7%AA%D7%A7%D7%A9%D7%99%D7%9D-%D7%A9%D7%9E%D7%A7%D7%93%D7%9D-%D7%91%D7%99%D7%98%D7%97%D7%95%D7%9F|substitution-in-algebraic-expressions-grade-7|three-representations-equation-solution-grade-7|triangular-prism-surface-area-grade-7|triangular-prism-volume-grade-7|two-step-equations-grade-7|unknown-on-both-sides-grade-7|variables-and-algebraic-modeling-grade-7|what-is-an-equation-solution-grade-7|%D7%9E%D7%AA%D7%99-%D7%9C%D7%95%D7%9E%D7%93%D7%99%D7%9D-%D7%90%D7%97%D7%95%D7%96%D7%99%D7%9D-%D7%95%D7%90%D7%99%D7%9A-%D7%91%D7%95%D7%A0%D7%99%D7%9D-%D7%94%D7%91%D7%A0%D7%94-%D7%A0%D7%9B%D7%95%D7%A0%D7%94-%D7%91%D7%9B%D7%99%D7%AA%D7%94-%D7%95|%D7%91%D7%A2%D7%99%D7%95%D7%AA-%D7%9E%D7%99%D7%9C%D7%95%D7%9C%D7%99%D7%95%D7%AA-%D7%91%D7%9E%D7%AA%D7%9E%D7%98%D7%99%D7%A7%D7%94-%D7%A4%D7%95%D7%AA%D7%A8%D7%99%D7%9D-%D7%A9%D7%9C%D7%91-%D7%90%D7%97%D7%A8-%D7%A9%D7%9C%D7%91|word-problems-with-equations-grade-7|%D7%97%D7%95%D7%91%D7%A8%D7%95%D7%AA-%D7%97%D7%A9%D7%91%D7%95%D7%9F-%D7%9E%D7%95%D7%9C-%D7%93%D7%A4%D7%99-%D7%AA%D7%A8%D7%92%D7%95%D7%9C-%D7%9E%D7%94-%D7%9E%D7%AA%D7%90%D7%99%D7%9D-%D7%9C%D7%99%D7%9C%D7%93|%D7%93%D7%A4%D7%99-%D7%A2%D7%91%D7%95%D7%93%D7%94-%D7%9C%D7%9E%D7%95%D7%A8%D7%99%D7%9D-%D7%91%D7%9E%D7%AA%D7%9E%D7%98%D7%99%D7%A7%D7%94-%D7%A9%D7%9E%D7%A7%D7%A6%D7%A8%D7%99%D7%9D-%D7%94%D7%9B%D7%A0%D7%94-%D7%9C%D7%A9%D7%99%D7%A2%D7%95%D7%A8|%D7%93%D7%A4%D7%99-%D7%A2%D7%91%D7%95%D7%93%D7%94-%D7%91%D7%9E%D7%AA%D7%9E%D7%98%D7%99%D7%A7%D7%94-%D7%9C%D7%9C%D7%90-%D7%94%D7%A8%D7%A9%D7%9E%D7%94-%D7%9C%D7%9B%D7%9C-%D7%9B%D7%99%D7%AA%D7%94-%D7%95%D7%A0%D7%95%D7%A9%D7%90)$',
    label: 'blog posts (M25–M29; 59 of 59)',
    preview: '/post/{slug}',
    kind: 'exact',
  },
  {
    pattern:
      '^/blog(/categories/(elementary-math|middle-school-math|teachers-and-parents))?$',
    label: 'blog archives (M26 index + 3 categories)',
    preview: '/blog…',
    kind: 'exact',
  },
];

function hasExactGradeHubRoute(pathname) {
  const m = pathname.match(/^\/grade-([1-9])$/);
  return !!m && EXACT_GRADE_HUBS.includes(Number(m[1]));
}

function hasExactTopicPilotRoute(pathname) {
  return TOPIC_PAGE_EXACT.includes(pathname);
}

function hasExactSitePageRoute(pathname) {
  return SITE_PAGE_EXACT.includes(pathname);
}

function hasExactBlogPilotRoute(pathname) {
  return BLOG_POST_PILOT_EXACT.includes(pathname);
}

function hasExactBlogArchiveRoute(pathname) {
  return BLOG_ARCHIVE_EXACT.includes(pathname);
}

async function fetchText(url) {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

function locsFromSitemap(xml) {
  return [...xml.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/g)].map((m) => m[1].trim());
}

function pathOf(url) {
  try {
    const u = new URL(url);
    return u.pathname.replace(/\/$/, '') || '/';
  } catch {
    return url;
  }
}

function classifyPath(pathname) {
  if (pathname === '/') return 'home';
  if (/^\/grade-[1-9]$/.test(pathname)) return 'grade-hub';
  if (pathname === '/blog' || pathname.startsWith('/post/') || pathname.startsWith('/blog/'))
    return 'blog';
  if (pathname.includes('blog')) return 'blog-related';
  // Policy before worksheet keyword — conditionforfreeworksheets contains "worksheet"
  if (POLICY_PATHS.has(pathname) || pathname.includes('accessibility') || pathname.includes('privacy'))
    return 'policy';
  if (pathname === '/terms' || pathname.includes('/terms')) return 'policy';
  if (SITE_NAV_PATHS.has(pathname)) return 'site-nav-page';
  if (
    /-(grade|grades)-[1-9]$/.test(pathname) ||
    /grade-[1-9]/.test(pathname) ||
    pathname.includes('worksheet')
  )
    return 'topic-seo-page';
  return 'other-page';
}

/** Functional coverage in this preview (catalog equivalent counts as covered). */
function isCoveredByPreview(pathname) {
  if (pathname === '/') return true;
  if (/^\/grade-[1-9]$/.test(pathname)) return true;
  if (hasExactTopicPilotRoute(pathname)) return true;
  if (hasExactSitePageRoute(pathname)) return true;
  if (hasExactBlogPilotRoute(pathname)) return true;
  if (hasExactBlogArchiveRoute(pathname)) return true;
  return false;
}

function countByBucket(rows) {
  const out = {};
  for (const row of rows) out[row.bucket] = (out[row.bucket] || 0) + 1;
  return out;
}

function sumCounts(obj) {
  return Object.values(obj).reduce((n, v) => n + v, 0);
}

function proposedSequence(missingBuckets, urlParity) {
  return [
    {
      step: 1,
      focus: 'Keep strengthening worksheet catalog + viewer + learning (already in preview)',
      why: 'Core product path; M11–14 covered this.',
      kind: 'done',
    },
    {
      step: 2,
      focus: 'Grade hub URL parity /grade-1…9 (exact code-managed routes done in M16–17)',
      why: `Exact URL parity on ${urlParity.gradeHubExactRoutes.length} hubs; ${urlParity.gradeHubFunctionalOnly.length} still functional-only.`,
      count: urlParity.gradeHubFunctionalOnly.length,
      kind: urlParity.gradeHubFunctionalOnly.length ? 'url-parity' : 'done',
    },
    {
      step: 3,
      focus: 'Topic SEO landing pages (slug-per-topic) — M18–M21 exact routes; remainder pending',
      why: `Remaining topic SEO gap after M18–M21 (~${missingBuckets['topic-seo-page'] || 0} pages). Reuse TopicPage template + production capture + parity gate.`,
      count: missingBuckets['topic-seo-page'] || 0,
      kind: 'missing-content',
      exactTopicRoutes: TOPIC_PAGE_EXACT,
    },
    {
      step: 4,
      focus: 'Site chrome pages (about, tools, conditions, high-school)',
      why: `Primary nav / trust pages (~${missingBuckets['site-nav-page'] || 0}).`,
      count: missingBuckets['site-nav-page'] || 0,
      kind: 'missing-content',
    },
    {
      step: 5,
      focus: 'Blog index, categories, posts',
      why: `Separate content system (~${(missingBuckets['blog'] || 0) + (missingBuckets['blog-related'] || 0)} URLs).`,
      count: (missingBuckets['blog'] || 0) + (missingBuckets['blog-related'] || 0),
      kind: 'missing-content',
    },
    {
      step: 6,
      focus: 'Canonical/robots/SEO cutover',
      why: 'Only after route parity; this audit deliberately does not change them.',
      kind: 'cutover',
    },
  ];
}

async function main() {
  const indexXml = await fetchText(`${PROD}/sitemap.xml`);
  const childSitemaps = locsFromSitemap(indexXml);
  const allLocs = [];
  for (const sm of childSitemaps) {
    const xml = await fetchText(sm);
    allLocs.push(...locsFromSitemap(xml));
  }

  const homeHtml = await fetchText(`${PROD}/`);
  const navHrefs = [
    ...new Set(
      [...homeHtml.matchAll(/href="(https:\/\/www\.noamdoronmath\.co\.il[^"#]*)/g)].map((m) =>
        pathOf(m[1])
      )
    ),
  ].filter((p) => p && p !== '/blog-feed.xml');

  const pagePaths = [
    ...new Set(allLocs.map(pathOf).filter((p) => !p.includes('blog-feed'))),
  ].sort();

  const missing = [];
  const covered = [];
  for (const p of pagePaths) {
    const row = { path: p, bucket: classifyPath(p) };
    if (isCoveredByPreview(p)) covered.push(row);
    else missing.push(row);
  }

  const allSitemapBucketCounts = countByBucket([...covered, ...missing]);
  const coveredBucketCounts = countByBucket(covered);
  const missingBucketCounts = countByBucket(missing);
  const coveredSum = sumCounts(coveredBucketCounts);
  const missingSum = sumCounts(missingBucketCounts);

  if (coveredSum + missingSum !== pagePaths.length) {
    throw new Error(
      `Invariant broken: covered(${coveredSum})+missing(${missingSum}) != sitemap(${pagePaths.length})`
    );
  }
  if (missingSum !== missing.length) {
    throw new Error(`Missing bucket sum ${missingSum} != missing rows ${missing.length}`);
  }

  const navMissing = navHrefs.filter((p) => !isCoveredByPreview(p));

  const examplesByBucket = {};
  for (const row of missing) {
    const list = (examplesByBucket[row.bucket] ||= []);
    if (list.length < 5) list.push(row.path);
  }

  const urlParity = {
    note: 'Functional catalog coverage ≠ production URL parity.',
    gradeHubFunctionalCoverage: coveredBucketCounts['grade-hub'] || 0,
    gradeHubExactRoutes: covered
      .filter((r) => r.bucket === 'grade-hub' && hasExactGradeHubRoute(r.path))
      .map((r) => r.path),
    gradeHubFunctionalOnly: covered
      .filter((r) => r.bucket === 'grade-hub' && !hasExactGradeHubRoute(r.path))
      .map((r) => r.path),
    gradeHubPreviewEquivalent: '/grade-N exact for all sitemap grade hubs (1–9)',
    gradeHubProductionUrls: covered.filter((r) => r.bucket === 'grade-hub').map((r) => r.path),
    stillMissingExactGradeHubRoute: false,
    topicSeoExactRoutes: TOPIC_PAGE_EXACT,
    topicSeoPilotCoveredCount: covered.filter((r) => hasExactTopicPilotRoute(r.path)).length,
  };

  const report = {
    generatedAt: new Date().toISOString(),
    productionOrigin: PROD,
    note:
      'Read-only audit. No SEO prose copied; canonical/robots unchanged. ' +
      'coveredInPreviewEquivalent = functional coverage (home + grade hubs via catalog). ' +
      'missingBucketCounts are mutually exclusive and must sum to missingFromPreview.',
    sitemapChildren: childSitemaps,
    totals: {
      sitemapUrls: pagePaths.length,
      coveredInPreviewEquivalent: covered.length,
      missingFromPreview: missing.length,
      coveredBucketSum: coveredSum,
      missingBucketSum: missingSum,
      homepageNavPaths: navHrefs.length,
      homepageNavMissing: navMissing.length,
    },
    previewCoveredToday: PREVIEW_COVERED,
    allSitemapBucketCounts,
    coveredBucketCounts,
    missingBucketCounts,
    /** @deprecated alias of allSitemapBucketCounts — do not treat as missing */
    bucketCounts: allSitemapBucketCounts,
    urlParity,
    missingExamplesByBucket: examplesByBucket,
    homepageNavPaths: navHrefs,
    homepageNavMissingExamples: navMissing.slice(0, 20),
    proposedMigrationSequence: proposedSequence(missingBucketCounts, urlParity),
  };

  mkdirSync(outDir, { recursive: true });
  const jsonPath = join(outDir, 'production-route-coverage.json');
  writeFileSync(jsonPath, JSON.stringify(report, null, 2) + '\n');

  if (asJson) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log('Production route coverage (read-only)');
  console.log('Sitemap URLs:', report.totals.sitemapUrls);
  console.log('Covered (functional):', report.totals.coveredInPreviewEquivalent, coveredBucketCounts);
  console.log('Missing from preview:', report.totals.missingFromPreview, missingBucketCounts);
  console.log(
    'Missing bucket sum check:',
    missingSum,
    missingSum === report.totals.missingFromPreview ? 'OK' : 'FAIL'
  );
  console.log(
    'URL parity: exact grade hubs',
    urlParity.gradeHubExactRoutes.join(', ') || '(none)',
    '| functional-only',
    urlParity.gradeHubFunctionalOnly.join(', ') || '(none)'
  );
  console.log(
    'Topic SEO exact routes:',
    urlParity.topicSeoExactRoutes.join(', '),
    `(covered ${urlParity.topicSeoPilotCoveredCount})`
  );
  console.log('Homepage nav missing:', navMissing.join(', ') || '(none beyond covered)');
  console.log('\nProposed sequence:');
  for (const s of report.proposedMigrationSequence) {
    console.log(`  ${s.step}. ${s.focus}${s.count != null ? ` [${s.count}]` : ''} (${s.kind})`);
  }
  console.log('\nWrote', jsonPath);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
