/**
 * Public lesson: permanent path, indexable on production, linked from Eliyahu's games corner.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
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

const lesson = readFileSync(fromTest('../src/public-lesson/lesson.html'), 'utf8');
const root = fromTest('..');

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
    assert.match(html, /<script src="\/noam-site-companion\.js" defer><\/script>/);
    assert.equal(html.includes('__OG_'), false);
    assert.equal(html.includes('noindex'), false);
  });

  it('stays noindex on a preview host, like the other public pages', () => {
    const html = renderPublicLesson(lesson, '127.0.0.1');
    assert.match(html, /content="noindex,nofollow"/);
    assert.ok(html.includes(`rel="canonical" href="${SITE_CANONICAL_ORIGIN}${PUBLIC_LESSON_PATH}"`));
  });

  it('is in the sitemap with the other extras page', () => {
    const keys = ['./math-tools.astro', './aboutus.astro'];
    const paths = listMainPagePaths(keys);
    assert.ok(paths.includes('/math-tools'));
    assert.ok(paths.includes(PUBLIC_LESSON_PATH));
    const xml = renderPagesSitemapXml(keys);
    assert.ok(xml.includes(`${SITE_CANONICAL_ORIGIN}${PUBLIC_LESSON_PATH}`));
    assert.ok(xml.includes(`${SITE_CANONICAL_ORIGIN}/math-tools`));
  });

  it('is offered from Eliyahu\'s games corner and not from a home promo card', () => {
    const home = readFileSync(fromTest('../src/pages/index.astro'), 'utf8');
    const header = readFileSync(fromTest('../src/components/SiteHeader.astro'), 'utf8');
    const corner = readFileSync(fromTest('../src/lib/eliyahuGames.ts'), 'utf8');
    const gamesPage = readFileSync(fromTest('../src/pages/games/index.astro'), 'utf8');
    assert.equal(existsSync(fromTest('../src/components/GamePromoCard.astro')), false);
    assert.equal(home.includes('GamePromoCard'), false);
    assert.equal(home.includes('data-home-game-promo'), false);
    assert.equal(home.includes('נסו את המשחק החדש!'), false);
    assert.equal(header.includes('PUBLIC_LESSON_PATH'), false);
    assert.equal(header.includes('/games/kefel-mekutsar-2'), false);
    assert.ok(header.includes('GAMES_INDEX_PATH'));
    assert.ok(header.includes('aria-label="משחקים"'));
    assert.equal(header.includes('aria-haspopup="true" aria-label="משחקים"'), false);
    assert.ok(corner.includes("slug: 'kefel-mekutsar-2'"));
    assert.ok(corner.includes("badge: '(beta)'"));
    assert.ok(gamesPage.includes('game.badge'));
    assert.ok(gamesPage.includes('gamePath(game)'));
    assert.equal(existsSync(fromTest('../src/pages/l')), false);
    assert.equal(existsSync(fromTest('../src/lib/secretLesson.ts')), false);
  });

  it('keeps game formulas on one LTR line and a trailing question mark inside the math run', () => {
    assert.match(lesson, /\.math\{direction:ltr;unicode-bidi:isolate;white-space:nowrap\}/);
    assert.match(lesson, /id="heroEq" class="math-line"/);
    assert.match(lesson, /title\.append\(mathNode\(S\.tM \+ \(S\.tB \|\| ''\)\)\)/);
    assert.match(lesson, /m\('\(2ab\)'\)/);
    assert.equal(lesson.includes("(' + m('2ab') + ')"), false);
    assert.match(lesson, /#numEq2\{display:flex;flex-wrap:nowrap/);
  });

  it('scales the square diagram with its frame instead of a fixed pixel cap', () => {
    assert.match(lesson, /#squareFrame\{width:100%;max-width:100%;min-width:0;aspect-ratio:402\/322/);
    assert.match(lesson, /#square\{position:absolute;inset:0;width:100%;height:100%/);
    assert.match(lesson, /viewBox="0 0 402 322"/);
    assert.equal(lesson.includes('#square{width:min(240px,30vh)}'), false);
    assert.equal(lesson.includes('#square{width:min(300px,34vw)}'), false);
    assert.match(lesson, /legible\(userPx\)/);
  });
});
