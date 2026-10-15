import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { layoutOwnsSeo } from '../src/lib/metadataOwnership';
import {
  DEFAULT_SITE_DESCRIPTION,
  DEFAULT_SITE_TITLE,
  canonicalUrl,
  isPreviewHost,
  robotsContent,
} from '../src/lib/siteSeo';

describe('siteSeo preview vs production', () => {
  it('marks Wix preview and localhost as noindex', () => {
    assert.equal(isPreviewHost('wglqn3-noam-math-astro-poc-amiramnoam-130a.wix-site-host.com'), true);
    assert.equal(isPreviewHost('localhost'), true);
    assert.equal(robotsContent('127.0.0.1'), 'noindex,nofollow');
  });

  it('marks production main domain as indexable', () => {
    assert.equal(isPreviewHost('www.noamdoronmath.co.il'), false);
    assert.equal(isPreviewHost('noamdoronmath.co.il'), false);
    assert.equal(robotsContent('www.noamdoronmath.co.il'), 'index,follow');
  });

  it('builds canonicals on the main domain', () => {
    assert.equal(canonicalUrl('/grade-7'), 'https://www.noamdoronmath.co.il/grade-7');
    assert.equal(canonicalUrl('/'), 'https://www.noamdoronmath.co.il/');
    assert.equal(
      canonicalUrl('/grade-2', '?popup=ai3zi'),
      'https://www.noamdoronmath.co.il/grade-2?popup=ai3zi'
    );
  });

  it('default title/description are Hebrew and not Astro POC / Home dupes', () => {
    assert.match(DEFAULT_SITE_TITLE, /נועם/);
    assert.doesNotMatch(DEFAULT_SITE_TITLE, /Astro POC|Home \|/i);
    assert.doesNotMatch(DEFAULT_SITE_DESCRIPTION, /Astro POC/i);
  });

  it('BaseLayout renders a single owned set and never strips Wix tags in the browser', () => {
    const src = readFileSync('src/layouts/BaseLayout.astro', 'utf8');
    assert.match(src, /renderLayoutSeo &&/);
    assert.doesNotMatch(src, /stripWixSeoDupes|MutationObserver|removeChild/);
    assert.match(src, /showPreviewNote=\{showPreviewNote\}/);
    assert.match(src, /slot name="seo-tags"/);
  });

  it('leaves hosted main-page primary tags to Wix but preserves preview and item tags', () => {
    const main = { managedBuild: true, hostname: 'www.noamdoronmath.co.il', pathname: '/grade-5' };
    assert.equal(layoutOwnsSeo(main), false);
    assert.equal(layoutOwnsSeo({ ...main, managedBuild: false }), true);
    assert.equal(layoutOwnsSeo({ ...main, hostname: 'localhost' }), true);
    assert.equal(layoutOwnsSeo({ ...main, hostname: 'isolated-preview.manus.computer' }), true);
    assert.equal(layoutOwnsSeo({ ...main, pathname: '/blog/a-real-article' }), true);
    assert.equal(layoutOwnsSeo({ ...main, pathname: '/post/a-real-article' }), true);
    assert.equal(layoutOwnsSeo({ ...main, pathname: '/blog' }), false);
    assert.equal(layoutOwnsSeo({ ...main, hostname: 'www.noamdoronmath.co.il.evil.example' }), true);
    assert.equal(layoutOwnsSeo({ ...main, status: 404 }), true);
    assert.equal(layoutOwnsSeo({ ...main, pathname: '/404' }), true);
    assert.equal(layoutOwnsSeo({ ...main, hostname: 'internal.wix.local', forwardedUrl: 'https://www.noamdoronmath.co.il/grade-5' }), false);
    assert.equal(layoutOwnsSeo({ ...main, managedBuild: false, hostname: 'localhost', forwardedUrl: 'https://www.noamdoronmath.co.il/grade-5' }), true);
    assert.equal(layoutOwnsSeo({ ...main, hostname: 'localhost', forwardedUrl: 'javascript:alert(1)' }), true);
    assert.equal(layoutOwnsSeo({ ...main, hostname: 'localhost', forwardedUrl: 'not a url' }), true);
    assert.equal(layoutOwnsSeo({ ...main, hostname: 'localhost', forwardedUrl: 'https://user:pass@www.noamdoronmath.co.il/' }), true);
  });

  it('SiteFooter preview note is gated off production hosts', () => {
    const src = readFileSync('src/components/SiteFooter.astro', 'utf8');
    assert.match(src, /showPreviewNote/);
    assert.match(src, /showPreviewNote && footer\.previewNote/);
  });
});
