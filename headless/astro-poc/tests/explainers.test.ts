/**
 * Explainer animations (POC): the three components, their shared frame/runtime,
 * and the noindex demo page.
 *
 * Source checks always run. The render check needs a running server:
 *   EXPLAINERS_BASE_URL=http://127.0.0.1:4337 npx tsx --test tests/explainers.test.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';

const dir = new URL('../src/components/explainers/', import.meta.url);
const read = (name: string) => readFileSync(new URL(name, dir), 'utf8');
const COMPONENTS = ['TriangleAreaExplainer.astro', 'PythagorasExplainer.astro', 'DistributiveExplainer.astro'];

describe('explainers: components', () => {
  for (const name of COMPONENTS) {
    it(`${name}: accessible SVG, Hebrew description, reduced-motion final state`, () => {
      const src = read(name);
      assert.match(src, /<svg[^>]+role="img"/);
      assert.match(src, /<svg[^>]+aria-label=\{label\}/);
      const label = src.match(/const label = '([^']+)'/)?.[1] || '';
      assert.ok(/[֐-׿]/.test(label) && label.length > 60, 'Hebrew aria-label that describes the idea');
      assert.match(src, /@media \(prefers-reduced-motion: reduce\)\s*\{[^}]*animation: none !important/);
      assert.match(src, /import ExplainerFrame from '\.\/ExplainerFrame\.astro'/);
      // Only the shared frame is imported: no animation or math libraries.
      const imports = [...src.matchAll(/^import .+ from '([^']+)'/gm)].map((m) => m[1]);
      assert.deepEqual(imports, ['./ExplainerFrame.astro']);
      // Hebrew text is marked RTL, math is marked LTR.
      for (const t of src.matchAll(/<text[^>]*direction="(rtl|ltr)"[^>]*>([^<]+)</g)) {
        const hebrew = /[֐-׿]/.test(t[2]);
        assert.equal(t[1], hebrew ? 'rtl' : 'ltr', t[2]);
      }
      // Animations run only after the runtime arms the figure.
      assert.match(src, /:global\(\[data-state='play'\]\)/);
    });
  }

  it('frame: replay button, fixed aspect ratio, button hidden without runtime or with reduced motion', () => {
    const src = read('ExplainerFrame.astro');
    assert.match(src, /<button type="button" class="explainer__replay" data-replay/);
    assert.match(src, /aspect-ratio: 4 \/ 3/);
    assert.match(src, /\.explainer:not\(\[data-state\]\) \.explainer__replay \{\s*visibility: hidden/);
    assert.match(src, /prefers-reduced-motion: reduce/);
    assert.match(src, /import '\.\/explainer-runtime'/);
  });

  it('runtime: skips reduced motion, starts on view, plays once, replay restarts', () => {
    const src = read('explainer-runtime.ts');
    assert.match(src, /prefers-reduced-motion: reduce/);
    assert.match(src, /IntersectionObserver/);
    assert.match(src, /unobserve/);
    assert.match(src, /\[data-replay\]/);
  });

  it('demo page: all three, noindex, standalone (not BaseLayout)', () => {
    const page = readFileSync(new URL('../src/pages/poc-explainers.astro', import.meta.url), 'utf8');
    for (const c of ['TriangleAreaExplainer', 'PythagorasExplainer', 'DistributiveExplainer']) assert.match(page, new RegExp(`<${c} />`));
    assert.match(page, /<meta name="robots" content="noindex" \/>/);
    assert.ok(!/import BaseLayout/.test(page), 'standalone page, not BaseLayout');
  });
});

const BASE = process.env.EXPLAINERS_BASE_URL;
describe('explainers: rendered page', { skip: BASE ? false : 'set EXPLAINERS_BASE_URL to run' }, () => {
  it('renders 3 labelled SVGs, the reduced-motion rule and noindex', async () => {
    const res = await fetch(`${BASE}/poc-explainers`);
    assert.equal(res.status, 200);
    const html = await res.text();
    const svgs = [...html.matchAll(/<svg[^>]*role="img"[^>]*aria-label="([^"]+)"/g)];
    assert.equal(svgs.length, 3);
    for (const s of svgs) assert.ok(/[֐-׿]/.test(s[1]));
    assert.equal((html.match(/data-explainer="/g) || []).length, 3);
    assert.equal((html.match(/data-replay/g) || []).length, 3);
    assert.ok(html.includes('prefers-reduced-motion'));
    assert.match(html, /<meta name="robots" content="noindex">/);
  });
});
