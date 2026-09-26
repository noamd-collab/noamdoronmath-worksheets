/**
 * Styled 404: site chrome, Hebrew copy, and links home / worksheets / blog.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

describe('404 page', () => {
  it('uses BaseLayout (shared footer) with Hebrew recovery links', () => {
    const path = 'src/pages/404.astro';
    assert.equal(existsSync(path), true);
    const src = readFileSync(path, 'utf8');
    assert.match(src, /export const prerender = false/);
    assert.match(src, /import BaseLayout from '\.\.\/layouts\/BaseLayout\.astro'/);
    // Footer now comes from BaseLayout on every page (r6); must not be doubled here.
    assert.doesNotMatch(src, /<SiteFooter/);
    const layout = readFileSync('src/layouts/BaseLayout.astro', 'utf8');
    assert.match(layout, /<SiteFooter/);
    assert.match(src, /העמוד לא נמצא/);
    assert.match(src, /href="\/"/);
    assert.match(src, /href="\/worksheets"/);
    assert.match(src, /href="\/blog"/);
    assert.match(src, /דף הבית/);
    assert.match(src, /דפי עבודה/);
    assert.match(src, /בלוג/);
  });
});
