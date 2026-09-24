/**
 * HEADLESS-MIGRATION-15 — header learning link present on code-managed shell.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const src = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');

describe('site header learning link (HEADLESS-MIGRATION-15)', () => {
  it('SiteHeader exposes same-origin הלמידה שלי → /learning.html', () => {
    const html = readFileSync(join(src, 'components', 'SiteHeader.astro'), 'utf8');
    assert.ok(html.includes('href="/learning.html"'));
    assert.ok(html.includes('הלמידה שלי'));
    assert.ok(html.includes("navProps('learning')"));
  });

  it('SiteHeader retains worksheets + expanded Harmony nav targets', () => {
    const html = readFileSync(join(src, 'components', 'SiteHeader.astro'), 'utf8');
    assert.ok(html.includes('href="/worksheets"'));
    assert.ok(html.includes('href="/blog"'));
    assert.ok(html.includes('href="/math-tools"'));
  });
});
