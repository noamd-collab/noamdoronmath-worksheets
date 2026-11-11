/**
 * The games corner: registry, engine, specs, routes, nav and sitemap.
 *
 * The composer in src/lib/eliyahuGameDocument.ts uses `import.meta.glob`, which
 * only exists under Vite, so the files are read from disk here instead.
 */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { resolveActiveNav } from '../src/lib/activeNav';
import {
  ALL_GAMES,
  ENGINE_GAMES,
  ENGINE_GAME_SLUGS,
  GAMES_INDEX_DESCRIPTION,
  GAMES_INDEX_H1,
  GAMES_INDEX_PATH,
  GAMES_INDEX_TITLE,
  LEGACY_GAMES,
  findEngineGame,
  gamePath,
  listGamePaths,
} from '../src/lib/eliyahuGames';
import { PUBLIC_LESSON_PATH } from '../src/lib/publicLesson';
import { PUBLIC_LESSON_DESCRIPTION, PUBLIC_LESSON_TITLE } from '../src/lib/publicLesson';
import {
  PYTHAGORAS_GAME_DESCRIPTION,
  PYTHAGORAS_GAME_H1,
  PYTHAGORAS_GAME_PATH,
  PYTHAGORAS_GAME_TITLE,
} from '../src/lib/pythagorasGame';
import { isLocallyServedPath, resolveSiteHrefString, PROD_ORIGIN } from '../src/lib/resolveSiteHref';
import { listMainPagePaths } from '../src/lib/siteSitemaps';
import { TOPIC_PAGE_SLUGS } from '../src/lib/topicPages';

function fromTest(relativePath: string): string {
  return fileURLToPath(new URL(relativePath, import.meta.url));
}

function readFromTest(relativePath: string): string {
  return readFileSync(fromTest(relativePath), 'utf8');
}

const specDir = fromTest('../src/games/specs');
const specFiles = readdirSync(specDir).filter((name) => name.endsWith('.js'));
const specSources = new Map<string, string>(
  specFiles.map((name) => [name.replace(/\.js$/, ''), readFileSync(`${specDir}/${name}`, 'utf8')])
);

const engineJs = readFromTest('../src/games/engine/engine.js');
const engineCss = readFromTest('../src/games/engine/engine.css');
const fontsCss = readFromTest('../src/games/engine/fonts.css');
const fontDir = fromTest('../src/games/engine/fonts');
const mascotHtml = readFromTest('../src/games/engine/mascot.html');
const composer = readFromTest('../src/lib/eliyahuGameDocument.ts');
const playRoute = readFromTest('../src/pages/games/[slug]/play.ts');
const wrapperPage = readFromTest('../src/pages/games/[slug]/index.astro');
const cornerPage = readFromTest('../src/pages/games/index.astro');
const header = readFromTest('../src/components/SiteHeader.astro');

const TOPIC_PATHS = new Set(TOPIC_PAGE_SLUGS.map((slug) => `/${slug}`));

