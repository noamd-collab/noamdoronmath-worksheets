/**
 * Every catalog topic in grades 1–9 has a landing whose primary CTA is that
 * topic. These fifteen used to appear only inside a parent page.
 * Loops are existing films; this file does not add a new variant.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { loadCatalog } from '../src/lib/catalog/loadCatalog.ts';
import { loadGradeHub } from '../src/lib/gradeHubs.ts';
import { topicLandingLoop } from '../src/lib/landingLoops.ts';
import { loadTopicPage, TOPIC_PAGE_AUTHORED_SLUGS, TOPIC_PAGE_G9_AUTHORED_SLUGS, TOPIC_PAGE_OWN_LANDING_SLUGS, TOPIC_PAGE_SLUGS } from '../src/lib/topicPages.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const OWN = [
  { grade: 7, topicId: 18, slug: 'rectangle-square-area-grade-7', parent: 'area-rectangle-perimeter-grade-7', loop: 'area' },
  { grade: 7, topicId: 22, slug: 'algebraic-language-grade-7', parent: 'algebraic-expressions-grade-7', loop: 'pattern' },
  { grade: 7, topicId: 21, slug: 'number-patterns-grade-7', parent: 'patterns-and-graphs-grade-7', loop: 'pattern' },
  { grade: 7, topicId: 20, slug: 'box-and-cube-grade-7', parent: 'solids-box-cube-prism-grade-7', loop: 'cube-8' },
  { grade: 7, topicId: 32, slug: 'equation-solution-grade-7', parent: 'equations-basics-grade-7', loop: 'balance' },
  { grade: 7, topicId: 34, slug: 'one-step-equations-grade-7', parent: 'equations-basics-grade-7', loop: 'balance' },
  { grade: 7, topicId: 36, slug: 'simplify-then-solve-grade-7', parent: 'equations-advanced-grade-7', loop: 'balance' },
  { grade: 7, topicId: 37, slug: 'equations-parentheses-grade-7', parent: 'equations-advanced-grade-7', loop: 'balance' },
  { grade: 7, topicId: 39, slug: 'unknown-both-sides-grade-7', parent: 'equations-both-sides-word-problems-grade-7', loop: 'balance' },
  { grade: 7, topicId: 40, slug: 'equation-representations-grade-7', parent: 'equations-both-sides-word-problems-grade-7', loop: 'balance' },
  { grade: 7, topicId: 45, slug: 'parallelogram-trapezoid-area-grade-7', parent: 'area-parallelogram-trapezoid-composite-grade-7', loop: 'area-para' },
  { grade: 7, topicId: 47, slug: 'triangular-prism-volume-grade-7', parent: 'solids-box-cube-prism-grade-7', loop: 'prism-vol' },
  { grade: 9, topicId: 41, slug: 'common-factor-grade-9', parent: 'factoring-grade-9', loop: 'area-model' },
  { grade: 9, topicId: 42, slug: 'factoring-identities-grade-9', parent: 'factoring-grade-9', loop: 'area-model' },
  { grade: 9, topicId: 43, slug: 'complete-factoring-grade-9', parent: 'factoring-grade-9', loop: 'area-model' },
] as const;

describe('own topic landings', () => {
  it('the eight renewal grade-9 pages already have their own landings', () => {
    assert.deepEqual([...TOPIC_PAGE_G9_AUTHORED_SLUGS], [
      'equilateral-triangle-grade-9',
      'rational-equations-grade-9',
      'median-to-hypotenuse-grade-9',
      'equations-numeric-denominator-grade-9',
      'parallel-lines-angles-grade-9',
      'co-interior-angles-grade-9',
      'math-literacy-tasks-grade-9',
      'percentages-grade-9',
    ]);
    for (const slug of TOPIC_PAGE_G9_AUTHORED_SLUGS) {
      const page = loadTopicPage(slug);
      assert.ok(page.catalogCtas.length >= 1, slug);
      assert.equal(page.catalogCta.catalogTopicId, page.catalogCtas[0].catalogTopicId);
    }
  });

  it('each gap topic is the primary CTA of its new page, linked from the hub and the parent', () => {
    assert.equal(TOPIC_PAGE_OWN_LANDING_SLUGS.length, OWN.length);
    const catalog = loadCatalog();
    for (const row of OWN) {
      assert.ok((TOPIC_PAGE_SLUGS as readonly string[]).includes(row.slug), row.slug);
      assert.ok((TOPIC_PAGE_AUTHORED_SLUGS as readonly string[]).includes(row.slug), row.slug);
      const page = loadTopicPage(row.slug);
      assert.equal(page.grade, row.grade);
      assert.equal(page.catalogCta.catalogTopicId, row.topicId);
      assert.equal(page.catalogCta.href, `/worksheets?grade=${row.grade}&topic=${row.topicId}`);
      const topic = catalog.grades.find((g) => g.grade === row.grade)!.topics.find((item) => item.id === row.topicId)!;
      assert.equal(page.catalogCta.catalogTopicTitle, topic.title);
      assert.ok(topic.levels.every((level) => level.pdfId));
      assert.match(readFileSync(join(root, `src/pages/${row.slug}.astro`), 'utf8'), new RegExp(`slug="${row.slug}"`));
      const hub = loadGradeHub(row.grade);
      assert.ok(hub.topicLinks.some((link) => link.path === page.path), `flat ${row.slug}`);
      assert.ok(hub.topicSections.some((section) => section.links.some((link) => link.path === page.path)), `section ${row.slug}`);
      const parent = loadTopicPage(row.parent);
      assert.ok(parent.relatedTopics.some((link) => link.path === page.path), `parent ${row.parent}`);
      const loop = topicLandingLoop(page);
      const variant = loop.kind === 'film' ? loop.marker : loop.variant;
      assert.equal(variant, row.loop, row.slug);
      assert.equal(page.intro.includes('/'), false, row.slug);
      assert.equal(page.h1.includes('רמה ג'), false, row.slug);
    }
  });
});
