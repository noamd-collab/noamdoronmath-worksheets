/**
 * Wix/Astro quirk: public *.html shells 404 when the document URL has ?query.
 * Middleware must return the bundled HTML body (rewrite alone still 404s on Wix)
 * while the browser URL keeps search for the viewer/learning clients.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

describe('middleware static HTML query serve', () => {
  const mw = readFileSync('src/middleware.ts', 'utf8');
  const shells = readFileSync('src/lib/publicHtmlShells.ts', 'utf8');

  it('serves bundled worksheet-viewer and learning HTML when search is present', () => {
    assert.match(mw, /PUBLIC_HTML_SHELLS/);
    assert.match(mw, /new Response\(shell/);
    assert.match(mw, /context\.url\.search/);
    assert.match(shells, /worksheet-viewer-noam\.html\?raw/);
    assert.match(shells, /learning\.html\?raw/);
  });
});
