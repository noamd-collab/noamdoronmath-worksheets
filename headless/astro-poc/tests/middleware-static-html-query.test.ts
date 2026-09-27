/**
 * Wix/Astro quirk: public *.html shells 404 when the document URL has ?query.
 * Middleware must rewrite those paths to the bare asset while keeping search
 * in the browser URL for the viewer/learning clients.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

describe('middleware static HTML query rewrite', () => {
  const src = readFileSync('src/middleware.ts', 'utf8');

  it('rewrites worksheet-viewer and learning when search is present', () => {
    assert.match(src, /PUBLIC_HTML_WITH_QUERY/);
    assert.match(src, /worksheet-viewer-noam\.html/);
    assert.match(src, /learning\.html/);
    assert.match(src, /context\.rewrite\(path\)/);
    assert.match(src, /context\.url\.search/);
  });
});
