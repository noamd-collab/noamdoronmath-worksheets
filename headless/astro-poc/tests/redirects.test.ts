/**
 * OPEN-15 — 301 map for the domain move: representative paths, trailing slash,
 * exclusions, and integrity of src/data/redirects.json.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { existsSync } from 'node:fs';
import { REDIRECT_RULES, resolveRedirect } from '../src/lib/redirects';

const pageExists = (p: string) =>
  p === '/' || existsSync(new URL(`../src/pages${p}.astro`, import.meta.url));

describe('OPEN-15 redirects', () => {
  it('maps the representative legacy paths to their decided targets', () => {
    const cases: Array<[string, string]> = [
      ['/worksheetsfor7thgrade', '/grade-7'],
      ['/worksheetsfor1thgrade', '/grade-1'],
      ['/home', '/'],
      ['/coordinate-plane-intro-grade-7', '/coordinate-plane-scale-grade-7'],
      ['/triangle-area-grade-7-worksheets', '/powers-grade-7'],
      ['/blank-1', '/quadratic-inequalities-systems-grade-9'],
      ['/page-2', '/aboutus'],
      ['/equations-grade-7', '/equations-basics-grade-7'],
    ];
    for (const [from, to] of cases) assert.equal(resolveRedirect(from), to, from);
  });

  it('strips a trailing slash, in one hop even for a mapped path, and keeps the query', () => {
    assert.equal(resolveRedirect('/aboutus/'), '/aboutus');
    assert.equal(resolveRedirect('/grade-7/'), '/grade-7');
    assert.equal(resolveRedirect('/worksheetsfor7thgrade/'), '/grade-7');
    assert.equal(resolveRedirect('/worksheets/', '?grade=7'), '/worksheets?grade=7');
    assert.equal(resolveRedirect('/home', '?utm_source=x'), '/?utm_source=x');
  });

  it('leaves live pages, the root, the blog, api, platform paths and files alone', () => {
    for (const p of ['/', '/grade-7', '/aboutus', '/math-tools', '/blog', '/blog/', '/post/x/', '/api/blog-audio-info/', '/_wix/pages.json', '/learning.html', '/triangular-prism-volume-grade-9'])
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
    }
    assert.equal(REDIRECT_RULES.filter((r) => r.from.startsWith('/worksheetsfor')).length, 9);
    assert.match(REDIRECT_RULES.find((r) => r.from === '/triangle-area-grade-7-worksheets')!.note!, /live-mapping-looks-wrong-check-with-noam/);
    assert.equal(REDIRECT_RULES.filter((r) => /pending-wix-api/.test(r.note || '')).length, 22);
  });
});
