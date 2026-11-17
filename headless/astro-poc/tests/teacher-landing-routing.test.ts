import test from 'node:test';
import assert from 'node:assert/strict';
import { legacyTeacherToolRedirect } from '../src/lib/teacherLandingContent';
import { canonicalUrl, robotsContent } from '../src/lib/siteSeo';
import { pathsFromAstroModuleKeys } from '../src/lib/siteSitemaps';
import { existsSync } from 'node:fs';
import { GET as oldStaticEntry } from '../src/pages/teachers/index.html';

test('teacher landing keeps plain and marketing visits on the public page', () => {
  for (const query of ['', '?utm_source=teachers', '?next=https://untrusted.example']) {
    assert.equal(legacyTeacherToolRedirect(new URL(`https://www.noamdoronmath.co.il/teachers${query}`)), null);
  }
  assert.equal(canonicalUrl('/teachers', '?utm_source=teachers'), 'https://www.noamdoronmath.co.il/teachers');
  assert.equal(robotsContent('www.noamdoronmath.co.il', {}), 'index,follow');
  assert.equal(robotsContent('preview.wix-site-host.com', { SITE_INDEXABLE: 'true' }), 'noindex,nofollow');
  assert.ok(pathsFromAstroModuleKeys(['./teachers.astro']).includes('/teachers'));
});

test('legacy scope and AI pick handoffs preserve all parameters and their encoding', () => {
  const query = '?grade=3&topic=10&level=a&edition=elementary-20261108-r1&minutes=20&pick=1%2C2&note=%D7%A9%D7%9C%D7%95%D7%9D';
  assert.equal(legacyTeacherToolRedirect(new URL(`https://www.noamdoronmath.co.il/teachers${query}`)), `/teachers/app${query}`);
  for (const key of ['grade', 'topic', 'level', 'edition', 'minutes', 'pick']) {
    assert.equal(legacyTeacherToolRedirect(new URL(`https://example.test/teachers?${key}=`)), `/teachers/app?${key}=`);
  }
});

test('legacy redirects stay on this site, preserve unknown parameters and never accept a destination', () => {
  const query = '?grade=bad&next=https://untrusted.example&grade=3';
  assert.equal(legacyTeacherToolRedirect(new URL(`https://example.test/teachers${query}#selection`)), `/teachers/app${query}#selection`);
});

test('the old static entry cannot shadow the new landing and remains a private tool alias', async () => {
  assert.equal(existsSync(new URL('../public/teachers/index.html', import.meta.url)), false);
  assert.equal(existsSync(new URL('../src/teacher-pages/wizard.html', import.meta.url)), true);
  const url = new URL('https://example.test/teachers/index.html?grade=3&topic=10&pick=1%2C2');
  const response = await oldStaticEntry({ url } as Parameters<typeof oldStaticEntry>[0]);
  assert.equal(response.status, 307);
  assert.equal(response.headers.get('location'), '/teachers/app?grade=3&topic=10&pick=1%2C2');
  assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow');
  assert.equal(response.headers.get('cache-control'), 'no-store');
});
