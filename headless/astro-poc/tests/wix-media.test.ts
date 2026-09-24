/**
 * M36 Wix Media UGD helpers — strict URL validation (no substring trust).
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  WIX_UGD_CDN_BASE,
  WIX_UGD_LEGACY_SITE_BASE,
  WIX_UGD_SITE_PATH_PREFIX,
  canonicalizeUgdPdfHref,
  normalizePdfBase,
  redirectTargetForSiteUgdPath,
  wixUgdPdfUrl,
} from '../src/lib/wixMedia';
import { loadCatalog } from '../src/lib/catalog/loadCatalog';
import { readFileSync } from 'node:fs';

const GOOD_ID = '3b7080759e5240fe8f7faa8e0e261084';
const GOOD_CDN = `https://static.wixstatic.com/ugd/d8e7ad_${GOOD_ID}.pdf`;
const GOOD_SITE = `https://www.noamdoronmath.co.il/_files/ugd/d8e7ad_${GOOD_ID}.pdf`;

describe('M36 wixMedia UGD', () => {
  it('builds CDN PDF URLs from pdfId without copying bytes', () => {
    assert.equal(wixUgdPdfUrl(GOOD_ID), GOOD_CDN);
    assert.throws(() => wixUgdPdfUrl('not-an-id'));
  });

  it('preserves query and hash on wixUgdPdfUrl', () => {
    assert.equal(
      wixUgdPdfUrl(GOOD_ID, { search: '?dl=1', hash: '#page=2' }),
      `${GOOD_CDN}?dl=1#page=2`
    );
  });

  it('normalizes exact legacy + CDN + relative bases to fixed canonical (never echoes raw)', () => {
    assert.equal(normalizePdfBase(WIX_UGD_LEGACY_SITE_BASE), WIX_UGD_CDN_BASE);
    assert.equal(
      normalizePdfBase('https://www.noamdoronmath.co.il/_files/ugd/d8e7ad_'),
      WIX_UGD_CDN_BASE
    );
    assert.equal(
      normalizePdfBase('https://noamdoronmath.co.il/_files/ugd/d8e7ad_'),
      WIX_UGD_CDN_BASE
    );
    assert.equal(normalizePdfBase(WIX_UGD_SITE_PATH_PREFIX), WIX_UGD_CDN_BASE);
    assert.equal(normalizePdfBase(WIX_UGD_CDN_BASE), WIX_UGD_CDN_BASE);
    // Even a "valid" CDN input must return the fixed constant, not the raw string object identity
    const spaced = `  ${WIX_UGD_CDN_BASE}  `;
    assert.equal(normalizePdfBase(spaced), WIX_UGD_CDN_BASE);
    assert.notEqual(normalizePdfBase(spaced), spaced);
  });

  it('rejects lookalike hosts / userinfo / query-on-base (never returns attacker string)', () => {
    const attacks = [
      'https://evil.example/static.wixstatic.com/ugd/d8e7ad_',
      'https://static.wixstatic.com.evil.example/ugd/d8e7ad_',
      'https://static.wixstatic.com%2eevil.example/ugd/d8e7ad_',
      'https://user:pass@static.wixstatic.com/ugd/d8e7ad_',
      'https://static.wixstatic.com/ugd/d8e7ad_@evil.example/',
      'https://static.wixstatic.com/ugd/d8e7ad_?x=1',
      'https://static.wixstatic.com/ugd/otherprefix_',
      'https://static.wixstatic.com/ugd/d8e7ad_/../evil',
      'http://static.wixstatic.com/ugd/d8e7ad_',
      'https://static.wixstatic.com:444/ugd/d8e7ad_',
      '//static.wixstatic.com/ugd/d8e7ad_',
      'https://www.noamdoronmath.co.il.evil/_files/ugd/d8e7ad_',
      'https://evil.noamdoronmath.co.il/_files/ugd/d8e7ad_',
    ];
    for (const a of attacks) {
      const out = normalizePdfBase(a);
      assert.equal(out, WIX_UGD_CDN_BASE, `should canonicalize: ${a}`);
      assert.ok(!out.includes('evil'), `must not leak lookalike: ${a} → ${out}`);
      assert.notEqual(out, a);
    }
  });

  it('canonicalizeUgdPdfHref rewrites supported PDFs and preserves query/fragment', () => {
    assert.equal(canonicalizeUgdPdfHref(GOOD_CDN), GOOD_CDN);
    assert.equal(canonicalizeUgdPdfHref(GOOD_SITE), GOOD_CDN);
    assert.equal(
      canonicalizeUgdPdfHref(`/_files/ugd/d8e7ad_${GOOD_ID}.pdf`),
      GOOD_CDN
    );
    assert.equal(
      canonicalizeUgdPdfHref(`${GOOD_SITE}?dl=1#p=3`),
      `${GOOD_CDN}?dl=1#p=3`
    );
    assert.equal(
      canonicalizeUgdPdfHref(`${GOOD_CDN}?download=1`),
      `${GOOD_CDN}?download=1`
    );
  });

  it('canonicalizeUgdPdfHref rejects adversarial PDF hrefs', () => {
    const bad = [
      `https://evil.example/static.wixstatic.com/ugd/d8e7ad_${GOOD_ID}.pdf`,
      `https://user:pass@static.wixstatic.com/ugd/d8e7ad_${GOOD_ID}.pdf`,
      `https://static.wixstatic.com/ugd/d8e7ad_${GOOD_ID}.pdf/../x`,
      `https://static.wixstatic.com/media/d8e7ad_${GOOD_ID}.pdf`,
      `https://static.wixstatic.com/ugd/other_${GOOD_ID}.pdf`,
      `https://filesusr.com/ugd/d8e7ad_${GOOD_ID}.pdf`,
      `/_files/ugd/../ugd/d8e7ad_${GOOD_ID}.pdf`,
      `/_files/ugd/d8e7ad_${GOOD_ID}.pdf/..`,
      `/%2e%2e/_files/ugd/d8e7ad_${GOOD_ID}.pdf`,
    ];
    for (const b of bad) {
      assert.equal(canonicalizeUgdPdfHref(b), null, `must reject: ${b}`);
    }
  });

  it('redirectTargetForSiteUgdPath is exact + preserves search; rejects traversal', () => {
    assert.equal(
      redirectTargetForSiteUgdPath(`/_files/ugd/d8e7ad_${GOOD_ID}.pdf`),
      GOOD_CDN
    );
    assert.equal(
      redirectTargetForSiteUgdPath(`/_files/ugd/d8e7ad_${GOOD_ID}.pdf`, '?dl=1'),
      `${GOOD_CDN}?dl=1`
    );
    assert.equal(redirectTargetForSiteUgdPath('/_files/ugd/otherprefix_abc.pdf'), null);
    assert.equal(redirectTargetForSiteUgdPath('/worksheets'), null);
    assert.equal(
      redirectTargetForSiteUgdPath(`/_files/ugd/%2e%2e/d8e7ad_${GOOD_ID}.pdf`),
      null
    );
    assert.equal(
      redirectTargetForSiteUgdPath(`/_files/ugd/d8e7ad_${GOOD_ID}.pdf/../x`),
      null
    );
    assert.equal(
      redirectTargetForSiteUgdPath(`/_files/%2fugd/d8e7ad_${GOOD_ID}.pdf`),
      null
    );
  });

  it('loadCatalog exposes CDN pdfBase even if snapshot still has legacy site base', () => {
    const snap = JSON.parse(readFileSync('src/data/catalog.v1.json', 'utf8'));
    assert.ok(
      snap.config.pdfBase.includes('_files/ugd/') ||
        snap.config.pdfBase.includes('wixstatic')
    );
    const cat = loadCatalog();
    assert.equal(cat.config.pdfBase, WIX_UGD_CDN_BASE);
  });

  it('viewer + learning assets use CDN BASE (no domain-tied /_files for new links)', () => {
    const viewer = readFileSync('public/worksheet-viewer-noam.html', 'utf8');
    assert.ok(viewer.includes('https://static.wixstatic.com/ugd/d8e7ad_'));
    assert.ok(!viewer.includes('https://www.noamdoronmath.co.il/_files/ugd/d8e7ad_'));
    const learning = readFileSync('public/noam-learning.js', 'utf8');
    assert.ok(learning.includes('https://static.wixstatic.com/ugd/d8e7ad_'));
    assert.ok(!learning.includes('https://www.noamdoronmath.co.il/_files/ugd/d8e7ad_'));
  });
});
