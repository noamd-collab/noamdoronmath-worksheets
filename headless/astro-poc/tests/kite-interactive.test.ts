/**
 * Kite interactive (JSXGraph) pilot — /kite-grade-9.
 * The animation stays engine-owned; the board opens after the film parks.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (file: string) => readFileSync(join(root, file), 'utf8');

describe('kite interactive handoff (JSXGraph pilot)', () => {
  it('mounts only on the kite page, after the loop', () => {
    const tpl = read('src/components/TopicPage.astro');
    assert.match(tpl, /import KiteInteractive from '\.\/KiteInteractive\.astro';/);
    assert.match(tpl, /\{slug === 'kite-grade-9' && <KiteInteractive \/>/);
    // exactly one mount, kite only
    assert.equal(tpl.split('<KiteInteractive').length - 1, 1);
  });

  it('keeps the protected loop engine untouched', () => {
    // The pilot must not modify the fenced files (design-exact-protected hashes).
    const ix = read('src/lib/kiteInteractive.ts');
    // It never imports the protected modules.
    assert.doesNotMatch(ix, /import[^;]*conceptLoops/i);
    assert.doesNotMatch(ix, /import[^;]*ConceptLoop/);
    // It talks to the engine only through its public hook and toggle.
    assert.match(ix, /__loop/);
    assert.match(ix, /\[data-el="toggle"\]/);
  });

  it('hands off only when the film is done; replay goes through the engine toggle', () => {
    const ix = read('src/lib/kiteInteractive.ts');
    assert.match(ix, /h\.state\(\)\.done/);
    assert.match(ix, /toggle\?\.click\(\)/);
    // static (reduced motion / no motion): no auto handoff, on-demand button
    assert.match(ix, /state\(\)\.static/);
    const cmp = read('src/components/KiteInteractive.astro');
    assert.match(cmp, /פתחו את הפעילות/);
    assert.match(cmp, /data-ix-open/);
  });

  it('is bundled locally — no CDN, dynamic import only on open', () => {
    const cmp = read('src/components/KiteInteractive.astro');
    const ix = read('src/lib/kiteInteractive.ts');
    assert.doesNotMatch(cmp + ix, /src=["']https?:\/\//i);
    assert.doesNotMatch(cmp + ix, /from ["']https?:\/\//);
    assert.doesNotMatch(cmp + ix, /jsdelivr|unpkg|cdnjs/i);
    assert.match(ix, /await import\('jsxgraph'\)/);
    const pkg = JSON.parse(read('package.json'));
    assert.ok(pkg.dependencies.jsxgraph, 'jsxgraph must be a local dependency');
  });

  it('renders Hebrew RTL hint, replay and reset controls with sane defaults', () => {
    const cmp = read('src/components/KiteInteractive.astro');
    assert.match(cmp, /dir="rtl"/);
    assert.match(cmp, /הפעלת ההדגמה מחדש/);
    assert.match(cmp, /איפוס הדלתון/);
    assert.match(cmp, /aria-live="polite"/);
    // hidden until JS opens it — no-JS keeps the film
    assert.match(cmp, /data-interactive="kite-diagonals" hidden/);
    // author display rules must not defeat the hidden attribute
    assert.match(cmp, /\.kite-ix\[hidden\],\s*\.kite-ix-open-wrap\[hidden\]\s*\{\s*display:\s*none/);
    assert.match(cmp, /touch-action:\s*none/);
  });

  it('board matches the film: colors, labels, mirror D, S = (AC · BD) : 2', () => {
    const ix = read('src/lib/kiteInteractive.ts');
    for (const token of ['#22305a', '#2a7c7a', '#e5735c', '#e6a534', '#7c3aed1f']) {
      assert.ok(ix.includes(token), token);
    }
    // default kite is the page's own example: 8 × 6 → 24
    assert.match(ix, /A: \[0, 4\]/);
    assert.match(ix, /B: \[3, 0\]/);
    assert.match(ix, /C: \[0, -4\]/);
    // D mirrors B across the symmetry axis and is not draggable
    assert.match(ix, /\(\) => -B\.X\(\), \(\) => B\.Y\(\)/);
    assert.match(ix, /S = \(/);
    assert.match(ix, /: 2 = /);
    // congruence ticks: double teal from A, triple coral from C
    assert.match(ix, /ticks\(board, A, B, 2, TEAL_DARK\)/);
    assert.match(ix, /ticks\(board, C, B, 3, CORAL_DARK\)/);
  });

  it('snaps drags to halves and keeps the kite a kite', () => {
    const ix = read('src/lib/kiteInteractive.ts');
    assert.match(ix, /const SNAP = 0\.5/);
    // A and C stay on the axis (x = 0)
    assert.match(ix, /A\.moveTo\(\[0, clamp/);
    assert.match(ix, /C\.moveTo\(\[0, clamp/);
  });

  it('shows a נסו בעצמכם badge and a one-shot attention cue that dies on first touch', () => {
    const cmp = read('src/components/KiteInteractive.astro');
    const ix = read('src/lib/kiteInteractive.ts');
    // badge near the figure, never blocking drags
    assert.match(cmp, /נסו בעצמכם!/);
    assert.match(cmp, /data-ix-badge/);
    assert.match(cmp, /\.kite-ix__badge\s*\{[^}]*pointer-events:\s*none/s);
    // cue: pulse ring + nudging finger, plays exactly once for 2-3s
    assert.match(cmp, /data-ix-cue/);
    assert.match(cmp, /kite-ix-pulse 2\.6s ease-out 1/);
    assert.match(cmp, /kite-ix-nudge 2\.6s ease-in-out 1/);
    // stops on the first pointer contact; the site motion controls hide it,
    // the OS reduced-motion setting alone does not
    assert.match(ix, /addEventListener\('pointerdown', stop, \{ once: true \}\)/);
    assert.match(ix, /cueDone/);
    assert.match(ix, /if \(sitePrefersReducedMotion\(\)\) return;/);
    assert.doesNotMatch(ix, /matchMedia\('\(prefers-reduced-motion/);
    assert.match(ix, /!isStatic\(\)\) showCueOnce/);
    assert.match(cmp, /:global\(html\.nd-motion-off\) \.kite-ix__cue,\s*:global\(html\.noam-a11y-motion\) \.kite-ix__cue\s*\{\s*display:\s*none/);
    assert.doesNotMatch(cmp, /@media \(prefers-reduced-motion:\s*reduce\)\s*\{\s*\.kite-ix__cue/);
    // static film: closing the board brings the open button back
    assert.match(ix, /if \(isStatic\(\) && openWrap\) openWrap\.hidden = false;/);
    // hidden cue must not defeat the hidden attribute
    assert.match(cmp, /\.kite-ix__cue\[hidden\]\s*\{\s*display:\s*none/);
  });
});
