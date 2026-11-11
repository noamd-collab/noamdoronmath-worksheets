/**
 * Compose one playable game document.
 *
 * The HTML itself is a small shell: the font faces, the theme and the mascot
 * sprite sheet. The fonts, the engine stylesheet and runtime, and the game's
 * own spec are content-hashed static files under /_astro/, so they stay out of
 * the Wix server bundle and are cached once for every game. Everything is
 * same-origin; nothing comes from a third-party host.
 */
import fontFacesCss from '../games/engine/fonts.css?raw';
import engineCssUrl from '../games/engine/engine.css?url';
import engineJsUrl from '../games/engine/engine.js?url';
import mascotHtml from '../games/engine/mascot.html?raw';
import type { EliyahuGame, GameTheme } from './eliyahuGames';

function byFileName(modules: Record<string, string>, extension: RegExp): Record<string, string> {
  return Object.fromEntries(
    Object.entries(modules).map(([path, url]) => [path.split('/').pop()!.replace(extension, ''), url])
  );
}

const SPEC_URLS = byFileName(
  import.meta.glob('../games/specs/*.js', { query: '?url', import: 'default', eager: true }) as Record<string, string>,
  /\.js$/
);

const FONT_URLS = byFileName(
  import.meta.glob('../games/engine/fonts/*.woff2', { query: '?url', import: 'default', eager: true }) as Record<string, string>,
  /\.woff2$/
);

function fontUrl(name: string): string {
  const url = FONT_URLS[name];
  if (!url) throw new Error(`Missing game font ${name}.woff2`);
  return url;
}

/**
 * Heebo is a variable font, so every weight shares one file per subset. The
 * Hebrew and Latin subsets are the site's own /fonts/ files, which the wrapper
 * page has already loaded; the other subsets ship with the engine.
 */
const FONT_FACES = fontFacesCss.replace(/url\('\.\/fonts\/([\w-]+)\.woff2'\)/g, (_, name: string) => `url('${fontUrl(name)}')`);

const FONT_PRELOADS = [...new Set([...fontFacesCss.matchAll(/url\('(\/fonts\/[\w.-]+\.woff2)'\)/g)].map((match) => match[1]))]
  .map((url) => `<link rel="preload" href="${url}" as="font" type="font/woff2" crossorigin>`)
  .join('\n');

export function hasSpec(slug: string): boolean {
  return Object.prototype.hasOwnProperty.call(SPEC_URLS, slug);
}

export function listSpecSlugs(): string[] {
  return Object.keys(SPEC_URLS).sort();
}

function themeVars(theme: GameTheme): string {
  return [
    `--ink:${theme.ink}`,
    `--main:${theme.main}`,
    `--main-dark:${theme.mainDark}`,
    `--main-soft:${theme.mainSoft}`,
    `--main-line:${theme.mainLine}`,
    `--bg-a:${theme.bgA}`,
    `--bg-b:${theme.bgB}`,
    `--bg-c:${theme.bgC}`
  ].join(';');
}

function escapeAttribute(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

/**
 * Build the document served at /games/<slug>/play.
 * It is noindex on purpose: the wrapper page at /games/<slug> is canonical.
 */
export function renderGameDocument(game: EliyahuGame): string {
  const specUrl = SPEC_URLS[game.slug];
  if (!specUrl) throw new Error(`No game spec for ${game.slug}`);
  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<title>${escapeAttribute(game.h1)}</title>
<meta name="description" content="${escapeAttribute(game.description)}">
<meta name="robots" content="noindex, nofollow">
${FONT_PRELOADS}
<style id="game-fonts">
${FONT_FACES}
</style>
<link rel="stylesheet" href="${engineCssUrl}">
<style>
/* The game's own palette, after the engine stylesheet so it wins over the defaults. */
:root{${themeVars(game.theme)}}
</style>
</head>
<body>
<div id="app" dir="rtl" lang="he"></div>
${mascotHtml}
<script src="${engineJsUrl}"></script>
<script src="${specUrl}"></script>
</body>
</html>
`;
}