describe('games corner registry', () => {
  it('offers at least ten engine games plus the two hand-written ones', () => {
    assert.ok(ENGINE_GAMES.length >= 10, `only ${ENGINE_GAMES.length} engine games`);
    assert.equal(LEGACY_GAMES.length, 2);
    assert.equal(ALL_GAMES.length, ENGINE_GAMES.length + LEGACY_GAMES.length);
    const legacyPaths = LEGACY_GAMES.map((game) => gamePath(game)).sort();
    assert.deepEqual(legacyPaths, [PYTHAGORAS_GAME_PATH, PUBLIC_LESSON_PATH].sort());
  });

  it('keeps every entry unique, described and themed', () => {
    const slugs = new Set<string>();
    const titles = new Set<string>();
    for (const game of ALL_GAMES) {
      assert.match(game.slug, /^[a-z0-9-]+$/, game.slug);
      assert.equal(slugs.has(game.slug), false, `duplicate slug ${game.slug}`);
      slugs.add(game.slug);
      assert.equal(titles.has(game.title), false, `duplicate title ${game.title}`);
      titles.add(game.title);
      assert.ok(game.h1.length > 4, game.slug);
      assert.ok(game.description.length <= 180, `${game.slug} description too long`);
      assert.ok(game.short.length > 10, game.slug);
      assert.ok(game.grade.includes('כיתה') || game.grade.includes('כיתות'), game.slug);
      assert.ok(game.gradeOrder >= 1 && game.gradeOrder <= 9, game.slug);
      assert.ok(game.emoji.length > 0, game.slug);
      for (const key of ['ink', 'main', 'mainDark', 'mainSoft', 'mainLine', 'bgA', 'bgB', 'bgC'] as const) {
        assert.match(game.theme[key], /^#[0-9a-f]{6}$/, `${game.slug} ${key}`);
      }
    }
  });

  it('links only to worksheet pages that exist', () => {
    for (const game of ALL_GAMES) {
      assert.ok(game.links.length >= 1, `${game.slug} has no topic link`);
      for (const link of game.links) {
        assert.ok(TOPIC_PATHS.has(link.href), `${game.slug} -> ${link.href}`);
        assert.ok(link.label.length > 4, `${game.slug} -> ${link.href}`);
      }
    }
  });

  it('gives every engine game a title built on its own h1', () => {
    for (const game of ENGINE_GAMES) {
      assert.ok(game.title.includes(game.h1), `${game.slug} title drops the h1`);
      assert.match(game.title, /\| נועם דורון$/, game.slug);
      assert.ok(game.description.length >= 55, `${game.slug} description too short`);
      assert.ok(game.h1.includes('אליהו'), game.slug);
    }
  });

  it('mirrors the metadata the two older games already serve', () => {
    const kefel = ALL_GAMES.find((game) => game.slug === 'kefel-mekutsar-2');
    assert.ok(kefel);
    assert.equal(kefel.title, PUBLIC_LESSON_TITLE);
    assert.equal(kefel.description, PUBLIC_LESSON_DESCRIPTION);
    const pyth = ALL_GAMES.find((game) => game.slug === 'eliyahu-pythagoras');
    assert.ok(pyth);
    assert.equal(pyth.title, PYTHAGORAS_GAME_TITLE);
    assert.equal(pyth.description, PYTHAGORAS_GAME_DESCRIPTION);
    assert.equal(pyth.h1, PYTHAGORAS_GAME_H1);
  });

  it('sorts the corner by grade and resolves paths', () => {
    const order = ALL_GAMES.map((game) => game.gradeOrder);
    assert.deepEqual(order, [...order].sort((a, b) => a - b));
    assert.equal(gamePath(ENGINE_GAMES[0]), `/games/${ENGINE_GAMES[0].slug}`);
    assert.equal(findEngineGame(ENGINE_GAMES[0].slug)?.slug, ENGINE_GAMES[0].slug);
    assert.equal(findEngineGame('eliyahu-pythagoras'), undefined);
    assert.equal(findEngineGame('no-such-game'), undefined);
    assert.deepEqual(ENGINE_GAME_SLUGS, ENGINE_GAMES.map((game) => game.slug));
    for (const game of ENGINE_GAMES) assert.equal(game.playPath, `/games/${game.slug}/play`);
  });
});

describe('game specs', () => {
  it('ships one spec per engine game and nothing stale', () => {
    assert.deepEqual([...specSources.keys()].sort(), [...ENGINE_GAME_SLUGS].sort());
  });

  it('stays self-contained: no network, no module imports', () => {
    for (const [slug, source] of specSources) {
      assert.equal(source.includes('fetch('), false, `${slug} fetches`);
      assert.equal(source.includes('XMLHttpRequest'), false, `${slug} uses XHR`);
      assert.equal(/^\s*import\s/m.test(source), false, `${slug} imports a module`);
      assert.equal(/\brequire\(/.test(source), false, `${slug} requires a module`);
      assert.match(source, /window\.NoamGame\.boot\(/, `${slug} never boots`);
      assert.match(source, /'use strict'/, slug);
    }
  });

  it('never spells a fraction with a slash', () => {
    for (const [slug, source] of specSources) {
      const quoted = source.match(/'[^'\n]*'|"[^"\n]*"/g) || [];
      for (const literal of quoted) {
        if (!/[\u0590-\u05FF]/.test(literal)) continue;
        assert.equal(/\d\s*\/\s*\d/.test(literal), false, `${slug}: ${literal}`);
      }
    }
  });

  it('runs the same nine-step shape with four quizzes and four skills', () => {
    for (const [slug, source] of specSources) {
      assert.match(source, /steps\s*:/, slug);
      const skillsAt = source.indexOf('skills: [');
      assert.ok(skillsAt > 0, `${slug} declares no skills`);
      const block = source.slice(skillsAt, source.indexOf(']', skillsAt));
      const rows = block.match(/\{\s*step:\s*\d+/g) || [];
      assert.equal(rows.length, 4, `${slug} has ${rows.length} skills`);
      for (const label of block.match(/name:\s*'([^']+)'/g) || []) {
        assert.match(label, /[\u0590-\u05FF]/, `${slug}: ${label} is not Hebrew`);
      }
    }
  });
});

describe('game engine', () => {
  it('keeps the runtime offline and isolates mathematics for RTL', () => {
    assert.equal(engineJs.includes('fetch('), false);
    assert.equal(engineJs.includes('XMLHttpRequest'), false);
    // LRI / PDI, written as escapes in the source so the file stays readable.
    assert.ok(engineJs.includes('\\u2066') || engineJs.includes('\u2066'));
    assert.ok(engineJs.includes('\\u2069') || engineJs.includes('\u2069'));
    assert.match(engineJs, /window\.NoamGame\s*=/);
    assert.match(engineJs, /boot\s*:/);
  });

  it('self-hosts every font face as its own woff2 file', () => {
    assert.equal(fontsCss.includes('data:'), false);
    assert.equal(fontsCss.includes('fonts.googleapis.com'), false);
    assert.equal(fontsCss.includes('fonts.gstatic.com'), false);
    const urls = [...fontsCss.matchAll(/url\('([^']+)'\)/g)].map((match) => match[1]);
    assert.equal(urls.length, (fontsCss.match(/@font-face/g) || []).length);
    const engineFonts = new Set<string>();
    for (const url of urls) {
      // Shared faces are the site's own hashed /fonts/ files; renaming one there
      // must update fonts.css too.
      const file = url.startsWith('/fonts/')
        ? fromTest(`../public${url}`)
        : url.startsWith('./fonts/')
          ? `${fontDir}/${url.slice('./fonts/'.length)}`
          : assert.fail(`${url} is neither a site font nor an engine font`);
      if (url.startsWith('./fonts/')) engineFonts.add(url.slice('./fonts/'.length));
      assert.equal(readFileSync(file).subarray(0, 4).toString('latin1'), 'wOF2', url);
    }
    assert.deepEqual([...engineFonts].sort(), readdirSync(fontDir).sort());
    assert.match(mascotHtml, /<svg/);
  });

  it('themes the shell through custom properties', () => {
    for (const token of ['--main', '--main-dark', '--main-soft', '--main-line', '--ink']) {
      assert.ok(engineCss.includes(`var(${token}`), `${token} unused`);
    }
  });
});

describe('game routes', () => {
  it('keeps the engine, specs and fonts out of the server bundle', () => {
    // Only the small font-face rules and the mascot sprite are inlined; the rest
    // is emitted as hashed static files, which the Wix worker payload excludes.
    const rawImports = [...composer.matchAll(/from '([^']+)\?raw'/g)].map((match) => match[1]);
    assert.deepEqual(rawImports.sort(), ['../games/engine/fonts.css', '../games/engine/mascot.html']);
    assert.ok(Buffer.byteLength(fontsCss) < 32_000, 'fonts.css must hold font-face rules, not font data');
    assert.ok(Buffer.byteLength(mascotHtml) < 16_000, 'mascot.html grew past the inline budget');
    assert.match(composer, /engine\/engine\.css\?url/);
    assert.match(composer, /engine\/engine\.js\?url/);
    assert.match(composer, /import\.meta\.glob\('\.\.\/games\/specs\/\*\.js', \{ query: '\?url'/);
    assert.match(composer, /import\.meta\.glob\('\.\.\/games\/engine\/fonts\/\*\.woff2', \{ query: '\?url'/);
    assert.match(composer, /<script src="\$\{engineJsUrl\}"><\/script>\n<script src="\$\{specUrl\}"><\/script>/);
    assert.match(composer, /lang="he"/);
    assert.match(composer, /dir="rtl"/);
  });

  it('serves the raw document noindex and the wrapper page as canonical', () => {
    assert.match(playRoute, /x-robots-tag': 'noindex/);
    assert.match(playRoute, /renderGameDocument/);
    assert.match(playRoute, /getStaticPaths|ENGINE_GAME_SLUGS|findEngineGame/);
    assert.match(wrapperPage, /<BaseLayout/);
    assert.match(wrapperPage, /<iframe/);
    assert.match(wrapperPage, /game\.playPath/);
    assert.equal(wrapperPage.includes('sandbox'), false);
    assert.equal(wrapperPage.includes('loading="lazy"'), false);
    assert.match(wrapperPage, /Astro\.redirect|404/);
  });

  it('lists the corner with its own copy and links every playable game', () => {
    assert.ok(cornerPage.includes('GAMES_INDEX_H1'));
    assert.ok(cornerPage.includes('GAMES_INDEX_TITLE'));
    assert.ok(cornerPage.includes('GAMES_INDEX_DESCRIPTION'));
    assert.ok(cornerPage.includes('hasSpec'));
    assert.ok(cornerPage.includes('gamePath(game)'));
    assert.ok(GAMES_INDEX_TITLE.includes(GAMES_INDEX_H1));
    assert.ok(GAMES_INDEX_DESCRIPTION.length >= 60);
    assert.equal(/\d\s*\/\s*\d/.test(GAMES_INDEX_DESCRIPTION), false);
  });
});

describe('games corner in nav, sitemap and link resolver', () => {
  it('marks the whole corner as the games nav item', () => {
    assert.equal(resolveActiveNav(GAMES_INDEX_PATH), 'tools');
    assert.equal(resolveActiveNav(`${GAMES_INDEX_PATH}/`), 'tools');
    assert.equal(resolveActiveNav(PYTHAGORAS_GAME_PATH), 'tools');
    assert.equal(resolveActiveNav(PUBLIC_LESSON_PATH), 'tools');
    for (const game of ENGINE_GAMES) assert.equal(resolveActiveNav(gamePath(game)), 'tools');
    assert.ok(header.includes('GAMES_INDEX_PATH'));
    assert.ok(header.includes('פינת המשחקים'));
  });

  it('keeps every game on this origin', () => {
    assert.equal(isLocallyServedPath(GAMES_INDEX_PATH), true);
    assert.equal(resolveSiteHrefString(`${PROD_ORIGIN}${GAMES_INDEX_PATH}`), GAMES_INDEX_PATH);
    for (const game of ENGINE_GAMES) {
      assert.equal(isLocallyServedPath(gamePath(game)), true, game.slug);
      assert.equal(isLocallyServedPath(game.playPath), true, game.slug);
      assert.equal(resolveSiteHrefString(`${PROD_ORIGIN}${gamePath(game)}`), gamePath(game));
    }
  });

  it('puts the corner and the game pages in the sitemap, but not the play documents', () => {
    const paths = listMainPagePaths(['./math-tools.astro', './aboutus.astro']);
    assert.ok(paths.includes(GAMES_INDEX_PATH));
    for (const game of ENGINE_GAMES) {
      assert.ok(paths.includes(gamePath(game)), game.slug);
      assert.equal(paths.includes(game.playPath), false, game.slug);
    }
    assert.deepEqual(listGamePaths()[0], GAMES_INDEX_PATH);
    assert.equal(new Set(paths).size, paths.length);
    assert.deepEqual(paths, [...paths].sort((a, b) => a.localeCompare(b)));
  });
});
