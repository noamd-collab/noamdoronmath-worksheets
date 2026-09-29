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
    // Test the destination, accessible active state and label, not an old skin's
    // CSS class/helper name. Active-state expressions are exercised in active-nav.
    const learning = html.match(/<a\b([^>]*\bhref="\/learning\.html"[^>]*)>([\s\S]*?)<\/a>/);
    assert.ok(learning, 'learning CTA is an anchor to the existing destination');
    assert.match(learning[1], /aria-current=\{[^}]*active\s*===\s*'learning'[^}]*\}/);
    assert.ok(learning[2].includes('הלמידה שלי'));
  });

  it('SiteHeader retains worksheets + expanded Harmony nav targets', () => {
    const html = readFileSync(join(src, 'components', 'SiteHeader.astro'), 'utf8');
    assert.ok(html.includes('href="/worksheets?level=ysodi"'));
    assert.ok(html.includes('href="/worksheets?level=hatzava"'));
    assert.ok(html.includes('דפי עבודה ליסודי'));
    assert.ok(html.includes('דפי עבודה לחטיבת הביניים'));
    assert.equal(html.includes('הביינים'), false);
    assert.ok(html.includes('href="/blog"'));
    assert.ok(html.includes('href="/math-tools"'));
  });
});
