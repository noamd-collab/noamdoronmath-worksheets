/**
 * Public lesson: same file as the unlisted link, permanent path, indexable on production.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { withSocialUrls } from '../src/lib/secretLessonPage';
import { SECRET_LESSON_TOKEN } from '../src/lib/secretLesson';
import {
  PUBLIC_LESSON_DESCRIPTION,
  PUBLIC_LESSON_PATH,
  PUBLIC_LESSON_TITLE,
  renderPublicLesson,
} from '../src/lib/publicLesson';
import { listMainPagePaths, renderPagesSitemapXml } from '../src/lib/siteSitemaps';
import { SITE_CANONICAL_ORIGIN } from '../src/lib/siteSeo';

function fromTest(relativePath: string): string {
  return fileURLToPath(new URL(relativePath, import.meta.url));
}

const lesson = readFileSync(fromTest('../src/secret-lesson/lesson.html'), 'utf8');

describe('public lesson menu page', () => {
  it('is indexable on the production host and keeps the lesson body', () => {
    const html = renderPublicLesson(lesson, 'www.noamdoronmath.co.il');
    assert.match(html, /content="index,follow"/);
    assert.ok(html.includes(`<title>${PUBLIC_LESSON_TITLE}</title>`));
    assert.ok(html.includes(`name="description" content="${PUBLIC_LESSON_DESCRIPTION}"`));
    assert.ok(html.includes(`rel="canonical" href="${SITE_CANONICAL_ORIGIN}${PUBLIC_LESSON_PATH}"`));
    assert.ok(html.includes(`property="og:url" content="${SITE_CANONICAL_ORIGIN}${PUBLIC_LESSON_PATH}"`));
    assert.ok(html.includes(`property="og:image" content="${SITE_CANONICAL_ORIGIN}${PUBLIC_LESSON_PATH}/preview.png"`));
    assert.match(html, /property="og:locale" content="he_IL"/);
    assert.match(html, /id="bubbleName">אליהו</);
    assert.match(html, /בוא נחקור ←/);
    assert.equal(html.includes(SECRET_LESSON_TOKEN), false);
    assert.equal(html.includes('__OG_'), false);
    assert.equal(html.includes('noindex'), false);
  });

  it('stays noindex on a preview host, like the other public pages', () => {
    const html = renderPublicLesson(lesson, '127.0.0.1');
    assert.match(html, /content="noindex,nofollow"/);
    assert.ok(html.includes(`rel="canonical" href="${SITE_CANONICAL_ORIGIN}${PUBLIC_LESSON_PATH}"`));
  });

  it('does not change the unlisted lesson gate', () => {
    const secret = withSocialUrls(lesson, 'https://www.noamdoronmath.co.il');
    assert.match(secret, /content="noindex, nofollow"/);
    assert.match(secret, /property="og:url" content="https:\/\/www\.noamdoronmath\.co\.il\/l\/q8w3n6m2k9p4x7r1"/);
    assert.match(secret, /<title>למה \(a \+ b\)² ≠ a² \+ b²\?<\/title>/);
    assert.equal(secret.includes(PUBLIC_LESSON_PATH), false);
  });

  it('is in the sitemap with the other extras page, and the token path is not', () => {
    const keys = ['./math-tools.astro', './aboutus.astro'];
    const paths = listMainPagePaths(keys);
    assert.ok(paths.includes('/math-tools'));
    assert.ok(paths.includes(PUBLIC_LESSON_PATH));
    const xml = renderPagesSitemapXml(keys);
    assert.ok(xml.includes(`${SITE_CANONICAL_ORIGIN}${PUBLIC_LESSON_PATH}`));
    assert.ok(xml.includes(`${SITE_CANONICAL_ORIGIN}/math-tools`));
    assert.equal(xml.includes('/l/'), false);
    assert.equal(xml.includes(SECRET_LESSON_TOKEN), false);
  });
});
