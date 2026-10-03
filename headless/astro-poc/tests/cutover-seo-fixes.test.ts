/**
 * Regression tests for the cut-over readiness review of SEO stages 1–7.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { canonicalUrl, readSiteIndexEnv, robotsContent } from '../src/lib/siteSeo';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

describe('canonical keeps only params that change the page', () => {
  it('drops tracking and UI params on every page', () => {
    assert.equal(canonicalUrl('/angles-grade-7', '?utm_source=fb&fbclid=abc'), 'https://www.noamdoronmath.co.il/angles-grade-7');
    assert.equal(canonicalUrl('/blog', '?page=2'), 'https://www.noamdoronmath.co.il/blog');
    assert.equal(canonicalUrl('/grade-2/', '?popup=ai3zi'), 'https://www.noamdoronmath.co.il/grade-2');
  });

  it('keeps grade and topic on /worksheets, in a fixed order, and nothing else', () => {
    const base = 'https://www.noamdoronmath.co.il/worksheets';
    assert.equal(canonicalUrl('/worksheets', '?grade=7&topic=12'), `${base}?grade=7&topic=12`);
    assert.equal(canonicalUrl('/worksheets', '?topic=12&grade=7'), `${base}?grade=7&topic=12`);
    assert.equal(canonicalUrl('/worksheets', '?grade=7&topic=12&q=x&utm_source=y&group=geo'), `${base}?grade=7&topic=12`);
    assert.equal(canonicalUrl('/worksheets', '?grade=9&track=red&topic=33'), `${base}?grade=9&topic=33`);
    assert.equal(canonicalUrl('/worksheets', '?grade=<script>'), base);
    assert.equal(canonicalUrl('/worksheets'), base);
  });
});

describe('robots env never assumes Node globals', () => {
  it('siteSeo has no bare process.env default (Workers may not define process)', () => {
    const src = read('src/lib/siteSeo.ts');
    assert.doesNotMatch(src, /=\s*process\.env/);
    assert.match(src, /globalThis as \{ process\?/);
  });

  it('reads the flag when given and falls back to hostname rules', () => {
    assert.equal(readSiteIndexEnv({ SITE_INDEXABLE: 'true' }).SITE_INDEXABLE, 'true');
    assert.equal(robotsContent('www.noamdoronmath.co.il', {}), 'index,follow');
    assert.equal(robotsContent('abc.wix-site-host.com', { SITE_INDEXABLE: 'true' }), 'noindex,nofollow');
  });
});

describe('redirect map reflects what production serves', () => {
  it('/dev-loops is dev-only, so the map says 404 and it stays out of robots allow', () => {
    const row = read('redirects-map.csv').split('\n').find((line) => line.startsWith('https://www.noamdoronmath.co.il/dev-loops,'));
    assert.equal(row, 'https://www.noamdoronmath.co.il/dev-loops,,404-מכוון,גבוה');
    assert.match(read('src/pages/dev-loops.astro'), /import\.meta\.env\.DEV/);
  });
});

describe('breadcrumb JSON-LD uses the canonical URL', () => {
  it('the last crumb is built from the canonical, not the raw query', () => {
    const layout = read('src/layouts/BaseLayout.astro');
    assert.match(layout, /path: `\$\{new URL\(canonical\)\.pathname\}\$\{new URL\(canonical\)\.search\}`/);
    assert.doesNotMatch(layout, /path: `\$\{Astro\.url\.pathname\}\$\{Astro\.url\.search\}`/);
  });
});
