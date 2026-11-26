/**
 * Eliyahu Pythagoras game: wrapped page, unchanged file, catalog/search/guide/sitemap.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
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

  it('drops the stray bottom-left diagonal and its c from the after diagram', () => {
    const figure = gameHtml.slice(gameHtml.indexOf('proofFigure(p)'), gameHtml.indexOf('proofStyle(p)'));
    assert.match(figure, /if \(!p\) \{/);
    assert.match(figure, /id="clipGhost"/);
    assert.match(figure, /clip-rule="evenodd"/);
    assert.equal(figure.includes('b_clipGhost'), false);
    assert.match(figure, /ghostClip = ' clip-path="url\(#clipGhost\)"'/);
    assert.equal((figure.match(/<polygon' \+ ghostClip/g) || []).length, 2);
    assert.match(figure, /id="hypCoverBL"/);
    assert.equal(figure.includes('b_hypCoverBL'), false);
    assert.equal(figure.includes('clipHypBL'), false);
    const render = gameHtml.slice(gameHtml.indexOf('renderProof()'), gameHtml.indexOf('proofGo()'));
    assert.match(render, /i === 3 && n < 5/);
    assert.match(render, /on\('hypCoverBL', n >= 5\)/);
    const beat = gameHtml.slice(gameHtml.indexOf('async proofBeat(n, quiet)'), gameHtml.indexOf('chkGeom(a, b)'));
    assert.match(beat, /on\('hypCoverBL', true\)/);
    assert.match(beat, /on\('hcLab3', false\)/);
    assert.match(beat, /'hypCoverBL'/);
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
    assert.equal(resolveActiveNav(PYTHAGORAS_GAME_PATH), 'games');
    assert.equal(isLocallyServedPath(PYTHAGORAS_GAME_PATH), true);
    assert.equal(isLocallyServedPath(PYTHAGORAS_GAME_PLAY_PATH), true);
    assert.equal(resolveSiteHrefString(`${PROD_ORIGIN}${PYTHAGORAS_GAME_PATH}`), PYTHAGORAS_GAME_PATH);
    const paths = listMainPagePaths(['./math-tools.astro', './aboutus.astro']);
    assert.ok(paths.includes(PYTHAGORAS_GAME_PATH));
    assert.equal(paths.includes(PYTHAGORAS_GAME_PLAY_PATH), false);
    assert.equal(header.includes('PYTHAGORAS_GAME_PATH'), false);
    assert.equal(header.includes('/games/eliyahu-pythagoras'), false);
    assert.ok(header.includes('GAMES_INDEX_PATH'));
    assert.ok(header.includes('aria-label="משחקים"'));
    const corner = readFileSync(fromTest('../src/lib/eliyahuGames.ts'), 'utf8');
    assert.ok(corner.includes("slug: 'eliyahu-pythagoras'"));
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

  it('does not show the kefel or Pythagoras promo cards on the home page', () => {
    const home = readFileSync(fromTest('../src/pages/index.astro'), 'utf8');
    const gamesPage = readFileSync(fromTest('../src/pages/games/index.astro'), 'utf8');
    const corner = readFileSync(fromTest('../src/lib/eliyahuGames.ts'), 'utf8');
    assert.equal(existsSync(fromTest('../src/components/GamePromoCard.astro')), false);
    assert.equal(home.includes('GamePromoCard'), false);
    assert.equal(home.includes('data-home-game-promo'), false);
    assert.equal(home.includes('data-home-pythagoras-promo'), false);
    assert.equal(home.includes('pythagoras-promo'), false);
    assert.equal(home.includes('נסו את המשחק החדש!'), false);
    assert.equal(home.includes('משחק פיתגורס כבר כאן!'), false);
    assert.equal(home.includes('exact-game-promo'), false);
    assert.ok(gamesPage.includes('ALL_GAMES'));
    assert.ok(gamesPage.includes('gamePath(game)'));
    assert.ok(corner.includes("slug: 'eliyahu-pythagoras'"));
    assert.ok(existsSync(fromTest('../src/pages/games/eliyahu-pythagoras/index.astro')));
  });

  it('does not show the grade-9 formulas block on the home page', () => {
    const home = readFileSync(fromTest('../src/pages/index.astro'), 'utf8');
    assert.equal(home.includes('id="new-algebra-formulas"'), false);
    assert.equal(home.includes('נוסחאות לכיתה ט׳'), false);
    assert.equal(home.includes('href="/binomial-square-grade-9"'), false);
    assert.equal(home.includes('href="/difference-of-squares-grade-9"'), false);
    assert.equal(home.includes('exact-new-pulse'), false);
    assert.equal(existsSync(fromTest('../src/pages/binomial-square-grade-9.astro')), true);
    assert.equal(existsSync(fromTest('../src/pages/difference-of-squares-grade-9.astro')), true);
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

  it('keeps non-integer hypotenuse slivers visible and explains the gN×gN whole-square grid in step 7', () => {
    assert.ok(gameHtml.includes('const fVis = cInt ? 0 : Math.max(c - gN, .42);'));
    assert.ok(gameHtml.includes("שלמות של <bdi class=\"math\" dir=\"ltr\">' + gN + '×' + gN"));
    assert.ok(gameHtml.includes("ברשת נכנסו ' + m(N.gN + '×' + N.gN + ' = ' + slots) + ' משבצות שלמות"));
  });
});
