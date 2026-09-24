/**
 * M37 — route-aware primary nav resolution.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { normalizeNavPath, resolveActiveNav } from '../src/lib/activeNav';

describe('M37 resolveActiveNav', () => {
  it('home is exact / only (trailing slash normalized)', () => {
    assert.equal(resolveActiveNav('/'), 'home');
    assert.equal(resolveActiveNav(''), 'home');
    assert.equal(normalizeNavPath('/aboutus/'), '/aboutus');
    assert.equal(resolveActiveNav('/aboutus/'), 'about');
    assert.notEqual(resolveActiveNav('/aboutus'), 'home');
    assert.notEqual(resolveActiveNav('/worksheets'), 'home');
    assert.notEqual(resolveActiveNav('/blog'), 'home');
    assert.notEqual(resolveActiveNav('/terms'), 'home');
  });

  it('maps about / tools / highschool / learning', () => {
    assert.equal(resolveActiveNav('/aboutus'), 'about');
    assert.equal(resolveActiveNav('/math-tools'), 'tools');
    assert.equal(resolveActiveNav('/high-school-math'), 'highschool');
    assert.equal(resolveActiveNav('/high-school-math-1'), 'highschool');
    assert.equal(resolveActiveNav('/learning.html'), 'learning');
    assert.equal(resolveActiveNav('/learning'), 'learning');
  });

  it('maps worksheets catalog, grade hubs, and topic pages (not home)', () => {
    assert.equal(resolveActiveNav('/worksheets'), 'worksheets');
    assert.equal(resolveActiveNav('/grade-7'), 'worksheets');
    assert.equal(resolveActiveNav('/equations-basics-grade-7'), 'worksheets');
    assert.equal(resolveActiveNav('/equations-grade-7'), 'worksheets');
    assert.notEqual(resolveActiveNav('/grade-7'), 'home');
  });

  it('maps blog archives and posts', () => {
    assert.equal(resolveActiveNav('/blog'), 'blog');
    assert.equal(resolveActiveNav('/blog/'), 'blog');
    assert.equal(resolveActiveNav('/blog/categories/middle-school-math'), 'blog');
    assert.equal(resolveActiveNav('/post/annual-review-grade-7'), 'blog');
  });

  it('legal / unrelated pages get no active nav (null)', () => {
    assert.equal(resolveActiveNav('/terms'), null);
    assert.equal(resolveActiveNav('/accessibilityadaptation'), null);
    assert.equal(resolveActiveNav('/conditionforfreeworksheets'), null);
    assert.equal(resolveActiveNav('/worksheet-viewer-noam.html'), null);
  });

  it('SiteHeader sets aria-current=page from active key (not hardcoded home)', () => {
    const html = readFileSync('src/components/SiteHeader.astro', 'utf8');
    assert.ok(html.includes("resolveActiveNav"));
    assert.ok(html.includes("'aria-current'"));
    assert.ok(html.includes("navProps('about')"));
    assert.ok(!html.includes('activeNav="home"'));
  });

  it('SitePage / blog shells no longer force activeNav=home', () => {
    assert.ok(!readFileSync('src/components/SitePage.astro', 'utf8').includes('activeNav="home"'));
    assert.ok(
      !readFileSync('src/components/BlogArchivePage.astro', 'utf8').includes('activeNav="home"')
    );
    assert.ok(
      !readFileSync('src/components/BlogPostPage.astro', 'utf8').includes('activeNav="home"')
    );
  });

  it('learning.html has Headless בס״ד top-right styles and marker', () => {
    const html = readFileSync('public/learning.html', 'utf8');
    assert.ok(html.includes('data-basad'));
    assert.ok(html.includes('בס״ד'));
    assert.ok(html.includes('nl-basad'));
    assert.ok(html.includes('right:12px') || html.includes('right: 12px'));
    assert.ok(html.includes('id="nl-basad-headless"'));
  });

  it('sync-viewer-assets re-injects learning בס״ד after sync', () => {
    const sync = readFileSync('scripts/sync-viewer-assets.mjs', 'utf8');
    assert.ok(sync.includes('nl-basad'));
    assert.ok(sync.includes('data-basad'));
    assert.ok(sync.includes('Failed to ensure Headless בס״ד'));
  });
});
