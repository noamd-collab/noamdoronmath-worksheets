/**
 * Landing-animation review galleries are local preview pages only:
 * not Wix pages, noindex, and linked from nowhere on the site.
 */
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (file: string) => readFileSync(join(root, file), 'utf8');

describe('landing-animation review galleries', () => {
  it('live outside src/pages and only the preview config injects them', () => {
    assert.equal(existsSync(join(root, 'src/pages/review')), false);
    assert.doesNotMatch(read('astro.config.mjs'), /dev-pages\/review|\/review\//);
    const preview = read('astro.config.preview.mjs');
    assert.match(preview, /src\/dev-pages\/review\//);
    assert.match(preview, /pattern: `\/review\/\$\{file\.replace\(\/\\\.astro\$\/, ''\)\}`/);
    assert.match(preview, /\^landing-loops-\[\\w-\]\+\\\.astro\$/);
  });

  it('are noindex and nothing on the site links to them', () => {
    const shell = read('src/dev-pages/review/parts/ReviewGallery.astro');
    assert.match(shell, /<meta name="robots" content="noindex, nofollow" \/>/);
    const galleries = readdirSync(join(root, 'src/dev-pages/review')).filter((f) => /^landing-loops-[\w-]+\.astro$/.test(f));
    for (const file of galleries) {
      assert.match(read(`src/dev-pages/review/${file}`), /<ReviewGallery\b/, file);
    }
    const walk = (dir: string): string[] =>
      readdirSync(join(root, dir), { withFileTypes: true }).flatMap((d) =>
        d.isDirectory() ? walk(`${dir}/${d.name}`) : /\.(astro|ts|tsx|js|mjs|json)$/.test(d.name) ? [`${dir}/${d.name}`] : [],
      );
    for (const file of [...walk('src/pages'), ...walk('src/components'), ...walk('src/layouts'), ...walk('src/lib')]) {
      assert.equal(read(file).includes('/review/landing-loops'), false, file);
    }
  });

  it('show the base picture from frozen copies, not the live components', () => {
    const before = read('src/dev-pages/review/before/LandingLoopBefore.astro');
    assert.match(before, /from '\.\/LoopSketchBefore\.astro'/);
    assert.match(before, /from '\.\/landingLoopsBefore'/);
    assert.match(read('src/dev-pages/review/parts/ReviewLoop.astro'), /side === 'before' && <LandingLoopBefore/);
  });
});
