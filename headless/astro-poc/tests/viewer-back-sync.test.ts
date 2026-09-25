/**
 * The next sync:viewer run copies the root viewer and rewrites its back=
 * block from headlessViewerBackBlock. That output must keep the allowlist
 * already in public/worksheet-viewer-noam.html.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  applyHeadlessViewerBack,
  headlessViewerBackBlock,
} from '../scripts/sync-viewer-assets.mjs';
import { LEGACY_GITHUB_CATALOG, viewerBackHref } from './viewer-back-href.ts';

const here = dirname(fileURLToPath(import.meta.url));
const pubViewer = join(here, '..', 'public', 'worksheet-viewer-noam.html');
const rootViewer = join(here, '..', '..', '..', 'worksheet-viewer-noam.html');

function backBlock(html: string) {
  const start = html.indexOf('/* BACK — Headless adapter:');
  const end = html.indexOf('var panel = document.getElementById("panel");');
  assert.ok(start >= 0 && end > start, 'back block missing');
  return html.slice(start, end).trimEnd();
}

describe('sync viewer back template', () => {
  it('template output matches the public viewer back= guard', () => {
    const html = readFileSync(pubViewer, 'utf8');
    assert.equal(backBlock(html), headlessViewerBackBlock);
    assert.ok(headlessViewerBackBlock.includes('var allowlistedBackHost'));
    assert.ok(headlessViewerBackBlock.includes('pathname.indexOf("/worksheets/") === 0'));
    assert.equal(
      headlessViewerBackBlock.includes('pathname.indexOf("/worksheets") === 0'),
      false
    );
    assert.ok(headlessViewerBackBlock.includes('!isHeadlessHost'));
    assert.ok(headlessViewerBackBlock.includes('target === current'));
    assert.ok(headlessViewerBackBlock.includes('isProductionPairHost(target)'));
  });

  it('applying the template to the upstream viewer does not regress the guard', () => {
    const patched = applyHeadlessViewerBack(readFileSync(rootViewer, 'utf8'));
    assert.equal(backBlock(patched), headlessViewerBackBlock);
    const preview = 'preview.wix-site-host.com';
    assert.equal(
      viewerBackHref(patched, {
        hostname: 'www.noamdoronmath.co.il',
        back: LEGACY_GITHUB_CATALOG,
      }),
      '/worksheets?grade=7'
    );
    assert.equal(
      viewerBackHref(patched, {
        hostname: 'noamdoronmath.co.il',
        back: '/worksheetsEvil',
      }),
      '/worksheets?grade=7'
    );
    assert.equal(
      viewerBackHref(patched, {
        hostname: preview,
        back: 'https://other.wix-site-host.com/worksheets?grade=7',
      }),
      '/worksheets?grade=7'
    );
    assert.equal(
      viewerBackHref(patched, {
        hostname: preview,
        back: LEGACY_GITHUB_CATALOG,
      }),
      '/worksheets?grade=7'
    );
    assert.equal(
      viewerBackHref(patched, {
        hostname: preview,
        back: `https://${preview}/worksheets?grade=7`,
      }),
      `https://${preview}/worksheets?grade=7`
    );
    assert.equal(
      viewerBackHref(patched, {
        hostname: preview,
        back: 'https://noamdoronmath.co.il/worksheets?grade=7',
      }),
      'https://noamdoronmath.co.il/worksheets?grade=7'
    );
  });

  it('re-applying the template to the patched public viewer leaves the guard in place', () => {
    const html = readFileSync(pubViewer, 'utf8');
    assert.equal(applyHeadlessViewerBack(html), html);
    assert.equal(backBlock(applyHeadlessViewerBack(html)), headlessViewerBackBlock);
  });
});
