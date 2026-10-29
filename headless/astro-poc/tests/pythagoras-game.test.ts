/**
 * Eliyahu Pythagoras game: wrapped page, unchanged file, catalog/search/guide/sitemap.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { resolveActiveNav } from '../src/lib/activeNav';
import {
  PYTHAGORAS_GAME_CATALOG_GRADE,
  PYTHAGORAS_GAME_CATALOG_TOPIC_ID,
  PYTHAGORAS_GAME_DESCRIPTION,
  PYTHAGORAS_GAME_H1,
  PYTHAGORAS_GAME_PATH,
  PYTHAGORAS_GAME_PLAY_PATH,
  PYTHAGORAS_GAME_TITLE,
} from '../src/lib/pythagorasGame';
import { isLocallyServedPath, resolveSiteHrefString, PROD_ORIGIN } from '../src/lib/resolveSiteHref';
import { listMainPagePaths } from '../src/lib/siteSitemaps';
import { loadTopicPage } from '../src/lib/topicPages';

function fromTest(relativePath: string): string {
  return fileURLToPath(new URL(relativePath, import.meta.url));
}

const gameHtml = readFileSync(fromTest('../src/games/eliyahu-pythagoras.html'), 'utf8');
const page = readFileSync(fromTest('../src/pages/games/eliyahu-pythagoras/index.astro'), 'utf8');
const play = readFileSync(fromTest('../src/pages/games/eliyahu-pythagoras/play.ts'), 'utf8');
const header = readFileSync(fromTest('../src/components/SiteHeader.astro'), 'utf8');

describe('eliyahu pythagoras game page', () => {
  it('keeps the game file self-contained and free of slash fractions', () => {
    assert.match(gameHtml, new RegExp(`<title>${PYTHAGORAS_GAME_TITLE}</title>`));
    assert.ok(gameHtml.includes(PYTHAGORAS_GAME_DESCRIPTION));
    assert.ok(gameHtml.includes('שלב 1 מתוך 9'));
    assert.equal(gameHtml.includes('fetch('), false);
    assert.equal(gameHtml.includes('XMLHttpRequest'), false);
    const withoutFonts = gameHtml.replace(/<style id="offline-fonts">[\s\S]*?<\/style>/, '');
    const ratios = [...withoutFonts.matchAll(/aspect-ratio:\s*(\d+\/\d+)/g)].map((match) => match[1]);
    const slashNumbers = withoutFonts.match(/\d+\s*\/\s*\d+/g) || [];
    assert.deepEqual(slashNumbers, ratios);
    assert.ok(ratios.length > 0);
  });

  it('keeps the lesson animations running inside the embed', () => {
    assert.equal(page.includes('sandbox'), false);
    assert.equal(page.includes('loading="lazy"'), false);
    assert.equal(play.toLowerCase().includes('content-security-policy'), false);
    assert.match(gameHtml, /get rm\(\) \{ return false; \}/);
    assert.equal(gameHtml.includes('animation-duration:.01ms'), false);
    assert.equal(gameHtml.includes('.rv *{animation:none'), false);
    assert.match(page, /src=\{PYTHAGORAS_GAME_PLAY_PATH\}/);
  });

  it('embeds the file without rewriting it', () => {
    assert.match(play, /eliyahu-pythagoras\.html\?raw/);
    assert.equal(play.includes('.replace('), false);
    assert.match(play, /x-robots-tag': 'noindex'/);
    assert.match(page, new RegExp(`src=\\{PYTHAGORAS_GAME_PLAY_PATH\\}`));
    assert.match(page, /<BaseLayout/);
    assert.match(page, /skipHref="#eliyahu-game"/);
    assert.match(page, /data-eliyahu-dock/);
    assert.match(page, /href="\/pythagorean-theorem-grade-8"/);
    assert.match(page, /href="\/pythagorean-theorem-grade-9"/);
  });

  it('is a local games route in the sitemap, nav, and link resolver', () => {
    assert.equal(resolveActiveNav(PYTHAGORAS_GAME_PATH), 'tools');
    assert.equal(isLocallyServedPath(PYTHAGORAS_GAME_PATH), true);
    assert.equal(isLocallyServedPath(PYTHAGORAS_GAME_PLAY_PATH), true);
    assert.equal(resolveSiteHrefString(`${PROD_ORIGIN}${PYTHAGORAS_GAME_PATH}`), PYTHAGORAS_GAME_PATH);
    const paths = listMainPagePaths(['./math-tools.astro', './aboutus.astro']);
    assert.ok(paths.includes(PYTHAGORAS_GAME_PATH));
    assert.equal(paths.includes(PYTHAGORAS_GAME_PLAY_PATH), false);
    assert.ok(header.includes('PYTHAGORAS_GAME_PATH'));
    assert.ok(header.includes('משחק משפט פיתגורס'));
  });

  it('is linked from the grade 8 and grade 9 theorem pages', () => {
    for (const slug of ['pythagorean-theorem-grade-8', 'pythagorean-theorem-grade-9'] as const) {
      const topic = loadTopicPage(slug);
      const rel = topic.relatedTopics.find((item) => item.path === PYTHAGORAS_GAME_PATH);
      assert.ok(rel, slug);
      assert.equal(rel.label, PYTHAGORAS_GAME_H1);
      assert.equal(rel.productionHref, `${PROD_ORIGIN}${PYTHAGORAS_GAME_PATH}`);
    }
  });

  it('stacks a beta promo under the kefel card on the home page', () => {
    const card = readFileSync(fromTest('../src/components/GamePromoCard.astro'), 'utf8');
    const home = readFileSync(fromTest('../src/pages/index.astro'), 'utf8');
    const kefelAt = card.indexOf('data-home-game-promo');
    const betaAt = card.indexOf('id="pythagoras-promo"');
    assert.ok(home.includes('<GamePromoCard />'));
    assert.ok(kefelAt > 0 && betaAt > kefelAt);
    assert.ok(card.includes('חדש!'));
    assert.ok(card.includes('נסו את המשחק החדש!'));
    assert.ok(card.includes('PUBLIC_LESSON_PATH'));
    assert.match(card, /data-home-pythagoras-promo[\s\S]*בטא/);
    assert.ok(card.includes('משחק פיתגורס כבר כאן!'));
    assert.ok(card.includes('גרסת בטא'));
    assert.ok(card.includes('href={PYTHAGORAS_GAME_PATH}'));
    assert.ok(card.includes('data-pop="160"'));
    assert.equal(card.includes('dialog'), false);
    const beta = card.slice(betaAt);
    assert.equal(/\d+\s*\/\s*\d+/.test(beta), false);
  });

  it('adds a new-formulas block under the Pythagoras promo', () => {
    const card = readFileSync(fromTest('../src/components/GamePromoCard.astro'), 'utf8');
    const kefelAt = card.indexOf('data-home-game-promo');
    const betaAt = card.indexOf('id="pythagoras-promo"');
    const formulasAt = card.indexOf('id="new-algebra-formulas"');
    assert.ok(kefelAt > 0 && betaAt > kefelAt && formulasAt > betaAt);
    const kefel = card.slice(kefelAt, betaAt);
    assert.ok(kefel.includes('נסו את המשחק החדש!'));
    assert.equal(kefel.includes('/binomial-square-grade-9'), false);
    assert.equal(kefel.includes('id="new-algebra-formulas"'), false);
    const beta = card.slice(betaAt, formulasAt);
    assert.ok(beta.includes('משחק פיתגורס כבר כאן!'));
    assert.equal(beta.includes('/difference-of-squares-grade-9'), false);
    assert.ok(card.includes('href="/binomial-square-grade-9"'));
    assert.ok(card.includes('href="/difference-of-squares-grade-9"'));
    assert.ok(card.includes('דו־איבר בריבוע'));
    assert.ok(card.includes('הפרש ריבועים'));
    assert.ok(card.includes('(a+b)²'));
    assert.ok(card.includes('a²−b²'));
    assert.ok(card.includes('exact-new-pulse'));
    assert.ok(card.includes('prefers-reduced-motion:reduce'));
    assert.ok(card.includes('a² = 36'));
    assert.ok(card.includes('ba = 24'));
    assert.ok(card.includes('ab = 24'));
    assert.ok(card.includes('b² = 16'));
    assert.ok(card.includes('a+b=10'));
    assert.ok(card.includes('a·(a−b) = 12'));
    assert.ok(card.includes('b·(a−b) = 8'));
    assert.ok(card.includes('exact-ring'));
    assert.ok(card.includes('c²'));
    assert.ok(beta.includes('168,96 264,168 336,72 240,0'));
    assert.ok(beta.includes('exact-pyth-a'));
    assert.ok(beta.includes('exact-pyth-b'));
    assert.ok(beta.includes('exact-pyth-c'));
    const motion = card.slice(card.indexOf('prefers-reduced-motion:reduce'));
    assert.equal(motion.includes('animation:none'), false);
    assert.match(motion, /animation-duration:3\.1s/);
    const block = card.slice(formulasAt, card.indexOf('<style>'));
    assert.equal(/\d+\s*\/\s*\d+/.test(block), false);
  });

  it('draws a true square on the hypotenuse of the 3-4-5 triangle', () => {
    const card = readFileSync(fromTest('../src/components/GamePromoCard.astro'), 'utf8');
    const points = card.match(/<polygon class="exact-pyth-glow" points="([^"]+)"/)![1]
      .split(' ').map(point => point.split(',').map(Number));
    const edges = points.map((p, i) => [points[(i + 1) % 4][0] - p[0], points[(i + 1) % 4][1] - p[1]]);
    assert.equal(points.length, 4);
    for (let i = 0; i < 4; i++) {
      const edge = edges[i], next = edges[(i + 1) % 4];
      assert.equal(edge[0] ** 2 + edge[1] ** 2, 120 ** 2);
      assert.equal(edge[0] * next[0] + edge[1] * next[1], 0);
    }
    assert.equal(72 ** 2 + 96 ** 2, 120 ** 2);
  });
});
