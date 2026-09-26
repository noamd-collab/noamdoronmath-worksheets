/**
 * OPEN-15 — 301 map for the domain move: representative paths, trailing slash,
 * exclusions, and integrity of src/data/redirects.json.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { existsSync, readFileSync } from 'node:fs';
import { REDIRECT_RULES, resolveRedirect } from '../src/lib/redirects';
import { SITE_PAGE_M24_REDIRECTS } from '../src/lib/sitePages';
import { TOPIC_PAGE_M30_REDIRECTS } from '../src/lib/topicPages';
import { resolveSiteHref } from '../src/lib/resolveSiteHref';

const pageExists = (p: string) =>
  p === '/' || existsSync(new URL(`../src/pages${p}.astro`, import.meta.url));

describe('OPEN-15 redirects', () => {
  it('maps the representative legacy paths to their decided targets', () => {
    const cases: Array<[string, string]> = [
      ['/worksheetsfor7thgrade', '/grade-7'],
      ['/worksheetsfor1thgrade', '/grade-1'],
      ['/worksheetsfor2thgrade', '/grade-2'],
      ['/worksheetsfor3thgrade', '/grade-3'],
      ['/worksheets8grade-1', '/grade-8'],
      ['/worksheets8grade-2', '/grade-8'],
      ['/home', '/'],
      ['/coordinate-plane-intro-grade-7', '/coordinate-plane-scale-grade-7'],
      ['/triangle-area-grade-7-worksheets', '/triangle-area-grade-7'],
      ['/special-triangles-grade-7', '/special-triangles-grade-7-new'],
      ['/blank-1', '/quadratic-inequalities-systems-grade-9'],
      ['/page', '/terms'],
      ['/page-2', '/aboutus'],
      ['/high-school-math-1', '/high-school-math'],
      ['/equations-grade-7', '/equations-basics-grade-7'],
      ['/equations-both-sides-word-problems-grade-7-1', '/equations-both-sides-word-problems-grade-7'],
      ['/inequalities-grade-8-1', '/inequalities-grade-8'],
    ];
    for (const [from, to] of cases) assert.equal(resolveRedirect(from), to, from);
  });

  it('keeps /workflow as a real 404 (no redirect, no stub page)', () => {
    assert.equal(resolveRedirect('/workflow'), null);
    assert.ok(
      !existsSync(new URL('../src/pages/workflow.astro', import.meta.url)),
      'must not ship a /workflow stub page'
    );
    const map = JSON.parse(
      readFileSync(new URL('../src/data/redirects.json', import.meta.url), 'utf8')
    ) as { flaggedDoNotAutoRedirect?: Array<{ from: string; reason?: string }> };
    const flagged = map.flaggedDoNotAutoRedirect?.find((r) => r.from === '/workflow');
    assert.ok(flagged, 'must stay in flaggedDoNotAutoRedirect');
    assert.match(String(flagged.reason || ''), /404/i);
  });

  it('strips a trailing slash, in one hop even for a mapped path, and keeps the query', () => {
    assert.equal(resolveRedirect('/aboutus/'), '/aboutus');
    assert.equal(resolveRedirect('/grade-7/'), '/grade-7');
    assert.equal(resolveRedirect('/worksheetsfor7thgrade/'), '/grade-7');
    assert.equal(resolveRedirect('/worksheets/', '?grade=7'), '/worksheets?grade=7');
    assert.equal(resolveRedirect('/home', '?utm_source=x'), '/?utm_source=x');
    assert.equal(resolveRedirect('/grade-2', '?popup=ai3zi'), null);
  });

  it('leaves live pages, the root, the blog, api, platform paths and files alone', () => {
    for (const p of [
      '/',
      '/grade-7',
      '/aboutus',
      '/math-tools',
      '/blog',
      '/blog/',
      '/post/x/',
      '/api/blog-audio-info/',
      '/_wix/pages.json',
      '/learning.html',
      '/triangular-prism-volume-grade-9',
      '/workflow',
    ])
      assert.equal(resolveRedirect(p), null, p);
  });

  it('map is clean: unique sources, no chains, every target is a real POC page', () => {
    const froms = REDIRECT_RULES.map((r) => r.from);
    assert.equal(new Set(froms).size, froms.length, 'duplicate from');
    for (const r of REDIRECT_RULES) {
      assert.ok(r.from.startsWith('/') && r.to.startsWith('/'), r.from);
      assert.ok(!froms.includes(r.to), `chain: ${r.from} -> ${r.to}`);
      assert.ok(pageExists(r.to), `target has no page: ${r.to}`);
      assert.notEqual(r.to, '/triangular-prism-volume-grade-9', 'wrong live mapping must not be copied');
      assert.notEqual(r.to, '/powers-grade-7', 'triangle worksheets must not target powers');
    }
    assert.equal(REDIRECT_RULES.filter((r) => r.from.startsWith('/worksheetsfor')).length, 9);
    assert.equal(
      REDIRECT_RULES.find((r) => r.from === '/triangle-area-grade-7-worksheets')!.to,
      '/triangle-area-grade-7'
    );
  });

  it('cleanup: no page file answers a redirected path; older redirect lists agree with the map', () => {
    for (const r of REDIRECT_RULES)
      assert.ok(
        !existsSync(new URL(`../src/pages${r.from}.astro`, import.meta.url)),
        `page file still exists for ${r.from}`
      );
    const byFrom = new Map(REDIRECT_RULES.map((r) => [r.from, r.to]));
    for (const r of [...SITE_PAGE_M24_REDIRECTS, ...TOPIC_PAGE_M30_REDIRECTS])
      assert.equal(byFrom.get(`/${r.from}`), r.to, r.from);
  });

  it('cleanup: rendered links to old paths go straight to the target (no 301 hop)', () => {
    const cases: Array<[string, string]> = [
      ['https://www.noamdoronmath.co.il/high-school-math-1', '/high-school-math'],
      ['https://www.noamdoronmath.co.il/page', '/terms'],
      ['/equations-grade-7', '/equations-basics-grade-7'],
      ['https://www.noamdoronmath.co.il/coordinate-plane-intro-grade-7#x', '/coordinate-plane-scale-grade-7#x'],
      ['https://www.noamdoronmath.co.il/worksheetsfor7thgrade', '/grade-7'],
      ['https://www.noamdoronmath.co.il/triangle-area-grade-7-worksheets', '/triangle-area-grade-7'],
    ];
    for (const [href, want] of cases) {
      const r = resolveSiteHref(href);
      assert.equal(r.href, want, href);
      assert.equal(r.local, true, href);
    }
  });
});
