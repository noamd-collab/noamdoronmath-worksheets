import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
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
});
