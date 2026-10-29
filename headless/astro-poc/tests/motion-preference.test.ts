import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import { describe, it } from 'node:test';
import { parseHTML } from 'linkedom';

const STORAGE_KEY = 'noam-accessibility-v1';
const sources = [
  ['Astro accessibility menu', new URL('../public/noam-accessibility.js', import.meta.url), true],
  ['legacy worksheet accessibility menu', new URL('../../../noam-accessibility.js', import.meta.url), false],
] as const;
const preferenceSource = readFileSync(new URL('../src/lib/motionPreference.js', import.meta.url), 'utf8');

/** Runs the shipped menu, including its real click listeners and persistence. */
function menuFixture(source: URL, options: { reduced?: boolean; stored?: Record<string, unknown> } = {}) {
  const { document, window: dom } = parseHTML('<!doctype html><html><head></head><body></body></html>');
  let reduced = options.reduced ?? true;
  const changes = new Set<() => void>();
  const store = new Map<string, string>();
  if (options.stored) store.set(STORAGE_KEY, JSON.stringify(options.stored));
  const media = {
    get matches() { return reduced; },
    addEventListener(type: string, listener: () => void) { if (type === 'change') changes.add(listener); },
  };
  const frames = new Map<number, (time: number) => void>();
  let frameId = 0;
  const motionEvents: boolean[] = [];
  const window = {
    matchMedia: (query: string) => query.includes('prefers-reduced-motion') ? media : { matches: true, addEventListener() {} },
    requestAnimationFrame(callback: (time: number) => void) { frames.set(++frameId, callback); return frameId; },
    cancelAnimationFrame(id: number) { frames.delete(id); },
    addEventListener() {},
    dispatchEvent(event: any) { if (event.type === 'nd:motion-off') motionEvents.push(event.detail.off); return true; },
    setTimeout() { return 0; },
    clearTimeout() {},
    innerWidth: 390,
    innerHeight: 844,
  };
  const scope = {
    document, window,
    localStorage: { getItem: (key: string) => store.get(key) ?? null, setItem: (key: string, value: string) => store.set(key, value) },
    CustomEvent: dom.CustomEvent,
    MutationObserver: class { observe() {} disconnect() {} },
    requestAnimationFrame: (callback: (time: number) => void) => window.requestAnimationFrame(callback),
    cancelAnimationFrame: (id: number) => window.cancelAnimationFrame(id),
  };
  runInNewContext(readFileSync(source, 'utf8'), scope, { filename: fileURLToPath(source), timeout: 1000 });
  const root = document.getElementById('noam-accessibility')!.shadowRoot!;
  const control = (selector: string) => {
    const element = root.querySelector(selector);
    assert.ok(element, `Missing actual menu control: ${selector}`);
    return element;
  };
  return {
    document, window, frames, motionEvents,
    click(selector: string) { control(selector).dispatchEvent(new dom.Event('click', { bubbles: true })); },
    pressed(selector: string) { return control(selector).getAttribute('aria-pressed'); },
    enabled() { return document.documentElement.classList.contains('nd-motion-enabled'); },
    reduced() { return document.documentElement.classList.contains('noam-a11y-motion'); },
    stopped() { return document.documentElement.classList.contains('nd-motion-off'); },
    stored() { return JSON.parse(store.get(STORAGE_KEY) ?? '{}') as Record<string, unknown>; },
    deviceReduced(value: boolean) { reduced = value; changes.forEach(listener => listener()); },
  };
}

