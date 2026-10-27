import assert from 'node:assert/strict';
import { it } from 'node:test';
import { parseHTML } from 'linkedom';

function environment(markup: string) {
  const { document, window } = parseHTML(`<html><body>${markup}</body></html>`);
  const pending = new Map<number, FrameRequestCallback>();
  let next = 0;
  class InViewObserver {
    constructor(private callback: (entries: { isIntersecting: boolean }[]) => void) {}
    observe() { this.callback([{ isIntersecting: true }]); }
  }
  window.matchMedia = () => ({ matches: true, addEventListener() {} }) as any;
  window.IntersectionObserver = InViewObserver as any;
  Object.assign(globalThis, {
    document, window, MutationObserver: window.MutationObserver, IntersectionObserver: InViewObserver,
    performance: { now: () => 0 }, sessionStorage: { getItem: () => null, setItem() {} },
    requestAnimationFrame: (callback: FrameRequestCallback) => { pending.set(++next, callback); return next; },
    cancelAnimationFrame: (id: number) => pending.delete(id),
  });
  return {
    document, window, pending,
    tick(ms: number) {
      const frames = [...pending.values()];
      pending.clear();
      frames.forEach(frame => frame(ms));
    },
    async motion(enabled: boolean, stopped = false) {
      document.documentElement.classList.toggle('nd-motion-enabled', enabled);
      document.documentElement.classList.toggle('nd-motion-off', stopped);
      await Promise.resolve();
    },
  };
}

it('percent demo waits for site opt-in and respects global stop and later manual input', async () => {
  const env = environment(`<div data-pct-explorer data-p="25" data-q="200"><div data-el="grid">${'<i></i>'.repeat(100)}</div><input data-el="range" value="25"></div>`);
  const { initPercentExplorers } = await import('../src/lib/percentExplorer');
  initPercentExplorers();
  const range = env.document.querySelector('input') as HTMLInputElement;
  assert.equal(env.pending.size, 0);
  assert.equal(range.value, '25');
  await env.motion(true);
  assert.equal(env.pending.size, 1, 'opt-in starts the deferred demo');
  env.tick(250);
  assert.ok(Number(range.value) > 0 && Number(range.value) < 25, 'the demo advances');
  await env.motion(true, true);
  assert.equal(env.pending.size, 0, 'global stop cancels the active demo');
  assert.equal(range.value, '25');
  await env.motion(true);
  assert.equal(env.pending.size, 1, 'policy-interrupted demo resumes');
  range.value = '36';
  range.dispatchEvent(new env.window.Event('input'));
  assert.equal(env.pending.size, 0);
  await env.motion(true, true);
  await env.motion(true);
  assert.equal(env.pending.size, 0, 'manual input is not overwritten by another demo');
  assert.equal(range.value, '36');
});

it('triangle demo waits for site opt-in and leaves manual apex input intact across policy changes', async () => {
  const env = environment('<div data-tri-explorer><svg><polygon data-el="poly"></polygon><polygon data-el="poly-fill"></polygon><line data-el="height"></line><path data-el="ra"></path><text data-el="lbl-h"></text><circle data-el="hit"></circle><circle data-el="handle"></circle></svg><input data-el="range"><p data-el="hint"></p><p data-el="live"></p></div>');
  const { initTriExplorers } = await import('../src/lib/triExplorer');
  initTriExplorers();
  const root = env.document.querySelector('[data-tri-explorer]') as any;
  const range = env.document.querySelector('input') as HTMLInputElement;
  assert.equal(root.__tri.state(), 3);
  assert.equal(env.pending.size, 0);
  await env.motion(true);
  assert.equal(env.pending.size, 1);
  env.tick(400);
  assert.ok(root.__tri.state() > 3, 'the apex moves after opt-in');
  await env.motion(true, true);
  assert.equal(env.pending.size, 0);
  await env.motion(true);
  assert.equal(env.pending.size, 1);
  range.value = '4.2';
  range.dispatchEvent(new env.window.Event('input'));
  assert.equal(env.pending.size, 0);
  await env.motion(true, true);
  await env.motion(true);
  assert.equal(root.__tri.state(), 4.2);
  assert.equal(env.pending.size, 0, 'manual input ends the one-time demo');
});
