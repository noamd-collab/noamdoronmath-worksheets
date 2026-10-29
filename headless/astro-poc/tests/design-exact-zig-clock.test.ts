import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ExactReferenceMotion } from '../src/lib/exactReferenceMotion.js';

// Drive the actual geometry renderer with deterministic RAF and wall clocks.
function withZig(check: (fixture: any) => void) {
  const nodes: any[] = [];
  const element = () => {
    const node = {
      style: {} as Record<string, string>,
      attributes: new Map<string, string>(),
      setAttribute(name: string, value: string) { this.attributes.set(name, value); },
    };
    nodes.push(node);
    return node;
  };
  const paths = Array.from({ length: 7 }, element);
  const texts = Array.from({ length: 2 }, element);
  const theorems = Array.from({ length: 3 }, element);
  const parts = new Map(['rad', 'axes', 'tri', 'play', 'play-s'].map(name => [`[data-${name}]`, element()]));
  const shape = Object.assign(element(), {
    querySelector: (selector: string) => parts.get(selector),
    querySelectorAll: (selector: string) => selector === ':scope > path' ? paths : selector === ':scope > text' ? texts : theorems,
  });
  const bot = element();
  const host = Object.assign(element(), { querySelector: () => bot });
  const state = { off: false, wallTime: 100.5 };
  const frames = new Map<number, (timestamp: number) => void>();
  let frameId = 0;
  const document = {
    hidden: false,
    documentElement: { scrollHeight: 1600 },
    querySelector: (selector: string) => selector === '[data-exact-zig]' ? host : selector === '[data-exact-zig-path]' ? shape : null,
  };
  const globals = {
    document,
    performance: { now: () => state.wallTime },
    scrollY: 0,
    innerWidth: 1280,
    innerHeight: 900,
    requestAnimationFrame: (callback: (timestamp: number) => void) => { frames.set(++frameId, callback); return frameId; },
    cancelAnimationFrame: (id: number) => frames.delete(id),
  };
  const prior = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { value, configurable: true });
  const motion = new ExactReferenceMotion();
  motion.motion = () => state.off ? 'כבוי' : 'שובב';
  const snapshot = () => nodes.map(node => ({ attributes: [...node.attributes], style: { ...node.style } }));
  const frame = (timestamp: number) => {
    assert.equal(frames.size, 1, 'renderer keeps one pending frame');
    const [id, callback] = frames.entries().next().value!;
    frames.delete(id);
    callback(timestamp);
  };
  const assertFiniteDrawing = () => {
    assert.ok(paths.every(path => path.attributes.get('d')?.startsWith('M')));
    assert.doesNotMatch(JSON.stringify(snapshot()), /NaN|Infinity/);
    for (const path of paths) {
      const offset = Number(path.style.strokeDashoffset);
      assert.ok(offset >= 0 && offset <= 1, `valid stroke reveal offset: ${offset}`);
    }
  };
  try { check({ motion, state, document, frames, frame, snapshot, assertFiniteDrawing }); }
  finally {
    for (const [key, descriptor] of prior) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
}

describe('exact geometry animation clock', () => {
  it('resumes from a static frame when RAF predates the resume handler', () => withZig(({ motion, state, frames, frame, assertFiniteDrawing }) => {
    state.off = true;
    motion.startZig();
    assert.equal(frames.size, 0);
    state.wallTime = 200.5;
    state.off = false;
    motion.syncZig();
    // The old clock rebased its origin to 200.5, producing a negative shape
    // index for this legitimate RAF timestamp and throwing before scheduling.
    frame(200);
    assertFiniteDrawing();
    frame(216);
    assertFiniteDrawing();
    assert.equal(frames.size, 1);
  }));

  it('excludes a hidden-tab pause without resetting the animation phase', () => {
    let uninterrupted: unknown;
    withZig(({ motion, frame, snapshot }) => {
      motion.startZig();
      [100, 1500, 3000, 3000, 3100].forEach(frame);
      uninterrupted = snapshot();
    });
    withZig(({ motion, state, document, frames, frame, snapshot }) => {
      motion.startZig();
      [100, 1500, 3000].forEach(frame);
      state.wallTime = 3000.5;
      document.hidden = true;
      motion.syncZig();
      assert.equal(frames.size, 0);
      state.wallTime = 100000.5;
      document.hidden = false;
      motion.syncZig();
      [100000, 100100].forEach(frame);
      assert.deepEqual(snapshot(), uninterrupted);
    });
  });

  it('keeps valid geometry and schedules frames after backward or invalid timestamps', () => withZig(({ motion, frame, frames, assertFiniteDrawing }) => {
    motion.startZig();
    for (const timestamp of [100, 90, NaN, Infinity, 116, 1400, 7600, 12000, 24000]) {
      frame(timestamp);
      assertFiniteDrawing();
      assert.equal(frames.size, 1);
    }
  }));
});
