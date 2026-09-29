import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ExactReferenceMotion } from '../src/lib/exactReferenceMotion.js';

// A small DOM/WAAPI contract harness: no browser, screenshots, engines or timers
// are started outside the adapter. The browser gate still verifies React itself.
function withIsland(check: (fixture: any) => void) {
  const state = { ssr: true, ready: false, engine: false, animations: [] as any[] };
  const owner = { hasAttribute: (name: string) => name === 'data-exact-motion-ready' && state.ready };
  const makeElement = () => {
    const target = new EventTarget() as any;
    target.dataset = {};
    target.style = {};
    target.attributes = new Map();
    target.setAttribute = (name: string, value: string) => target.attributes.set(name, value);
    target.closest = (selector: string) => {
      if (selector.includes('[data-loop]')) return state.engine ? {} : null;
      if (selector === 'astro-island[ssr]') return state.ssr ? owner : null;
      if (selector === '[data-exact-hydration]') return owner;
      return null;
    };
    target.getBoundingClientRect = () => ({ top: 0, bottom: 50 });
    target.animate = () => {
      const animation = new EventTarget() as any;
      animation.playState = 'running';
      animation.pause = () => { animation.playState = 'paused'; };
      animation.play = () => { animation.playState = 'running'; };
      animation.finish = () => {
        animation.playState = 'finished';
        animation.onfinish?.();
        animation.dispatchEvent(new Event('finish'));
      };
      animation.cancel = () => { animation.dispatchEvent(new Event('cancel')); };
      state.animations.push(animation);
      return animation;
    };
    return target;
  };
  const fish = makeElement(), img = makeElement();
  fish.dataset.doodle = 'fish';
  fish.querySelector = (selector: string) => selector === 'img' ? img : null;
  const root = {
    querySelectorAll: (selector: string) =>
      selector === '[data-doodle] img' ? [img] : selector.includes('[data-doodle]') ? [fish] : [],
  };
  const globals = {
    document: {
      querySelector: (selector: string) => selector === '.exact-frame' ? root : null,
      documentElement: { dataset: {}, classList: { contains: () => false } },
      hidden: false,
    },
    matchMedia: () => ({ matches: false }),
    innerHeight: 900,
  };
  const prior = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { value, configurable: true });
  const motion = new ExactReferenceMotion();
  motion.io = { observe: () => {}, unobserve: () => {} };
  try { check({ motion, state, fish, img }); }
  finally {
    clearTimeout(motion.fallback);
    motion.listeners.forEach((remove: () => void) => remove());
    for (const [key, descriptor] of prior) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
}

describe('exact decorative motion hydration boundary', () => {
  it('does not mutate or animate SSR islands', () => withIsland(({ motion, state, fish, img }) => {
    motion.scan();
    assert.equal(state.animations.length, 0);
    assert.equal(img.attributes.size, 0);
    assert.equal(img.tabIndex, undefined);
    assert.equal(fish.__prepared, undefined);
    assert.deepEqual(fish.style, {});
  }));

  it('waits for React commit even after Astro removes ssr', () => withIsland(({ motion, state, img }) => {
    state.ssr = false;
    motion.scan();
    assert.equal(state.animations.length, 0);
    assert.equal(img.attributes.size, 0);
  }));

  it('starts the original effects and keyboard handler once after readiness', () => withIsland(({ motion, state, fish, img }) => {
    state.ssr = false;
    state.ready = true;
    motion.scan();
    assert.equal(state.animations.length, 1);
    assert.equal(img.tabIndex, 0);
    assert.equal(img.attributes.get('role'), 'button');
    assert.equal(img.attributes.get('aria-label'), 'הנפשת השרבוט');
    const listenerCount = motion.listeners.length;
    motion.scan();
    assert.equal(state.animations.length, 1);
    assert.equal(motion.listeners.length, listenerCount);
    state.animations[0].finish();
    assert.equal(state.animations.length, 2);
    assert.equal(fish.style.transformOrigin, 'center');
  }));

  it('still excludes the protected math engine subtree after hydration', () => withIsland(({ motion, state, img }) => {
    state.ssr = false;
    state.ready = true;
    state.engine = true;
    motion.scan();
    assert.equal(state.animations.length, 0);
    assert.equal(img.attributes.size, 0);
  }));
});
