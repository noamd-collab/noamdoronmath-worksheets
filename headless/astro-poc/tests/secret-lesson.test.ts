/**
 * Unlisted lesson gate: 72h window, token, no lesson HTML when closed, not in the sitemap.
 */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  SECRET_LESSON_TOKEN,
  SECRET_LESSON_WINDOW_MS,
  lessonEndsAt,
  lessonPhase,
  resolveNowMs,
  tokenMatches,
} from '../src/lib/secretLesson';
import { renderGatePage, renderNotFoundPage, withSocialUrls } from '../src/lib/secretLessonPage';
import { renderPagesSitemapXml } from '../src/lib/siteSitemaps';

const HOUR = 60 * 60 * 1000;
const START = '2026-10-01T12:00:00.000Z';
const START_MS = Date.parse(START);

function fromTest(relativePath: string): string {
  return fileURLToPath(new URL(relativePath, import.meta.url));
}

describe('secret lesson 72h gate', () => {
  it('stays closed until a start instant is set', () => {
    assert.equal(lessonPhase(Date.now(), ''), 'not-started');
    assert.equal(lessonPhase(Date.now(), '   '), 'not-started');
    assert.equal(lessonPhase(Date.now(), 'not-a-date'), 'not-started');
    assert.equal(lessonEndsAt(''), null);
  });

  it('is live only inside the 72 hour window', () => {
    assert.equal(SECRET_LESSON_WINDOW_MS, 72 * HOUR);
    assert.equal(lessonPhase(START_MS - 1, START), 'not-started');
    assert.equal(lessonPhase(START_MS, START), 'live');
    assert.equal(lessonPhase(START_MS + 72 * HOUR - 1, START), 'live');
    assert.equal(lessonPhase(START_MS + 72 * HOUR, START), 'expired');
    assert.equal(lessonPhase(START_MS + 73 * HOUR, START), 'expired');
    assert.equal(lessonEndsAt(START), START_MS + 72 * HOUR);
  });

  it('matches only the full token', () => {
    assert.equal(tokenMatches(SECRET_LESSON_TOKEN), true);
    assert.equal(tokenMatches(SECRET_LESSON_TOKEN.slice(0, -1)), false);
    assert.equal(tokenMatches(SECRET_LESSON_TOKEN + 'x'), false);
    assert.equal(tokenMatches(''), false);
    assert.equal(tokenMatches(undefined), false);
  });

  it('ignores a forced clock off loopback and when the switch is off', () => {
    const forced = '2026-10-05T00:00:00.000Z';
    assert.equal(
      resolveNowMs({ hostname: 'www.noamdoronmath.co.il', allowClock: true, nowOverride: forced, dateNow: START_MS }),
      START_MS
    );
    assert.equal(
      resolveNowMs({ hostname: '127.0.0.1', allowClock: false, nowOverride: forced, dateNow: START_MS }),
      START_MS
    );
    assert.equal(
      resolveNowMs({ hostname: '127.0.0.1', allowClock: true, nowOverride: forced, dateNow: START_MS }),
      Date.parse(forced)
    );
  });

  it('gate pages contain no lesson content', () => {
    for (const html of [renderGatePage('expired'), renderGatePage('not-started'), renderNotFoundPage()]) {
      assert.match(html, /noindex, nofollow/);
      assert.equal(html.includes('בוא נחקור'), false);
      assert.equal(html.includes('data-lesson'), false);
      assert.equal(html.includes('data-tile'), false);
      assert.equal(html.includes(SECRET_LESSON_TOKEN), false);
      assert.equal(html.includes('אליהו'), false);
    }
    assert.match(renderGatePage('expired'), /הקישור כבר לא פעיל/);
    assert.match(renderGatePage('not-started'), /הקישור עדיין לא פעיל/);
  });

  it('lesson file is the standalone handoff port and social tags are absolute', () => {
    const html = readFileSync(fromTest('../src/secret-lesson/lesson.html'), 'utf8');
    assert.match(html, /lang="he"/);
    assert.match(html, /dir="rtl"/);
    assert.match(html, /id="bubbleName">אליהו</);
    assert.equal(html.includes('>ריבו<'), false);
    assert.match(html, /noindex, nofollow/);
    assert.match(html, /og:locale" content="he_IL"/);
    assert.match(html, /gsap\/3\.12\.2\/gsap\.min\.js/);
    assert.equal(html.includes('support.js'), false);
    assert.match(html, /למה \(a \+ b\)² ≠ a² \+ b²/);
    assert.match(html, /בוא נחקור ←/);
    assert.match(html, /גרור כל חלק למקום שלו למטה/);
    const live = withSocialUrls(html, 'https://www.noamdoronmath.co.il');
    assert.match(live, /property="og:image" content="https:\/\/www\.noamdoronmath\.co\.il\/l\/q8w3n6m2k9p4x7r1\/preview\.png"/);
    assert.match(live, /property="og:url" content="https:\/\/www\.noamdoronmath\.co\.il\/l\/q8w3n6m2k9p4x7r1"/);
    assert.equal(live.includes('__OG_'), false);
  });

  it('is absent from sitemap-pages.xml', () => {
    const dir = fromTest('../src/pages');
    const keys = readdirSync(dir)
      .filter((name) => name.endsWith('.astro'))
      .map((name) => `./${name}`)
      .concat(['./l.astro', './l/[token].astro']);
    const xml = renderPagesSitemapXml(keys);
    assert.equal(xml.includes('/l/'), false);
    assert.equal(xml.includes(SECRET_LESSON_TOKEN), false);
    assert.equal(xml.includes('>/l<'), false);
  });
});
