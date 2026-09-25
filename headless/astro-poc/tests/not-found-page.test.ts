/**
 * Styled 404: site chrome, Hebrew copy, and links home / worksheets / blog.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

describe('404 page', () => {
  it('uses BaseLayout and SiteFooter with Hebrew recovery links', () => {
    const path = 'src/pages/404.astro';
    assert.equal(existsSync(path), true);
    const src = readFileSync(path, 'utf8');
    assert.match(src, /export const prerender = false/);
    assert.match(src, /import BaseLayout from '\.\.\/layouts\/BaseLayout\.astro'/);
    assert.match(src, /import SiteFooter from '\.\.\/components\/SiteFooter\.astro'/);
    assert.match(src, /<SiteFooter/);
    assert.match(src, /העמוד לא נמצא/);
    assert.match(src, /href="\/"/);
    assert.match(src, /href="\/worksheets"/);
    assert.match(src, /href="\/blog"/);
    assert.match(src, /דף הבית/);
    assert.match(src, /דפי עבודה/);
    assert.match(src, /בלוג/);
  });
});
