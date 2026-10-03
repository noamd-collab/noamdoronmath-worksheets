import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import {
  DEFAULT_SITE_DESCRIPTION,
  DEFAULT_SITE_TITLE,
  buildSocialMeta,
  canonicalUrl,
  isPreviewHost,
  isProductionHost,
  renderRobotsTxt,
  robotsContent,
} from '../src/lib/siteSeo';

describe('siteSeo preview vs production', () => {
  it('marks Wix preview and localhost as noindex', () => {
    assert.equal(isPreviewHost('wglqn3-noam-math-astro-poc-amiramnoam-130a.wix-site-host.com'), true);
    assert.equal(isPreviewHost('localhost'), true);
    assert.equal(robotsContent('127.0.0.1'), 'noindex,nofollow');
  });

  it('marks production main domain as indexable when the env flag is unset', () => {
    assert.equal(isPreviewHost('www.noamdoronmath.co.il'), false);
    assert.equal(isProductionHost('www.noamdoronmath.co.il'), true);
    assert.equal(isPreviewHost('noamdoronmath.co.il'), false);
    assert.equal(robotsContent('www.noamdoronmath.co.il', {}), 'index,follow');
  });

  it('SITE_INDEXABLE forces index or noindex, but preview hosts stay noindex', () => {
    assert.equal(robotsContent('www.noamdoronmath.co.il', { SITE_INDEXABLE: 'false' }), 'noindex,nofollow');
    assert.equal(robotsContent('example.com', { SITE_INDEXABLE: 'true' }), 'index,follow');
    assert.equal(
      robotsContent('preview.wix-site-host.com', { SITE_INDEXABLE: 'true' }),
      'noindex,nofollow',
    );
    assert.equal(robotsContent('unknown.example', {}), 'noindex,nofollow');
  });

  it('robots.txt points at the production sitemap and blocks preview crawling', () => {
    const preview = renderRobotsTxt(false);
    const live = renderRobotsTxt(true);
    assert.match(preview, /Disallow: \//);
    assert.match(live, /Allow: \//);
    assert.match(preview, /Sitemap: https:\/\/www\.noamdoronmath\.co\.il\/sitemap\.xml/);
    assert.match(live, /Sitemap: https:\/\/www\.noamdoronmath\.co\.il\/sitemap\.xml/);
    assert.doesNotMatch(preview, /wix-site-host/);
  });

  it('social tags cover Open Graph and Twitter once per page', () => {
    const tags = buildSocialMeta({
      title: 'שטח משולש',
      description: 'תרגול שטח משולש לכיתה ז׳',
      url: 'https://www.noamdoronmath.co.il/triangle-area-grade-7',
      image: 'https://www.noamdoronmath.co.il/brand/noam-doron-math-logo.png',
      type: 'article',
    });
    const keys = tags.map((t) => t.property || t.name);
    assert.deepEqual(keys, [
      'og:title',
      'og:description',
      'og:url',
      'og:locale',
      'og:type',
      'og:site_name',
      'twitter:card',
      'twitter:title',
      'twitter:description',
      'og:image',
      'twitter:image',
    ]);
    assert.equal(new Set(keys).size, keys.length);
    assert.equal(tags.find((t) => t.property === 'og:type')?.content, 'article');
  });

  it('builds canonicals on the main domain', () => {
    assert.equal(canonicalUrl('/grade-7'), 'https://www.noamdoronmath.co.il/grade-7');
    assert.equal(canonicalUrl('/'), 'https://www.noamdoronmath.co.il/');
    // popup is client-side only (redirects.json), so it is the same page as /grade-2.
    assert.equal(canonicalUrl('/grade-2', '?popup=ai3zi'), 'https://www.noamdoronmath.co.il/grade-2');
  });

  it('default title/description are Hebrew and not Astro POC / Home dupes', () => {
    assert.match(DEFAULT_SITE_TITLE, /נועם/);
    assert.doesNotMatch(DEFAULT_SITE_TITLE, /Astro POC|Home \|/i);
    assert.doesNotMatch(DEFAULT_SITE_DESCRIPTION, /Astro POC/i);
  });

  it('BaseLayout strips conflicting Wix SEO title/canonical/og:title tags', () => {
    const src = readFileSync('src/layouts/BaseLayout.astro', 'utf8');
    assert.match(src, /stripWixSeoDupes/);
    assert.match(src, /wix-seo-tag/);
    assert.match(src, /buildSocialMeta/);
    assert.match(src, /twitter:/);
    assert.match(src, /indexOf\('og:'\)/);
    assert.match(src, /lang="he"/);
    assert.match(src, /dir="rtl"/);
    assert.match(src, /showPreviewNote=\{showPreviewNote\}/);
  });

  it('SiteFooter preview note is gated off production hosts', () => {
    const src = readFileSync('src/components/SiteFooter.astro', 'utf8');
    assert.match(src, /showPreviewNote/);
    assert.match(src, /showPreviewNote && footer\.previewNote/);
  });
});
