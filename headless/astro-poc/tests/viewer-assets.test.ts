/**
 * HEADLESS-MIGRATION-12 — copied viewer must match live GitHub mobile page
 * width (pdfZoom / 0.7) and ship a working learning.html route.
 */
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const pub = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');

describe('copied viewer assets (HEADLESS-MIGRATION-12)', () => {
  it('mobile getPdfPageWidth matches live GitHub (÷ 0.7 at 70% zoom)', () => {
    const html = readFileSync(join(pub, 'worksheet-viewer-noam.html'), 'utf8');
    assert.ok(html.includes('pdfZoom / .7'));
    assert.ok(
      !html.includes(
        'pdfScroll.clientWidth - (mobileLayout.matches ? 116 : 78)) * pdfZoom;'
      )
    );
  });

  it('learning.html is present and catalog/brand links stay on preview', () => {
    const path = join(pub, 'learning.html');
    assert.equal(existsSync(path), true);
    const html = readFileSync(path, 'utf8');
    assert.ok(html.includes('הלמידה שלי'));
    assert.ok(!html.includes('href="./"'));
    assert.ok(html.includes('href="/worksheets"'));
    assert.ok(html.includes('class="nl-brand" href="/"'));
  });

  it('sibling catalog fetch uses HEADLESS_LEGACY_INDEX (local or GitHub rollback)', () => {
    const html = readFileSync(join(pub, 'worksheet-viewer-noam.html'), 'utf8');
    assert.ok(html.includes('HEADLESS_LEGACY_INDEX'));
    assert.ok(html.includes('"./legacy-github/index.html"'));
    assert.ok(!html.includes('fetch(\n    "./index.html"'));
  });
});
