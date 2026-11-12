/**
 * HEADLESS-MIGRATION-32 — general same-site URL resolver.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  isLocallyServedPath,
  isMediaOrAssetUrl,
  resolveSiteHref,
  resolveSiteHrefString,
  PROD_ORIGIN,
} from '../src/lib/resolveSiteHref.ts';
import { localizeBlogHref } from '../src/lib/blogPosts.ts';
import { localizeSiteHref } from '../src/lib/sitePages.ts';
import { TOPIC_PAGE_SLUGS } from '../src/lib/topicPages.ts';

describe('resolveSiteHref (M32)', () => {
  it('keeps migrated topic/grade/site routes on same-origin paths', () => {
    assert.equal(
      resolveSiteHrefString(`${PROD_ORIGIN}/grade-7`),
      '/grade-7'
    );
    assert.equal(
      resolveSiteHrefString(`${PROD_ORIGIN}/equations-basics-grade-7`),
      '/equations-basics-grade-7'
    );
    assert.equal(
      resolveSiteHrefString(`${PROD_ORIGIN}/aboutus#team`),
      '/aboutus#team'
    );
    assert.equal(
      resolveSiteHrefString(`${PROD_ORIGIN}/worksheets?grade=7&topic=12`),
      '/worksheets?grade=7&topic=12'
    );
    assert.equal(resolveSiteHrefString('/blog?page=2'), '/blog?page=2');
  });

  it('preserves anchors/query on local paths', () => {
    const r = resolveSiteHref(`${PROD_ORIGIN}/signed-numbers-grade-7?utm=x#faq`);
    assert.equal(r.href, '/signed-numbers-grade-7?utm=x#faq');
    assert.equal(r.local, true);
    assert.equal(r.reason, 'local');
  });

  it('keeps the teacher landing and tool local with every scope and selection parameter intact', () => {
    const suffix = '?grade=3&topic=10&level=a&edition=elementary-20261108-r1&minutes=45&pick=ex%3A3d7563584d774bf5958dc6a37ef7e210%3A1%D7%90&tag=one&tag=two#questions';
    for (const path of ['/teachers', '/teachers/app']) {
      assert.equal(isLocallyServedPath(path), true);
      assert.equal(isLocallyServedPath(path + '/'), true);
      for (const href of [path + suffix, PROD_ORIGIN + path + suffix, 'https://noamdoronmath.co.il' + path + '/' + suffix]) {
        assert.deepEqual(resolveSiteHref(href), { href: path + suffix, local: true, reason: 'local' });
      }
    }
    assert.equal(resolveSiteHrefString(PROD_ORIGIN + '/teachers?utm_source=menu'), '/teachers?utm_source=menu');
    for (const path of ['/teachers/unknown', '/teachers/app/unknown', '/teachers-other']) {
      assert.equal(isLocallyServedPath(path), false, 'Only the two exact teacher routes are added');
      assert.equal(resolveSiteHref(PROD_ORIGIN + path).reason, 'unserved-prod');
    }
    const external = 'https://example.com/teachers/app' + suffix;
    assert.equal(resolveSiteHrefString(external), external);
  });

  it('preserves Wix Media PDF and github.io viewer URLs', () => {
    const pdf =
      'https://static.wixstatic.com/ugd/abcd1234.pdf';
    assert.equal(resolveSiteHrefString(pdf), pdf);
    assert.equal(resolveSiteHref(pdf).reason, 'media');

    const viewer =
      'https://noamd-collab.github.io/noamdoronmath-worksheets/?grade=7&topic=31';
    assert.equal(resolveSiteHrefString(viewer), viewer);
    assert.ok(isMediaOrAssetUrl(new URL(viewer)));
  });

  it('keeps genuinely external links unchanged', () => {
    assert.equal(
      resolveSiteHrefString('https://wa.me/972501234567'),
      'https://wa.me/972501234567'
    );
    assert.equal(resolveSiteHrefString('mailto:noamd@noamdoronmath.co.il'), 'mailto:noamd@noamdoronmath.co.il');
  });

  it('does not invent local routes for unserved production paths', () => {
    // Patterns-and-graphs is a migrated topic — use a fake unserved slug
    const fake = `${PROD_ORIGIN}/totally-unserved-topic-xyz`;
    const r = resolveSiteHref(fake);
    assert.equal(r.local, false);
    assert.equal(r.reason, 'unserved-prod');
    assert.equal(r.href, fake);
  });

  it('covers every migrated TOPIC_PAGE_SLUG as locally served', () => {
    for (const slug of TOPIC_PAGE_SLUGS) {
      assert.equal(isLocallyServedPath(`/${slug}`), true, slug);
      assert.equal(
        resolveSiteHrefString(`${PROD_ORIGIN}/${slug}`),
        `/${slug}`,
        slug
      );
    }
  });

  it('localizeSiteHref and localizeBlogHref share the same resolver', () => {
    const samples = [
      `${PROD_ORIGIN}/grade-7`,
      `${PROD_ORIGIN}/post/assessment-1-grade-7`,
      `${PROD_ORIGIN}/patterns-and-graphs-grade-7`,
      'https://static.wixstatic.com/media/x.pdf',
      'https://www.geekhero.co.il/x',
    ];
    for (const href of samples) {
      assert.equal(localizeSiteHref(href), resolveSiteHrefString(href), href);
      assert.equal(localizeBlogHref(href), resolveSiteHrefString(href), href);
    }
  });
});