for (const [label, source, hasStopControl] of sources) describe(label, () => {
  it('plays animations by default even when the device (Safari/macOS) requests reduced motion', () => {
    const f = menuFixture(source);
    assert.equal(f.pressed('[data-pref="motion"]'), 'false');
    assert.equal(f.reduced(), false);
    assert.equal(f.enabled(), true, 'the default must release CSS rules that honor the OS setting');
    assert.deepEqual(f.stored(), {}, 'the default is not saved as a visitor choice');
    assert.equal(f.motionEvents.at(-1), false);
    f.deviceReduced(false);
    assert.equal(f.reduced(), false);
    assert.equal(f.enabled(), true);
    f.deviceReduced(true);
    assert.equal(f.reduced(), false);
    assert.equal(f.enabled(), true);
  });

  it('persists an explicit reduced-motion choice and restores it after reloading', () => {
    const f = menuFixture(source, { reduced: false });
    f.click('[data-pref="motion"]');
    assert.equal(f.pressed('[data-pref="motion"]'), 'true');
    assert.equal(f.stored().motion, true);
    assert.equal(f.stored().motionChosen, true);
    assert.equal(f.enabled(), false);
    assert.equal(f.reduced(), true);
    assert.equal(f.motionEvents.at(-1), true);
    const reload = menuFixture(source, { reduced: false, stored: f.stored() });
    assert.equal(reload.pressed('[data-pref="motion"]'), 'true');
    assert.equal(reload.enabled(), false);
    assert.equal(reload.reduced(), true);
  });

  it('does not turn contrast, links, text size, or a legacy saved false into a motion choice', () => {
    const f = menuFixture(source, { stored: { text: 100, motion: false, contrast: false } });
    for (const selector of ['[data-pref="contrast"]', '[data-pref="links"]', '#increase']) f.click(selector);
    assert.equal(f.stored().text, 110);
    assert.equal(f.stored().contrast, true);
    assert.equal(f.stored().links, true);
    assert.notEqual(f.stored().motionChosen, true);
    assert.equal(f.enabled(), true);
    assert.equal(f.pressed('[data-pref="motion"]'), 'false');
    const reload = menuFixture(source, { stored: f.stored() });
    assert.equal(reload.enabled(), true);
    assert.equal(reload.reduced(), false);
  });

  it('resets an explicit choice back to playing animations, including after another reload', () => {
    const f = menuFixture(source);
    f.click('[data-pref="motion"]');
    if (hasStopControl) f.click('#stop-anim');
    f.click('#reset');
    assert.equal(f.pressed('[data-pref="motion"]'), 'false');
    assert.equal(f.enabled(), true);
    assert.equal(f.stopped(), false);
    assert.notEqual(f.stored().motionChosen, true);
    assert.equal(menuFixture(source, { stored: f.stored() }).reduced(), false);
  });

  if (hasStopControl) it('gives stop-animations priority over playing motion and resumes when released', () => {
    const f = menuFixture(source);
    f.click('#stop-anim');
    assert.equal(f.enabled(), false);
    assert.equal(f.stopped(), true);
    assert.equal(f.reduced(), true);
    assert.equal(f.pressed('#stop-anim'), 'true');
    assert.equal(f.motionEvents.at(-1), true);
    let callbacks = 0;
    f.window.requestAnimationFrame(() => callbacks++);
    for (const [id, callback] of [...f.frames]) { f.frames.delete(id); callback(100); }
    assert.equal(callbacks, 0, 'stop-animations must actually hold RAF callbacks');
    const reload = menuFixture(source, { stored: f.stored() });
    assert.equal(reload.stopped(), true);
    assert.equal(reload.enabled(), false);
    f.click('#stop-anim');
    assert.equal(f.stopped(), false);
    assert.equal(f.enabled(), true);
    assert.equal(f.reduced(), false);
    for (const [id, callback] of [...f.frames]) { f.frames.delete(id); callback(200); }
    assert.equal(callbacks, 1, 'resuming must release the held callback once');
  });

  it('keeps a saved stop choice across other preference edits and the other menu', () => {
    const f = menuFixture(source, { reduced: false, stored: { motion: false, motionChosen: true, stopAnim: true } });
    assert.equal(f.stopped(), true);
    assert.equal(f.reduced(), true);
    assert.equal(f.enabled(), false, 'saved stop outranks an explicit full-motion choice');
    assert.equal(f.motionEvents.at(-1), true);
    for (const selector of ['[data-pref="contrast"]', '#increase']) {
      f.click(selector);
      assert.equal(f.stored().stopAnim, true, 'unrelated edits must not erase the shared stop preference');
      assert.equal(f.stored().motionChosen, true);
      assert.equal(f.enabled(), false);
      assert.equal(f.motionEvents.at(-1), true);
    }
    const otherSource = sources.find(([, candidate]) => candidate.href !== source.href)![1];
    const otherMenu = menuFixture(otherSource, { reduced: false, stored: f.stored() });
    assert.equal(otherMenu.stopped(), true, 'the stop choice survives navigation between Astro and worksheet menus');
    assert.equal(otherMenu.reduced(), true);
    assert.equal(otherMenu.enabled(), false);
    otherMenu.click('#reset');
    assert.equal(otherMenu.stopped(), false);
    assert.equal(otherMenu.reduced(), false);
    assert.notEqual(otherMenu.stored().stopAnim, true);
  });

  it('preserves both explicit off and explicit on choices when the OS setting changes', () => {
    const f = menuFixture(source);
    f.click('[data-pref="motion"]');
    for (const reduced of [false, true]) {
      f.deviceReduced(reduced);
      assert.equal(f.enabled(), false);
      assert.equal(f.reduced(), true);
      assert.equal(f.pressed('[data-pref="motion"]'), 'true');
    }
    f.click('[data-pref="motion"]');
    for (const reduced of [false, true]) {
      f.deviceReduced(reduced);
      assert.equal(f.enabled(), true);
      assert.equal(f.reduced(), false);
    }
    const legacy = menuFixture(source, { reduced: false, stored: { motion: true } });
    assert.equal(legacy.reduced(), true, 'a legacy affirmative reduction remains an explicit choice');
  });
});

function preferenceFixture(reduced: boolean) {
  const { document } = parseHTML('<html><body></body></html>');
  const window = { matchMedia: () => ({ matches: reduced }) };
  const readPreference = runInNewContext(
    preferenceSource.replace(/^export /gm, '') + '\nsitePrefersReducedMotion;',
    { document, window },
    { filename: 'motionPreference.js', timeout: 1000 },
  ) as () => boolean;
  return { html: document.documentElement, readPreference };
}

describe('shared motion preference used by animation engines', () => {
  it('ignores the OS setting until the site has an explicit choice (Safari reports macOS Reduce motion)', () => {
    assert.equal(preferenceFixture(true).readPreference(), false);
    assert.equal(preferenceFixture(false).readPreference(), false);
  });

  it('allows a site opt-in under reduced motion and supports the established motion levels', () => {
    const f = preferenceFixture(true);
    f.html.classList.add('nd-motion-enabled');
    assert.equal(f.readPreference(), false);
    f.html.classList.remove('nd-motion-enabled');
    for (const mode of ['full', 'relaxed', 'calm']) {
      f.html.dataset.ndMotion = mode;
      assert.equal(f.readPreference(), false);
    }
  });

  it('gives each explicit stop mechanism priority over an opt-in and a full motion level', () => {
    for (const stopClass of ['nd-motion-off', 'noam-a11y-motion']) {
      const f = preferenceFixture(false);
      f.html.classList.add('nd-motion-enabled', stopClass);
      f.html.dataset.ndMotion = 'full';
      assert.equal(f.readPreference(), true);
    }
    const f = preferenceFixture(false);
    f.html.classList.add('nd-motion-enabled');
    f.html.dataset.ndMotion = 'off';
    assert.equal(f.readPreference(), true);
  });
});
