/**
 * Compose one playable game document.
 *
 * The result is a single self-contained HTML file: embedded fonts, the shared
 * engine stylesheet and runtime, the mascot sprite sheet, and the game's own
 * spec. Nothing is fetched at runtime, so the document keeps working inside the
 * iframe on the wrapper page and in an offline preview.
 */
import fontsCss from '../games/engine/fonts.css?raw';
import engineCss from '../games/engine/engine.css?raw';
import engineJs from '../games/engine/engine.js?raw';
import mascotHtml from '../games/engine/mascot.html?raw';
import type { EliyahuGame, GameTheme } from './eliyahuGames';

const specModules = import.meta.glob('../games/specs/*.js', {
  query: '?raw',
  import: 'default',
  eager: true
}) as Record<string, string>;

/** Spec source by slug, keyed off the file name. */
const SPECS: Record<string, string> = Object.fromEntries(
  Object.entries(specModules).map(([path, source]) => {
    const slug = path.split('/').pop()!.replace(/\.js$/, '');
    return [slug, source];
  })
);

export function hasSpec(slug: string): boolean {
  return Object.prototype.hasOwnProperty.call(SPECS, slug);
}

export function listSpecSlugs(): string[] {
  return Object.keys(SPECS).sort();
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
  const spec = SPECS[game.slug];
  if (!spec) throw new Error(`No game spec for ${game.slug}`);
  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<title>${escapeAttribute(game.h1)}</title>
<meta name="description" content="${escapeAttribute(game.description)}">
<meta name="robots" content="noindex, nofollow">
<style id="offline-fonts">
${fontsCss}
</style>
<style>
${engineCss}
/* The game's own palette, last so it wins over the engine defaults. */
:root{${themeVars(game.theme)}}
</style>
</head>
<body>
<div id="app" dir="rtl" lang="he"></div>
${mascotHtml}
<script>
${engineJs}
</script>
<script>
${spec}
</script>
</body>
</html>
`;
}
