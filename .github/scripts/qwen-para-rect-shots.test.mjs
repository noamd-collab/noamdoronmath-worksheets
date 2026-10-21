import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { PARA_RECT_FRAMES, shouldCaptureParaRectFilm, shuffleUnitFor } from './qwen-para-rect-shots.mjs';

describe('shouldCaptureParaRectFilm', () => {
  it('runs when the homepage film engine or markup changes', () => {
    assert.equal(shouldCaptureParaRectFilm(['headless/astro-poc/src/lib/conceptLoops.ts']), true);
    assert.equal(shouldCaptureParaRectFilm(['headless/astro-poc/src/components/ConceptLoop.astro']), true);
    assert.equal(shouldCaptureParaRectFilm(['headless/astro-poc/src/pages/index.astro']), false);
    assert.equal(shouldCaptureParaRectFilm(['headless/astro-poc/src/styles/exact-site.css']), false);
  });

  it('names the parallelogram and the rectangle hold', () => {
    assert.deepEqual(PARA_RECT_FRAMES.map((frame) => frame.name), ['parallelogram', 'rectangle']);
    assert.equal(PARA_RECT_FRAMES[0].t < 1.3, true);
    assert.equal(PARA_RECT_FRAMES[1].t, 5.4);
  });

  it('picks para-rect from the hero shuffle candidates', () => {
    const candidates = ['angle-sum', 'para-rect', 'pythagoras'];
    const unit = shuffleUnitFor(candidates, 'para-rect');
    assert.equal(Math.floor(unit * candidates.length), 1);
    assert.equal(shuffleUnitFor(candidates, 'triangle'), null);
  });

  it('seeks the mounted homepage film before the screenshot', () => {
    const source = readFileSync(new URL('./qwen-para-rect-shots.mjs', import.meta.url), 'utf8');
    assert.match(source, /data-loop="para-rect"/);
    assert.match(source, /__loop\.seek/);
    assert.match(source, /__loop\.pause/);
  });
});
