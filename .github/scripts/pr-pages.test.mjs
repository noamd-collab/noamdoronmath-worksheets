import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ELEMENTARY_GRADE_HUB_PAGES, pagesTouchedByDiff, routeFromPageFile } from './pr-pages.mjs';

describe('routeFromPageFile', () => {
  it('maps page files to routes', () => {
    assert.equal(routeFromPageFile('headless/astro-poc/src/pages/index.astro'), '/');
    assert.equal(routeFromPageFile('headless/astro-poc/src/pages/grade-9.astro'), '/grade-9');
    assert.equal(routeFromPageFile('headless/astro-poc/src/pages/blog/index.astro'), '/blog');
    assert.equal(routeFromPageFile('headless/astro-poc/src/pages/worksheets.astro'), '/worksheets?grade=9');
    assert.equal(routeFromPageFile('headless/astro-poc/src/pages/post/[...slug].astro'), null);
    assert.equal(routeFromPageFile('headless/astro-poc/src/pages/api/contact-form.ts'), null);
    assert.equal(routeFromPageFile('headless/astro-poc/src/components/GradeHubPage.astro'), null);
    assert.equal(routeFromPageFile('headless/astro-poc/src/pages/sitemap-index.xml.ts'), null);
    assert.equal(routeFromPageFile('headless/astro-poc/src/pages/llms.txt.ts'), null);
    assert.equal(routeFromPageFile('headless/astro-poc/src/pages/data.json.ts'), null);
  });
});

describe('pagesTouchedByDiff', () => {
  it('uses the fallback set when the diff does not name a page', () => {
    const result = pagesTouchedByDiff(['headless/astro-poc/src/styles/exact-site.css']);
    assert.equal(result.fallback, true);
    assert.deepEqual(result.pages, ['/', '/grade-5', '/grade-9', '/factoring-grade-9', '/worksheets?grade=9', '/blog']);
  });

  it('screenshots every elementary grade hub when the hub nav changes', () => {
    const result = pagesTouchedByDiff([
      'headless/astro-poc/src/components/GradeHubPage.astro',
      'headless/astro-poc/src/pages/index.astro',
    ]);
    assert.equal(result.fallback, false);
    assert.deepEqual(result.pages, ELEMENTARY_GRADE_HUB_PAGES);
    assert.deepEqual(result.omitted, []);
  });

  it('keeps changed pages and caps the screenshot list', () => {
    const files = [
      'headless/astro-poc/src/pages/grade-8.astro',
      'headless/astro-poc/src/pages/terms.astro',
      'headless/astro-poc/src/pages/grade-1.astro',
      'headless/astro-poc/src/pages/grade-2.astro',
      'headless/astro-poc/src/pages/grade-3.astro',
      'headless/astro-poc/src/pages/grade-4.astro',
      'headless/astro-poc/src/pages/grade-5.astro',
    ];
    const result = pagesTouchedByDiff(files);
    assert.equal(result.fallback, false);
    assert.equal(result.pages.length, 6);
    assert.deepEqual(result.omitted, ['/grade-5']);
  });

  it('screenshots /teachers when teachers page or print-pack files change', () => {
    const result = pagesTouchedByDiff([
      'headless/astro-poc/public/teachers/index.html',
      'headless/astro-poc/public/teachers/teacher-factoring-print.js',
      'headless/astro-poc/public/teachers/packs/factoring-9/4aba762b64b54af098827d1f386bcf68.json',
      'headless/astro-poc/scripts/render-teacher-pack.py',
    ]);
    assert.equal(result.fallback, false);
    assert.deepEqual(result.pages, ['/teachers']);
    assert.deepEqual(result.omitted, []);
  });
});

