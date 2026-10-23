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
import { prepareIndex, search } from '../src/lib/siteSearch/engine';
import type { SearchIndex } from '../src/lib/siteSearch/types';
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

  it('is findable in search under the grade-8 Pythagoras catalog card', () => {
    const index = JSON.parse(readFileSync(fromTest('../src/data/search-index.v1.json'), 'utf8')) as SearchIndex;
    const doc = index.docs.find((item) => item.href === PYTHAGORAS_GAME_PATH);
    assert.ok(doc);
    assert.equal(doc.kind, 'page');
    assert.equal(doc.grade, PYTHAGORAS_GAME_CATALOG_GRADE);
    assert.equal(doc.topicKey, `topic:${PYTHAGORAS_GAME_CATALOG_GRADE}:${PYTHAGORAS_GAME_CATALOG_TOPIC_ID}`);
    assert.equal(doc.title, PYTHAGORAS_GAME_H1);
    const result = search(prepareIndex(index), 'פיתגורס', { grade: 8 });
    assert.equal(result.results[0]?.key, 'topic:8:11');
    const card = result.results.find((item) => item.key === 'topic:8:11');
    assert.ok(card?.explainers.some((item) => item.href === PYTHAGORAS_GAME_PATH && item.title === PYTHAGORAS_GAME_H1));
  });
});
