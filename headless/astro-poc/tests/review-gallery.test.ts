/**
 * Animation galleries and catalog-gap review indexes are local preview pages only:
 * not Wix pages, noindex, and linked from nowhere on the site.
 */
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (file: string) => readFileSync(join(root, file), 'utf8');
type PreviewRoute = { pattern: string; entrypoint: URL; prerender: boolean };
type PreviewIntegration = {
  name: string;
  hooks: { 'astro:config:setup'?: (options: { injectRoute: (route: PreviewRoute) => void }) => void };
};
const walk = (dir: string): string[] =>
  readdirSync(join(root, dir), { withFileTypes: true }).flatMap((d) =>
    d.isDirectory() ? walk(`${dir}/${d.name}`) : /\.(astro|ts|tsx|js|mjs|json)$/.test(d.name) ? [`${dir}/${d.name}`] : [],
  );

describe('landing-animation review galleries', () => {
  it('live outside src/pages and only the preview config injects them', () => {
    assert.equal(existsSync(join(root, 'src/pages/review')), false);
    assert.doesNotMatch(read('astro.config.mjs'), /dev-pages\/review|\/review\//);
    const preview = read('astro.config.preview.mjs');
    assert.match(preview, /src\/dev-pages\/review\//);
    assert.match(preview, /pattern: `\/review\/\$\{file\.replace\(\/\\\.astro\$\/, ''\)\}`/);
    assert.match(preview, /\^landing-loops-\[\\w-\]\+\\\.astro\$/);
    assert.match(preview, /\^new-topic-pages-grade-\[789\]\\\.astro\$/);
    assert.deepEqual(walk('src/pages').filter((file) => /^src\/pages\/review(?:\/|\.)/.test(file)), []);
  });

  it('injects every review entrypoint into the preview with a strict route pattern', async () => {
    const { default: imported } = await import('../astro.config.preview.mjs');
    const config = imported as unknown as { integrations: PreviewIntegration[] };
    const integration = config.integrations.find((item) => item.name === 'noam-dev-only-routes');
    assert.ok(integration);
    const setup = integration.hooks['astro:config:setup'];
    assert.ok(setup);
    const routes: PreviewRoute[] = [];
    setup({ injectRoute: (route) => routes.push(route) });
    const reviewRoutes = routes.filter((route) => route.pattern.startsWith('/review/'));
    const files = readdirSync(join(root, 'src/dev-pages/review')).filter((file) => file.endsWith('.astro')).sort();
    assert.deepEqual(reviewRoutes.map((route) => route.pattern).sort(), files.map((file) => `/review/${file.slice(0, -6)}`));
    for (const grade of [7, 8, 9]) {
      assert.ok(reviewRoutes.some((route) => route.pattern === `/review/new-topic-pages-grade-${grade}`));
    }
    for (const route of reviewRoutes) {
      assert.match(route.pattern, /^\/review\/(?:landing-loops-[\w-]+|new-topic-pages-grade-[789])$/);
      assert.equal(route.prerender, false);
      assert.equal(fileURLToPath(route.entrypoint), join(root, 'src/dev-pages', `${route.pattern.slice(1)}.astro`));
      assert.ok(existsSync(route.entrypoint));
    }
  });

  it('are noindex and nothing on the site links to them', () => {
    const shell = read('src/dev-pages/review/parts/ReviewGallery.astro');
    assert.match(shell, /<meta name="robots" content="noindex, nofollow" \/>/);
    const galleries = readdirSync(join(root, 'src/dev-pages/review')).filter((f) => /^landing-loops-[\w-]+\.astro$/.test(f));
    for (const file of galleries) {
      assert.match(read(`src/dev-pages/review/${file}`), /<ReviewGallery\b/, file);
    }
    const topicShell = read('src/components/CatalogGapReview.astro');
    assert.match(topicShell, /<meta name="robots" content="noindex, nofollow" \/>/);
    assert.match(topicShell, /X-Robots-Tag', 'noindex, nofollow'/);
    for (const grade of [7, 8, 9]) {
      assert.match(read(`src/dev-pages/review/new-topic-pages-grade-${grade}.astro`), /<CatalogGapReview\b/);
    }
    for (const file of [...walk('src/pages'), ...walk('src/components'), ...walk('src/layouts'), ...walk('src/lib')]) {
      assert.equal(read(file).includes('/review/landing-loops'), false, file);
      assert.equal(read(file).includes('/review/new-topic-pages'), false, file);
    }
  });

  it('show the base picture from frozen copies, not the live components', () => {
    const before = read('src/dev-pages/review/before/LandingLoopBefore.astro');
    assert.match(before, /from '\.\/LoopSketchBefore\.astro'/);
    assert.match(before, /from '\.\/landingLoopsBefore'/);
    assert.match(read('src/dev-pages/review/parts/ReviewLoop.astro'), /side === 'before' && <LandingLoopBefore/);
  });
});
