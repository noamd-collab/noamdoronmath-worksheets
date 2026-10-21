/**
 * para-rect (homepage «האם השטח משתנה?»): base b and height h stay on the shape.
 * The lap is still 10s and the hold is still 5.4s.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { parseHTML } from 'linkedom';
import { HERO_PLAY_S } from '../src/lib/heroRotation.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (file: string) => readFileSync(join(root, file), 'utf8');

function markup() {
  return `<div data-loop="para-rect">
    <polygon data-el="shape" points=""></polygon>
    <line data-el="height" x1="0" y1="0" x2="0" y2="0"></line>
    <path data-el="h-sq" d=""></path>
    <path data-el="h-brk" d=""></path>
    <text data-el="lbl-h">h</text>
    <path data-el="b-brk" d="M160 250 L160 262 L400 262 L400 250"></path>
    <text data-el="lbl-b" x="280" y="280" text-anchor="middle">b</text>
    <text data-el="lbl-same">אותו שטח</text>
    <span data-fx="0"></span>
    <span data-fx="1"></span>
  </div>`;
}

async function boot() {
  const { document, window } = parseHTML(`<!doctype html><html><body>${markup()}</body></html>`);
  window.matchMedia = () => ({ matches: false, addEventListener() {} }) as any;
  Object.assign(globalThis, {
    document,
    window,
    MutationObserver: window.MutationObserver,
    requestAnimationFrame: () => 0,
    cancelAnimationFrame: () => {},
  });
  const { initConceptLoops } = await import('../src/lib/conceptLoops.ts');
  initConceptLoops();
  const card = document.querySelector('[data-loop="para-rect"]');
  return card;
}

describe('para-rect base and height markers', () => {
  it('keeps the homepage lap and hold', () => {
    assert.equal(HERO_PLAY_S['para-rect'], 10);
    const engine = read('src/lib/conceptLoops.ts');
    assert.match(engine, /const PARA_RECT_HOLD = 5\.4;/);
    assert.match(engine, /'para-rect': \{ duration: 10, hold: PARA_RECT_HOLD, render: renderParaRect \}/);
  });

  it('draws b under the base and h on a marker, on the rectangle and the parallelogram', async () => {
    const card = await boot();
    const loop = card.__loop;
    assert.ok(loop, 'loop hook');
    const el = (name: string) => card.querySelector(`[data-el="${name}"]`);

    loop.seek(5.4);
    assert.equal(el('shape').getAttribute('points'), '160,240 400,240 400,128 160,128');
    assert.equal(el('height').style.opacity, '0');
    assert.equal(el('h-brk').style.opacity, '1');
    assert.match(el('h-brk').getAttribute('d'), /L142 128 L142 240 L160 240/);
    assert.equal(el('lbl-h').getAttribute('x'), '124');
    assert.equal(el('lbl-h').textContent, 'h');
    assert.equal(el('lbl-h').style.opacity, '1');
    assert.equal(el('lbl-b').textContent, 'b');
    assert.equal(el('lbl-b').style.opacity, '1');
    assert.equal(el('b-brk').style.opacity, '1');
    assert.equal(el('lbl-b').getAttribute('x'), '280');
    assert.equal(el('lbl-same').style.opacity, '1');
    assert.equal(el('h-sq').getAttribute('d'), 'M160 226 L174 226 L174 240');

    loop.seek(1);
    assert.equal(el('shape').getAttribute('points'), '160,240 400,240 472,128 232,128');
    assert.equal(el('height').getAttribute('x1'), '232');
    assert.equal(el('height').getAttribute('y1'), '128');
    assert.equal(el('height').getAttribute('y2'), '240');
    assert.equal(el('height').style.opacity, '1');
    assert.equal(el('h-brk').style.opacity, '0');
    assert.equal(el('lbl-h').getAttribute('x'), '248');
    assert.equal(el('lbl-h').style.opacity, '1');
    assert.equal(el('lbl-b').style.opacity, '1');
    assert.equal(el('lbl-same').style.opacity, '0');
    assert.equal(el('h-sq').getAttribute('d'), 'M232 226 L246 226 L246 240');
  });

  it('ships both markers in the card markup', () => {
    const source = read('src/components/ConceptLoop.astro');
    const block = source.slice(source.indexOf("variant === 'para-rect'"), source.indexOf("variant === 'angle-kinds'"));
    for (const token of ['data-el="lbl-b"', 'data-el="b-brk"', 'data-el="h-brk"', 'data-el="h-sq"', 'data-el="height"', '>b<', '>h<', 'אותו שטח']) {
      assert.ok(block.includes(token), token);
    }
  });
});
