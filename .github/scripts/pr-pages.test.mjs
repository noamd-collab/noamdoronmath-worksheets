import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { pagesTouchedByDiff, routeFromPageFile } from './pr-pages.mjs';

describe('routeFromPageFile', () => {
  it('maps page files to routes', () => {
    assert.equal(routeFromPageFile('headless/astro-poc/src/pages/index.astro'), '/');
    assert.equal(routeFromPageFile('headless/astro-poc/src/pages/grade-9.astro'), '/grade-9');
    assert.equal(routeFromPageFile('headless/astro-poc/src/pages/blog/index.astro'), '/blog');
    assert.equal(routeFromPageFile('headless/astro-poc/src/pages/worksheets.astro'), '/worksheets?grade=9');
    assert.equal(routeFromPageFile('headless/astro-poc/src/pages/post/[...slug].astro'), null);
    assert.equal(routeFromPageFile('headless/astro-poc/src/pages/api/contact-form.ts'), null);
    assert.equal(routeFromPageFile('headless/astro-poc/src/components/GradeHubPage.astro'), null);
  });
});

describe('pagesTouchedByDiff', () => {
  it('uses the fallback set when the diff does not name a page', () => {
    const result = pagesTouchedByDiff(['headless/astro-poc/src/styles/exact-site.css']);
    assert.equal(result.fallback, true);
    assert.deepEqual(result.pages, ['/', '/grade-9', '/worksheets?grade=9']);
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
});
