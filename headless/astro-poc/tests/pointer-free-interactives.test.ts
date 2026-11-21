/**
 * Pointer-free routes for the two on-page interactives.
 *
 * Every state they offer must be reachable by drag, by button and by keyboard,
 * and nothing may wait for an animation frame to become visible or to fit: the
 * site's Stop Animations mode holds requestAnimationFrame callbacks, so a frame
 * that never arrives would break the page for the readers who asked for less
 * motion.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (file: string) => readFileSync(join(root, file), 'utf8');

describe('triangle area explorer: drag, buttons and keyboard', () => {
  it('exposes the apex handle as a focusable slider', () => {
    const cmp = read('src/components/TriangleAreaExplorer.astro');
    assert.match(cmp, /role="slider"/);
    assert.match(cmp, /tabindex="0"/);
    assert.match(cmp, /aria-valuemin/);
    assert.match(cmp, /aria-valuemax/);
  });

  it('offers three buttons that move the apex', () => {
    const cmp = read('src/components/TriangleAreaExplorer.astro');
    assert.equal(cmp.split('class="te-step"').length - 1, 3);
    assert.match(cmp, /class="te-step" data-el="left"/);
    assert.match(cmp, /class="te-step" data-el="home"/);
    assert.match(cmp, /class="te-step" data-el="right"/);
  });

  it('answers the arrow, page, home and end keys', () => {
    const lib = read('src/lib/triExplorer.ts');
    assert.match(lib, /ArrowLeft/);
    assert.match(lib, /ArrowRight/);
    assert.match(lib, /PageUp/);
    assert.match(lib, /PageDown/);
    assert.match(lib, /'Home'/);
    assert.match(lib, /'End'/);
    assert.match(lib, /addEventListener\('keydown'/);
  });

  it('announces the move with a timer, never with an animation frame', () => {
    const lib = read('src/lib/triExplorer.ts');
    const announce = lib.slice(lib.indexOf('if (announce && live)'), lib.indexOf('function showHint'));
    assert.doesNotMatch(announce, /requestAnimationFrame\(/);
    assert.match(announce, /setTimeout/);
  });

  it('tells the reader about all three routes', () => {
    const cmp = read('src/components/TriangleAreaExplorer.astro');
    assert.match(cmp, /בכפתורים/);
    assert.match(cmp, /בחיצים/);
  });
});

describe('kite board: drag, buttons and keyboard', () => {
  it('offers a vertex chip per movable vertex and a four-way pad', () => {
    const cmp = read('src/components/KiteInteractive.astro');
    for (const v of ['A', 'B', 'C']) assert.match(cmp, new RegExp(`data-ix-pick="${v}"`));
    for (const m of ['up', 'down', 'left', 'right']) assert.match(cmp, new RegExp(`data-ix-move="${m}"`));
    assert.match(cmp, /aria-pressed/);
  });

  it('moves the picked vertex with the arrow keys', () => {
    const lib = read('src/lib/kiteInteractive.ts');
    assert.match(lib, /ArrowUp: 'up'/);
    assert.match(lib, /addEventListener\('keydown'/);
    // A and C ride the vertical axis; sideways keys must stay inert for them.
    assert.match(lib, /picked !== 'B'/);
  });

  it('shares one clamped placement for the drag and for the buttons', () => {
    const lib = read('src/lib/kiteInteractive.ts');
    for (const fn of ['placeA', 'placeB', 'placeC']) assert.match(lib, new RegExp(`${fn}\\s*[(=]`));
    assert.match(lib, /nudge/);
  });

  it('reveals the board without waiting for an animation frame', () => {
    const lib = read('src/lib/kiteInteractive.ts');
    const open = lib.slice(lib.indexOf('const openBoard'), lib.indexOf('const closeBoard'));
    assert.doesNotMatch(open, /requestAnimationFrame\(/);
    assert.match(open, /offsetHeight/);
    assert.match(open, /classList\.add\('is-on'\)/);
  });
});

describe('game pages refit without animation frames', () => {
  for (const page of ['src/pages/games/eliyahu-pythagoras/index.astro', 'src/pages/games/[slug]/index.astro']) {
    it(`backs the frame fit with a timer in ${page}`, () => {
      const src = read(page);
      assert.match(src, /eliyahuFitTimer/);
      assert.match(src, /setTimeout\(runEliyahuFit/);
      assert.match(src, /requestAnimationFrame\(runEliyahuFit\)/);
    });
  }
});
