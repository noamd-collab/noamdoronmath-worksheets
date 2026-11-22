/**
 * HEADLESS-MIGRATION-15 — header learning link present on code-managed shell.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const src = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');
const pub = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');

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

  it('learning.html uses the same per-letter משחקים label as SiteHeader', () => {
    const html = readFileSync(join(pub, 'learning.html'), 'utf8');
    const css = readFileSync(join(pub, 'noam-learning.css'), 'utf8');
    const button = html.match(/<button\b([^>]*\bdata-tools-toggle\b[^>]*)>([\s\S]*?)<\/button>/);
    assert.ok(button, 'learning games control is a button');
    assert.match(button[1], /aria-label="משחקים"/);
    assert.match(button[2], /<span class="exact-nav-rainbow" aria-hidden="true"><span>מ<\/span><span>ש<\/span><span>ח<\/span><span>ק<\/span><span>י<\/span><span>ם<\/span><\/span>/);
    assert.match(html, /class="exact-nav-game exact-nav-game--pink"[^>]*>פינת המשחקים של אליהו</);
    assert.equal(html.includes('/games/kefel-mekutsar-2'), false);
    assert.equal(html.includes('/games/eliyahu-pythagoras'), false);
    assert.equal(html.includes('>משחקים</button>'), false);
    for (const rule of ['#c92f55', '#b85513', '#3f7f2a', '#2a60a7', 'exact-nav-game--orange', 'exact-nav-game--green']) {
      assert.ok(css.includes(rule), rule);
    }
  });

  it('teacher workspace nav uses the same per-letter משחקים label', () => {
    const html = readFileSync(join(src, 'teacher-pages', 'wizard.html'), 'utf8');
    assert.match(
      html,
      /href="https:\/\/www\.noamdoronmath\.co\.il\/math-tools" aria-label="משחקים"><span class="exact-nav-rainbow" aria-hidden="true"><span>מ<\/span><span>ש<\/span><span>ח<\/span><span>ק<\/span><span>י<\/span><span>ם<\/span><\/span><\/a>/
    );
    assert.match(html, /\.exact-nav-rainbow>span:nth-child\(4n\+1\)\{color:#c92f55\}/);
  });
});
